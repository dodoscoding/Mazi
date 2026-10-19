"""Complete location exports through public store operations on synthetic archives."""
import hashlib
import io
import json
import tempfile
import unittest
import zipfile

from mazi.capacity import CapacityExceeded
from mazi.identity.core import Denied
from mazi.memories.memories import MemoryStore
from mazi.sources.sources import SourceStore
from tests.backend.imports.test_engine import picture


class PlacesFixture(unittest.TestCase):
    store_type = SourceStore

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.store = self.store_type(self.temp.name)
        self.addCleanup(self.store.close)
        self.alice = self.store.register('alice@example.test', 'synthetic places password')
        self.ben = self.store.register('ben@example.test', 'synthetic places password')
        self.outsider = self.store.register('other@example.test', 'synthetic places password')
        self.group = self.store.create_group(self.alice, 'Places circle')
        self.store.accept(self.ben, self.store.invite(self.alice, self.group))

    def import_locations(self, count, *, user=None, group=None, prefix='photo', city='Amsterdam', image_bytes=None, extension='jpg'):
        user, group = user or self.alice, group or self.group
        old = {row['id'] for row in self.store.owned_origins(user, group)}
        origins = []
        for start in range(0, count, 100):
            output = io.BytesIO()
            with zipfile.ZipFile(output, 'w') as archive:
                for number in range(start, min(start + 100, count)):
                    data = image_bytes(number) if callable(image_bytes) else image_bytes or picture()
                    archive.writestr(f'{prefix}-{number:05d}.{extension}', data)
            data = output.getvalue()
            run = self.store.begin_import(user, group, 'manual', 'places-export', len(data), hashlib.sha256(data).hexdigest(), {})
            for offset in range(0, len(data), 256 * 1024):
                self.store.write_chunk(user, run, offset, data[offset:offset + 256 * 1024])
            self.store.finish_transfer(user, run)
            self.store.scan(run)
            self.store.confirm(user, run)
            while self.store.work_once():
                pass
            self.assertEqual(self.store.report(user, run)['counts'], {'AVAILABLE_TO_GROUP': min(100, count - start)})
            batch = [row for row in self.store.owned_origins(user, group) if row['id'] not in old]
            origins.extend(batch)
            old.update(row['id'] for row in batch)
        self.assertEqual(len(origins), count)
        for index, origin in enumerate(origins):
            self.store.set_place(user, origin['id'], 'NL', city, 52.37, 4.9,
                                 None if index % 4 == 0 else '2024-01-02' if index % 4 < 3 else '2024-01-03')
        return origins

    def exported(self, user=None, group=None):
        return zipfile.ZipFile(io.BytesIO(self.store.export_archive(user or self.alice, group or self.group)))


class SourcePlacesExportTests(PlacesFixture):
    def test_map_keeps_complete_limit_and_typed_failure_before_filters(self):
        origins = self.import_locations(1000)
        self.assertEqual(len(self.store.places(self.alice, self.group)['points']), 1000)
        self.import_locations(1, prefix='extra')
        for filters in ({}, {'country': 'NL', 'city': 'Amsterdam'}):
            with self.assertRaisesRegex(CapacityExceeded, '1,000 shared location records'):
                self.store.places(self.alice, self.group, **filters)
        self.store.set_place(self.alice, origins[0]['id'], '', '', None, None, None)
        self.assertEqual(len(self.store.places(self.alice, self.group)['points']), 1000)

    def test_export_keeps_all_1001_locations_and_original_source_records(self):
        origins = self.import_locations(1001)
        before = self.store.owned_origins(self.alice, self.group)
        with self.exported() as archive:
            places = json.loads(archive.read('places.json'))
            manifest = json.loads(archive.read('manifest.json'))
            self.assertEqual(len(manifest['assets']), 1)
            self.assertEqual(len(manifest['assets'][0]['origins']), 1001)
            self.assertEqual(archive.read('originals/' + origins[0]['asset']), picture())
            self.assertEqual({p['origin'] for p in places}, {o['id'] for o in origins})
            self.assertEqual(len(places), 1001)
            self.assertEqual([(p['day'] or '', p['origin']) for p in places],
                             sorted((p['day'] or '', p['origin']) for p in places))
        self.assertEqual(self.store.owned_origins(self.alice, self.group), before)
        with self.assertRaises(CapacityExceeded):
            self.store.places(self.alice, self.group)


