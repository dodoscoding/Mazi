"""Two-photo conversation archive; test controls never enter production handlers."""
import hashlib
import io
import os
import tempfile
from urllib.parse import urlsplit
from PIL import Image

os.environ['MAZI_BACKEND'] = 'local'

from mazi.memories.memories import MemoryStore
from mazi.server import AppServer, handler_for
from .shared_fixture import configure_shared

with tempfile.TemporaryDirectory(prefix='mazi-conversations-browser-') as root:
    store = MemoryStore(root)
    alice = store.register('alice@example.test', 'correct horse battery')
    ben = store.register('ben@example.test', 'correct horse battery')
    group = store.create_group(alice, 'Arkadaşlarımız')
    store.accept(ben, store.invite(alice, group))
    other = store.create_group(alice, 'Başka grubumuz')
    store.accept(ben, store.invite(alice, other))
    source = store.create_source(alice, group, 'apple', 'Synthetic Photos', {
        'start': '2020-01-01', 'end': '2030-01-01', 'albums': [], 'types': ['image']})
    store.set_source(alice, source, True, 'authorized')
    assets = []
    for index, color in enumerate(('red', 'blue')):
        image = io.BytesIO()
        Image.new('RGB', (80, 80), color).save(image, 'JPEG')
        data = image.getvalue()
        resource = store.begin_resource(alice, source, dict(item=str(index), component='photo',
            version='original', filename=f'{color}.jpg', date='2024-01-02', kind='image', albums=[]),
            len(data), hashlib.sha256(data).hexdigest())
        store.resource_chunk(alice, resource['id'], 0, data)
        store.finish_resource(alice, resource['id'])
        while store.work_once():
            pass
        assets.append(store.db.execute('SELECT asset_id FROM archive_origins WHERE run_id=?', (resource['id'],)).fetchone()[0])
    event = store.review_event(alice, group, assets, 'Birlikte bir gün', 'accept')
    configure_shared(store, group, {'Alice': alice, 'Ben': ben})

    class Handler(handler_for(store)):
        def do_GET(self):
            if urlsplit(self.path).path == '/__test__/state':
                return self.json(200, dict(group=group, other=other, event=event, assets=assets))
            return super().do_GET()

        def do_POST(self):
            path = urlsplit(self.path).path
            if path == '/__test__/reset':
                with store.db:
                    for table in ('social_reactions', 'social_comments', 'social_receipts',
                                  'social_reaction_deletions', 'social_comment_deletions'):
                        store.db.execute('DELETE FROM ' + table)
                with store.db:
                    store.db.execute('UPDATE shared_policy SET group_id=?', (group,))
                    store.db.execute('UPDATE archive_origins SET withdrawn=0')
                    store.db.execute("UPDATE import_items SET outcome='AVAILABLE_TO_GROUP',reason='' WHERE reason='WITHDRAWN_BY_OWNER'")
                store.set_source(alice, source, True, 'authorized')
                return self.json(200, dict(ok=True))
            if path == '/__test__/switch-circle':
                with store.db:
                    store.db.execute('UPDATE shared_policy SET group_id=?', (other,))
                return self.json(200, dict(ok=True))
            if path == '/__test__/withdraw':
                for origin in store.db.execute('SELECT id FROM archive_origins WHERE withdrawn=0').fetchall():
                    store.delete_origin(alice, origin['id'])
                return self.json(200, dict(ok=True))
            return super().do_POST()

    server = AppServer(('127.0.0.1', int(os.environ.get('MAZI_IMPORT_PORT', '8156'))), Handler)
    try:
        server.serve_forever()
    finally:
        server.server_close()
        store.close()
