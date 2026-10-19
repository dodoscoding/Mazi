"""Real unified HTTP boundaries after ordinary synthetic imports cross local limits."""
import hashlib
import http.client
import io
import json
import tempfile
import threading
import unittest
import zipfile
from http.server import HTTPServer
from types import SimpleNamespace

from PIL import Image
from mazi.memories.memories import MemoryStore
from mazi.server import handler_for


class CapacityHttpTests(unittest.TestCase):
    def test_capacity_is_explicit_while_validation_and_access_remain_protected(self):
        with tempfile.TemporaryDirectory() as root:
            store = MemoryStore(root)
            self.addCleanup(store.close)
            user = store.register('capacity-http@example.test', 'synthetic capacity password')
            group = store.create_group(user, 'Capacity circle')
            code = store.setup_shared(admin_name='Alice', group_id=group, mappings={'Alice': user})
            _, token = store.enter_shared(code=code, name='Alice')
            for start in range(0, 1001, 100):
                output = io.BytesIO()
                with zipfile.ZipFile(output, 'w') as archive:
                    for number in range(start, min(start + 100, 1001)):
                        image = io.BytesIO()
                        Image.new('RGB', (8, 8), (number % 256, number // 256, 100)).save(image, 'PNG')
                        archive.writestr(f'photo-{number}.png', image.getvalue())
                data = output.getvalue()
                run = store.begin_import(user, group, 'manual', 'capacity-http', len(data), hashlib.sha256(data).hexdigest(), {})
                for offset in range(0, len(data), 256 * 1024):
                    store.write_chunk(user, run, offset, data[offset:offset + 256 * 1024])
                store.finish_transfer(user, run)
                store.scan(run)
                store.confirm(user, run)
                while store.work_once():
                    pass
                self.assertEqual(store.report(user, run)['state'], 'COMPLETED')
            self.assertEqual(len(store._visible_ids(user, group)), 1001)
            store.processing(user, group, True, group_wide=True)
            store.processing(user, group, True)
            store.answer_processing(user, group, True, group_wide=True)
            store.answer_processing(user, group, True)
            server = HTTPServer(('127.0.0.1', 0), handler_for(store))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()

            def request(path, body=None, authenticated=True):
                connection = http.client.HTTPConnection('127.0.0.1', server.server_port)
                headers = {'Cookie': 'mazi_session=' + token if authenticated else ''}
                if body is not None:
                    headers['Content-Type'] = 'application/json'
                connection.request('GET' if body is None else 'POST', path,
                                   None if body is None else json.dumps(body), headers)
                response = connection.getresponse()
                result = response.status, json.loads(response.read())
                connection.close()
                return result

            try:
                asset = store.gallery(user, group)[0]['id']
                checks = [
                    (f'/api/discovery/search?group={group}', None, 'Local search limit is 1,000 items'),
                    ('/api/answers/ask', {'group': group, 'question': 'Where were these photographs taken?'}, 'Local Memory answers support up to 1,000 visible photographs'),
                    (f'/api/answers/evidence?group={group}&asset={asset}', None, 'Local Memory answers support up to 1,000 visible photographs'),
                    (f'/api/review/events?group={group}', None, 'Review set exceeds local limit'),
                    (f'/api/review/duplicates?group={group}', None, 'Review set exceeds local limit'),
                ]
                for path, body, message in checks:
                    with self.subTest(path=path):
                        self.assertEqual(request(path, body), (400, {'code': 'capacity_exceeded', 'error': message}))
                        self.assertEqual(request(path, body, authenticated=False)[0], 403)
                original_encoder = store.encoder
                store.encoder = SimpleNamespace(ready=True)
                try:
                    self.assertEqual(request('/api/discovery/index', {'group': group, 'limit': 2}, authenticated=False)[0], 403)
                    self.assertEqual(request('/api/discovery/index', {'group': group, 'limit': 2}),
                                     (400, {'code': 'capacity_exceeded', 'error': 'Local index limit is 1,000 items'}))
                finally:
                    store.encoder = original_encoder
                for path, body in [
                    (f'/api/discovery/search?group={group}&offset=bad', None),
                    (f'/api/review/timeline?group={group}&offset=bad', None),
                    ('/api/answers/ask', {'group': group, 'question': ''}),
                ]:
                    self.assertEqual(request(path, body), (400, {'error': 'Invalid request'}))
                status, gallery = request(f'/api/archive?group={group}')
                self.assertEqual((status, len(gallery)), (200, 30))
                status, timeline = request(f'/api/review/timeline?group={group}')
                self.assertEqual((status, timeline['total']), (200, 1001))
                # A real visibility change back to the supported boundary restores search.
                store.hide(user, gallery[0]['id'], True)
                status, search = request(f'/api/discovery/search?group={group}')
                self.assertEqual((status, search['total']), (200, 1000))
                self.assertNotIn('code', search)
                status, answer = request('/api/answers/ask', {'group': group, 'question': 'Where were these photographs taken?'})
                self.assertEqual(status, 200, answer)
                self.assertNotIn('code', answer)
            finally:
                server.shutdown()
                thread.join()
                server.server_close()
