"""Seed a WhatsApp export and a Discord bot channel with two senders each, then serve the built app.

Run from the repository root: PYTHONPATH=. .venv/bin/python <this file> <port> <data_dir>
"""
import hashlib
import io
import json
import sys
import zipfile
from pathlib import Path

from PIL import Image
from mazi.atlas import atlas_view
from mazi.memories.memories import MemoryStore
from mazi.server import AppServer, handler_for
from mazi.sources.discord import poll_source
from tests.backend.sources.test_discord import FakeDiscord, link, message, paged

port, root = int(sys.argv[1]), sys.argv[2]
DIST = Path(__file__).resolve().parents[4] / 'dist'
Path(root).mkdir(parents=True, exist_ok=True)
store = MemoryStore(root)
alice = store.register('alice@example.test', 'correct horse battery')
ben = store.register('ben@example.test', 'correct horse battery')
group = store.create_group(alice, 'Our circle')
store.accept(ben, store.invite(alice, group))


def jpeg(color):
    out = io.BytesIO()
    Image.new('RGB', (60, 45), color).save(out, 'JPEG')
    return out.getvalue()


def zipped(files):
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w') as archive:
        for name, data in files.items():
            archive.writestr(name, data)
    return out.getvalue()


def drain():
    while store.work_once():
        pass


chat = ('01/02/2024, 12:00 - Ana: We made it to the lake\n'
        '01/02/2024, 12:01 - Ana: lake-ana.jpg (file attached)\n'
        '01/02/2024, 12:05 - Deniz: lake-deniz.jpg (file attached)\n'
        '01/02/2024, 12:06 - Deniz: Cold but worth it, lake swim tomorrow\n')
data = zipped({'chat.txt': chat, 'lake-ana.jpg': jpeg('steelblue'), 'lake-deniz.jpg': jpeg('seagreen')})
run = store.begin_import(alice, group, 'whatsapp', 'synthetic-whatsapp', len(data), hashlib.sha256(data).hexdigest(), {'date_order': 'DMY'})
store.write_chunk(alice, run, 0, data)
store.finish_transfer(alice, run)
store.scan(run)
store.confirm(alice, run)
drain()


class ColourDiscord(FakeDiscord):
    def attachment(self, attachment):
        return jpeg({'41': 'goldenrod', '42': 'indianred'}[attachment['id']])


link(store, ben, group)
connection = store.create_source(ben, group, 'discord', 'Lake channel', {
    'guild': '10', 'channels': ['20'], 'start': '2024-01-01', 'end': '2024-12-31'})
store.set_source(ben, connection, True, 'authorized')
client = ColourDiscord()
store.discord_authorize = client.authorize
client.messages = paged([
    message(1, 'Lake from the server', attachments=[1], author={'id': '31', 'global_name': 'Mehmet'}),
    message(2, 'Same lake, other side', attachments=[1], author={'id': '32', 'global_name': 'Selin'}),
])
poll_source(store, ben, connection, client)
drain()

code = store.setup_shared(admin_name='Alice', group_id=group, mappings={'Alice': alice, 'Ben': ben})
_, token = store.enter_shared(code=code, name='Alice')
store.db.execute('UPDATE shared_profiles SET introduced_at=1')
store.db.commit()
cards = atlas_view(store, alice, group)['memories']
print('ATLAS', json.dumps([{key: card[key] for key in ('title', 'source')} for card in cards]), flush=True)
print('FACETS', json.dumps(store.search(alice, group)['facets']), flush=True)
Path(root, 'session.json').write_text(json.dumps({'token': token, 'group': group}))
server = AppServer(('127.0.0.1', port), handler_for(store, dist=DIST))
print(f'serving {port}', flush=True)
try:
    server.serve_forever()
finally:
    store.close()