class PlacesProjectionTests(PlacesFixture):
    def test_public_maximum_unicode_and_nul_city_round_trip(self):
        origin = self.import_locations(1)[0]
        for city in ('😀' * 200, '\0' + 'x' * 199):
            with self.subTest(city=repr(city[:5])):
                self.store.set_place(self.alice, origin['id'], 'NL', city, -90, 180, None)
                with self.exported() as archive:
                    raw = archive.read('places.json')
                    row = json.loads(raw)[0]
                    self.assertEqual(row['city'], city)
                    self.assertEqual((row['latitude'], row['longitude'], row['day']), (-90, 180, None))
                    self.assertLessEqual(len(raw) - 2, 2048)

    def test_robustness_oversized_stored_cells_are_rejected_before_driver_transfer(self):
        import sqlite3
        origin = self.import_locations(1)[0]
        for field, value in [('city', '😀' * 100000), ('city', '\0' + 'x' * 100000),
                             ('country', 'x' * 100000), ('day', 'x' * 100000),
                             ('latitude', 'x' * 100000), ('longitude', 'x' * 100000)]:
            with self.subTest(field=field, prefix=repr(value[:2])):
                previous = self.store.db.execute('SELECT ' + field + ' FROM shared_places WHERE origin=?', (origin['id'],)).fetchone()[0]
                self.store.db.execute('UPDATE shared_places SET ' + field + '=? WHERE origin=?', (value, origin['id']))
                self.store.db.commit()
                projected = []
                def observe(cursor, values):
                    row = sqlite3.Row(cursor, values)
                    if field in row.keys() and 'origin' in row.keys() and 'asset_id' in row.keys():
                        projected.append(row[field])
                    return row
                self.store.db.row_factory = observe
                try:
                    with self.assertRaisesRegex(CapacityExceeded, 'location record'):
                        self.store.export_archive(self.alice, self.group)
                finally:
                    self.store.db.row_factory = sqlite3.Row
                    self.store.db.execute('UPDATE shared_places SET ' + field + '=? WHERE origin=?', (previous, origin['id']))
                    self.store.db.commit()
                self.assertEqual(projected, [None])
        self.assertFalse(self.store.db.in_transaction)

    def test_robustness_malformed_stored_location_is_never_written(self):
        origin = self.import_locations(1)[0]
        for field, value in [('city', 'x' * 201), ('city', '\0' + 'x' * 200), ('city', '  '),
                             ('country', '1A'), ('day', '2024-02-30'), ('day', ''),
                             ('latitude', 91), ('longitude', float('inf')), ('latitude', 'bad')]:
            with self.subTest(field=field, value=repr(value)[:30]):
                previous = self.store.db.execute('SELECT ' + field + ' FROM shared_places WHERE origin=?', (origin['id'],)).fetchone()[0]
                self.store.db.execute('UPDATE shared_places SET ' + field + '=? WHERE origin=?', (value, origin['id']))
                self.store.db.commit()
                try:
                    with self.assertRaises(ValueError):
                        self.store.export_archive(self.alice, self.group)
                finally:
                    self.store.db.execute('UPDATE shared_places SET ' + field + '=? WHERE origin=?', (previous, origin['id']))
                    self.store.db.commit()


