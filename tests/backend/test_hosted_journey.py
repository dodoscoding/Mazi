"""Opt-in real private Storage journey; requires a running hosted API/worker.

Load .env.supabase server-side and set MAZI_TEST_HOSTED=1 and
MAZI_TEST_FIXTURE to a restricted synthetic D17 fixture JSON path.
"""
import hashlib
import json
import os
import shutil
import tempfile
import time
import unittest
import uuid
from pathlib import Path
from mazi.identity.core import Denied
from mazi.memories.memories import MemoryStore
from tests.backend.imports.test_engine import picture
from tests.backend.imports.test_adapters import zip_bytes


@unittest.skipUnless(os.environ.get('MAZI_TEST_HOSTED') == '1', 'requires explicit hosted synthetic fixture')
class HostedJourney(unittest.TestCase):
    def test_remote_restart_and_private_byte_classes(self):
        fixture = json.loads(Path(os.environ['MAZI_TEST_FIXTURE']).read_text())
        user, guest, group = fixture['user'], fixture['guest'], fixture['group']
        root = tempfile.mkdtemp()
        store = MemoryStore(root)
        self.assertTrue(getattr(store.db, 'hosted', False))
        namespace = 'synthetic-hosted-' + uuid.uuid4().hex
        data = zip_bytes({'photo.jpg': picture()})
        run = store.begin_import(user, group, 'manual', namespace, len(data), hashlib.sha256(data).hexdigest(), {})
        try:
            midpoint = len(data) // 2
            store.write_chunk(user, run, 0, data[:midpoint])
            store.close()
            shutil.rmtree(root)
            root = tempfile.mkdtemp()
            store = MemoryStore(root)
            self.assertEqual(store.report(user, run)['received'], midpoint)
            store.write_chunk(user, run, 0, data[:midpoint])
            store.write_chunk(user, run, midpoint, data[midpoint:])
            store.finish_transfer(user, run)
            store.scan(run)
            store.confirm(user, run)
            deadline = time.monotonic() + 90
            while store.report(user, run)['state'] != 'COMPLETED' and time.monotonic() < deadline:
                time.sleep(0.5)
            self.assertEqual(store.report(user, run)['counts'], {'AVAILABLE_TO_GROUP': 1})
            asset = store.db.execute('SELECT asset_id FROM archive_origins WHERE run_id=?', (run,)).fetchone()[0]
            self.assertEqual(store.asset_bytes(guest, asset, True), picture())
            self.assertTrue(store.asset_bytes(guest, asset))
            self.assertTrue(store.rendition_bytes(guest, asset))
            store.close()
            shutil.rmtree(root)
            root = tempfile.mkdtemp()
            store = MemoryStore(root)
            self.assertEqual(store.asset_bytes(guest, asset, True), picture())
            self.assertTrue(store.export_archive(guest, group))
            with self.assertRaises(Denied):
                store.asset_bytes('synthetic outsider', asset, True)
            source = store.create_source(user, group, 'apple', namespace, {'start': '2020-01-01', 'end': '2030-01-01', 'albums': [], 'types': ['image', 'video']})
            store.set_source(user, source, True, 'authorized')
            movie = b'synthetic private unsupported movie'
            resource = store.begin_resource(user, source, dict(item=namespace, component='pairedVideo', version='original', filename='movie.mov', date='2024-01-02', kind='video', albums=[]), len(movie), hashlib.sha256(movie).hexdigest())
            store.resource_chunk(user, resource['id'], 0, movie)
            store.finish_resource(user, resource['id'])
            self.assertEqual(store.resource_bytes(guest, resource['id']), movie)
            media = store.upload_image(user, group, 'synthetic.jpg', picture())
            self.assertEqual(store.media_bytes(user, media, True), picture())
            store.withdraw(user, run)
            self.assertIsNone(store.db.execute('SELECT 1 FROM archive_origins WHERE run_id=? AND withdrawn=0', (run,)).fetchone())
        finally:
            store.close()
            shutil.rmtree(root, ignore_errors=True)
