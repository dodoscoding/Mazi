"""Seed a chat-only archive with no GPS and serve the built app. argv: port data_dir

Run from the repository root: PYTHONPATH=. .venv/bin/python work/poteto/place-on-map-20261024/evidence/seed_serve.py 8531 /tmp/dir
"""
import hashlib, io, json, sys, zipfile
from pathlib import Path
from PIL import Image
from mazi.atlas import atlas_view
from mazi.memories.memories import MemoryStore
from mazi.server import AppServer, handler_for

port, root = int(sys.argv[1]), sys.argv[2]
DIST = Path(__file__).resolve().parents[4] / 'dist'
Path(root).mkdir(parents=True, exist_ok=True)
store = MemoryStore(root)
alice = store.register('alice@example.test', 'correct horse battery')
group = store.create_group(alice, 'Our circle')


def jpeg(color):
    out = io.BytesIO()
    Image.new('RGB', (64, 48), color).save(out, 'JPEG')
    return out.getvalue()


def chat_import(namespace, lines, photos):
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w') as archive:
        archive.writestr('_chat.txt', '\n'.join(lines))
        for name, color in photos.items():
            archive.writestr(name, jpeg(color))
    data = output.getvalue()
    run = store.begin_import(alice, group, 'whatsapp', namespace, len(data), hashlib.sha256(data).hexdigest(), {'date_order': 'DMY'})
    store.write_chunk(alice, run, 0, data)
    store.finish_transfer(alice, run)
    store.scan(run)
    store.confirm(alice, run)
    while store.work_once():
        pass
    return [row[0] for row in store.db.execute('SELECT asset_id FROM archive_origins WHERE run_id=? ORDER BY id', (run,))]


lake = chat_import('lake', [
    '[12/07/2024, 18.02.11] Ana: we made it',
    '[12/07/2024, 18.03.40] Ana: <attached: lake-1.jpg>',
    '[12/07/2024, 18.03.52] Ana: <attached: lake-2.jpg>',
    '[12/07/2024, 18.05.09] Ben: the water is freezing',
], {'lake-1.jpg': 'steelblue', 'lake-2.jpg': 'teal'})
other = chat_import('dinner', [
    '[03/02/2023, 21.14.00] Deniz: <attached: dinner.jpg>',
    '[03/02/2023, 21.16.30] Maya: best night',
    '[20/09/2022, 10.01.00] Maya: <attached: harbour.jpg>',
], {'dinner.jpg': 'darkorange', 'harbour.jpg': 'seagreen'})
memory = store.review_event(alice, group, lake, 'Lake weekend', 'accept')
code = store.setup_shared(admin_name='Alice', group_id=group, mappings={'Alice': alice})
_, token = store.enter_shared(code=code, name='Alice')
store.db.execute('UPDATE shared_profiles SET introduced_at=1')
store.db.commit()
gps = store.db.execute("SELECT count(*) FROM archive_origins WHERE payload LIKE '%gps_exif%'").fetchone()[0]
cards = atlas_view(store, alice, group)['memories']
print('SEED', json.dumps({'gps_origins': gps, 'shared_places': store.db.execute('SELECT count(*) FROM shared_places').fetchone()[0],
                          'cards': [{k: c[k] for k in ('id', 'title', 'date', 'place')} for c in cards]}), flush=True)
Path(root, 'session.json').write_text(json.dumps({'token': token, 'group': group, 'memory': memory}))
server = AppServer(('127.0.0.1', port), handler_for(store, dist=DIST))
print(f'serving {port}', flush=True)
try:
    server.serve_forever()
finally:
    store.close()