class PlacesBudgetTests(PlacesFixture):
    def test_remaining_archive_budget_prevents_an_oversized_location_write(self):
        from unittest.mock import patch
        from mazi.archive import review
        self.import_locations(2, city='😀' * 200)
        with self.exported() as archive:
            info = archive.getinfo('places.json')
            raw = archive.read('places.json')
            data_start = info.header_offset + 30 + len(info.filename.encode())
        limit = data_start + len(raw) - 2
        writes = []
        original = zipfile._ZipWriteFile.write
        def observe(member, data):
            if member._zinfo.filename == 'places.json':
                writes.append((member._fileobj.tell(), len(data)))
            return original(member, data)
        with patch.object(review, 'EXPORT_BYTES', limit), patch.object(zipfile._ZipWriteFile, 'write', observe):
            with self.assertRaisesRegex(CapacityExceeded, '128 MiB archive limit'):
                self.store.export_archive(self.alice, self.group)
        self.assertTrue(writes)
        self.assertTrue(all(offset + count <= limit for offset, count in writes), writes)

    def test_serialized_utf8_row_ceiling_accepts_exact_and_rejects_one_more_byte(self):
        from unittest.mock import patch
        from mazi.sources import sources
        self.import_locations(1, city='😀' * 200)
        with self.exported() as archive:
            raw = archive.read('places.json')
        with patch.object(sources, 'PLACES_EXPORT_ROW_BYTES', len(raw) - 2):
            with self.exported() as archive:
                self.assertEqual(archive.read('places.json'), raw)
        with patch.object(sources, 'PLACES_EXPORT_ROW_BYTES', len(raw) - 3):
            with self.assertRaisesRegex(CapacityExceeded, '2 KiB serialized limit'):
                self.store.export_archive(self.alice, self.group)

    def test_cooperative_deadline_exhaustion_never_returns_a_partial_archive(self):
        from unittest.mock import patch
        from mazi.sources import sources
        self.import_locations(1)
        for phase, zeroes in [('before first page', 1), ('after first page', 2),
                              ('during row encoding', 4), ('after final page', 5)]:
            with self.subTest(phase=phase):
                times = iter([0] * zeroes)
                with patch.object(sources.time, 'perf_counter', side_effect=lambda: next(times, 3.001)):
                    with self.assertRaisesRegex(CapacityExceeded, 'location scan time budget'):
                        self.store.export_archive(self.alice, self.group)
        self.assertFalse(self.store.db.in_transaction)
        times = iter([0])
        with patch.object(sources.time, 'perf_counter', side_effect=lambda: next(times, 3)):
            with self.exported() as archive:
                self.assertEqual(len(json.loads(archive.read('places.json'))), 1)


class PlacesPaginationTests(PlacesFixture):
    def test_exact_null_first_day_and_origin_order_across_page_boundaries(self):
        for count in (0, 1, 127, 128, 129):
            with self.subTest(count=count):
                group = self.store.create_group(self.alice, 'Page boundary ' + str(count))
                origins = self.import_locations(count, group=group)
                expected = sorted((('' if index % 4 == 0 else '2024-01-02' if index % 4 < 3 else '2024-01-03'), origin['id'])
                                  for index, origin in enumerate(origins))
                with self.exported(group=group) as archive:
                    places = json.loads(archive.read('places.json'))
                self.assertEqual([(p['day'] or '', p['origin']) for p in places], expected)
                self.assertEqual(len({p['origin'] for p in places}), count)

    def test_persisted_non_uuid_identifiers_still_export(self):
        original = self.import_locations(1)[0]
        with self.store.transaction():
            self.store.db.execute('PRAGMA defer_foreign_keys=ON')
            self.store.db.execute('UPDATE archive_assets SET id=? WHERE id=?', ('synthetic-asset', original['asset']))
            self.store.db.execute('UPDATE archive_origins SET id=?,asset_id=? WHERE id=?',
                                  ('synthetic-origin', 'synthetic-asset', original['id']))
            self.store.db.execute('UPDATE shared_places SET origin=? WHERE origin=?', ('synthetic-origin', original['id']))
        with self.exported() as archive:
            point = json.loads(archive.read('places.json'))[0]
            self.assertEqual((point['origin'], point['asset_id']), ('synthetic-origin', 'synthetic-asset'))
            self.assertEqual(archive.read('originals/synthetic-asset'), picture())

    def test_robustness_oversized_persisted_identifiers_are_rejected(self):
        original = self.import_locations(1)[0]
        for field in ('origin', 'asset_id'):
            with self.subTest(field=field):
                with self.store.transaction():
                    self.store.db.execute('PRAGMA defer_foreign_keys=ON')
                    if field == 'origin':
                        self.store.db.execute('UPDATE archive_origins SET id=? WHERE id=?', ('x' * 37, original['id']))
                        self.store.db.execute('UPDATE shared_places SET origin=? WHERE origin=?', ('x' * 37, original['id']))
                    else:
                        self.store.db.execute('UPDATE archive_assets SET id=? WHERE id=?', ('x' * 37, original['asset']))
                        self.store.db.execute('UPDATE archive_origins SET asset_id=?', ('x' * 37,))
                with self.assertRaisesRegex(CapacityExceeded, 'location record'):
                    self.store.export_archive(self.alice, self.group)
                with self.store.transaction():
                    self.store.db.execute('PRAGMA defer_foreign_keys=ON')
                    if field == 'origin':
                        self.store.db.execute('UPDATE archive_origins SET id=? WHERE id=?', (original['id'], 'x' * 37))
                        self.store.db.execute('UPDATE shared_places SET origin=? WHERE origin=?', (original['id'], 'x' * 37))
                    else:
                        self.store.db.execute('UPDATE archive_assets SET id=? WHERE id=?', (original['asset'], 'x' * 37))
                        self.store.db.execute('UPDATE archive_origins SET asset_id=?', (original['asset'],))


