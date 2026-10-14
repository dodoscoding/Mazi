"""Opt-in real-model integration evaluation; no personal media or model dispatch."""
import argparse
import hashlib
import io
import json
import math
from pathlib import Path
import tempfile
import time
import zipfile
from PIL import Image, ImageDraw
from .clip_encoder import CLIPEncoder
from .discovery import DiscoveryStore
from mazi.identity.core import Denied


def evaluate(directory):
    encoder = CLIPEncoder(directory)
    fixture_path = Path(__file__).resolve().parents[2] / 'tests/backend/discovery/clip_queries.json'
    fixture = json.loads(fixture_path.read_text())
    assets_root = Path(__file__).resolve().parents[2] / 'public/media'
    with tempfile.TemporaryDirectory(prefix='mazi-clip-evaluation-') as root:
        store = DiscoveryStore(root, encoder=encoder)
        owner = store.register('owner@clip.test', 'synthetic evaluation only')
        viewer = store.register('viewer@clip.test', 'synthetic evaluation only')
        stranger = store.register('stranger@clip.test', 'synthetic evaluation only')
        group = store.create_group(owner, 'CLIP synthetic evaluation')
        store.accept(viewer, store.invite(owner, group))
        store.processing(owner, group, True, group_wide=True)
        store.processing(owner, group, True)
        output, identities, hashes = io.BytesIO(), {}, {}
        with zipfile.ZipFile(output, 'w') as archive:
            for index, scene in enumerate(fixture['scenes']):
                source = assets_root / (scene['id'] + '.webp')
                hashes[scene['id']] = hashlib.sha256(source.read_bytes()).hexdigest()
                image = Image.open(source).convert('RGB')
                photo = io.BytesIO()
                image.save(photo, 'JPEG', quality=90)
                name = f'asset-{index}.jpg'
                identities[name] = scene['id']
                archive.writestr(name, photo.getvalue())
            for index in range(20):
                image = Image.new('RGB', (224,224), (index*13 % 256, index*31 % 256, index*47 % 256))
                ImageDraw.Draw(image).rectangle((20,20,100+index,150), fill=(255-index*10, index*12, 40))
                photo = io.BytesIO()
                image.save(photo, 'JPEG')
                archive.writestr(f'asset-{index+5}.jpg', photo.getvalue())
        data = output.getvalue()
        run = store.begin_import(owner, group, 'manual', 'clip-smoke', len(data), hashlib.sha256(data).hexdigest(), {})
        for offset in range(0, len(data), 512*1024):
            store.write_chunk(owner, run, offset, data[offset:offset+512*1024])
        store.finish_transfer(owner, run)
        store.scan(run)
        store.confirm(owner, run)
        while store.work_once():
            pass
        expected = {}
        for row in store.db.execute('SELECT asset_id,payload FROM archive_origins'):
            name = json.loads(row['payload'])['original_filename']
            if name in identities:
                expected[identities[name]] = row['asset_id']
        cold = time.perf_counter()
        while store.index_batch(viewer, group, limit=5)['remaining']:
            pass
        cold = time.perf_counter() - cold
        times, outcomes = [], []
        for scene in fixture['scenes']:
            for query in scene['queries']:
                started = time.perf_counter()
                rows = store.search(viewer, group, query=query, mode='semantic', limit=100)['items']
                times.append(time.perf_counter()-started)
                rank = next((i+1 for i,r in enumerate(rows) if r['id']==expected[scene['id']]), None)
                outcomes.append(dict(query=query, expected=scene['id'], rank=rank))
        privacy = {}
        store.hide(viewer, expected['lake'], True)
        privacy['personal_hide'] = expected['lake'] not in {r['id'] for r in store.search(viewer, group, query='friends on a dock', mode='semantic', limit=100)['items']}
        try:
            store.search(stranger, group, query='lake', mode='semantic')
            privacy['outsider'] = False
        except Denied:
            privacy['outsider'] = True
        store.processing(owner, group, False)
        fallback = store.search(viewer, group, query='asset', mode='semantic')
        privacy['consent_purged'] = store.db.execute('SELECT count(*) FROM discovery_vectors').fetchone()[0] == 0
        privacy['keyword_survives'] = fallback['total'] == 24
        store.close()
        return dict(model=encoder.version, fixture_sha256=hashlib.sha256(fixture_path.read_bytes()).hexdigest(), image_sha256=hashes, candidates=25, questions=len(outcomes), recall_at_1=sum(r['rank']==1 for r in outcomes)/len(outcomes), recall_at_3=sum(r['rank'] is not None and r['rank']<=3 for r in outcomes)/len(outcomes), recall_at_10=sum(r['rank'] is not None and r['rank']<=10 for r in outcomes)/len(outcomes), warm_p95_seconds=sorted(times)[math.ceil(len(times)*.95)-1], cold_index_seconds=cold, privacy=privacy, limitations=fixture['note'], misses_at_1=[r for r in outcomes if r['rank'] != 1])


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', default='.models/clip-vit-base-patch32')
    result = evaluate(parser.parse_args().directory)
    print(json.dumps(result,indent=2))
    # Smoke floor only; this is not the production release target.
    if result['recall_at_1'] < .70 or not all(result['privacy'].values()):
        raise SystemExit(1)
