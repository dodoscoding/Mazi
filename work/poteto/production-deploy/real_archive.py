"""Measure one owner-supplied archive through the public HTTP API; prints aggregates only.

usage: python real_archive.py ARCHIVE.zip SOURCE WORKDIR [--model DIR] [--date-order DMY|MDY]
Runs a fresh local-backend server on a free port. Message text, filenames and
search hits are never printed.
"""
import argparse
import base64
import hashlib
import http.cookiejar
import json
import os
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
QUERIES = ['beach', 'birthday', 'food', 'night', 'car', 'friends', 'snow', 'party']
QUESTION = 'When did we last go to the beach?'


def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


class Client:
    def __init__(self, base):
        self.base = base
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def call(self, path, body=None):
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(self.base + path, data, method='GET' if body is None else 'POST',
                                         headers={'Content-Type': 'application/json', 'Origin': self.base})
        started = time.perf_counter()
        with self.opener.open(request, timeout=600) as response:
            raw = response.read()
        return raw, time.perf_counter() - started

    def json(self, path, body=None):
        raw, seconds = self.call(path, body)
        return json.loads(raw), seconds


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('archive')
    parser.add_argument('source')
    parser.add_argument('workdir')
    parser.add_argument('--model')
    parser.add_argument('--date-order', choices=('DMY', 'MDY'))
    args = parser.parse_args()
    data_dir = Path(args.workdir) / 'data'
    data_dir.mkdir(parents=True, exist_ok=False)
    env = {**os.environ, 'MAZI_BACKEND': 'local', 'MAZI_IMPORT_DATA_DIR': str(data_dir)}
    if args.model:
        env['MAZI_EMBEDDING_MODEL_DIR'] = args.model
    setup = subprocess.run([sys.executable, '-m', 'mazi.identity.setup_shared', '--root', str(data_dir), '--admin-name', 'Measure'],
                           cwd=ROOT, env=env, capture_output=True, text=True, check=True)
    code = setup.stdout.strip().rsplit(' ', 1)[1]
    port = free_port()
    env['MAZI_IMPORT_PORT'] = str(port)
    server = subprocess.Popen([sys.executable, '-m', 'mazi'], cwd=ROOT, env=env,
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    result = {'archive_bytes': os.path.getsize(args.archive), 'source': args.source, 'learned_model': bool(args.model), 'date_order': args.date_order}
    try:
        client = Client(f'http://127.0.0.1:{port}')
        for _ in range(100):
            try:
                client.call('/health')
                break
            except OSError:
                time.sleep(0.2)
        profile, _ = client.json('/api/entry', {'name': 'Measure', 'code': code})
        group = profile['group_id']
        payload = Path(args.archive).read_bytes()
        started = time.perf_counter()
        run, _ = client.json('/api/imports/start', {'group': group, 'source': args.source, 'namespace': 'measure',
                                                    'size': len(payload), 'sha256': hashlib.sha256(payload).hexdigest(), 'options': {'date_order': args.date_order} if args.date_order else {}})
        for offset in range(0, len(payload), 512 * 1024):
            client.json('/api/imports/chunk', {'id': run['id'], 'offset': offset,
                                               'data': base64.b64encode(payload[offset:offset + 512 * 1024]).decode()})
        client.json('/api/imports/finish', {'id': run['id']})
        result['transfer_seconds'] = round(time.perf_counter() - started, 2)
        while True:
            report, _ = client.json(f"/api/imports/{run['id']}?offset=0")
            if report['state'] == 'INVENTORIED':
                result['inventory_seconds'] = round(time.perf_counter() - started, 2)
                client.json('/api/imports/confirm', {'id': run['id']})
            if report['state'] in ('COMPLETED', 'FAILED', 'CANCELLED'):
                break
            time.sleep(0.5)
        result['import_seconds'] = round(time.perf_counter() - started, 2)
        result['import_state'] = report['state']
        result['import_error_present'] = bool(report['error'])
        result['discovered'] = report['discovered']
        result['outcomes'] = report['counts']
        result['unique_assets'] = report['unique_assets']
        reasons = {}
        failed = []
        offset = 0
        while offset is not None:
            page, _ = client.json(f"/api/imports/{run['id']}?offset={offset}")
            for item in page['items']:
                key = f"{item['outcome']}:{item['reason'] or '-'}"
                reasons[key] = reasons.get(key, 0) + 1
                if item['outcome'] == 'FAILED':
                    failed.append(item['id'])
                for warning in item['warnings'] or []:
                    label = warning if isinstance(warning, str) else json.dumps(warning, sort_keys=True)[:40]
                    reasons['warning:' + label.split(':')[0][:40]] = reasons.get('warning:' + label.split(':')[0][:40], 0) + 1
            offset = page['next_offset']
        result['outcome_reasons'] = reasons
        result['failed_items'] = len(failed)

        raw, seconds = client.call(f'/api/atlas?group={group}')
        atlas = json.loads(raw)
        cards = atlas.get('cards', atlas.get('memories', []))
        result['atlas'] = {'bytes': len(raw), 'seconds': round(seconds, 3), 'cards': len(cards),
                           'dated_cards': sum(1 for c in cards if c.get('date') or c.get('day'))}
        keyword = {}
        for query in QUERIES:
            page, seconds = client.json(f'/api/discovery/search?group={group}&query={query}&mode=keyword')
            keyword[query] = {'total': page['total'], 'seconds': round(seconds, 3)}
        result['keyword_search'] = keyword

        client.json('/api/discovery/processing', {'group': group, 'enabled': True, 'group_wide': True})
        client.json('/api/discovery/processing', {'group': group, 'enabled': True})
        started = time.perf_counter()
        batches = []
        while True:
            batch, seconds = client.json('/api/discovery/index', {'group': group, 'limit': 5})
            batches.append(seconds)
            if not batch['remaining'] or not batch['indexed']:
                break
        indexed_seconds = time.perf_counter() - started
        result['related_index'] = {'batches': len(batches), 'seconds': round(indexed_seconds, 2),
                                   'max_batch_seconds': round(max(batches), 3), 'remaining': batch['remaining']}
        related = {}
        for query in QUERIES:
            page, seconds = client.json(f'/api/discovery/search?group={group}&query={query}&mode=semantic')
            related[query] = {'total': page['total'], 'unindexed': page.get('unindexed'), 'seconds': round(seconds, 3),
                              'model': page.get('model') or page.get('encoder')}
        result['related_search'] = related

        client.json('/api/answers/processing', {'group': group, 'enabled': True, 'group_wide': True})
        client.json('/api/answers/processing', {'group': group, 'enabled': True})
        answer, seconds = client.json('/api/answers/ask', {'group': group, 'question': QUESTION})
        result['answer'] = {'seconds': round(seconds, 3), 'status': answer['status'], 'evidence': len(answer['evidence'])}

        raw, seconds = client.call(f'/api/review/export?group={group}')
        result['export'] = {'bytes': len(raw), 'seconds': round(seconds, 2), 'zip': raw[:2] == b'PK'}
    finally:
        server.terminate()
        server.wait(timeout=30)
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == '__main__':
    main()