class PlacesScanConsistencyTests(PlacesFixture):
    def test_date_change_cannot_duplicate_a_location_across_keyset_pages(self):
        import threading
        origins = self.import_locations(129)
        other = SourceStore(self.temp.name)
        self.addCleanup(other.close)
        changed, trigger = threading.Event(), threading.Event()
        failures = []
        def change_day():
            trigger.wait(5)
            try:
                other.set_place(self.alice, origins[0]['id'], 'NL', 'Moved after scan', 52, 4, '2025-01-01')
            except Exception as error:
                failures.append(error)
            finally:
                changed.set()
        writer = threading.Thread(target=change_day)
        writer.start()
        connection = self.store.db
        pages = []
        class ObservePages:
            def __getattr__(self, name):
                return getattr(connection, name)
            def execute(self, sql, values=()):
                cursor = connection.execute(sql, values)
                if 'AS oversized' not in sql:
                    return cursor
                class Page:
                    def fetchall(self):
                        rows = cursor.fetchall()
                        pages.append(len(rows))
                        if len(pages) == 1:
                            trigger.set()
                            changed.wait(0.1)
                        return rows
                return Page()
        self.store.db = ObservePages()
        try:
            with self.exported() as archive:
                points = json.loads(archive.read('places.json'))
        finally:
            self.store.db = connection
            trigger.set()
            writer.join(6)
        self.assertFalse(writer.is_alive())
        self.assertEqual(failures, [])
        self.assertEqual(len(points), 129)
        self.assertEqual({p['origin'] for p in points}, {o['id'] for o in origins})
        self.assertEqual(next(p for p in points if p['origin'] == origins[0]['id'])['day'], None)
        self.assertEqual(next(p for p in self.store.places(self.alice, self.group)['points']
                              if p['origin'] == origins[0]['id'])['day'], '2025-01-01')
        self.assertTrue(all(count <= 128 for count in pages))
        self.assertFalse(connection.in_transaction)


