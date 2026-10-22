import sqlite3
import io
import json
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

from mazi.storage import HostedObjects, LocalObjects, STORAGE_SCHEMA, StorageConflict, StorageHTTP


class Remote:
    def __init__(self):
        self.data = {}
        self.fail_put = False
        self.fail_delete = False
        self.puts = []

    def put(self, key, data):
        if self.fail_put:
            raise OSError('offline')
        self.puts.append((key, len(data)))
        if key in self.data and self.data[key] != data:
            raise StorageConflict('duplicate')
        self.data[key] = data

    def get(self, key):
        return self.data[key]

    def list(self):
        return list(self.data)

    def delete(self, key):
        if self.fail_delete:
            raise OSError('offline')
        self.data.pop(key, None)


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.row_factory = sqlite3.Row
        self.db.executescript(STORAGE_SCHEMA)
        self.remote = Remote()
        self.objects = HostedObjects(self.db, 'https://test.supabase.co', 'sb_secret_test', 'mazi-private', self.remote)

    def test_failure_does_not_record_receipt_and_retry_converges(self):
        self.remote.fail_put = True
        with self.assertRaises(OSError), self.db:
            self.objects.append('archives', 'a', 0, b'hello')
        self.assertEqual(self.db.execute('SELECT count(*) FROM object_receipts').fetchone()[0], 0)
        self.remote.fail_put = False
        with self.db:
            self.assertEqual(self.objects.append('archives', 'a', 0, b'hello'), 5)
        self.assertEqual(self.objects.read('archives', 'a'), b'hello')

    def test_conflicting_remote_write_reads_once_and_never_receipts_bad_bytes(self):
        reads = []
        def conflict(key, data):
            raise StorageConflict('existing object')
        def read(key):
            reads.append(key)
            return b'hello'
        with patch.object(self.remote, 'put', conflict), patch.object(self.remote, 'get', read), self.db:
            self.objects.append('archives', 'a', 0, b'hello')
        self.assertEqual(len(reads), 1)
        with patch.object(self.remote, 'put', conflict), patch.object(self.remote, 'get', return_value=b'bad'):
            with self.assertRaises(StorageConflict), self.db:
                self.objects.append('archives', 'b', 0, b'hello')
        self.assertEqual(self.db.execute("SELECT count(*) FROM object_receipts WHERE key='b'").fetchone()[0], 0)

    def test_replay_arbitrary_ranges_restart_and_no_growing_upload(self):
        with self.db:
            self.objects.append('archives', 'a', 0, b'hello')
            self.objects.append('archives', 'a', 5, b' world')
            self.assertEqual(self.objects.append('archives', 'a', 3, b'lo wo'), 11)
        other = HostedObjects(self.db, 'https://test.supabase.co', 'sb_secret_test', 'mazi-private', self.remote)
        with other.materialize('archives', 'a') as path:
            self.assertEqual(path.read_bytes(), b'hello world')
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
        self.assertFalse(path.exists())
        self.assertEqual([size for _, size in self.remote.puts], [5, 6])
        with self.assertRaises(StorageConflict):
            other.append('archives', 'a', 4, b'x')

    def test_reset_uses_new_generation_and_delete_failure_denies_reads(self):
        with self.db:
            self.objects.retain('originals', 'a', b'old')
            old = set(self.remote.data)
            self.objects.reset('originals', 'a')
            self.objects.retain('originals', 'a', b'new')
        self.assertEqual(self.objects.read('originals', 'a'), b'new')
        self.assertEqual(len(self.remote.data), 2)
        self.assertEqual(len(old), 1)
        with self.db:
            self.objects.remove('originals', 'a')
        self.remote.fail_delete = True
        self.assertEqual(self.objects.retry_deletions(), 0)
        with self.assertRaises(FileNotFoundError):
            self.objects.read('originals', 'a')
        self.remote.fail_delete = False
        self.assertEqual(self.objects.retry_deletions(), 2)
        self.assertEqual(self.remote.data, {})

    def test_corrupt_remote_receipt_and_immutable_duplicate(self):
        with self.db:
            self.objects.retain('previews', 'a', b'hello')
            self.objects.retain('previews', 'a', b'hello')
        with self.assertRaises(StorageConflict):
            self.objects.retain('previews', 'a', b'other')
        self.remote.data[next(iter(self.remote.data))] = b'corrupt'
        with self.assertRaises(OSError):
            self.objects.read('previews', 'a')

    def test_database_rollback_leaves_only_collectable_remote_objects(self):
        with self.assertRaises(RuntimeError), self.db:
            self.objects.append('archives', 'a', 0, b'hello')
            raise RuntimeError('commit failed')
        self.assertEqual(self.objects.list('archives'), [])
        self.assertEqual(set(self.objects.unreferenced()), set(self.remote.data))
        with self.db:
            self.objects.append('archives', 'a', 0, b'hello')
        self.assertEqual(self.objects.read('archives', 'a'), b'hello')

    def test_large_retained_object_is_split_and_receipt_gap_fails(self):
        with patch('mazi.storage.CHUNK_SIZE', 4), self.db:
            self.objects.retain('source-resources', 'a', b'unsupported zip bytes')
        self.assertTrue(all(size <= 4 for _, size in self.remote.puts))
        self.assertEqual(self.objects.read('source-resources', 'a'), b'unsupported zip bytes')
        self.db.execute('UPDATE object_receipts SET start_offset=start_offset+1 WHERE start_offset=0')
        with self.assertRaises(OSError):
            self.objects.read('source-resources', 'a')

    def test_interrupted_local_retain_does_not_install_partial_file(self):
        with tempfile.TemporaryDirectory() as root:
            local = LocalObjects(root)
            with patch('mazi.storage.os.fsync', side_effect=OSError('interrupted')):
                with self.assertRaises(OSError):
                    local.retain('originals', 'a', b'complete object')
            self.assertFalse((Path(root) / 'originals/a').exists())
            self.assertEqual(list((Path(root) / 'originals').iterdir()), [])
            local.retain('originals', 'a', b'complete object')
            self.assertEqual(local.read('originals', 'a'), b'complete object')

    def test_local_file_layout_and_path_validation(self):
        with tempfile.TemporaryDirectory() as root:
            local = LocalObjects(root)
            local.append('uploads', 'a', 0, b'hello')
            self.assertEqual(local.append('uploads', 'a', 1, b'ell'), 5)
            self.assertEqual((Path(root) / 'uploads/a').read_bytes(), b'hello')
            for area, key in [('archives', '../x'), ('../x', 'a'), ('archives', '/x')]:
                with self.assertRaises(ValueError):
                    local.read(area, key)


