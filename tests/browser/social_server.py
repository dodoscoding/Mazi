"""Isolated empty-archive plans fixture; controls exist only in this test process."""
import os
import tempfile
from urllib.parse import urlsplit

from mazi.memories.memories import MemoryStore
from mazi.server import AppServer, handler_for
from .shared_fixture import configure_shared

with tempfile.TemporaryDirectory(prefix='mazi-social-browser-') as root:
    store = MemoryStore(root)
    alice = store.register('alice@example.test', 'correct horse battery')
    ben = store.register('ben@example.test', 'correct horse battery')
    group = store.create_group(alice, 'Arkadaşlarımız')
    store.accept(ben, store.invite(alice, group))
    other = store.create_group(alice, 'Başka grubumuz')
    store.accept(ben, store.invite(alice, other))
    configure_shared(store, group, {'Alice': alice, 'Ben': ben})

    class Handler(handler_for(store)):
        def do_GET(self):
            if urlsplit(self.path).path == '/__test__/state':
                return self.json(200, dict(group=group, other=other, photos=store.db.execute('SELECT count(*) FROM archive_assets').fetchone()[0]))
            return super().do_GET()

        def do_POST(self):
            path = urlsplit(self.path).path
            if path == '/__test__/reset':
                with store.db:
                    store.db.execute('DELETE FROM social_plans')
                    store.db.execute('DELETE FROM social_receipts')
                    store.db.execute('UPDATE shared_policy SET group_id=?', (group,))
                return self.json(200, {'ok': True})
            if path == '/__test__/switch-circle':
                with store.db:
                    store.db.execute('UPDATE shared_policy SET group_id=?', (other,))
                return self.json(200, {'group': other})
            return super().do_POST()

    server = AppServer(('127.0.0.1', int(os.environ.get('MAZI_IMPORT_PORT', '8018'))), Handler)
    try:
        server.serve_forever()
    finally:
        server.server_close()
        store.close()
