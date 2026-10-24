"""Seed a realistic local archive and serve it. argv: port data_dir mode(noplace|someplace)"""
import hashlib, io, json, sys, threading, os
from pathlib import Path
from PIL import Image
from mazi.memories.memories import MemoryStore
from mazi.server import AppServer, handler_for
from mazi.atlas import atlas_view

port, root, mode = int(sys.argv[1]), sys.argv[2], sys.argv[3]
DIST = Path(__file__).parent / 'dist'
Path(root).mkdir(parents=True, exist_ok=True)
store = MemoryStore(root)
alice = store.register('alice@example.test', 'correct horse battery')
group = store.create_group(alice, 'Our circle')
source = store.create_source(alice, group, 'apple', 'Photos', {
    'start': '2020-01-01', 'end': '2030-01-01', 'albums': [], 'types': ['image']})
store.set_source(alice, source, True, 'authorized')


def jpeg(color, gps=False, when=None):
    image = Image.new('RGB', (40, 40), color)
    exif = Image.Exif()
    if when:
        exif[306] = when
    if gps:
        # Istanbul 41.0082 N, 28.9784 E
        exif[34853] = {1: 'N', 2: (41.0, 0.0, 29.52), 3: 'E', 4: (28.0, 58.0, 42.24)}
    out = io.BytesIO()
    image.save(out, 'JPEG', exif=exif)
    return out.getvalue()

assets = []
for index, (color, gps, date) in enumerate([('red', True, '2023-05-01'), ('blue', False, '2022-01-02'), ('green', False, '2021-07-03')]):
    data = jpeg(color, gps, date.replace('-', ':') + ' 12:00:00')
    resource = store.begin_resource(alice, source, {
        'item': str(index), 'component': 'photo', 'version': 'original',
        'filename': f'{color}.jpg', 'date': date, 'kind': 'image', 'albums': []
    }, len(data), hashlib.sha256(data).hexdigest())
    store.resource_chunk(alice, resource['id'], 0, data)
    store.finish_resource(alice, resource['id'])
    while store.work_once():
        pass
    asset = store.db.execute('SELECT asset_id FROM archive_origins WHERE run_id=?', (resource['id'],)).fetchone()[0]
    assets.append(asset)

payload = json.loads(store.db.execute('SELECT payload FROM archive_origins WHERE asset_id=?', (assets[0],)).fetchone()[0])
print('GPS photo location_assertions:', json.dumps(payload.get('location_assertions'))[:200], flush=True)
if mode == 'review':
    store.correct_asset(alice, assets[1], title='', capture_date=None, place='girne')
if mode == 'someplace':
    origin = store.db.execute('SELECT id FROM archive_origins WHERE asset_id=?', (assets[2],)).fetchone()[0]
    store.set_place(alice, origin, 'GR', 'Naxos', 37.1036, 25.3766, None)
code = store.setup_shared(admin_name='Alice', group_id=group, mappings={'Alice': alice})
_, token = store.enter_shared(code=code, name='Alice')
store.db.execute('UPDATE shared_profiles SET introduced_at=1'); store.db.commit()
cards = atlas_view(store, alice, group)['memories']
print('ATLAS', json.dumps([{k: c[k] for k in ('id', 'year', 'date', 'place')} for c in cards]), flush=True)
Path(root, 'session.json').write_text(json.dumps({'token': token, 'group': group}))
server = AppServer(('127.0.0.1', port), handler_for(store, dist=DIST))
print(f'serving {port}', flush=True)
try:
    server.serve_forever()
finally:
    store.close()