class SourcePlacesPrivacyTests(PlacesFixture):
    def test_current_origin_owners_and_circle_boundary_include_requester_in_both_circles(self):
        alice = self.import_locations(2)
        ben = self.import_locations(2, user=self.ben, prefix='ben')
        other_group = self.store.create_group(self.outsider, 'Other circle')
        self.store.accept(self.alice, self.store.invite(self.outsider, other_group))
        other = self.import_locations(2, user=self.outsider, group=other_group, prefix='other')
        with self.exported() as archive:
            self.assertEqual({p['origin'] for p in json.loads(archive.read('places.json'))},
                             {o['id'] for o in alice + ben})
            self.assertEqual(len(json.loads(archive.read('manifest.json'))['assets']), 1)
        with self.exported(group=other_group) as archive:
            self.assertEqual({p['origin'] for p in json.loads(archive.read('places.json'))}, {o['id'] for o in other})
        self.store.delete_origin(self.alice, alice[0]['id'])
        with self.exported() as archive:
            self.assertEqual({p['origin'] for p in json.loads(archive.read('places.json'))},
                             {o['id'] for o in alice[1:] + ben})
        self.store.remove_member(self.alice, self.group, self.ben)
        with self.assertRaises(Denied):
            self.store.export_archive(self.ben, self.group)
        self.store.accept(self.ben, self.store.invite(self.alice, self.group))
        with self.exported() as archive:
            self.assertEqual([p['origin'] for p in json.loads(archive.read('places.json'))], [alice[1]['id']])
            self.assertEqual(len(json.loads(archive.read('manifest.json'))['assets']), 1)
        with self.assertRaises(Denied):
            self.store.export_archive(self.ben, other_group)
        with self.assertRaises(Denied):
            self.store.set_place(self.ben, ben[0]['id'], 'NL', 'No resurrection', 52, 4, None)

    def test_source_pause_and_permission_revocation_keep_completed_locations(self):
        source = self.store.create_source(self.alice, self.group, 'apple', 'Synthetic library',
                     dict(start='2020-01-01', end='2030-01-01', albums=[], types=['image']))
        self.store.set_source(self.alice, source, True, 'authorized')
        data = picture()
        resource = self.store.begin_resource(self.alice, source,
                       dict(item='photo', component='original', version='1', filename='source.jpg',
                            date='2024-01-01', kind='image', albums=[]), len(data), hashlib.sha256(data).hexdigest())
        self.store.resource_chunk(self.alice, resource['id'], 0, data)
        self.store.finish_resource(self.alice, resource['id'])
        while self.store.work_once():
            pass
        origin = self.store.owned_origins(self.alice, self.group)[0]
        self.store.set_place(self.alice, origin['id'], 'NL', 'Retained location', 52, 4, None)
        for permission in ('authorized', 'revoked'):
            self.store.set_source(self.alice, source, False, permission)
            with self.exported() as archive:
                self.assertEqual(json.loads(archive.read('places.json'))[0]['origin'], origin['id'])
                self.assertEqual(archive.read('originals/' + origin['asset']), data)
        self.store.withdraw_resource(self.alice, resource['id'])
        with self.exported() as archive:
            self.assertEqual(json.loads(archive.read('places.json')), [])


class MemoryPlacesExportTests(SourcePlacesPrivacyTests):
    store_type = MemoryStore

    def test_personal_hide_removes_only_requesters_locations_and_assets(self):
        origins = self.import_locations(1001)
        asset = origins[0]['asset']
        self.store.hide(self.ben, asset, True)
        with self.exported(self.ben) as archive:
            self.assertEqual(json.loads(archive.read('places.json')), [])
            self.assertEqual(json.loads(archive.read('manifest.json'))['assets'], [])
        self.assertEqual(self.store.places(self.ben, self.group)['points'], [])
        with self.exported() as archive:
            self.assertEqual(len(json.loads(archive.read('places.json'))), 1001)
        with self.assertRaises(CapacityExceeded):
            self.store.places(self.alice, self.group)
        self.store.hide(self.ben, asset, False)
        with self.exported(self.ben) as archive:
            self.assertEqual(len(json.loads(archive.read('places.json'))), 1001)

    def test_final_zip_budget_includes_people_personal_metadata_and_resources(self):
        from unittest.mock import patch
        from mazi.archive import review
        origins = self.import_locations(1, city='😀' * 200)
        person = self.store.create_person(self.alice, self.group, 'é' * 100)
        self.store.tag(self.alice, person, origins[0]['asset'], True)
        source = self.store.create_source(self.alice, self.group, 'apple', 'Opaque resource',
                    dict(start='2020-01-01', end='2030-01-01', albums=[], types=['video']))
        self.store.set_source(self.alice, source, True, 'authorized')
        data = b'Synthetic retained movie'
        resource = self.store.begin_resource(self.alice, source,
                       dict(item='movie', component='paired', version='1', filename='movie.mov',
                            date='2024-01-01', kind='video', albums=[]), len(data), hashlib.sha256(data).hexdigest())
        self.store.resource_chunk(self.alice, resource['id'], 0, data)
        self.store.finish_resource(self.alice, resource['id'])
        full = self.store.export_archive(self.alice, self.group)
        with zipfile.ZipFile(io.BytesIO(full)) as archive:
            self.assertEqual(json.loads(archive.read('people.json'))[0]['name'], 'é' * 100)
            self.assertIn('processing', json.loads(archive.read('personal-discovery.json')))
            self.assertEqual(archive.read('resources/' + resource['id']), data)
        with patch.object(review, 'EXPORT_BYTES', len(full)):
            self.assertEqual(len(self.store.export_archive(self.alice, self.group)), len(full))
        with patch.object(review, 'EXPORT_BYTES', len(full) - 1):
            with self.assertRaisesRegex(CapacityExceeded, '128 MiB archive limit'):
                self.store.export_archive(self.alice, self.group)


