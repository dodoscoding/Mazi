"""Independent empty-circle Home fixture with a synthetic next-day clock."""
import os
import tempfile
import threading
import time
from unittest.mock import patch
from urllib.parse import urlsplit

os.environ['MAZI_BACKEND'] = 'local'

from mazi.memories.memories import MemoryStore
from mazi.server import AppServer, handler_for
from mazi.sources.server import worker
from .shared_fixture import configure_shared

with tempfile.TemporaryDirectory(prefix='mazi-home-browser-') as root:
    store = MemoryStore(root)
    alice = store.register('alice@example.test', 'correct horse battery')
    ben = store.register('ben@example.test', 'correct horse battery')
    group = store.create_group(alice, 'Arkadaşlarımız')
    store.accept(ben, store.invite(alice, group))
    configure_shared(store, group, {'Alice': alice, 'Ben': ben})
    clock = None
    timings = []

    class Handler(handler_for(store)):
        def do_GET(self):
            path = urlsplit(self.path).path
            if path == '/__test__/state':
                return self.json(200, dict(group=group, photos=store.db.execute('SELECT count(*) FROM archive_assets WHERE group_id=?', (group,)).fetchone()[0], assets=[row[0] for row in store.db.execute('SELECT id FROM archive_assets WHERE group_id=?', (group,))], timings=timings))
            if path in ('/api/social/home', '/api/social/activity', '/api/atlas/memory'):
                started = time.perf_counter()
                count = []
                store.db.set_trace_callback(lambda sql: count.append(sql))
                try:
                    if clock is not None:
                        with patch('mazi.social.home.time.time', return_value=clock):
                            return super().do_GET()
                    return super().do_GET()
                finally:
                    store.db.set_trace_callback(None)
                    timings.append(dict(path=path, ms=round((time.perf_counter()-started)*1000, 3), queries=len(count)))
            return super().do_GET()

        def do_POST(self):
            global group, clock
            path = urlsplit(self.path).path
            if path == '/__test__/reset':
                group = store.create_group(alice, 'Arkadaşlarımız')
                with store.db:
                    store.db.execute('UPDATE shared_policy SET group_id=?', (group,))
                store.accept(ben, store.invite(alice, group))
                clock = None
                timings.clear()
                return self.json(200, dict(group=group))
            if path == '/__test__/next-day':
                clock = time.time() + 86400
                return self.json(200, dict(ok=True))
            if path == '/__test__/withdraw':
                for row in store.db.execute('SELECT id FROM archive_origins WHERE group_id=? AND withdrawn=0', (group,)).fetchall():
                    store.delete_origin(alice, row['id'])
                return self.json(200, dict(ok=True))
            return super().do_POST()

    stop = threading.Event()
    background = threading.Thread(target=worker, args=(root, stop), daemon=True)
    background.start()
    server = AppServer(('127.0.0.1', int(os.environ.get('MAZI_IMPORT_PORT', '8172'))), Handler)
    try:
        server.serve_forever()
    finally:
        stop.set()
        background.join(timeout=35)
        server.server_close()
        store.close()
