import tempfile
import unittest
from pathlib import Path
from mazi.archive.hosted_ops import encode_value, decode_value, verify_snapshot, write_snapshot


class RecoveryContracts(unittest.TestCase):
    def test_binary_round_trip(self):
        value = b'\x00\xffcapsule'
        self.assertEqual(decode_value(encode_value(value)), value)

    def test_corrupted_object_is_rejected(self):
        snapshot = {'format': 1, 'tables': {}, 'objects': {'archives/x': {'data': 'eA==', 'sha256': 'bad'}}}
        with self.assertRaises(ValueError):
            verify_snapshot(snapshot)

    def test_snapshot_is_private_and_does_not_overwrite(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / 'snapshot.json'
            write_snapshot({'format': 1, 'tables': {}, 'objects': {}}, path)
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            with self.assertRaises(FileExistsError):
                write_snapshot({'format': 1, 'tables': {}, 'objects': {}}, path)


class EmptyDestinationContracts(unittest.TestCase):
    def test_existing_remote_objects_block_restore(self):
        from unittest.mock import patch
        from mazi.archive.hosted_ops import require_empty
        class Remote:
            def list(self): return ['archives/private']
        with patch('mazi.archive.hosted_ops.table_names', return_value=[]):
            with self.assertRaisesRegex(ValueError, 'must be empty'):
                require_empty(object(), Remote())

    def test_restore_requires_isolation_before_reading_snapshot(self):
        from mazi.archive.hosted_ops import restore_backup
        with self.assertRaisesRegex(ValueError, 'isolated'):
            restore_backup(object(), object(), '/does/not/exist')

    def test_source_read_preserves_binary_and_order_without_mutation(self):
        import sqlite3
        from mazi.archive.migrate import read_source
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / 'mazi.sqlite3'
            with sqlite3.connect(path) as db:
                db.execute('CREATE TABLE archive_assets(id TEXT PRIMARY KEY, photo BLOB)')
                db.execute('INSERT INTO archive_assets VALUES(?,?)', ('z', b'\x00\xff'))
                db.execute('INSERT INTO archive_assets VALUES(?,?)', ('a', b'abc'))
            before = path.read_bytes()
            tables = {'archive_assets': {'columns': ['id', 'photo', '_mazi_order'], 'rows': []}, **{name: {'columns': [], 'rows': []} for name in ('stored_objects', 'object_receipts', 'object_deletions')}}
            result = read_source(root, tables)
            rows = {row[0]: row for row in result['archive_assets']['rows']}
            self.assertEqual(rows['z'][2], 1)
            self.assertEqual(rows['a'][2], 2)
            self.assertEqual(decode_value(rows['z'][1]), b'\x00\xff')
            self.assertEqual(path.read_bytes(), before)


class MigrationResumeContracts(unittest.TestCase):
    def test_exact_source_retry_after_remote_failure_and_unrelated_source_refusal(self):
        from unittest.mock import patch
        from mazi.archive.migrate import migrate_archive
        class Database:
            def __enter__(self): return self
            def __exit__(self, *args): pass
        class Remote:
            def __init__(self): self.data = {}
            def list(self): return list(self.data)
            def get(self, key): return self.data[key]
            def put(self, key, data): self.data[key] = data
        class Objects:
            def __init__(self): self.remote, self.fail, self.data = Remote(), True, {}
            def retain(self, area, key, data):
                self.remote.put(area + '/' + key + '/generation/0-digest', data)
                if self.fail:
                    self.fail = False
                    raise OSError('synthetic interrupted upload')
                self.data[area, key] = data
            def read(self, area, key): return self.data[area, key]
            def list(self, area): return [key for item_area, key in self.data if area == item_area]
        tables = {name: {'columns': [], 'rows': []} for name in ('archive_assets', 'archive_origins', 'source_resources', 'stored_objects', 'object_receipts', 'object_deletions')}
        with tempfile.TemporaryDirectory() as root, patch('mazi.archive.migrate.capture_tables', return_value=tables), patch('mazi.archive.migrate.read_source', return_value=tables), patch('mazi.archive.migrate.insert_tables'):
            path = Path(root) / 'archives' / 'synthetic'
            path.parent.mkdir()
            path.write_bytes(b'archive bytes')
            from mazi.storage import AREAS
            for area in AREAS:
                if area != 'archives':
                    (Path(root) / area).mkdir()
                    (Path(root) / area / 'synthetic').write_bytes((area + ' bytes').encode())
            objects = Objects()
            with self.assertRaises(OSError):
                migrate_archive(root, Database(), objects)
            self.assertTrue(any(key.startswith('migration-receipts/') for key in objects.remote.list()))
            result = migrate_archive(root, Database(), objects)
            self.assertTrue(result['migrated'])
            self.assertEqual(result['files'], 6)
            self.assertEqual({area for area, _ in objects.data}, set(AREAS))
            self.assertEqual(objects.read('archives', 'synthetic'), b'archive bytes')
            path.write_bytes(b'different source')
            with self.assertRaisesRegex(ValueError, 'exact-source'):
                migrate_archive(root, Database(), objects)


class RestoreOrderContracts(unittest.TestCase):
    def test_foreign_key_parents_precede_children_and_final_epochs(self):
        from mazi.archive.hosted_ops import insertion_tables
        class Raw:
            def execute(self, *args): return [('archive_origins', 'archive_assets'), ('archive_assets', 'groups'), ('discovery_generations', 'groups')]
        class Database:
            _db = Raw()
        ordered = insertion_tables(Database(), {'groups': {}, 'archive_assets': {}, 'archive_origins': {}, 'discovery_processing': {}, 'discovery_generations': {}})
        self.assertLess(ordered.index('groups'), ordered.index('archive_assets'))
        self.assertLess(ordered.index('archive_assets'), ordered.index('archive_origins'))
        self.assertEqual(ordered[-1], 'discovery_generations')


class RestoreResumeContracts(unittest.TestCase):
    def test_failed_object_upload_can_resume_only_exact_snapshot(self):
        import base64, hashlib
        from unittest.mock import patch
        from mazi.archive.hosted_ops import restore_backup
        class Database:
            def __enter__(self): return self
            def __exit__(self, *args): pass
        class Remote:
            bucket = 'isolated-test'
            def __init__(self): self.data, self.fail = {}, True
            def list(self): return list(self.data)
            def get(self, key): return self.data[key]
            def put(self, key, data):
                self.data[key] = data
                if key == 'archives/synthetic' and self.fail:
                    self.fail = False
                    raise OSError('synthetic interruption')
        class Objects:
            def __init__(self): self.remote = Remote()
        data = b'synthetic bytes'
        snapshot = {'format': 1, 'tables': {}, 'objects': {'archives/synthetic': {'data': base64.b64encode(data).decode(), 'sha256': hashlib.sha256(data).hexdigest()}}}
        with tempfile.TemporaryDirectory() as root, patch('mazi.archive.hosted_ops._target_identity', return_value={'schema': 'isolated-test', 'bucket': 'isolated-test'}), patch('mazi.archive.hosted_ops.capture_tables', return_value={}), patch('mazi.archive.hosted_ops.insert_tables'):
            path = Path(root) / 'snapshot.json'
            write_snapshot(snapshot, path)
            objects = Objects()
            with self.assertRaises(OSError):
                restore_backup(Database(), objects, path, isolated=True)
            self.assertTrue(restore_backup(Database(), objects, path, isolated=True)['restored'])
            other = Path(root) / 'other.json'
            write_snapshot({'format': 1, 'tables': {}, 'objects': {}}, other)
            before = dict(objects.remote.data)
            with self.assertRaisesRegex(ValueError, 'exact-snapshot'):
                restore_backup(Database(), objects, other, isolated=True)
            self.assertEqual(objects.remote.data, before)
            database_failure = Objects()
            database_failure.remote.fail = False
            with patch('mazi.archive.hosted_ops.insert_tables', side_effect=[RuntimeError('synthetic database failure'), None]):
                with self.assertRaises(RuntimeError):
                    restore_backup(Database(), database_failure, path, isolated=True)
                self.assertTrue(restore_backup(Database(), database_failure, path, isolated=True)['restored'])
            objects.remote.data['unrelated/private'] = b'other'
            before = dict(objects.remote.data)
            with self.assertRaisesRegex(ValueError, 'unrelated'):
                restore_backup(Database(), objects, path, isolated=True)
            self.assertEqual(objects.remote.data, before)


class RequiredSourceBytesContracts(unittest.TestCase):
    def test_missing_active_manual_original_and_previews_are_rejected(self):
        import hashlib
        from mazi.archive.migrate import validate_source_payloads
        digest = hashlib.sha256(b'original').hexdigest()
        tables = {'archive_assets': {'columns': [], 'rows': []}, 'archive_origins': {'columns': [], 'rows': []}, 'source_resources': {'columns': [], 'rows': []}, 'media': {'columns': ['id', 'status', 'sha256'], 'rows': [['manual', 'published', digest]]}}
        for payloads in [[], [('originals', 'manual', b'original')], [('previews', 'manual', b'preview')]]:
            with self.assertRaises(ValueError): validate_source_payloads(tables, payloads)
        tables['media']['rows'] = []
        tables['archive_assets'] = {'columns': ['id', 'original_key', 'preview_key', 'sha256'], 'rows': [['asset', 'a.original', 'a.preview', digest]]}
        tables['archive_origins'] = {'columns': ['asset_id', 'withdrawn'], 'rows': [['asset', 0]]}
        with self.assertRaisesRegex(ValueError, 'preview'):
            validate_source_payloads(tables, [('archive-objects', 'a.original', b'original')])

    def test_missing_manual_bytes_fail_before_any_remote_write(self):
        from unittest.mock import patch
        from mazi.archive.migrate import migrate_archive
        class Database:
            def __enter__(self): return self
            def __exit__(self, *args): pass
        class Objects:
            remote = object()  # Any attempted Storage access would fail this contract.
        tables = {'archive_assets': {'columns': [], 'rows': []}, 'archive_origins': {'columns': [], 'rows': []}, 'source_resources': {'columns': [], 'rows': []}, 'media': {'columns': ['id', 'status', 'sha256'], 'rows': [['manual', 'published', 'digest']]}}
        with tempfile.TemporaryDirectory() as root, patch('mazi.archive.migrate.capture_tables', return_value=tables), patch('mazi.archive.migrate.read_source', return_value=tables):
            with self.assertRaisesRegex(ValueError, 'manual'):
                migrate_archive(root, Database(), Objects())