class PlacesAuthorizationChecks(PlacesFixture):
    def test_membership_is_rechecked_before_pages_between_pages_and_after_final_page(self):
        for phase, count in [('before scan', 1), ('between pages', 129), ('after final page', 1)]:
            with self.subTest(phase=phase):
                group = self.store.create_group(self.alice, phase)
                self.store.accept(self.ben, self.store.invite(self.alice, group))
                self.import_locations(count, group=group)
                connection = self.store.db
                revoked = []
                def revoke():
                    if not revoked:
                        # Synthetic in-connection revocation tests the current-view checks.
                        # Normal concurrent writers are serialized by the scan transaction.
                        connection.execute('DELETE FROM members WHERE group_id=? AND user_id=?', (group, self.ben))
                        revoked.append(True)
                class RevokeDuringScan:
                    def __getattr__(self, name):
                        return getattr(connection, name)
                    def execute(self, sql, values=()):
                        cursor = connection.execute(sql, values)
                        if phase == 'before scan' and sql == 'BEGIN IMMEDIATE':
                            revoke()
                        if phase == 'before scan' or 'AS oversized' not in sql:
                            return cursor
                        class Page:
                            def fetchall(self):
                                rows = cursor.fetchall()
                                revoke()
                                return rows
                        return Page()
                self.store.db = RevokeDuringScan()
                try:
                    with self.assertRaises(Denied):
                        self.store.export_archive(self.ben, group)
                finally:
                    self.store.db = connection
                self.assertEqual(revoked, [True])
                self.assertFalse(connection.in_transaction)
                with self.exported(self.ben, group) as archive:
                    self.assertEqual(len(json.loads(archive.read('places.json'))), count)

    def test_cooperative_budget_counts_time_waiting_for_the_scan_lock(self):
        from unittest.mock import patch
        from mazi.sources import sources
        self.import_locations(1)
        connection = self.store.db
        clock = [0]
        scans = []
        class WaitForLock:
            def __getattr__(self, name):
                return getattr(connection, name)
            def execute(self, sql, values=()):
                result = connection.execute(sql, values)
                if sql == 'BEGIN IMMEDIATE':
                    clock[0] = 3.001
                if 'AS oversized' in sql:
                    scans.append(sql)
                return result
        self.store.db = WaitForLock()
        try:
            with patch.object(sources.time, 'perf_counter', side_effect=lambda: clock[0]):
                with self.assertRaisesRegex(CapacityExceeded, 'location scan time budget'):
                    self.store.export_archive(self.alice, self.group)
        finally:
            self.store.db = connection
        self.assertEqual(scans, [])
        self.assertFalse(connection.in_transaction)
        with self.exported() as archive:
            self.assertEqual(len(json.loads(archive.read('places.json'))), 1)


