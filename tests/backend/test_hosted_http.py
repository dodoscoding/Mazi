"""Opt-in HTTP acceptance against a running hosted app and independent worker.

Set MAZI_TEST_HOSTED_HTTP=1, MAZI_TEST_HTTP_BASE_URL (loopback), and
MAZI_TEST_HTTP_FIXTURE (restricted synthetic D17 JSON). Run phase prepare,
restart API/worker with fresh scratch roots, then run phase verify. State and
cookies remain in a private MAZI_TEST_HTTP_STATE file pair; no backend key is used.
"""
import base64
import hashlib
import http.cookiejar
import json
import os
import time
import unittest
import uuid
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPCookieProcessor, Request, build_opener
from tests.backend.imports.test_engine import picture
from tests.backend.imports.test_adapters import zip_bytes


@unittest.skipUnless(os.environ.get('MAZI_TEST_HOSTED_HTTP') == '1', 'requires explicit hosted HTTP synthetic fixture')
class HostedHttpJourney(unittest.TestCase):
    def setUp(self):
        self.base = os.environ.get('MAZI_TEST_HTTP_BASE_URL', 'http://127.0.0.1:5186').rstrip('/')
        parsed = urlsplit(self.base)
        if parsed.scheme != 'http' or parsed.hostname not in ('127.0.0.1', 'localhost', '::1') or parsed.username or parsed.path or parsed.query or parsed.fragment:
            raise ValueError('HTTP acceptance requires a loopback app origin')
        self.state_path = Path(os.environ.get('MAZI_TEST_HTTP_STATE', '/tmp/mazi-hosted-http-state.json'))
        if os.environ.get('MAZI_TEST_HTTP_PHASE', 'full') in ('prepare', 'full') and (self.state_path.exists() or Path(str(self.state_path) + '.cookies').exists()):
            raise ValueError('Choose a fresh synthetic HTTP state path')
        self.cookies = http.cookiejar.LWPCookieJar(str(self.state_path) + '.cookies')
        self.client = build_opener(HTTPCookieProcessor(self.cookies))

    def request(self, path, body=None, *, status=200, client=None, origin=None):
        headers = {'Origin': origin or self.base}
        data = None
        if body is not None:
            headers['Content-Type'] = 'application/json'
            data = json.dumps(body).encode()
        request = Request(self.base + path, data=data, headers=headers)
        try:
            response = (client or self.client).open(request, timeout=30)
        except HTTPError as error:
            response = error
        with response:
            actual, payload, received = response.code, response.read(), response.headers
        self.assertEqual(actual, status, 'HTTP status mismatch for ' + path.split('?')[0])
        self.assertEqual(received.get('Cache-Control'), 'no-store')
        return json.loads(payload) if received.get_content_type() == 'application/json' else payload

    def poll(self, run, expected):
        deadline = time.monotonic() + 120
        while True:
            report = self.request('/api/imports/' + run)
            if report['state'] == expected:
                return report
            if report['state'] in ('FAILED', 'CANCELLED') or time.monotonic() >= deadline:
                self.fail('Independent worker did not reach ' + expected)
            time.sleep(0.5)

    def start(self, group, namespace, data):
        return self.request('/api/imports/start', {'group': group, 'source': 'manual', 'namespace': namespace, 'size': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'options': {}}, status=201)['id']

    def chunk(self, run, offset, data):
        return self.request('/api/imports/chunk', {'id': run, 'offset': offset, 'data': base64.b64encode(data).decode()})['received']

    def finish(self, run):
        self.request('/api/imports/finish', {'id': run})
        self.poll(run, 'INVENTORIED')
        self.request('/api/imports/confirm', {'id': run})
        report = self.poll(run, 'COMPLETED')
        self.assertEqual(report['counts'], {'AVAILABLE_TO_GROUP': 1})

    def save_state(self, state):
        with os.fdopen(os.open(self.state_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as stream:
            json.dump(state, stream)
        cookie_path = self.cookies.filename
        descriptor = os.open(cookie_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        os.close(descriptor)
        self.cookies.save(ignore_discard=True)
        os.chmod(cookie_path, 0o600)

    def prepare(self):
        fixture = json.loads(Path(os.environ['MAZI_TEST_HTTP_FIXTURE']).read_text())
        namespace = 'http-synthetic-' + uuid.uuid4().hex
        profile = self.request('/api/entry', {'code': fixture['code'], 'name': namespace})
        self.assertEqual(profile['group_id'], fixture['group'])
        self.assertFalse(profile['introduced'])
        self.assertTrue(self.request('/api/introduction/complete', {})['introduced'])
        for enabled in (True, False):
            self.request('/api/memories/notifications', {'group': fixture['group'], 'enabled': enabled})
            self.assertEqual(self.request('/api/memories/notifications?' + urlencode({'group': fixture['group']}))['enabled'], enabled)
        image = picture() + namespace.encode()
        data = zip_bytes({namespace + '.jpg': image})
        run = self.start(fixture['group'], namespace, data)
        midpoint = len(data) // 2
        self.assertEqual(self.chunk(run, 0, data[:midpoint]), midpoint)
        self.assertEqual(self.chunk(run, 0, data[:midpoint]), midpoint)
        self.request('/api/imports/chunk', {'id': run, 'offset': 0, 'data': base64.b64encode(b'conflicting bytes').decode()}, status=409)
        self.chunk(run, midpoint, data[midpoint:])
        self.finish(run)
        gallery = self.request('/api/archive?' + urlencode({'group': fixture['group']}))
        assets = [item for item in gallery if namespace in json.dumps(item['origins'])]
        self.assertEqual(len(assets), 1)
        asset = assets[0]['id']
        self.assertEqual(self.request('/api/archive/' + asset + '/original'), image)
        self.assertTrue(self.request('/api/archive/' + asset + '/preview').startswith(b'\xff\xd8'))
        self.assertGreater(self.request('/api/archive/' + asset + '/origins')['total'], 0)
        self.request('/api/atlas?' + urlencode({'group': fixture['group']}))
        anonymous = build_opener()
        self.request('/api/archive/' + asset + '/original', client=anonymous, status=403)
        self.request('/api/archive?' + urlencode({'group': str(uuid.uuid4())}), status=403)
        self.request('/api/imports/start', {'group': fixture['group']}, origin='https://untrusted.example', status=403)
        pending = self.start(fixture['group'], namespace + '-resume', data)
        self.chunk(pending, 0, data[:midpoint])
        self.save_state({'group': fixture['group'], 'profile': profile['user_id'], 'run': run, 'pending': pending, 'asset': asset, 'image': base64.b64encode(image).decode(), 'archive': base64.b64encode(data).decode(), 'received': midpoint})

    def verify(self):
        self.cookies.load(ignore_discard=True)
        state = json.loads(self.state_path.read_text())
        profile = self.request('/api/session')
        self.assertEqual(profile['user_id'], state['profile'])
        self.assertTrue(profile['introduced'])
        self.assertEqual(self.request('/api/archive/' + state['asset'] + '/original'), base64.b64decode(state['image']))
        self.assertEqual(self.request('/api/imports/' + state['pending'])['received'], state['received'])
        data = base64.b64decode(state['archive'])
        self.chunk(state['pending'], state['received'], data[state['received']:])
        self.finish(state['pending'])
        self.assertGreaterEqual(self.request('/api/archive/' + state['asset'] + '/origins')['total'], 2)
        self.assertTrue(self.request('/api/review/rendition/' + state['asset']).startswith(b'\xff\xd8'))
        self.assertTrue(self.request('/api/review/export?' + urlencode({'group': state['group']})).startswith(b'PK'))
        for run in (state['run'], state['pending']):
            self.request('/api/imports/withdraw', {'id': run})
        self.request('/api/archive/' + state['asset'] + '/original', status=403)
        self.request('/api/logout', {})
        self.assertFalse(list(self.cookies))
        self.request('/api/session', status=403)

    def test_actual_http_entry_import_worker_private_reads_and_restart(self):
        phase = os.environ.get('MAZI_TEST_HTTP_PHASE', 'full')
        if phase not in ('prepare', 'verify', 'full'):
            raise ValueError('Unknown HTTP acceptance phase')
        if phase in ('prepare', 'full'):
            self.prepare()
        if phase in ('verify', 'full'):
            self.verify()
