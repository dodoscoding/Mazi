"""Seed chat-only photos like production (no EXIF) and serve the built app. argv: port data_dir"""
import hashlib, io, json, sys, zipfile
from pathlib import Path
from PIL import Image
from mazi.memories.memories import MemoryStore
from mazi.server import AppServer, handler_for
from mazi.atlas import atlas_view
from mazi.sources.discord import poll_source
from tests.backend.sources.test_discord import FakeDiscord, link, message, paged

port, root = int(sys.argv[1]), sys.argv[2]
DIST = Path(__file__).resolve().parents[4] / 'dist'
Path(root).mkdir(parents=True, exist_ok=True)
store = MemoryStore(root)
alice = store.register('alice@example.test', 'correct horse battery')
group = store.create_group(alice, 'Our circle')


def jpeg(color):
    out = io.BytesIO()
    Image.new('RGB', (480, 360), color).save(out, 'JPEG')
    return out.getvalue()


def drain():
    while store.work_once():
        pass


def upload(source, files, options=None):
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w') as archive:
        for name, data in files.items():
            archive.writestr(name, data)
    data = out.getvalue()
    run = store.begin_import(alice, group, source, 'evidence', len(data), hashlib.sha256(data).hexdigest(), options or {})
    store.write_chunk(alice, run, 0, data)
    store.finish_transfer(alice, run)
    store.scan(run)
    store.confirm(alice, run)
    drain()
    return [row[0] for row in store.db.execute('SELECT asset_id FROM archive_origins WHERE run_id=? ORDER BY rowid', (run,))]


# WhatsApp chat whose photo lines are all ambiguous (04/05, 05/04); a later text line (23/05) settles DMY.
chat = ('04/05/2024, 21:00 - Ana: a.jpg (file attached)\n'
        '05/04/2024, 09:00 - Ana: b.jpg (file attached)\n'
        '05/04/2024, 09:01 - Ben: Lovely\n'
        '23/05/2024, 10:00 - Ben: Back home')
whatsapp = upload('whatsapp', {'WhatsApp Chat with Lake.txt': chat, 'a.jpg': jpeg('seagreen'), 'b.jpg': jpeg('steelblue')})
# A manual photo with no date at all, grouped with a dated chat photo.
[undated] = upload('manual', {'undated.jpg': jpeg('sienna')})
store.review_event(alice, group, [whatsapp[0], undated], 'Lake evening', 'accept')

# Discord bot photos: one imported by the fixed code, one rewritten to the shape production rows have.
link(store, alice, group)
connection = store.create_source(alice, group, 'discord', 'Lake', {
    'guild': '10', 'channels': ['20'], 'start': '2024-01-01', 'end': '2024-12-31'})
store.set_source(alice, connection, True, 'authorized')
client = FakeDiscord()
store.discord_authorize = client.authorize
client.messages = paged([message(1, 'Göle vardık', author={'id': '31', 'global_name': 'Ayşe'}),
                         message(2, 'Look at this', attachments=[1], author={'id': '32', 'username': 'mehmet'}),
                         message(3, 'And this one', attachments=[1], author={'id': '31', 'global_name': 'Ayşe'})])
client.attachment = lambda attachment: jpeg('goldenrod' if attachment['id'] == '42' else 'indianred')
poll_source(store, alice, connection, client)
drain()
for row in store.db.execute('SELECT id,payload FROM archive_origins').fetchall():
    payload = json.loads(row['payload'])
    if payload['source_type'] == 'discord' and payload['sender'].get('label') == 'Ayşe':
        payload['shared_at_assertion'] = {'raw': payload['shared_at_assertion']['raw'], 'source': 'discord_message'}
        store.db.execute('UPDATE archive_origins SET payload=? WHERE id=?', (json.dumps(payload), row['id']))
store.db.commit()

code = store.setup_shared(admin_name='Alice', group_id=group, mappings={'Alice': alice})
_, token = store.enter_shared(code=code, name='Alice')
store.db.execute('UPDATE shared_profiles SET introduced_at=1'); store.db.commit()
cards = atlas_view(store, alice, group)['memories']
print('ATLAS', json.dumps([{'id': c['id'], 'title': c['title'], 'year': c['year'], 'date': c['date'],
                            'shared': [[p['sharedAt'] for p in photo.get('provenance', [])] for photo in c['photos']]}
                           for c in cards], ensure_ascii=False, indent=1), flush=True)
Path(root, 'session.json').write_text(json.dumps({'token': token, 'group': group,
                                                  'memory': next(c['id'] for c in cards if c['kind'] == 'memory')}))
server = AppServer(('127.0.0.1', port), handler_for(store, dist=DIST))
print(f'serving {port}', flush=True)
try:
    server.serve_forever()
finally:
    store.close()