class RestrictedVisibleStore(MemoryStore):
    only_asset = None

    def _visible_ids(self, user, group):
        ids = super()._visible_ids(user, group)
        return ids if self.only_asset is None else [asset for asset in ids if asset == self.only_asset]


class CapturedPlacesTests(PlacesFixture):
    store_type = RestrictedVisibleStore

    def test_export_projection_intersects_polymorphic_captured_asset_set(self):
        from PIL import Image
        included = self.import_locations(1)[0]
        blue = io.BytesIO()
        Image.new('RGB', (8, 8), 'blue').save(blue, 'JPEG')
        excluded = self.import_locations(1, prefix='blue', image_bytes=blue.getvalue())[0]
        self.assertNotEqual(included['asset'], excluded['asset'])
        self.store.only_asset = included['asset']
        with self.exported() as archive:
            self.assertEqual([p['origin'] for p in json.loads(archive.read('places.json'))], [included['id']])
            self.assertEqual([p['id'] for p in json.loads(archive.read('manifest.json'))['assets']], [included['asset']])
            self.assertNotIn('originals/' + excluded['asset'], archive.namelist())


class PlacesScaleTests(PlacesFixture):
    def test_public_ten_thousand_origin_export_uses_bounded_complete_pages(self):
        import time
        origins = self.import_locations(10000)
        connection = self.store.db
        samples = dict(pages=0, rows=0, maximum_page_rows=0, maximum_projected_page_utf8_bytes=0)
        started, finished = [], []
        class ObserveScan:
            def __getattr__(self, name):
                return getattr(connection, name)
            def execute(self, sql, values=()):
                if sql == 'BEGIN IMMEDIATE':
                    started.append(time.perf_counter())
                cursor = connection.execute(sql, values)
                if 'AS oversized' not in sql:
                    return cursor
                class Page:
                    def fetchall(self):
                        rows = cursor.fetchall()
                        samples['pages'] += 1
                        samples['rows'] += len(rows)
                        samples['maximum_page_rows'] = max(samples['maximum_page_rows'], len(rows))
                        samples['maximum_projected_page_utf8_bytes'] = max(
                            samples['maximum_projected_page_utf8_bytes'],
                            len(json.dumps([dict(row) for row in rows], ensure_ascii=False).encode()))
                        return rows
                return Page()
            def commit(self):
                connection.commit()
                finished.append(time.perf_counter())
        self.store.db = ObserveScan()
        try:
            with self.exported() as archive:
                points = json.loads(archive.read('places.json'))
                self.assertEqual(len(json.loads(archive.read('manifest.json'))['assets'][0]['origins']), 10000)
        finally:
            self.store.db = connection
        self.assertEqual(len(points), 10000)
        self.assertEqual({p['origin'] for p in points}, {o['id'] for o in origins})
        expected = sorted((('' if index % 4 == 0 else '2024-01-02' if index % 4 < 3 else '2024-01-03'), origin['id'])
                          for index, origin in enumerate(origins))
        self.assertEqual([(p['day'] or '', p['origin']) for p in points], expected)
        self.assertEqual((samples['rows'], samples['pages'], samples['maximum_page_rows']), (10000, 79, 128))
        self.assertLessEqual(samples['maximum_projected_page_utf8_bytes'], 128 * 2048)
        self.assertEqual(len(started), 1)
        self.assertEqual(len(finished), 1)
        samples['location_scan_seconds'] = finished[0] - started[0]
        print('Location export synthetic profile: ' + json.dumps(samples, sort_keys=True))
        with self.assertRaises(CapacityExceeded):
            self.store.places(self.alice, self.group)


