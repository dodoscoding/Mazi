"""Completed-file export behavior at the store and inherited HTTP boundaries."""
import io
import hashlib
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch
import json
import os
import tempfile
import unittest
import zipfile

from mazi.capacity import CapacityExceeded
from mazi.memories.memories import MemoryStore
from mazi.server import handler_for
from tests.backend.imports import test_engine as helpers


class ObservedFile:
    def __init__(self, stream):
        self.stream = stream
        self.high_water = 0

    def __getattr__(self, name):
        return getattr(self.stream, name)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

    def close(self):
        self.stream.close()

    def write(self, data):
        written = self.stream.write(data)
        self.high_water = max(self.high_water, self.stream.tell())
        return written


@contextmanager
def observe_artifacts(kind=ObservedFile):
    temporary_file = tempfile.TemporaryFile
    files = []
    def create(*args, **kwargs):
        stream = kind(temporary_file(*args, **kwargs))
        files.append(stream)
        return stream
    with patch('mazi.archive.review.tempfile.TemporaryFile', create):
        yield files


class ExportFileTests(unittest.TestCase):
    submit = helpers.EngineTests.submit
    process = helpers.EngineTests.process

    def setUp(self):
        helpers.EngineTests.setUp(self)
        self.store.close()
        self.store = MemoryStore(self.temp.name)
        self.run = self.submit()
        self.process(self.run)
        self.asset = self.store.gallery(self.ben, self.group)[0]['id']

    def tearDown(self):
        helpers.EngineTests.tearDown(self)

    def test_completed_private_file_is_readable_and_closed_after_use(self):
        with self.store.export_archive_file(self.ben, self.group) as artifact:
            self.assertEqual(artifact.tell(), 0)
            self.assertEqual(os.fstat(artifact.fileno()).st_mode & 0o777, 0o600)
            self.assertFalse(self.store.db.in_transaction)
            with zipfile.ZipFile(artifact) as archive:
                self.assertIsNone(archive.testzip())
                self.assertEqual(archive.read('originals/' + self.asset), helpers.picture())
                self.assertEqual(json.loads(archive.read('manifest.json'))['group'], self.group)
                self.assertEqual(archive.namelist(), ['originals/' + self.asset, 'manifest.json',
                    'resources.json', 'places.json', 'people.json', 'personal-discovery.json'])
        self.assertTrue(artifact.closed)

    def retained_resource(self, data=b'synthetic retained movie'):
        connection = self.store.create_source(self.alice, self.group, 'apple', 'Synthetic library',
            {'start': '2020-01-01', 'end': '2030-01-01', 'albums': [], 'types': ['video']})
        self.store.set_source(self.alice, connection, True, 'authorized')
        metadata = dict(item='live', component='pairedVideo', version='v1', filename='live.mov',
                        date='2024-01-01', kind='video', albums=[])
        resource = self.store.begin_resource(self.alice, connection, metadata, len(data), hashlib.sha256(data).hexdigest())
        for start in range(0, len(data), 256 * 1024):
            self.store.resource_chunk(self.alice, resource['id'], start, data[start:start + 256 * 1024])
        self.store.finish_resource(self.alice, resource['id'])
        return resource['id']

    def test_originals_and_resources_are_copied_in_chunks_without_whole_object_reads(self):
        data = b'opaque video bytes' * 40000
        resource = self.retained_resource(data)
        materialize = self.store.objects.materialize
        reads, objects = [], []
        test = self
        class BoundedPath:
            def __init__(self, path):
                self.path = path
            def stat(self):
                return self.path.stat()
            @contextmanager
            def open(self, mode):
                with self.path.open(mode) as stream:
                    class Reader:
                        def fileno(self):
                            return stream.fileno()
                        def read(self, size=-1):
                            test.assertGreater(size, 0)
                            test.assertLessEqual(size, 256 * 1024)
                            reads.append(size)
                            return stream.read(size)
                    yield Reader()
        @contextmanager
        def observe(area, key):
            self.assertFalse(self.store.db.in_transaction)
            objects.append((area, key))
            with materialize(area, key) as path:
                yield BoundedPath(path)
        with patch.object(self.store.objects, 'materialize', observe), \
             patch.object(self.store.objects, 'read', side_effect=AssertionError('whole object read')), \
             patch.object(Path, 'read_bytes', side_effect=AssertionError('whole path read')):
            with self.store.export_archive_file(self.ben, self.group) as artifact:
                with zipfile.ZipFile(artifact) as archive:
                    self.assertEqual(archive.read('originals/' + self.asset), helpers.picture())
                    self.assertEqual(archive.read('resources/' + resource), data)
                    self.assertIsNone(archive.testzip())
        self.assertEqual(len(objects), 2)
        self.assertGreater(len(reads), 4)

    def http_export(self, sink=None, configure=None):
        self.store.setup_shared(admin_name='Alice', group_id=self.group,
                                mappings={'Alice': self.alice, 'Ben': self.ben})
        handler = object.__new__(handler_for(self.store))
        handler.path = '/api/review/export?group=' + self.group
        handler.user = lambda: self.ben
        handler.wfile = sink if sink is not None else io.BytesIO()
        handler.close_connection = False
        statuses, headers = [], {}
        handler.send_response = statuses.append
        handler.send_header = lambda key, value: headers.update({key: value})
        handler.end_headers = lambda: None
        if configure:
            configure(handler)
        handler.do_GET()
        return handler, statuses, headers

    def test_http_uses_completed_file_with_exact_headers_and_bounded_writes(self):
        data = b'opaque video bytes' * 40000
        resource = self.retained_resource(data)
        writes = []
        class Sink(io.BytesIO):
            def write(self, chunk):
                writes.append(len(chunk))
                return super().write(chunk)
        with patch.object(self.store, 'export_archive', side_effect=AssertionError('bytes wrapper')):
            handler, statuses, headers = self.http_export(Sink())
        body = handler.wfile.getvalue()
        self.assertEqual(statuses, [200])
        self.assertEqual(headers['Content-Type'], 'application/zip')
        self.assertEqual(int(headers['Content-Length']), len(body))
        self.assertEqual(headers['Cache-Control'], 'no-store')
        self.assertEqual(headers['X-Content-Type-Options'], 'nosniff')
        self.assertIn("frame-ancestors 'none'", headers['Content-Security-Policy'])
        self.assertLessEqual(max(writes), 256 * 1024)
        self.assertGreater(len(writes), 2)
        with zipfile.ZipFile(io.BytesIO(body)) as archive:
            self.assertEqual(archive.read('resources/' + resource), data)
            self.assertIsNone(archive.testzip())

    def test_exact_zip_limit_succeeds_and_one_extra_directory_byte_is_rejected_before_write(self):
        with self.store.export_archive_file(self.ben, self.group) as artifact:
            size = artifact.seek(0, 2)
        with patch('mazi.archive.review.EXPORT_BYTES', size), observe_artifacts() as files:
            with self.store.export_archive_file(self.ben, self.group) as artifact:
                with zipfile.ZipFile(artifact) as archive:
                    self.assertEqual(archive.read('originals/' + self.asset), helpers.picture())
                    self.assertIsNone(archive.testzip())
            self.assertEqual(files[0].high_water, size)
        with patch('mazi.archive.review.EXPORT_BYTES', size - 1), observe_artifacts() as files:
            with self.assertRaises(CapacityExceeded):
                with self.store.export_archive_file(self.ben, self.group):
                    self.fail('Incomplete artifact exposed')
            self.assertTrue(files[0].closed)
            self.assertLessEqual(files[0].high_water, size - 1)

    def test_initial_read_error_survives_temporary_file_cleanup_failure(self):
        class CloseFailure(ObservedFile):
            def close(self):
                super().close()
                raise OSError('cleanup failure')
        with observe_artifacts(CloseFailure) as files, \
             patch.object(self.store.objects, 'materialize', side_effect=OSError('original unavailable')):
            with self.assertRaisesRegex(OSError, '^original unavailable$'):
                with self.store.export_archive_file(self.ben, self.group):
                    self.fail('Failed export exposed')
            self.assertTrue(files[0].closed)

    def test_http_disconnect_closes_artifact_without_a_second_response(self):
        self.retained_resource(b'opaque video bytes' * 40000)
        class Disconnect(io.BytesIO):
            calls = 0
            def write(self, chunk):
                self.calls += 1
                if self.calls > 1:
                    raise BrokenPipeError('client disconnected')
                return super().write(chunk)
        with observe_artifacts() as files:
            handler, statuses, headers = self.http_export(Disconnect())
        self.assertEqual(statuses, [200])
        self.assertEqual(len(handler.wfile.getvalue()), 256 * 1024)
        self.assertGreater(int(headers['Content-Length']), len(handler.wfile.getvalue()))
        self.assertNotIn(b'{"error"', handler.wfile.getvalue())
        self.assertTrue(handler.close_connection)
        self.assertTrue(files[0].closed)

    def test_http_short_socket_write_closes_connection_and_artifact(self):
        class ShortWrite(io.BytesIO):
            def write(self, chunk):
                return super().write(chunk[:5])
        with observe_artifacts() as files:
            handler, statuses, _ = self.http_export(ShortWrite())
        self.assertEqual(statuses, [200])
        self.assertEqual(handler.wfile.getvalue(), b'PK\x03\x04\x14')
        self.assertTrue(handler.close_connection)
        self.assertTrue(files[0].closed)

    def test_http_file_read_failure_and_premature_eof_never_append_json(self):
        for result in (OSError('disk read failed'), b''):
            with self.subTest(result=result):
                class ReadFailure(ObservedFile):
                    def read(self, size=-1):
                        if isinstance(result, Exception):
                            raise result
                        return result
                with observe_artifacts(ReadFailure) as files:
                    handler, statuses, headers = self.http_export()
                self.assertEqual(statuses, [200])
                self.assertEqual(handler.wfile.getvalue(), b'')
                self.assertGreater(int(headers['Content-Length']), 0)
                self.assertTrue(handler.close_connection)
                self.assertTrue(files[0].closed)

    def test_http_close_failure_after_delivery_never_starts_json_response(self):
        class CloseFailure(ObservedFile):
            def close(self):
                super().close()
                raise OSError('close failed')
        with observe_artifacts(CloseFailure) as files:
            handler, statuses, headers = self.http_export()
        body = handler.wfile.getvalue()
        self.assertEqual(statuses, [200])
        self.assertEqual(len(body), int(headers['Content-Length']))
        self.assertTrue(handler.close_connection)
        self.assertTrue(files[0].closed)
        with zipfile.ZipFile(io.BytesIO(body)) as archive:
            self.assertIsNone(archive.testzip())

    def test_disk_full_and_short_file_write_return_only_preheader_json(self):
        for short in (False, True):
            with self.subTest(short=short):
                class WriteFailure(ObservedFile):
                    def write(self, data):
                        if short:
                            return super().write(data[:-1])
                        raise OSError('disk full')
                with observe_artifacts(WriteFailure) as files:
                    handler, statuses, headers = self.http_export()
                self.assertEqual(statuses, [503])
                self.assertEqual(headers['Content-Type'], 'application/json')
                self.assertEqual(json.loads(handler.wfile.getvalue()), {'error': 'Stored file unavailable; retry later'})
                self.assertTrue(files[0].closed)

    def test_zip_close_failure_is_preheader_and_closes_private_file(self):
        real_zip = zipfile.ZipFile
        class CloseFailure(real_zip):
            def close(self):
                was_open = self.fp is not None
                super().close()
                if was_open:
                    raise OSError('ZIP directory unavailable')
        with observe_artifacts() as files, patch('mazi.archive.review.zipfile.ZipFile', CloseFailure):
            handler, statuses, headers = self.http_export()
        self.assertEqual(statuses, [503])
        self.assertEqual(headers['Content-Type'], 'application/json')
        self.assertNotIn(b'PK\x03\x04', handler.wfile.getvalue())
        self.assertTrue(files[0].closed)

    def test_admission_and_consumer_errors_close_private_file_and_keep_first_error(self):
        from mazi.identity.core import Conflict, Denied
        build = self.store._build_export_archive
        def hide_after_build(*args, **kwargs):
            result = build(*args, **kwargs)
            self.store.hide(self.ben, self.asset, True)
            return result
        class CloseFailure(ObservedFile):
            def close(self):
                super().close()
                raise OSError('cleanup failure')
        with observe_artifacts(CloseFailure) as files, patch.object(self.store, '_build_export_archive', hide_after_build):
            with self.assertRaisesRegex(Conflict, '^Archive changed while preparing export; retry$'):
                with self.store.export_archive_file(self.ben, self.group):
                    self.fail('Unadmitted file exposed')
        self.assertTrue(files[0].closed)
        self.store.hide(self.ben, self.asset, False)
        with observe_artifacts(CloseFailure) as files:
            with self.assertRaisesRegex(Denied, '^consumer stopped$'):
                with self.store.export_archive_file(self.ben, self.group):
                    raise Denied('consumer stopped')
        self.assertTrue(files[0].closed)

    def test_header_failure_closes_file_without_a_second_response(self):
        def configure(handler):
            send_response = handler.send_response
            def fail(status):
                send_response(status)
                raise OSError('headers failed')
            handler.send_response = fail
        with observe_artifacts() as files:
            handler, statuses, _ = self.http_export(configure=configure)
        self.assertEqual(statuses, [200])
        self.assertEqual(handler.wfile.getvalue(), b'')
        self.assertTrue(handler.close_connection)
        self.assertTrue(files[0].closed)

    def test_original_copy_uses_original_length_when_stored_size_includes_preview(self):
        original = self.store.asset_bytes(self.ben, self.asset, original=True)
        preview = self.store.asset_bytes(self.ben, self.asset)
        self.assertEqual(self.store.group_metrics(self.alice, self.group)['stored_original_bytes'], len(original) + len(preview))
        with self.store.export_archive_file(self.ben, self.group) as artifact:
            with zipfile.ZipFile(artifact) as archive:
                self.assertEqual(archive.getinfo('originals/' + self.asset).file_size, len(original))
                self.assertEqual(archive.read('originals/' + self.asset), original)

    def hosted_objects(self, resource_data):
        from mazi.storage import HostedObjects, STORAGE_SCHEMA
        from tests.backend.test_storage import Remote
        resource = self.retained_resource(resource_data)
        local = self.store.objects
        self.store.db.executescript(STORAGE_SCHEMA)
        remote = Remote()
        hosted = HostedObjects(self.store.db, 'https://test.supabase.co', 'sb_secret_test', 'mazi-private', remote)
        _, area, key = self.store._asset_locator(self.ben, self.asset, original=True)
        with self.store.transaction():
            hosted.retain(area, key, local.read(area, key))
            hosted.retain('source-resources', resource, resource_data)
        self.store.objects = hosted
        return remote, resource

    def test_hosted_materialization_preserves_receipts_checksums_and_private_cleanup(self):
        data = b'opaque video bytes' * 300000
        remote, resource = self.hosted_objects(data)
        materialize = self.store.objects.materialize
        paths, downloads = [], []
        get = remote.get
        def observe_get(key):
            self.assertFalse(self.store.db.in_transaction)
            value = get(key)
            downloads.append(len(value))
            return value
        @contextmanager
        def observe_materialize(area, key):
            self.assertFalse(self.store.db.in_transaction)
            with materialize(area, key) as path:
                paths.append(path)
                self.assertEqual(path.stat().st_mode & 0o777, 0o600)
                self.assertEqual(path.parent.stat().st_mode & 0o777, 0o700)
                yield path
        with patch.object(remote, 'get', observe_get), \
             patch.object(self.store.objects, 'materialize', observe_materialize), \
             patch.object(self.store.objects, 'read', side_effect=AssertionError('whole hosted object read')):
            with self.store.export_archive_file(self.ben, self.group) as artifact:
                with zipfile.ZipFile(artifact) as archive:
                    self.assertEqual(archive.read('resources/' + resource), data)
                    self.assertEqual(archive.read('originals/' + self.asset), helpers.picture())
                    self.assertIsNone(archive.testzip())
        self.assertEqual(len(paths), 2)
        self.assertTrue(all(not path.exists() and not path.parent.exists() for path in paths))
        self.assertEqual(sum(downloads), len(data) + len(helpers.picture()))
        self.assertLessEqual(max(downloads), 4 * 1024 * 1024)

    def test_corrupt_hosted_chunk_fails_before_headers_and_removes_materialized_file(self):
        remote, _ = self.hosted_objects(b'opaque video bytes')
        remote.data[next(iter(remote.data))] = b'corrupt'
        temporary_directory = tempfile.TemporaryDirectory
        directories = []
        def observe_directory(*args, **kwargs):
            directory = temporary_directory(*args, **kwargs)
            directories.append(Path(directory.name))
            return directory
        with observe_artifacts() as files, patch('mazi.storage.tempfile.TemporaryDirectory', observe_directory):
            handler, statuses, headers = self.http_export()
        self.assertEqual(statuses, [503])
        self.assertEqual(headers['Content-Type'], 'application/json')
        self.assertNotIn(b'PK\x03\x04', handler.wfile.getvalue())
        self.assertTrue(files[0].closed)
        self.assertTrue(directories)
        self.assertTrue(all(not directory.exists() for directory in directories))

    def test_all_store_layers_preserve_member_scope_and_bytes_wrapper_compatibility(self):
        from mazi.archive.review import ReviewStore
        from mazi.sources.sources import SourceStore
        from mazi.discovery.discovery import DiscoveryStore
        resource_data = b'opaque video bytes'
        resource = self.retained_resource(resource_data)
        origin = self.store.owned_origins(self.alice, self.group)[0]['id']
        self.store.set_place(self.alice, origin, 'NL', 'Amsterdam', 52.37, 4.9, '2024-01-01')
        self.store.correct_asset(self.alice, self.asset, title='A title', capture_date=None, place='')
        person = self.store.create_person(self.alice, self.group, 'A friend')
        self.store.tag(self.alice, person, self.asset, True)
        base = ['originals/' + self.asset, 'manifest.json']
        sources = ['resources/' + resource, 'resources.json', 'places.json']
        discovery = ['people.json', 'personal-discovery.json']
        for kind, expected in ((ReviewStore, base), (SourceStore, base + sources),
                               (DiscoveryStore, base + sources + discovery), (MemoryStore, base + sources + discovery)):
            with self.subTest(store=kind.__name__):
                store = kind(self.temp.name)
                try:
                    with store.export_archive_file(self.ben, self.group) as artifact:
                        with zipfile.ZipFile(artifact) as archive:
                            self.assertEqual(archive.namelist(), expected)
                            contents = {name: archive.read(name) for name in expected}
                            self.assertEqual(contents['originals/' + self.asset], helpers.picture())
                            self.assertEqual(json.loads(contents['manifest.json'])['assets'][0]['annotation']['title'], 'A title')
                            self.assertIsNone(archive.testzip())
                    with zipfile.ZipFile(io.BytesIO(store.export_archive(self.ben, self.group))) as archive:
                        self.assertEqual({name: archive.read(name) for name in archive.namelist()}, contents)
                    if 'resources.json' in contents:
                        self.assertEqual(contents['resources/' + resource], resource_data)
                        self.assertEqual(json.loads(contents['places.json'])[0]['origin'], origin)
                    if 'people.json' in contents:
                        self.assertEqual(json.loads(contents['people.json'])[0]['id'], person)
                finally:
                    store.close()

    def test_payload_metadata_and_directory_exhaustion_never_extend_past_limit_or_send_zip(self):
        resource = self.retained_resource(b'opaque video bytes' * 40000)
        with self.store.export_archive_file(self.ben, self.group) as artifact:
            with zipfile.ZipFile(artifact) as archive:
                limits = []
                for name in ('manifest.json', 'resources/' + resource):
                    entry = archive.getinfo(name)
                    start = entry.header_offset + 30 + len(name.encode('utf-8'))
                    limits.append((name, start + entry.file_size - 1, start))
                limits.append(('central directory', archive.start_dir + 5, archive.start_dir))
        for name, limit, start in limits:
            with self.subTest(boundary=name), patch('mazi.archive.review.EXPORT_BYTES', limit), observe_artifacts() as files:
                handler, statuses, headers = self.http_export()
                self.assertEqual(statuses, [400])
                self.assertEqual(headers['Content-Type'], 'application/json')
                self.assertEqual(json.loads(handler.wfile.getvalue())['code'], 'capacity_exceeded')
                self.assertTrue(files[0].closed)
                self.assertLessEqual(files[0].high_water, limit)
                self.assertGreaterEqual(files[0].high_water, start)

    def test_empty_archive_is_complete_in_each_store_layer(self):
        from mazi.archive.review import ReviewStore
        from mazi.sources.sources import SourceStore
        from mazi.discovery.discovery import DiscoveryStore
        self.store.withdraw(self.alice, self.run)
        for kind in (ReviewStore, SourceStore, DiscoveryStore, MemoryStore):
            with self.subTest(store=kind.__name__):
                store = kind(self.temp.name)
                try:
                    with store.export_archive_file(self.ben, self.group) as artifact:
                        with zipfile.ZipFile(artifact) as archive:
                            self.assertEqual(json.loads(archive.read('manifest.json')), {'group': self.group, 'assets': []})
                            self.assertFalse(any(name.startswith('originals/') for name in archive.namelist()))
                            self.assertIsNone(archive.testzip())
                finally:
                    store.close()

    def test_loopback_http_streams_complete_multichunk_zip_and_closes_file(self):
        import http.client
        import threading
        from http.server import HTTPServer
        data = b'opaque video bytes' * 40000
        resource = self.retained_resource(data)
        code = self.store.setup_shared(admin_name='Alice', group_id=self.group,
                                       mappings={'Alice': self.alice, 'Ben': self.ben})
        _, token = self.store.enter_shared(code=code, name='Ben')
        server = HTTPServer(('127.0.0.1', 0), handler_for(self.store))
        server.timeout = 5
        worker = threading.Thread(target=server.handle_request, daemon=True)
        connection = http.client.HTTPConnection('127.0.0.1', server.server_port, timeout=5)
        try:
            with observe_artifacts() as files:
                worker.start()
                connection.request('GET', '/api/review/export?group=' + self.group,
                                   headers={'Cookie': 'mazi_session=' + token})
                response = connection.getresponse()
                body = response.read()
                worker.join(5)
                self.assertFalse(worker.is_alive())
                self.assertEqual(response.status, 200)
                self.assertEqual(response.getheader('Content-Type'), 'application/zip')
                self.assertEqual(int(response.getheader('Content-Length')), len(body))
                self.assertGreater(len(body), 2 * 256 * 1024)
                self.assertTrue(files[0].closed)
            with zipfile.ZipFile(io.BytesIO(body)) as archive:
                self.assertIsNone(archive.testzip())
                self.assertEqual(archive.read('resources/' + resource), data)
                self.assertEqual(archive.read('originals/' + self.asset), helpers.picture())
        finally:
            connection.close()
            worker.join(5)
            server.server_close()

    def test_zip_rewrites_relative_and_end_seeks_do_not_spend_quota_twice(self):
        with self.store.export_archive_file(self.ben, self.group) as artifact:
            size = artifact.seek(0, 2)
        real_zip = zipfile.ZipFile
        class SeekingZip(real_zip):
            def close(self):
                if self.fp is not None and self.mode == 'w':
                    end = self.fp.tell()
                    self.fp.seek(-7, 1)
                    self.fp.seek(3, 1)
                    self.fp.seek(-4, 2)
                    self.fp.seek(4, 1)
                    if self.fp.tell() != end:
                        raise AssertionError('ZIP position drifted')
                return super().close()
        with patch('mazi.archive.review.EXPORT_BYTES', size), patch('mazi.archive.review.zipfile.ZipFile', SeekingZip):
            with self.store.export_archive_file(self.ben, self.group) as artifact:
                with real_zip(artifact) as archive:
                    self.assertEqual(archive.read('originals/' + self.asset), helpers.picture())
                    self.assertIsNone(archive.testzip())
                self.assertEqual(artifact.seek(0, 2), size)

    def test_large_legal_json_string_keeps_exact_metadata_with_bounded_writes(self):
        name = 'Synthetic participant ' + 'x' * (512 * 1024)
        metadata = {'title': 'Large legal conversation', 'participants': [{'name': name}],
                    'messages': [{'sender_name': 'Alice', 'timestamp_ms': 1577836800000,
                                  'photos': [{'uri': 'photo.jpg'}]}]}
        run = self.submit({'message_1.json': json.dumps(metadata), 'photo.jpg': helpers.picture()}, source='messenger')
        self.process(run)
        writes = []
        class BoundedFile(ObservedFile):
            def write(self, data):
                if len(data) > 256 * 1024:
                    raise AssertionError('Unbounded metadata write')
                writes.append(len(data))
                return super().write(data)
        with observe_artifacts(BoundedFile):
            with self.store.export_archive_file(self.ben, self.group) as artifact:
                with zipfile.ZipFile(artifact) as archive:
                    origins = json.loads(archive.read('manifest.json'))['assets'][0]['origins']
                    imported = next(origin for origin in origins if origin['source_type'] == 'messenger')
                    self.assertEqual(imported['conversation']['participants'], [{'name': name}])
                    self.assertIsNone(archive.testzip())
        self.assertEqual(max(writes), 256 * 1024)

    def test_short_and_failed_metadata_flush_close_file_before_headers(self):
        for short in (False, True):
            with self.subTest(short=short):
                class FlushFailure(ObservedFile):
                    def write(self, data):
                        if len(data) > 1024:
                            if short:
                                return super().write(data[:-1])
                            raise OSError('metadata flush failed')
                        return super().write(data)
                with observe_artifacts(FlushFailure) as files:
                    handler, statuses, headers = self.http_export()
                self.assertEqual(statuses, [503])
                self.assertEqual(headers['Content-Type'], 'application/json')
                self.assertNotIn(b'PK\x03\x04', handler.wfile.getvalue())
                self.assertTrue(files[0].closed)

    def test_premature_original_eof_is_rejected_and_partial_artifact_removed(self):
        materialize = self.store.objects.materialize
        class TruncatedPath:
            def __init__(self, path):
                self.path = path
            @contextmanager
            def open(self, mode):
                with self.path.open(mode) as stream:
                    class Reader:
                        def fileno(self):
                            return stream.fileno()
                        def read(self, size=-1):
                            return stream.read(16) if stream.tell() == 0 else b''
                    yield Reader()
        @contextmanager
        def truncate(area, key):
            with materialize(area, key) as path:
                yield TruncatedPath(path)
        with observe_artifacts() as files, patch.object(self.store.objects, 'materialize', truncate):
            handler, statuses, headers = self.http_export()
        self.assertEqual(statuses, [409])
        self.assertEqual(headers['Content-Type'], 'application/json')
        self.assertEqual(json.loads(handler.wfile.getvalue()), {'error': 'Stored original changed while preparing export; retry'})
        self.assertTrue(files[0].closed)
