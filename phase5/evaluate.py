"""Repeatable fixed synthetic retrieval evaluation, isolated from encoder code."""
import hashlib
import io
import json
import math
from pathlib import Path
import tempfile
import time
import zipfile

from PIL import Image
from .discovery import DiscoveryStore
from .embeddings import BaselineEncoder


def evaluate():
    dataset_path = Path(__file__).parent / 'tests/retrieval_holdout.json'
    fixture = json.loads(dataset_path.read_text())
    with tempfile.TemporaryDirectory(prefix='mazi-retrieval-eval-') as root:
        store = DiscoveryStore(root, encoder=BaselineEncoder())
        owner = store.register('owner@eval.test', 'synthetic password only')
        viewer = store.register('viewer@eval.test', 'synthetic password only')
        outsider = store.register('outsider@eval.test', 'synthetic password only')
        group = store.create_group(owner, 'Synthetic evaluation')
        store.accept(viewer, store.invite(owner, group))
        store.processing(owner, group, True, group_wide=True)
        store.processing(owner, group, True)
        scenes = fixture['scenes']
        records = scenes + [dict(id=f'distractor-{i}',title=f'Inventory specimen number {i}') for i in range(100)]
        for start in range(0, len(records), 60):
            output = io.BytesIO()
            with zipfile.ZipFile(output, 'w') as archive:
                for i, record in enumerate(records[start:start+60], start):
                    picture = io.BytesIO()
                    image = Image.new('RGB', (24, 24), (i * 37 % 256, i * 71 % 256, i * 101 % 256))
                    image.putpixel((0, 0), (i, 255 - i, 127))
                    image.save(picture, 'PNG')
                    archive.writestr(record['id'] + '.png', picture.getvalue())
            data = output.getvalue()
            run = store.begin_import(owner, group, 'manual', 'evaluation', len(data), hashlib.sha256(data).hexdigest(), {})
            store.write_chunk(owner, run, 0, data)
            store.finish_transfer(owner, run)
            store.scan(run)
            store.confirm(owner, run)
            while store.work_once():
                pass
        ids = {}
        for row in store.db.execute('SELECT asset_id,payload FROM archive_origins'):
            key = Path(json.loads(row['payload'])['original_filename']).stem
            ids[key] = row['asset_id']
        for record in records:
            store.correct_asset(owner, ids[record['id']], title=record['title'], capture_date=None, place='')
        cold_start = time.perf_counter()
        store.search(viewer, group, mode='semantic', limit=10)
        cold_seconds = time.perf_counter() - cold_start
        times, hits, failures = [], 0, []
        for scene in scenes:
            for query in scene['queries']:
                begin = time.perf_counter()
                result = store.search(viewer, group, query=query, mode='semantic', limit=10)
                times.append(time.perf_counter() - begin)
                if ids[scene['id']] in {r['id'] for r in result['items']}:
                    hits += 1
                else:
                    failures.append(query)
        # These denial probes are reported separately from retrieval relevance.
        from phase1.core import Denied
        denial_checks = 0
        try:
            store.search(outsider, group, query='bicycle', mode='semantic')
        except Denied:
            denial_checks += 1
        store.hide(viewer, ids['cycle'], True)
        if ids['cycle'] not in {r['id'] for r in store.search(viewer, group, query='bike', mode='semantic')['items']}:
            denial_checks += 1
        store.remove_member(owner, group, viewer)
        try:
            store.search(viewer, group, mode='semantic')
        except Denied:
            denial_checks += 1
        metrics = store.db.execute('SELECT * FROM discovery_measurements WHERE group_id=?', (group,)).fetchone()
        result = dict(fixture_sha256=hashlib.sha256(dataset_path.read_bytes()).hexdigest(), candidates=len(ids), questions=len(times), recall_at_10=hits/len(times), target=0.85, target_met=hits/len(times)>=0.85, warm_p95_seconds=sorted(times)[math.ceil(len(times)*.95)-1], cold_index_and_search_seconds=cold_seconds, embeddings_computed=metrics['embeddings'], processing_wall_seconds_per_1000_embeddings=metrics['seconds']*1000/metrics['embeddings'], external_provider_cost_per_1000=0, privacy_probes_passed=denial_checks, privacy_probes_total=3, failed_questions=failures, limitation=fixture['description'])
        store.close()
        return result


if __name__ == '__main__':
    result = evaluate()
    print(json.dumps(result, indent=2, ensure_ascii=False))
    if not result['target_met'] or result['privacy_probes_passed'] != result['privacy_probes_total']:
        raise SystemExit(1)
