import unittest
from tests.backend import test_atlas
from mazi.identity.core import Conflict, Denied


class PhotoCorrectionTests(unittest.TestCase):
    setUp = test_atlas.AtlasTests.setUp
    tearDown = test_atlas.AtlasTests.tearDown

    def test_patch_preserves_other_fields_and_sibling(self):
        first, sibling = self.assets
        self.store.correct_asset(self.alice, first, title='Keep', capture_date='2020-01-02', place='Harbour', anniversary=True)
        before = dict(self.store.db.execute('SELECT * FROM review_annotations WHERE asset_id=?', (sibling,)).fetchone())
        state = self.store.photo_correction(self.ben, self.group, first)
        self.store.patch_photo(self.ben, self.group, first, {'place': 'A private garden'}, state['snapshot'])
        row = self.store.db.execute('SELECT * FROM review_annotations WHERE asset_id=?', (first,)).fetchone()
        self.assertEqual((row['title'], row['capture_date'], row['anniversary'], row['place']), ('Keep', '2020-01-02', 1, 'A private garden'))
        self.assertEqual(before, dict(self.store.db.execute('SELECT * FROM review_annotations WHERE asset_id=?', (sibling,)).fetchone()))
        with self.assertRaises(Conflict):
            self.store.patch_photo(self.ben, self.group, first, {'place': ''}, state['snapshot'])
        fresh = self.store.photo_correction(self.ben, self.group, first)
        with self.assertRaises(ValueError):
            self.store.patch_photo(self.ben, self.group, first, {'capture_date': None}, fresh['snapshot'])

    def test_origin_change_and_access_are_checked(self):
        asset = self.assets[0]
        state = self.store.photo_correction(self.ben, self.group, asset)
        self.store.db.execute("UPDATE archive_origins SET fingerprint='changed' WHERE asset_id=?", (asset,))
        self.store.db.commit()
        with self.assertRaises(Conflict):
            self.store.patch_photo(self.ben, self.group, asset, {'place': 'Paris'}, state['snapshot'])
        with self.assertRaises(Denied):
            self.store.photo_correction(self.outsider, self.group, asset)
        with self.assertRaises(ValueError):
            self.store.patch_photo(self.ben, self.group, asset, {'title': 'No'}, state['snapshot'])

    def test_reviewed_place_export_replaces_source_and_clear_restores_it(self):
        import io
        import json
        import zipfile
        asset = self.assets[0]
        origin = self.store.db.execute('SELECT id FROM archive_origins WHERE asset_id=?', (asset,)).fetchone()[0]
        self.store.set_place(self.alice, origin, 'NL', 'Amsterdam', 52.37, 4.9, '2020-01-02')
        def places():
            with zipfile.ZipFile(io.BytesIO(self.store.export_archive(self.ben, self.group))) as archive:
                return json.loads(archive.read('places.json'))
        state = self.store.photo_correction(self.ben, self.group, asset)
        self.store.patch_photo(self.ben, self.group, asset, {'place': 'Paris'}, state['snapshot'])
        points = places()
        self.assertEqual(len(points), 1)
        self.assertEqual(points[0]['city'], 'Paris')
        self.assertEqual(points[0]['method'], 'reviewed city centroid')
        state = self.store.photo_correction(self.ben, self.group, asset)
        self.store.patch_photo(self.ben, self.group, asset, {'place': 'A garden'}, state['snapshot'])
        self.assertEqual(places(), [])
        self.assertEqual(self.store.places(self.ben, self.group)['points'], [])
        state = self.store.photo_correction(self.ben, self.group, asset)
        self.store.patch_photo(self.ben, self.group, asset, {'place': ''}, state['snapshot'])
        self.assertEqual(places()[0]['city'], 'Amsterdam')
        self.store.set_place(self.alice, origin, '', '', None, None, None)
        self.assertEqual(places(), [])

    def test_hidden_group_and_field_boundaries(self):
        asset = self.assets[0]
        state = self.store.photo_correction(self.ben, self.group, asset)
        other = self.store.create_group(self.outsider, 'Other')
        with self.assertRaises(Denied):
            self.store.patch_photo(self.ben, other, asset, {'place': 'Paris'}, state['snapshot'])
        self.store.hide(self.ben, asset, True)
        with self.assertRaises(Denied):
            self.store.patch_photo(self.ben, self.group, asset, {'place': 'Paris'}, state['snapshot'])

    def test_http_snapshot_origin_and_allowlist(self):
        import http.client
        import json
        import threading
        from mazi.server import AppServer, handler_for
        token = self.store.login('ben@example.test', 'correct horse battery')
        server = AppServer(('127.0.0.1', 0), handler_for(self.store))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        def request(body=None, origin=None):
            connection = http.client.HTTPConnection('127.0.0.1', server.server_port)
            headers = {'Cookie': 'mazi_session=' + token, 'Content-Type': 'application/json'}
            if origin:
                headers['Origin'] = origin
            path = '/api/atlas/photo?group=' + self.group + '&asset=' + self.assets[0]
            connection.request('POST' if body else 'GET', path, json.dumps(body) if body else None, headers)
            response = connection.getresponse()
            result = response.status, json.loads(response.read())
            connection.close()
            return result
        try:
            # Shared handler deliberately rejects individual login cookies.
            code = self.store.setup_shared(admin_name='Alice', group_id=self.group, mappings={'Alice': self.alice, 'Ben': self.ben})
            _, token = self.store.enter_shared(code=code, name='Ben')
            status, state = request()
            self.assertEqual(status, 200)
            body = dict(group=self.group, asset=self.assets[0], changes={'place': 'Paris'}, expected_snapshot=state['snapshot'])
            self.assertEqual(request(body, 'https://outside.test')[0], 403)
            self.assertEqual(request(body)[0], 200)
            self.assertEqual(request(body)[0], 409)
            body['changes'] = {'anniversary': False}
            self.assertEqual(request(body)[0], 400)
        finally:
            server.shutdown()
            thread.join()
            server.server_close()

    def test_other_annotation_change_invalidates_snapshot_even_same_second(self):
        asset = self.assets[0]
        state = self.store.photo_correction(self.ben, self.group, asset)
        self.store.correct_asset(self.alice, asset, title='Another editor', capture_date='2020-01-02', place='Harbour')
        with self.assertRaises(Conflict):
            self.store.patch_photo(self.ben, self.group, asset, {'place': 'Paris'}, state['snapshot'])
        self.assertEqual(self.store.photo_correction(self.ben, self.group, asset)['annotation']['title'], 'Another editor')

    def test_reviewed_place_change_during_export_rejects_delivery_and_keeps_origins(self):
        from unittest.mock import patch
        asset = self.assets[0]
        origins = [tuple(row) for row in self.store.db.execute('SELECT id,fingerprint,payload FROM archive_origins ORDER BY id')]
        state = self.store.photo_correction(self.ben, self.group, asset)
        self.store.patch_photo(self.ben, self.group, asset, {'place': 'Paris'}, state['snapshot'])
        write = self.store._write_export_places
        def change_after_write(*args, **kwargs):
            write(*args, **kwargs)
            current = self.store.photo_correction(self.ben, self.group, asset)
            self.store.patch_photo(self.ben, self.group, asset, {'place': 'Istanbul'}, current['snapshot'])
        with patch.object(self.store, '_write_export_places', side_effect=change_after_write):
            with self.assertRaises(Conflict):
                self.store.export_archive(self.ben, self.group)
        self.assertEqual(origins, [tuple(row) for row in self.store.db.execute('SELECT id,fingerprint,payload FROM archive_origins ORDER BY id')])
