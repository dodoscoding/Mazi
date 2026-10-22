"""Synthetic local scan benchmark; no private archives or remote credentials."""
import hashlib
import json
import tempfile
import time
from unittest.mock import patch
from mazi.imports.engine import ImportStore
from tests.backend.imports.test_adapters import zip_bytes
from tests.backend.imports.test_engine import picture
from mazi.imports import engine


class FakeRemote:
    def __init__(self):
        self.objects = {}
        self.gets = 0
        self.bytes = 0
    def put(self, key, data):
        self.objects[key] = data
    def get(self, key):
        data = self.objects[key]
        self.gets += 1
        self.bytes += len(data)
        return data


def measure(records, photos, hosted=False):
    lines = [f'01/01/2024, 12:00 - Alice: ' + (f'photo{i}.jpg (file attached)' if i < photos else f'synthetic message {i}') for i in range(records)]
    data = zip_bytes({'_chat.txt': '\n'.join(lines).encode(), **{f'photo{i}.jpg': picture() for i in range(photos)}})
    counts = {'materializations': 0, 'inventory_calls': 0, 'archive_bytes_hashed': 0, 'insert_statements': 0, 'scan_calls': 0}
    with tempfile.TemporaryDirectory() as root:
        store = ImportStore(root)
        remote = FakeRemote() if hosted else None
        if hosted:
            from mazi.storage import HostedObjects, STORAGE_SCHEMA
            store.db.executescript(STORAGE_SCHEMA)
            store.objects = HostedObjects(store.db, "unused", "unused", transport=remote)
        stages = {}
        user = store.register('benchmark@example.test', 'correct horse battery')
        group = store.create_group(user, 'Synthetic')
        run = store.begin_import(user, group, 'whatsapp', 'synthetic', len(data), hashlib.sha256(data).hexdigest(), {'date_order': 'DMY'})
        started = time.perf_counter()
        for offset in range(0, len(data), 512 * 1024):
            store.write_chunk(user, run, offset, data[offset:offset + 512 * 1024])
        stages['upload'] = round(time.perf_counter() - started, 4)
        started = time.perf_counter()
        store.finish_transfer(user, run)
        stages['finish'] = round(time.perf_counter() - started, 4)
        if remote:
            remote.gets = remote.bytes = 0
        original_archive, original_inventory = engine.Archive, engine.inventory
        def archive(path):
            counts['materializations'] += 1
            counts['archive_bytes_hashed'] += path.stat().st_size
            return original_archive(path)
        def inventory(*args):
            counts['inventory_calls'] += 1
            return original_inventory(*args)
        def trace(sql):
            if sql.startswith('INSERT INTO import_items'):
                counts['insert_statements'] += 1
        store.db.set_trace_callback(trace)
        started = time.perf_counter()
        with patch.object(engine, 'Archive', archive), patch.object(engine, 'inventory', inventory):
            while store.db.execute('SELECT state FROM import_runs WHERE id=?', (run,)).fetchone()[0] == 'SCANNING':
                store.scan(run, 500)
                counts['scan_calls'] += 1
        elapsed = time.perf_counter() - started
        scan_gets = remote.gets if remote else None
        scan_remote_bytes = remote.bytes if remote else None
        stages['scan'] = round(elapsed, 4)
        started = time.perf_counter()
        report = store.report(user, run)
        stages['report'] = round(time.perf_counter() - started, 4)
        started = time.perf_counter()
        store.confirm(user, run)
        while store.work_once():
            pass
        stages['processing'] = round(time.perf_counter() - started, 4)
        final = store.report(user, run)
        store.close()
    return {'records': records, 'photos': photos, 'archive_bytes': len(data), 'seconds': round(elapsed, 4), 'counts': report['counts'], 'final_counts': final['counts'], 'stages_seconds': stages, 'fake_hosted': hosted, 'scan_remote_gets': scan_gets, 'scan_remote_bytes': scan_remote_bytes, **counts}

if __name__ == '__main__':
    print(json.dumps([measure(7500, 223), measure(30000, 0), measure(7500, 223, hosted=True)], indent=2))
