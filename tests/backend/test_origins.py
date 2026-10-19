import hashlib
import http.client
import json
import tempfile
import threading
import unittest
from http.server import HTTPServer
from pathlib import Path

from mazi.memories.memories import MemoryStore
from mazi.server import handler_for


class OriginTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = MemoryStore(Path(self.temp.name))
        self.code = self.store.setup_shared(admin_name='Alice')
        self.server = HTTPServer(('127.0.0.1', 0), handler_for(self.store))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.host = 'archive.example.test:8443'
        status, headers, _ = self.request('/api/entry', {'code': self.code, 'name': 'Alice'}, 'https://' + self.host)
        self.assertEqual(status, 200)
        self.cookie = headers['Set-Cookie'].split(';')[0]
        status, _, groups = self.request('/api/groups')
        self.assertEqual(status, 200)
        self.group = groups[0]['id']

    def tearDown(self):
        self.server.shutdown()
        self.thread.join()
        self.server.server_close()
        self.store.close()
        self.temp.cleanup()

    def request(self, path, body=None, origin=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port)
        headers = {'Host': self.host, 'Cookie': getattr(self, 'cookie', '')}
        if origin is not None:
            headers['Origin'] = origin
        if body is not None:
            headers['Content-Type'] = 'application/json'
        connection.request('GET' if body is None else 'POST', path,
                           json.dumps(body) if body is not None else None, headers)
        response = connection.getresponse()
        result = response.status, dict(response.getheaders()), json.loads(response.read())
        connection.close()
        return result

    def test_https_import_starts_and_report_is_readable(self):
        body = {'group': self.group, 'source': 'manual', 'namespace': 'synthetic',
                'size': 1, 'sha256': hashlib.sha256(b'x').hexdigest()}
        status, _, created = self.request('/api/imports/start', body, 'https://' + self.host)
        self.assertEqual(status, 201, created)
        status, _, report = self.request('/api/imports/' + created['id'])
        self.assertEqual(status, 200)
        self.assertEqual(report['id'], created['id'])

    def test_inherited_mutation_routes_accept_http_https_and_absent_origin(self):
        routes = (
            ('/api/introduction/complete', {}, 200),
            ('/api/imports/start', {'group': self.group, 'source': 'manual', 'namespace': 'synthetic',
                                    'size': 1, 'sha256': hashlib.sha256(b'x').hexdigest()}, 201),
            ('/api/review/correct', {}, 400),
            ('/api/sources/create', {'group': self.group, 'kind': 'apple', 'label': 'Synthetic',
                                     'scope': {'start': '2020-01-01', 'end': '2030-01-01',
                                               'albums': [], 'types': ['image']}}, 201),
            ('/api/places', {}, 400),
            ('/api/discovery/person', {'group': self.group, 'name': 'Synthetic person'}, 201),
            ('/api/answers/processing', {'group': self.group, 'enabled': False}, 200),
            ('/api/memories/notifications', {'group': self.group, 'enabled': False}, 200),
        )
        for origin in ('http://' + self.host, 'https://' + self.host, None):
            for path, body, expected in routes:
                with self.subTest(origin=origin, path=path):
                    status, _, result = self.request(path, body, origin)
                    self.assertEqual(status, expected, result)

    def test_foreign_and_malformed_origins_are_denied_on_every_mutation_boundary(self):
        origins = (
            'https://foreign.example.test:8443',
            'https://archive.example.test.evil.test:8443',
            'https://archive.example.test:9443',
            'https://archive.example.test',
            'null',
            '',
            'archive.example.test:8443',
            'ftp://' + self.host,
            'https://' + self.host + '/',
            'https://' + self.host + '?query',
            'https://' + self.host + '#fragment',
            'https://user@' + self.host,
            'https://' + self.host + ' https://foreign.example.test',
        )
        paths = ('/api/introduction/complete', '/api/imports/start', '/api/review/correct',
                 '/api/sources/create', '/api/places', '/api/discovery/person',
                 '/api/answers/processing', '/api/memories/notifications')
        for origin in origins:
            for path in paths:
                with self.subTest(origin=origin, path=path):
                    status, _, result = self.request(path, {'group': self.group, 'enabled': False}, origin)
                    self.assertEqual((status, result), (403, {'error': 'Invalid origin'}))
