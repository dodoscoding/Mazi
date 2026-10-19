"""Response admission for completed exports after real public policy changes."""
import io
import hashlib
import json
import unittest
import zipfile

from PIL import Image

from mazi.memories.memories import MemoryStore
from mazi.server import handler_for
from tests.backend.imports import test_engine as helpers


class ExportAdmissionTests(unittest.TestCase):
    submit = helpers.EngineTests.submit
    process = helpers.EngineTests.process

    def setUp(self):
        helpers.EngineTests.setUp(self)
        self.store.close()
        self.store = MemoryStore(self.temp.name)
        self.writer = MemoryStore(self.temp.name)
        self.addCleanup(self.writer.close)
        self.run = self.submit()
        self.process(self.run)
        self.asset = self.store.gallery(self.ben, self.group)[0]['id']
        self.code = self.store.setup_shared(admin_name='Alice', group_id=self.group, mappings={'Alice': self.alice, 'Ben': self.ben})

    def tearDown(self):
        helpers.EngineTests.tearDown(self)

    def http_export(self, change=None, user=None):
        # The agreed interleave seam is the last completed-build return, before
        # response admission. The mutation itself uses a second real connection.
        build = self.store._build_export_archive
        def interleave(*args, **kwargs):
            result = build(*args, **kwargs)
            if change:
                change()
            return result
        self.store._build_export_archive = interleave
        handler = object.__new__(handler_for(self.store))
        handler.path = '/api/review/export?group=' + self.group
        handler.user = lambda: user or self.ben
        handler.wfile = io.BytesIO()
        statuses, headers = [], {}
        handler.send_response = statuses.append
        handler.send_header = lambda key, value: headers.update({key: value})
        handler.end_headers = lambda: None
        try:
            handler.do_GET()
        finally:
            self.store._build_export_archive = build
        return statuses, headers, handler.wfile.getvalue()

    def test_hide_committed_after_build_returns_conflict_without_zip_bytes(self):
        statuses, headers, body = self.http_export(lambda: self.writer.hide(self.ben, self.asset, True))
        self.assertEqual(statuses, [409])
        self.assertEqual(headers['Content-Type'], 'application/json')
        self.assertEqual(json.loads(body), {'error': 'Archive changed while preparing export; retry'})
        self.assertNotIn(b'PK\x03\x04', body)
        self.assertEqual(self.store.gallery(self.ben, self.group), [])

    def test_withdrawn_origin_is_rejected_even_when_independent_copy_remains(self):
        copy = self.submit({'independent.jpg': helpers.picture()}, user=self.ben)
        self.process(copy, user=self.ben)
        self.assertEqual(len(self.store.gallery(self.ben, self.group)[0]['origins']), 2)
        statuses, headers, body = self.http_export(lambda: self.writer.withdraw(self.alice, self.run))
        self.assertEqual(statuses, [409])
        self.assertEqual(headers['Content-Type'], 'application/json')
        self.assertNotIn(b'PK\x03\x04', body)
        self.assertEqual(len(self.store.gallery(self.ben, self.group)[0]['origins']), 1)

    def retained_resource(self):
        connection = self.store.create_source(self.alice, self.group, 'apple', 'Synthetic library',
            {'start': '2020-01-01', 'end': '2030-01-01', 'albums': [], 'types': ['video']})
        self.store.set_source(self.alice, connection, True, 'authorized')
        data = b'synthetic retained original movie'
        metadata = dict(item='live', component='pairedVideo', version='v1', filename='live.mov',
                        date='2024-01-01', kind='video', albums=[])
        resource = self.store.begin_resource(self.alice, connection, metadata, len(data), hashlib.sha256(data).hexdigest())
        self.store.resource_chunk(self.alice, resource['id'], 0, data)
        self.store.finish_resource(self.alice, resource['id'])
        return resource['id'], data

    def test_retained_resource_withdrawal_after_build_returns_json_conflict(self):
        resource, _ = self.retained_resource()
        statuses, headers, body = self.http_export(lambda: self.writer.withdraw_resource(self.alice, resource))
        self.assertEqual(statuses, [409])
        self.assertEqual(headers['Content-Type'], 'application/json')
        self.assertNotIn(b'PK\x03\x04', body)

    def test_location_changed_after_build_returns_json_conflict(self):
        origin = self.store.owned_origins(self.alice, self.group)[0]['id']
        self.store.set_place(self.alice, origin, 'NL', 'Amsterdam', 52.37, 4.9, '2024-01-01')
        statuses, headers, body = self.http_export(
            lambda: self.writer.set_place(self.alice, origin, 'TR', 'Istanbul', 41, 29, None))
        self.assertEqual(statuses, [409])
        self.assertEqual(headers['Content-Type'], 'application/json')
        self.assertNotIn(b'PK\x03\x04', body)

    def tagged_person(self):
        person = self.store.create_person(self.alice, self.group, 'Ben')
        self.store.propose_identity(self.alice, person, self.ben)
        self.store.confirm_identity(self.ben, person)
        self.store.tag(self.alice, person, self.asset, True)
        return person

    def test_verified_subject_suppression_after_build_returns_json_conflict(self):
        person = self.tagged_person()
        statuses, headers, body = self.http_export(lambda: self.writer.disassociate(self.ben, person, self.asset))
        self.assertEqual(statuses, [409])
        self.assertEqual(headers['Content-Type'], 'application/json')
        self.assertNotIn(b'PK\x03\x04', body)
        self.assertEqual(self.store.people(self.ben, self.group), [])

    def assert_conflict(self, change, user=None):
        statuses, headers, body = self.http_export(change, user)
        self.assertEqual(statuses, [409])
        self.assertEqual(headers['Content-Type'], 'application/json')
        self.assertEqual(json.loads(body), {'error': 'Archive changed while preparing export; retry'})
        self.assertNotIn(b'PK\x03\x04', body)
        self.assertFalse(self.store.db.in_transaction)

    def test_last_origin_withdrawal_after_build_is_rejected(self):
        self.assert_conflict(lambda: self.writer.withdraw(self.alice, self.run))
        self.assertEqual(self.store.gallery(self.ben, self.group), [])

    def test_origin_deletion_with_independent_copy_is_rejected(self):
        copy = self.submit({'independent.jpg': helpers.picture()}, user=self.ben)
        self.process(copy, user=self.ben)
        origin = self.store.owned_origins(self.alice, self.group)[0]['id']
        self.assert_conflict(lambda: self.writer.delete_origin(self.alice, origin))
        with zipfile.ZipFile(io.BytesIO(self.store.export_archive(self.ben, self.group))) as archive:
            records = json.loads(archive.read('manifest.json'))['assets'][0]['origins']
            self.assertEqual([r['original_filename'] for r in records], ['independent.jpg'])
            self.assertEqual(archive.read('originals/' + self.asset), helpers.picture())

    def test_contributor_departure_with_independent_copy_is_rejected(self):
        copy = self.submit({'independent.jpg': helpers.picture()}, user=self.ben)
        self.process(copy, user=self.ben)
        self.assert_conflict(lambda: self.writer.leave_group(self.ben, self.group), user=self.alice)
        self.assertEqual(len(self.store.gallery(self.alice, self.group)[0]['origins']), 1)

    def test_reader_departure_after_build_returns_forbidden(self):
        statuses, headers, body = self.http_export(lambda: self.writer.remove_member(self.alice, self.group, self.ben))
        self.assertEqual(statuses, [403])
        self.assertEqual(headers['Content-Type'], 'application/json')
        self.assertNotIn(b'PK\x03\x04', body)
        self.assertFalse(self.store.db.in_transaction)

    def test_import_withdrawal_of_retained_resource_is_rejected(self):
        resource, _ = self.retained_resource()
        self.assert_conflict(lambda: self.writer.withdraw(self.alice, resource))

    def test_tagger_departure_without_photo_withdrawal_is_rejected(self):
        self.store.accept(self.outsider, self.store.invite(self.alice, self.group))
        person = self.store.create_person(self.alice, self.group, 'Unverified friend')
        self.store.tag(self.outsider, person, self.asset, True)
        self.assert_conflict(lambda: self.writer.leave_group(self.outsider, self.group))
        self.assertEqual(self.store.people(self.ben, self.group), [])
        self.assertEqual(len(self.store.gallery(self.ben, self.group)), 1)

    def test_verified_identity_departure_without_photo_withdrawal_is_rejected(self):
        self.tagged_person()
        self.assert_conflict(lambda: self.writer.leave_group(self.ben, self.group), user=self.alice)
        self.assertEqual(self.store.people(self.alice, self.group), [])
        self.assertEqual(len(self.store.gallery(self.alice, self.group)), 1)

    def event(self):
        image = io.BytesIO()
        Image.new('RGB', (8, 8), 'blue').save(image, 'PNG')
        run = self.submit({'blue.png': image.getvalue()})
        self.process(run)
        ids = [item['id'] for item in self.store.gallery(self.ben, self.group)]
        return self.store.review_event(self.alice, self.group, ids, 'Synthetic memory', 'accept')

    def test_hidden_event_change_after_build_is_rejected(self):
        self.tagged_person()
        event = self.event()
        self.assert_conflict(lambda: self.writer.hide_event(self.ben, self.group, event, True))

    def test_referenced_event_title_change_after_build_is_rejected(self):
        self.tagged_person()
        self.event()
        ids = [item['id'] for item in self.store.gallery(self.ben, self.group)]
        self.assert_conflict(lambda: self.writer.review_event(self.alice, self.group, ids, 'Corrected memory', 'accept'))

    def test_annotation_change_after_build_is_rejected(self):
        self.assert_conflict(lambda: self.writer.correct_asset(self.alice, self.asset, title='Corrected title',
                                                              capture_date='2024-01-02', place='Amsterdam'))

    def test_processing_settings_change_after_build_is_rejected(self):
        self.assert_conflict(lambda: self.writer.processing(self.ben, self.group, True))

    def test_added_live_origin_after_build_is_rejected(self):
        run = self.submit({'new-source.jpg': helpers.picture()}, user=self.ben)
        def finish():
            self.writer.confirm(self.ben, run)
            while self.writer.work_once():
                pass
        self.assert_conflict(finish)

    def test_unchanged_export_keeps_every_category_and_reads_objects_once_outside_transactions(self):
        resource, resource_data = self.retained_resource()
        person = self.tagged_person()
        origin = self.store.owned_origins(self.alice, self.group)[0]['id']
        self.store.set_place(self.alice, origin, 'NL', 'Amsterdam', 52.37, 4.9, '2024-01-01')
        self.store.correct_asset(self.alice, self.asset, title='A title', capture_date='2024-01-01', place='A place', anniversary=True)
        reads = []
        read = self.store.objects.read
        def observe(namespace, key):
            self.assertFalse(self.store.db.in_transaction)
            reads.append((namespace, key))
            return read(namespace, key)
        self.store.objects.read = observe
        statuses, headers, body = self.http_export()
        self.assertEqual(statuses, [200])
        self.assertEqual(headers['Content-Type'], 'application/zip')
        self.assertEqual(int(headers['Content-Length']), len(body))
        self.assertEqual(headers['Cache-Control'], 'no-store')
        self.assertEqual(len(reads), 2)
        with zipfile.ZipFile(io.BytesIO(body)) as archive:
            self.assertIsNone(archive.testzip())
            self.assertEqual(archive.namelist(), ['originals/' + self.asset, 'manifest.json', 'resources/' + resource,
                                               'resources.json', 'places.json', 'people.json', 'personal-discovery.json'])
            self.assertEqual(archive.read('originals/' + self.asset), helpers.picture())
            self.assertEqual(archive.read('resources/' + resource), resource_data)
            record = json.loads(archive.read('manifest.json'))['assets'][0]
            self.assertEqual(record['sha256'], hashlib.sha256(helpers.picture()).hexdigest())
            self.assertEqual(record['origins'], self.store.origins(self.ben, self.asset)['items'])
            self.assertEqual(record['annotation'], dict(title='A title', capture_date='2024-01-01', place='A place', anniversary=1))
            self.assertEqual(json.loads(archive.read('places.json'))[0]['origin'], origin)
            self.assertEqual(json.loads(archive.read('people.json'))[0]['id'], person)
            self.assertEqual(set(json.loads(archive.read('personal-discovery.json'))),
                             {'hidden', 'hidden_memories', 'suppressed', 'processing'})
        self.assertFalse(self.store.db.in_transaction)

    def test_added_photo_after_build_is_rejected_before_deep_metadata_scan(self):
        image = io.BytesIO()
        Image.new('RGB', (8, 8), 'blue').save(image, 'PNG')
        run = self.submit({'new-photo.png': image.getvalue()})
        queries = []
        def finish():
            self.writer.confirm(self.alice, run)
            while self.writer.work_once():
                pass
            # Database-boundary diagnostic: final validation must stop at the
            # fresh visible set rather than scan an arbitrarily larger archive.
            self.store.db.set_trace_callback(queries.append)
        try:
            self.assert_conflict(finish)
        finally:
            self.store.db.set_trace_callback(None)
        self.assertFalse(any('o.payload' in sql or 'SELECT o.*' in sql or 'review_annotations' in sql for sql in queries))
        self.assertEqual(len(self.store.gallery(self.ben, self.group)), 2)

    def test_busy_final_validation_returns_one_json_error_without_zip(self):
        self.store.db.execute('PRAGMA busy_timeout=20')
        try:
            statuses, headers, body = self.http_export(lambda: self.writer.db.execute('BEGIN IMMEDIATE'))
        finally:
            self.writer.db.rollback()
        self.assertEqual(statuses, [503])
        self.assertEqual(headers['Content-Type'], 'application/json')
        self.assertEqual(json.loads(body), {'error': 'Archive is busy; retry shortly'})
        self.assertNotIn(b'PK\x03\x04', body)
        self.assertFalse(self.store.db.in_transaction)

    def test_change_after_successful_admission_cannot_revoke_the_zip(self):
        handler = object.__new__(handler_for(self.store))
        handler.path = '/api/review/export?group=' + self.group
        handler.user = lambda: self.ben
        handler.wfile = io.BytesIO()
        statuses = []
        def headers_begin(status):
            self.assertFalse(self.store.db.in_transaction)
            statuses.append(status)
            self.writer.hide(self.ben, self.asset, True)
        handler.send_response = headers_begin
        handler.send_header = lambda *args: None
        handler.end_headers = lambda: None
        handler.do_GET()
        self.assertEqual(statuses, [200])
        with zipfile.ZipFile(io.BytesIO(handler.wfile.getvalue())) as archive:
            self.assertEqual(archive.read('originals/' + self.asset), helpers.picture())
        self.assertEqual(self.store.gallery(self.ben, self.group), [])

    def test_replaced_origin_identity_is_rejected_when_public_payload_is_identical(self):
        before = self.store.origins(self.ben, self.asset)['items']
        run = self.submit(user=self.ben)
        def replace():
            self.writer.withdraw(self.alice, self.run)
            self.writer.confirm(self.ben, run)
            while self.writer.work_once():
                pass
        self.assert_conflict(replace)
        self.assertEqual(self.store.origins(self.ben, self.asset)['items'], before)
        self.assertEqual(self.store.gallery(self.ben, self.group)[0]['id'], self.asset)

    def test_loopback_http_withdrawal_returns_one_complete_json_conflict(self):
        import http.client
        import threading
        from http.server import HTTPServer
        _, token = self.store.enter_shared(code=self.code, name='Ben')
        build = self.store._build_export_archive
        def interleave(*args, **kwargs):
            result = build(*args, **kwargs)
            self.writer.withdraw(self.alice, self.run)
            return result
        self.store._build_export_archive = interleave
        server = HTTPServer(('127.0.0.1', 0), handler_for(self.store))
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        connection = http.client.HTTPConnection('127.0.0.1', server.server_port, timeout=5)
        try:
            connection.request('GET', '/api/review/export?group=' + self.group,
                               headers={'Cookie': 'mazi_session=' + token})
            response = connection.getresponse()
            body = response.read()
            self.assertEqual(response.status, 409)
            self.assertEqual(response.getheader('Content-Type'), 'application/json')
            self.assertEqual(int(response.getheader('Content-Length')), len(body))
            self.assertEqual(json.loads(body), {'error': 'Archive changed while preparing export; retry'})
            self.assertNotIn(b'PK\x03\x04', body)
        finally:
            connection.close()
            server.shutdown()
            worker.join(5)
            server.server_close()
            self.store._build_export_archive = build

    def test_final_validation_serializes_policy_writers_until_admission(self):
        import threading
        connection = self.store.db
        started, changed = threading.Event(), threading.Event()
        errors, scans = [], []
        def hide():
            started.set()
            try:
                self.writer.hide(self.ben, self.asset, True)
            except Exception as error:
                errors.append(error)
            finally:
                changed.set()
        worker = threading.Thread(target=hide)
        class ObserveTransaction:
            count = 0
            def __getattr__(self, key):
                return getattr(connection, key)
            def execute(inner, sql, params=()):
                cursor = connection.execute(sql, params)
                if sql == 'BEGIN IMMEDIATE':
                    inner.count += 1
                    if inner.count == 2:
                        worker.start()
                        self.assertTrue(started.wait(2))
                        self.assertFalse(changed.wait(0.05))
                elif inner.count == 2:
                    scans.append(sql)
                    self.assertFalse(changed.is_set())
                return cursor
        self.store.db = ObserveTransaction()
        try:
            statuses, _, body = self.http_export()
        finally:
            self.store.db = connection
            if worker.ident is not None:
                worker.join(5)
        self.assertTrue(changed.is_set())
        self.assertEqual(errors, [])
        self.assertTrue(any('review_annotations' in sql for sql in scans))
        self.assertEqual(statuses, [200])
        with zipfile.ZipFile(io.BytesIO(body)) as archive:
            self.assertEqual(archive.read('originals/' + self.asset), helpers.picture())
        self.assertEqual(self.store.gallery(self.ben, self.group), [])
