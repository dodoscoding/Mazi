import io
import itertools
import json
import random
import time
import threading
import unittest
from unittest.mock import patch

from mazi.capacity import CapacityExceeded
from PIL import Image
from mazi.identity.core import Denied
from tests.backend.archive import test_capacity as helpers
from tests.backend.imports.test_engine import picture


class RemainingCapacityTests(unittest.TestCase):
    setUp = helpers.ArchiveCapacityTests.setUp
    tearDown = helpers.ArchiveCapacityTests.tearDown
    submit = helpers.ArchiveCapacityTests.submit
    process = helpers.ArchiveCapacityTests.process
    seed_projection = helpers.ArchiveCapacityTests.seed_projection

    def prepare(self, count):
        self.seed_projection(count)
        for subject in ('*', self.alice):
            self.store.db.execute('INSERT INTO discovery_processing VALUES(?,?,1)', (self.group, subject))
        self.store.db.execute('INSERT INTO shared_places SELECT id,?,?,?,?,? FROM archive_origins',
                              ('NL', 'Amsterdam', 1, 1, '2020-01-02'))
        self.store.db.commit()

    def test_complete_semantic_index_events_and_places_at_ten_thousand(self):
        self.prepare(10000)
        self.store.encoder.learned = True
        page = self.store.search(self.ben, self.group, mode='semantic', offset=9990, limit=10)
        self.assertEqual((page['total'], len(page['items']), page['next_offset'], page['unindexed']),
                         (10000, 10, None, 10000))
        event = self.store.event_suggestions(self.ben, self.group)[0]
        self.assertEqual(len(event['assets']), 10000)
        self.assertEqual(len(self.store.places(self.ben, self.group)['points']), 10000)
        with patch.object(self.store, 'asset_bytes', return_value=b'synthetic'), patch.object(
                self.store.encoder, 'visual_vector', return_value=[1.0] * 11):
            indexed = self.store.index_batch(self.ben, self.group, limit=5)
        self.assertEqual(indexed, dict(indexed=5, discarded=0, remaining=9995))
        self.store.hide(self.ben, 'capacity-00000', True)
        self.store.db.execute("UPDATE archive_origins SET withdrawn=1 WHERE asset_id='capacity-00001'")
        self.store.db.commit()
        self.assertEqual(self.store.search(self.ben, self.group, mode='semantic')['total'], 9998)
        self.assertEqual(len(self.store.event_suggestions(self.ben, self.group)[0]['assets']), 9998)
        self.assertEqual(len(self.store.places(self.ben, self.group)['points']), 9998)

    def test_event_conflicting_late_origin_is_not_truncated(self):
        self.prepare(1001)
        row = self.store.db.execute('SELECT * FROM archive_origins LIMIT 1').fetchone()
        self.store.db.execute('INSERT INTO archive_origins VALUES(?,?,?,?,?,?,?,?,0)',
                              ('zz-last', row['asset_id'], self.group, self.alice, row['run_id'], 'last', 'last',
                               json.dumps({'capture_assertions': [{'local': '2030-01-02T12:00:00'}]})))
        self.store.db.commit()
        self.assertEqual(len(self.store.event_suggestions(self.ben, self.group)[0]['assets']), 1000)

    def test_large_projection_group_and_member_isolation(self):
        self.prepare(1001)
        other = self.store.create_group(self.alice, 'Separate circle')
        self.store.accept(self.ben, self.store.invite(self.alice, other))
        self.process(self.submit({'separate.jpg': picture()}, group=other))
        other_asset = self.store.gallery(self.ben, other)[0]['id']
        with self.assertRaises(Denied):
            self.store.search(self.ben, self.group, mode='semantic', similar=other_asset)
        self.assertEqual(self.store.search(self.ben, self.group, mode='semantic')['total'], 1001)
        self.assertEqual(len(self.store.event_suggestions(self.ben, self.group)[0]['assets']), 1001)
        self.store.remove_member(self.alice, self.group, self.ben)
        for action in (lambda: self.store.search(self.ben, self.group, mode='semantic'),
                       lambda: self.store.index_batch(self.ben, self.group),
                       lambda: self.store.event_suggestions(self.ben, self.group),
                       lambda: self.store.duplicate_suggestions(self.ben, self.group),
                       lambda: self.store.places(self.ben, self.group)):
            with self.assertRaises(Denied):
                action()
        self.assertEqual(len(self.store.places(self.ben, other)['points']), 0)

    def test_stream_fingerprints_and_eligibility_equal_live_document(self):
        self.prepare(1001)
        self.store.correct_asset(self.alice, 'capacity-00000', title='Café bicycle', capture_date='2021-01-02', place='Harbour')
        with self.store.transaction():
            streamed = list(self.store._keyword_documents(self.ben, self.group, '', time.perf_counter(), processing=True))
            for doc in streamed:
                expected = self.store._document(self.ben, doc['id'])
                self.assertEqual({key: value for key, value in doc.items() if key != 'person_match'}, expected)
        self.store.processing(self.alice, self.group, False)
        with self.store.transaction():
            self.assertTrue(all(not doc['eligible'] for doc in self.store._keyword_documents(
                self.ben, self.group, '', time.perf_counter(), processing=True)))

    def test_duplicate_exact_index_matches_all_pairs_and_review_order(self):
        self.prepare(300)
        rng = random.Random(59)
        hashes = [rng.getrandbits(64) for _ in range(50)]
        hashes += [value ^ sum(1 << bit for bit in rng.sample(range(64), distance))
                   for value in hashes[:25] for distance in range(1, 8)]
        hashes += [0, sum(1 << (part * 9) for part in range(6)), sum(1 << (part * 9) for part in range(7))]
        hashes += [rng.getrandbits(64) for _ in range(300 - len(hashes))]
        ids = self.store._visible_ids(self.ben, self.group)
        signatures = {asset: (value, [100, 100, 100], 1.0) for asset, value in zip(ids, hashes)}
        expected = [(left, right) for left, right in itertools.combinations(ids, 2)
                    if (signatures[left][0] ^ signatures[right][0]).bit_count() <= 6]
        with patch.object(self.store, 'asset_bytes', side_effect=lambda user, asset: asset), patch(
                'mazi.archive.review.signature', side_effect=lambda asset: signatures[asset]):
            actual = self.store.duplicate_suggestions(self.ben, self.group)
            self.assertEqual([(pair['left'], pair['right']) for pair in actual], expected[:100])
            left, right = expected[0]
            self.store.review_pair(self.ben, self.group, left, right, 'dismiss')
            actual = self.store.duplicate_suggestions(self.ben, self.group)
            self.assertEqual([(pair['left'], pair['right']) for pair in actual], expected[1:101])
            self.store.hide(self.ben, left, True)
            self.assertTrue(all(left not in (pair['left'], pair['right'])
                                for pair in self.store.duplicate_suggestions(self.ben, self.group)))

    def test_budget_exhaustion_never_returns_partial_projections(self):
        self.prepare(1001)
        for action in (lambda: self.store.search(self.ben, self.group, mode='semantic'),
                       lambda: self.store.index_batch(self.ben, self.group)):
            with patch('mazi.discovery.discovery.DISCOVERY_SCAN_SECONDS', -1), self.assertRaises(CapacityExceeded):
                action()
        with patch('mazi.archive.review.REVIEW_SCAN_SECONDS', -1), self.assertRaises(CapacityExceeded):
            self.store.event_suggestions(self.ben, self.group)
        with patch.object(self.store, 'asset_bytes', return_value=b'image'), patch(
                'mazi.archive.review.signature', return_value=(0, [0, 0, 0], 1)), patch(
                'mazi.archive.review.DUPLICATE_COMPARISONS', 0), self.assertRaises(CapacityExceeded):
            self.store.duplicate_suggestions(self.ben, self.group)
        self.store.db.execute("UPDATE archive_origins SET payload=? WHERE asset_id='capacity-01000'",
                              (json.dumps({'context': [{'text': 'x' * 65536}]}),))
        self.store.db.commit()
        with self.assertRaises(CapacityExceeded):
            self.store.event_suggestions(self.ben, self.group)
        with self.assertRaises(CapacityExceeded):
            self.store.search(self.ben, self.group, mode='semantic')
        self.store.db.execute("UPDATE shared_places SET city=? WHERE origin='origin-capacity-01000'", ('x' * 8193,))
        self.store.db.commit()
        with self.assertRaises(CapacityExceeded):
            self.store.places(self.ben, self.group, country='NO')
        with self.assertRaises(Denied):
            self.store.event_suggestions(self.outsider, self.group)

    def test_complete_ranked_pages_and_last_index_batch_above_old_boundary(self):
        self.prepare(1001)
        self.store.encoder.learned = True
        self.store.encoder.dimensions = {'text': 2, 'visual': 2}
        with self.store.transaction():
            for number, doc in enumerate(self.store._keyword_documents(self.ben, self.group, '', time.perf_counter(), processing=True)):
                if number < 996:
                    self.store._save_vectors(self.group, doc, dict(text=[1.0, 0.0], visual=[1.0, 0.0]), 0)
        with patch.object(self.store, 'asset_bytes', return_value=b'synthetic'), patch.object(
                self.store.encoder, 'text_vector', return_value=[1.0, 0.0]), patch.object(
                self.store.encoder, 'visual_vector', return_value=[1.0, 0.0]):
            self.assertEqual(self.store.index_batch(self.ben, self.group, limit=5), dict(indexed=5, discarded=0, remaining=0))
        with patch.object(self.store, 'asset_bytes', side_effect=AssertionError('search inferred an image')), patch.object(
                self.store.encoder, 'text_vector', return_value=[1.0, 0.0]), patch.object(
                self.store.encoder, 'score', side_effect=lambda query, vectors, content, words: 0.9 if 'latewinner' in content else 0.5):
            self.store.correct_asset(self.alice, 'capacity-01000', title='latewinner', capture_date=None, place='')
            doc = self.store._document(self.ben, 'capacity-01000')
            self.store._save_vectors(self.group, doc, dict(text=[1.0, 0.0], visual=[1.0, 0.0]), 0)
            self.store.db.commit()
            page = self.store.search(self.ben, self.group, query='synthetic', mode='semantic', limit=1)
            self.assertEqual((page['total'], page['items'][0]['id'], page['next_offset'], page['unindexed']),
                             (1001, 'capacity-01000', 1, 0))
            final = self.store.search(self.ben, self.group, query='synthetic', mode='semantic', offset=1000, limit=1)
            self.assertEqual((final['items'][0]['id'], final['next_offset']), ('capacity-00999', None))
            self.store.hide(self.ben, 'capacity-01000', True)
            with self.assertRaises(Denied):
                self.store.search(self.ben, self.group, mode='semantic', similar='capacity-01000')

    def test_places_scan_serializes_public_location_changes(self):
        from mazi.sources.sources import SourceStore
        for start in (0, 100):
            self.process(self.submit({f'photo-{number}.jpg': picture() for number in range(start, min(start + 100, 129))}))
        for row in self.store.db.execute('SELECT id FROM archive_origins').fetchall():
            self.store.set_place(self.alice, row['id'], 'NL', 'Amsterdam', 52, 4, '2020-01-02')
        writer = SourceStore(self.temp.name)
        self.addCleanup(writer.close)
        attempted, committed = threading.Event(), threading.Event()
        errors, threads = [], []
        connection = self.store.db
        owner = self
        class ScanCursor:
            def __init__(self, cursor):
                self.cursor = cursor
            def fetchall(self):
                rows = self.cursor.fetchall()
                if rows and not threads:
                    def mutate():
                        attempted.set()
                        try:
                            writer.set_place(owner.alice, rows[0]['origin'], 'NL', 'Amsterdam', 52, 4, '2030-01-02')
                            committed.set()
                        except Exception as error:
                            errors.append(error)
                    thread = threading.Thread(target=mutate)
                    threads.append(thread)
                    thread.start()
                    owner.assertTrue(attempted.wait(2))
                    owner.assertFalse(committed.wait(0.05))
                return rows
        class ScanConnection:
            def __getattr__(self, name):
                return getattr(connection, name)
            def execute(self, sql, params=()):
                cursor = connection.execute(sql, params)
                return ScanCursor(cursor) if 'AS text_bytes' in sql else cursor
        self.store.db = ScanConnection()
        try:
            points = self.store.places(self.ben, self.group)['points']
            self.assertEqual((len(points), len({point['origin'] for point in points})), (129, 129))
        finally:
            self.store.db = connection
            for thread in threads:
                thread.join(3)
        self.assertEqual(errors, [])
        self.assertTrue(committed.is_set())
        self.assertEqual(len(self.store.places(self.ben, self.group)['points']), 129)

    def test_real_ten_thousand_photo_import_supports_complete_local_journeys(self):
        for start in range(0, 10000, 100):
            files = {}
            for number in range(start, start + 100):
                output = io.BytesIO()
                Image.new('RGB', (8, 8), (number % 256, number // 256, 100)).save(output, 'PNG')
                files[f'photo-{number:05d}.png'] = output.getvalue()
            run = self.submit(files)
            self.process(run)
            self.assertEqual(self.store.report(self.alice, run)['state'], 'COMPLETED')
        self.store.processing(self.alice, self.group, True, group_wide=True)
        self.store.processing(self.alice, self.group, True)
        for origin in self.store.db.execute('SELECT id,asset_id AS asset FROM archive_origins').fetchall():
            self.store.set_place(self.alice, origin['id'], 'NL', 'Amsterdam', 52, 4, '2020-01-02')
            self.store.correct_asset(self.alice, origin['asset'], title='', capture_date='2020-01-02', place='Amsterdam')
        measurements = {}
        for name, operation in (
                ('related', lambda: self.store.search(self.ben, self.group, mode='semantic', offset=9990, limit=10)),
                ('index', lambda: self.store.index_batch(self.ben, self.group, limit=5)),
                ('events', lambda: self.store.event_suggestions(self.ben, self.group)),
                ('duplicates', lambda: self.store.duplicate_suggestions(self.ben, self.group)),
                ('places', lambda: self.store.places(self.ben, self.group))):
            started = time.perf_counter()
            measurements[name] = operation(), round(time.perf_counter() - started, 4)
        self.assertEqual((measurements['related'][0]['total'], len(measurements['related'][0]['items'])), (10000, 10))
        self.assertEqual(measurements['index'][0], dict(indexed=5, discarded=0, remaining=9995))
        self.assertEqual(len(measurements['events'][0][0]['assets']), 10000)
        self.assertEqual(len(measurements['duplicates'][0]), 100)
        self.assertEqual(len(measurements['places'][0]['points']), 10000)
        print('Real 10000-photo local seconds', {name: elapsed for name, (_, elapsed) in measurements.items()})


if __name__ == '__main__':
    unittest.main()