class StorageHTTPTests(unittest.TestCase):
    def test_append_has_one_readback_before_receipt(self):
        db = sqlite3.connect(':memory:')
        db.row_factory = sqlite3.Row
        db.executescript(STORAGE_SCHEMA)
        calls = []
        def request(req, **kwargs):
            calls.append(req.method)
            return io.BytesIO(b'hello' if req.method == 'GET' else b'')
        objects = HostedObjects(db, 'https://test.supabase.co', 'sb_secret_test')
        with patch('mazi.storage.urlopen', request), db:
            objects.append('archives', 'a', 0, b'hello')
        self.assertEqual(calls, ['POST', 'GET'])
        self.assertEqual(db.execute('SELECT count(*) FROM object_receipts').fetchone()[0], 1)
        db.close()

    def test_modern_secret_only_apikey_and_legacy_bearer(self):
        requests = []
        def request(req, **kwargs):
            requests.append(req)
            return io.BytesIO(b'synthetic')
        with patch('mazi.storage.urlopen', request):
            StorageHTTP('https://test.supabase.co', 'sb_secret_test', 'mazi-private').get('archives/a')
            StorageHTTP('https://test.supabase.co', 'eyJlegacy', 'mazi-private').get('archives/a')
        self.assertEqual(requests[0].get_header('Apikey'), 'sb_secret_test')
        self.assertIsNone(requests[0].get_header('Authorization'))
        self.assertEqual(requests[1].get_header('Authorization'), 'Bearer eyJlegacy')

    def test_remote_listing_visits_folders_and_all_pages(self):
        def request(req, **kwargs):
            body = json.loads(req.data)
            if body['prefix'] == '':
                rows = [{'name': 'archives', 'id': None}]
            elif body['offset'] == 0:
                rows = [{'name': str(i), 'id': str(i)} for i in range(100)]
            else:
                rows = [{'name': '100', 'id': '100'}]
            return io.BytesIO(json.dumps(rows).encode())
        with patch('mazi.storage.urlopen', request):
            keys = StorageHTTP('https://test.supabase.co', 'sb_secret_test', 'mazi-private').list()
        self.assertEqual(len(keys), 101)
        self.assertIn('archives/100', keys)
