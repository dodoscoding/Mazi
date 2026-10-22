"""Public import/share/download contract at the shared-location map boundary."""
import base64
import hashlib
import http.client
import io
import json
import threading
import zipfile
from http.server import HTTPServer
from unittest.mock import patch

from mazi.archive import review
from mazi.memories.memories import MemoryStore
from mazi.server import handler_for
from mazi.sources import sources
from tests.backend.imports.test_engine import picture
from tests.backend.sources.test_places_export import PlacesFixture


class PlacesHttpTests(PlacesFixture):
    store_type = MemoryStore

    def setUp(self):
        super().setUp()
        code = self.store.setup_shared(admin_name='Alice', group_id=self.group,
                                       mappings={'Alice': self.alice, 'Ben': self.ben})
        self.tokens = {user: self.store.enter_shared(code=code, name=name)[1]
                       for user, name in [(self.alice, 'Alice'), (self.ben, 'Ben')]}
        self.server = HTTPServer(('127.0.0.1', 0), handler_for(self.store))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.stop_server)

    def stop_server(self):
        self.server.shutdown()
        self.thread.join()
        self.server.server_close()

    def request(self, path, body=None, user=None, authenticated=True):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=30)
        headers = {'Cookie': 'mazi_session=' + self.tokens[user or self.alice]} if authenticated else {}
        if body is not None:
            headers['Content-Type'] = 'application/json'
        connection.request('GET' if body is None else 'POST', path,
                           None if body is None else json.dumps(body), headers)
        response = connection.getresponse()
        status, data, content_type = response.status, response.read(), response.headers['Content-Type']
        connection.close()
        return status, data, content_type

    def post(self, path, body, user=None):
        status, data, _ = self.request(path, body, user=user)
        self.assertIn(status, (200, 201), data)
        return json.loads(data)

    def import_public_origins(self, user, count, prefix):
        for start in range(0, count, 100):
            output = io.BytesIO()
            with zipfile.ZipFile(output, 'w') as archive:
                for number in range(start, min(start + 100, count)):
                    archive.writestr(f'{prefix}-{number:04d}.jpg', picture())
            data = output.getvalue()
            run = self.post('/api/imports/start', dict(group=self.group, source='manual',
                            namespace='places-http', size=len(data), sha256=hashlib.sha256(data).hexdigest(), options={}), user)['id']
            for offset in range(0, len(data), 256 * 1024):
                self.post('/api/imports/chunk', dict(id=run, offset=offset,
                          data=base64.b64encode(data[offset:offset + 256 * 1024]).decode()), user)
            self.post('/api/imports/finish', {'id': run}, user)
            self.assertTrue(self.store.scan(run))
            self.post('/api/imports/confirm', {'id': run}, user)
            while self.store.work_once():
                pass
            status, raw, _ = self.request('/api/imports/' + run, user=user)
            self.assertEqual((status, json.loads(raw)['state']), (200, 'COMPLETED'))
        status, raw, _ = self.request('/api/review/my-contributions?group=' + self.group, user=user)
        origins = json.loads(raw)
        self.assertEqual((status, len(origins)), (200, count))
        return origins

    def test_1001_shared_origins_export_completely_while_map_and_failures_remain_honest(self):
        origins = [(user, origin) for user, count, prefix in [(self.alice, 501, 'alice'), (self.ben, 500, 'ben')]
                   for origin in self.import_public_origins(user, count, prefix)]
        self.assertEqual(len({origin['asset'] for _, origin in origins}), 1)
        asset = origins[0][1]['asset']
        source_records = []
        for offset in range(0, 1001, 100):
            source_records.extend(self.store.origins(self.alice, asset, offset)['items'])
        query = '/api/places?group=' + self.group
        export = '/api/review/export?group=' + self.group
        for index, (user, origin) in enumerate(origins):
            if index == 1000:
                status, raw, _ = self.request(query)
                self.assertEqual((status, len(json.loads(raw)['points'])), (200, 1000))
            self.post('/api/places', dict(origin=origin['id'], country='NL', city='😀' * 200,
                      latitude=52.37, longitude=4.9, day=None if index % 4 == 0 else '2024-01-02'), user)
        for suffix, count in (('', 1001), ('&country=NL&city=Amsterdam', 0)):
            status, raw, content_type = self.request(query + suffix)
            self.assertEqual((status, len(json.loads(raw)['points'])), (200, count))
            self.assertIn('application/json', content_type)
        for path in (query, export):
            self.assertEqual(self.request(path, authenticated=False)[0], 403)
        self.assertFalse(self.store.settings(self.alice, self.group)['group_enabled'])
        self.assertFalse(self.store.settings(self.alice, self.group)['contribution_enabled'])
        status, data, content_type = self.request(export)
        self.assertEqual((status, content_type), (200, 'application/zip'))
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            points = json.loads(archive.read('places.json'))
            manifest = json.loads(archive.read('manifest.json'))
            self.assertEqual(len(points), 1001)
            self.assertEqual({p['origin'] for p in points}, {o['id'] for _, o in origins})
            self.assertTrue(all(p['city'] == '😀' * 200 for p in points))
            self.assertEqual(len(manifest['assets']), 1)
            self.assertEqual(manifest['assets'][0]['origins'], source_records)
            self.assertEqual(archive.read('originals/' + asset), picture())
        with patch.object(review, 'EXPORT_BYTES', len(data)):
            self.assertEqual(self.request(export)[0], 200)
        with patch.object(review, 'EXPORT_BYTES', len(data) - 1):
            status, raw, content_type = self.request(export)
            self.assertEqual((status, json.loads(raw)), (400, {'code': 'capacity_exceeded',
                              'error': 'Export exceeds the local 128 MiB archive limit'}))
            self.assertIn('application/json', content_type)
            self.assertFalse(raw.startswith(b'PK'))
        times = iter([0])
        with patch.object(sources.time, 'perf_counter', side_effect=lambda: next(times, 3.001)):
            status, raw, content_type = self.request(export)
            self.assertEqual((status, json.loads(raw)), (400, {'code': 'capacity_exceeded',
                              'error': 'Export exceeded the local location scan time budget'}))
            self.assertIn('application/json', content_type)
        status, raw, _ = self.request('/api/places', dict(origin=origins[0][1]['id'], country='NL',
                                      city='Amsterdam', latitude=91, longitude=4))
        self.assertEqual((status, json.loads(raw)), (400, {'error': 'Invalid request'}))
        last_user, last = origins[-1]
        self.post('/api/places', dict(origin=last['id'], latitude=None, longitude=None), last_user)
        status, raw, _ = self.request(query)
        self.assertEqual((status, len(json.loads(raw)['points'])), (200, 1000))
        with zipfile.ZipFile(io.BytesIO(self.request(export)[1])) as archive:
            self.assertEqual(len(json.loads(archive.read('places.json'))), 1000)
            self.assertEqual(json.loads(archive.read('manifest.json'))['assets'][0]['origins'], source_records)

    def test_over_twenty_thousand_authorized_rows_fail_before_filters_and_recover(self):
        origin = self.import_locations(1)[0]
        row = self.store.db.execute('SELECT * FROM archive_origins WHERE id=?', (origin['id'],)).fetchone()
        for number in range(20000):
            identifier = f'synthetic-overflow-{number:05d}'
            self.store.db.execute('INSERT INTO archive_origins VALUES(?,?,?,?,?,?,?,?,0)',
                                  (identifier, row['asset_id'], self.group, self.alice, row['run_id'], identifier, identifier, row['payload']))
            self.store.db.execute('INSERT INTO shared_places VALUES(?,?,?,?,?,?)',
                                  (identifier, 'NL', 'Amsterdam', 52, 4, None))
        self.store.db.commit()
        query = '/api/places?group=' + self.group
        for suffix in ('', '&country=NO&city=missing'):
            status, raw, content_type = self.request(query + suffix)
            self.assertEqual((status, json.loads(raw)), (400, {'code': 'capacity_exceeded',
                'error': 'Local map supports up to 20,000 location records within an 8 MiB response budget'}))
            self.assertIn('application/json', content_type)
        self.post('/api/places', dict(origin='synthetic-overflow-19999', latitude=None, longitude=None))
        status, raw, _ = self.request(query)
        points = json.loads(raw)['points']
        self.assertEqual((status, len(points), len({point['origin'] for point in points})), (200, 20000, 20000))

    def test_busy_location_scan_returns_retryable_json_and_recovers_after_unlock(self):
        from mazi.sources.sources import SourceStore
        self.import_locations(1)
        other = SourceStore(self.temp.name)
        self.addCleanup(other.close)
        self.store.db.execute('PRAGMA busy_timeout=1')
        other.db.execute('BEGIN IMMEDIATE')
        try:
            status, raw, content_type = self.request('/api/review/export?group=' + self.group)
            self.assertEqual((status, json.loads(raw)), (503, {'error': 'Archive is busy; retry shortly'}))
            self.assertIn('application/json', content_type)
            self.assertFalse(self.store.db.in_transaction)
        finally:
            other.db.rollback()
        status, raw, content_type = self.request('/api/review/export?group=' + self.group)
        self.assertEqual((status, content_type), (200, 'application/zip'))
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            self.assertEqual(len(json.loads(archive.read('places.json'))), 1)