class ArchiveWrapperBudgetTests(PlacesFixture):
    def test_final_closed_zip_budget_also_applies_without_discovery_layer(self):
        from unittest.mock import patch
        from mazi.archive import review
        self.import_locations(1, city='😀' * 200)
        review_store = review.ReviewStore(self.temp.name)
        self.addCleanup(review_store.close)
        for store in (review_store, self.store):
            with self.subTest(store=type(store).__name__):
                data = store.export_archive(self.alice, self.group)
                with zipfile.ZipFile(io.BytesIO(data)) as archive:
                    self.assertEqual(len(json.loads(archive.read('manifest.json'))['assets']), 1)
                with patch.object(review, 'EXPORT_BYTES', len(data)):
                    self.assertEqual(len(store.export_archive(self.alice, self.group)), len(data))
                with patch.object(review, 'EXPORT_BYTES', len(data) - 1):
                    with self.assertRaisesRegex(CapacityExceeded, '128 MiB archive limit'):
                        store.export_archive(self.alice, self.group)

    def test_non_lock_sqlite_error_is_not_reclassified_as_busy(self):
        import sqlite3
        self.import_locations(1)
        connection = self.store.db
        class InvalidSql:
            def __getattr__(self, name):
                return getattr(connection, name)
            def execute(self, sql, values=()):
                return connection.execute('SELECT FROM' if sql == 'BEGIN IMMEDIATE' else sql, values)
        self.store.db = InvalidSql()
        try:
            with self.assertRaises(sqlite3.OperationalError) as raised:
                self.store.export_archive(self.alice, self.group)
            self.assertEqual(raised.exception.sqlite_errorcode, sqlite3.SQLITE_ERROR)
        finally:
            self.store.db = connection
        self.assertFalse(connection.in_transaction)
        with self.exported() as archive:
            self.assertEqual(len(json.loads(archive.read('places.json'))), 1)


class PlacesHostedProjectionTests(PlacesFixture):
    def test_hosted_octet_length_projection_with_sqlite_shim(self):
        origin = self.import_locations(1, city='😀' * 200)[0]
        connection = self.store.db
        connection.create_function('octet_length', 1, lambda value: None if value is None else len(value.encode()))
        projected = []
        class HostedProjection:
            hosted = True
            def __getattr__(self, name):
                return getattr(connection, name)
            def execute(self, sql, values=()):
                cursor = connection.execute(sql.replace('_mazi_order', 'rowid'), values)
                if 'AS oversized' not in sql:
                    return cursor
                rows = cursor.fetchall()
                projected.extend(dict(row) for row in rows)
                class Page:
                    def fetchall(self):
                        return rows
                return Page()
        self.store.db = HostedProjection()
        try:
            with self.exported() as archive:
                self.assertEqual(json.loads(archive.read('places.json'))[0]['city'], '😀' * 200)
            connection.execute('UPDATE shared_places SET city=? WHERE origin=?', ('😀' * 100000, origin['id']))
            connection.commit()
            with self.assertRaisesRegex(CapacityExceeded, 'location record'):
                self.store.export_archive(self.alice, self.group)
        finally:
            self.store.db = connection
        self.assertEqual(len(projected), 2)
        self.assertEqual(projected[0]['city'], '😀' * 200)
        self.assertIsNone(projected[1]['city'])
        self.assertTrue(projected[1]['oversized'])
        self.assertFalse(connection.in_transaction)


class MemoryPlacesAssetLimitTests(PlacesFixture):
    store_type = MemoryStore

    def test_thousand_distinct_assets_export_all_locations_at_maximum_bound_parameter_set(self):
        from PIL import Image
        def unique_image(number):
            output = io.BytesIO()
            Image.new('RGB', (8, 8), (number % 256, number // 256, 100)).save(output, 'PNG')
            return output.getvalue()
        origins = self.import_locations(1000, image_bytes=unique_image, extension='png')
        self.assertEqual(len({origin['asset'] for origin in origins}), 1000)
        with self.exported() as archive:
            places = json.loads(archive.read('places.json'))
            manifest = json.loads(archive.read('manifest.json'))
            self.assertEqual(len(places), 1000)
            self.assertEqual({point['asset_id'] for point in places}, {origin['asset'] for origin in origins})
            self.assertEqual({asset['id'] for asset in manifest['assets']}, {origin['asset'] for origin in origins})
            self.assertEqual(len([name for name in archive.namelist() if name.startswith('originals/')]), 1000)
