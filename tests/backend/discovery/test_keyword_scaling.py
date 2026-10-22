"""Complete keyword results beyond 1,000, with bounded source-metadata work.

Large fixtures seed synthetic metadata; the HTTP contract uses actual imports.
"""
import json
import sqlite3
import threading
import unittest
from pathlib import Path

from mazi.identity.core import Denied

from mazi.capacity import CapacityExceeded
from tests.backend.archive import test_capacity as capacity_helpers
from tests.backend.imports import test_engine as helpers


class KeywordScalingTests(unittest.TestCase):
    submit = helpers.EngineTests.submit
    process = helpers.EngineTests.process
    setUp = capacity_helpers.ArchiveCapacityTests.setUp
    tearDown = capacity_helpers.ArchiveCapacityTests.tearDown
    seed_projection = capacity_helpers.ArchiveCapacityTests.seed_projection

    def seed_details(self, count=20):
        self.seed_projection(count)
        run = self.store.db.execute('SELECT id FROM import_runs').fetchone()[0]
        for number in range(count):
            asset = f'capacity-{number:05d}'
            for copy, owner in ((0, self.alice), (1, self.ben)):
                origin = ('origin-' if copy == 0 else 'copy-') + asset
                payload = {'original_filename': f'Straße-İstanbul-{number}.jpg',
                           'capture_assertions': [{'local': '2020-01-02T12:00:00' if copy == 0 or number % 3 else '2021-01-02T12:00:00'}],
                           'location_assertions': [{'city': 'Harbour' if copy == 0 or number % 4 else 'Hill'}],
                           'context': [{'text': 'bicycle café ΣΊΓΜΑ summer sunset'}]}
                if copy == 0:
                    self.store.db.execute('UPDATE archive_origins SET payload=? WHERE id=?', (json.dumps(payload, ensure_ascii=False), origin))
                else:
                    self.store.db.execute('INSERT INTO archive_origins VALUES(?,?,?,?,?,?,?,?,0)',
                                          (origin, asset, self.group, owner, run, origin, origin, json.dumps(payload, ensure_ascii=False)))
                self.store.db.execute('INSERT INTO shared_places VALUES(?,?,?,?,?,?)',
                                      (origin, 'NL' if copy == 0 else 'TR', 'Amsterdam' if copy == 0 else 'İstanbul', 1, 1, '2020-01-02'))
            if number % 5 == 0:
                self.store.db.execute('INSERT INTO review_annotations VALUES(?,?,?,?,?,?,?,?)',
                                      (asset, self.group, f'Summer {number}', '2022-01-02' if number % 10 == 0 else None,
                                       'Reviewed' if number % 15 == 0 else '', 0, self.alice, '2026-10-19'))
        for number, name in enumerate(('Zoe', 'Alex', 'Alex')):
            self.store.db.execute('INSERT INTO discovery_people VALUES(?,?,?,?,?,NULL)',
                                  (f'person-{number}', self.group, name, self.alice, self.ben if number == 0 else None))
            for asset_number in range(number, count, 3):
                self.store.db.execute('INSERT INTO discovery_tags VALUES(?,?,?)',
                                      (f'person-{number}', f'capacity-{asset_number:05d}', self.ben if number == 1 else self.alice))
        for subject in ('*', self.alice, self.ben):
            self.store.db.execute('INSERT INTO discovery_processing VALUES(?,?,1)', (self.group, subject))
        self.store.db.commit()

    def test_small_archive_keyword_page_has_bounded_database_work(self):
        participants = [{'name': 'Synthetic participant ' + str(n)} for n in range(2500)]
        metadata = {'title': 'Synthetic conversation', 'participants': participants, 'messages': [
            {'sender_name': 'Synthetic sender', 'timestamp_ms': 1577836800000,
             'content': 'oversizedmessengerkeyword', 'photos': [{'uri': 'photos/picture.jpg'}]}]}
        run = self.submit({'messages/inbox/synthetic/message_1.json': json.dumps(metadata),
                           'photos/picture.jpg': helpers.picture()}, source='messenger')
        self.process(run)
        self.assertEqual(self.store.report(self.alice, run)['state'], 'COMPLETED')
        self.assertGreater(self.store.db.execute('SELECT length(CAST(payload AS BLOB)) FROM archive_origins').fetchone()[0],
                           64 * 1024)
        self.seed_projection(300)
        statements = []
        self.store.db.set_trace_callback(statements.append)
        try:
            page = self.store.search(self.ben, self.group, query='SYNTHETIC', offset=270)
        finally:
            self.store.db.set_trace_callback(None)
        self.assertEqual([item['id'] for item in page['items']],
                         [f'capacity-{number:05d}' for number in range(270, 300)])
        self.assertEqual((page['total'], page['next_offset'], page['mode']),
                         (300, None, 'keyword / filters'))
        self.assertLessEqual(len(statements), 20,
                             'A keyword page must batch metadata reads instead of querying every asset')
        self.assertEqual(self.store.search(self.ben, self.group, query='oversizedmessengerkeyword')['total'], 1)

    def test_filters_unicode_and_pagination_return_expected_assets(self):
        self.seed_details()
        all_assets = list(range(20))
        capture_2020 = [1, 2, 4, 5, 7, 8, 11, 13, 14, 16, 17, 19]
        cases = [({}, all_assets), ({'query': 'STRASSE summer'}, all_assets),
                 ({'query': 'İSTANBUL ΣΊΓΜΑ'}, all_assets), ({'query': 'café'}, all_assets),
                 ({'query': '   '}, all_assets), ({'query': 'missing'}, []),
                 ({'query': 'summer STRASSE'}, all_assets), ({'object_query': 'bike cafe'}, all_assets),
                 ({'object_query': 'bike café'}, all_assets), ({'object_query': 'dog'}, []),
                 ({'place': 'DAM'}, all_assets), ({'place': 'İSTAN'}, all_assets),
                 ({'place': 'reviewed'}, [0, 15]), ({'place': 'missing'}, []),
                 ({'country': 'nl'}, all_assets), ({'country': 'TR'}, all_assets), ({'country': 'NO'}, []),
                 ({'source': 'manual'}, all_assets), ({'source': 'whatsapp'}, []), ({'source': 'Manual'}, []),
                 ({'start': '2020-01-02', 'end': '2020-01-02'}, capture_2020),
                 ({'start': '2021-01-01'}, [0, 10]), ({'end': '2021-01-01'}, capture_2020),
                 ({'person': 'person-0'}, [0, 3, 6, 9, 12, 15, 18]),
                 ({'person': 'person-1'}, [1, 4, 7, 10, 13, 16, 19]), ({'person': 'missing'}, []),
                 ({'query': 'STRASSE', 'country': 'NL', 'place': 'dam', 'object_query': 'bike',
                   'person': 'person-0', 'start': '2020-01-01', 'end': '2023-01-01', 'source': 'manual'}, [0]),
                 ({'similar': 'capacity-00000'}, all_assets)]
        for user in (self.alice, self.ben):
            for filters, expected in cases:
                with self.subTest(user=user, filters=filters):
                    page = self.store.search(user, self.group, **filters)
                    self.assertEqual([item['id'] for item in page['items']],
                                     [f'capacity-{number:05d}' for number in expected])
                    self.assertEqual((page['total'], page['next_offset']), (len(expected), None))
            for offset, limit, expected, next_offset in ((0, 1, [0], 1), (19, 1, [19], None),
                                                         (20, 30, [], None), (1000000, 30, [], None)):
                page = self.store.search(user, self.group, offset=offset, limit=limit)
                self.assertEqual([item['id'] for item in page['items']],
                                 [f'capacity-{number:05d}' for number in expected])
                self.assertEqual((page['total'], page['next_offset']), (20, next_offset))
        self.assertEqual(self.store.search(self.alice, self.group, query='bike')['total'], 0)
        rows = {item['id']: item for item in self.store.search(self.alice, self.group)['items']}
        self.assertEqual((rows['capacity-00010']['date'], rows['capacity-00010']['place']), ('2022-01-02', 'harbour'))
        self.assertEqual((rows['capacity-00015']['date'], rows['capacity-00015']['place']), (None, 'reviewed'))

    def test_all_501_origins_affect_matching_and_independent_corrections(self):
        self.seed_projection(1001)
        row = self.store.db.execute("SELECT * FROM archive_origins WHERE asset_id='capacity-00000'").fetchone()
        payload = json.loads(row['payload'])
        payload['location_assertions'] = [{'city': 'Harbour'}]
        self.store.db.execute('UPDATE archive_origins SET payload=? WHERE id=?', (json.dumps(payload), row['id']))
        for number in range(500):
            origin = f'zz-late-{number:05d}'
            payload['original_filename'] = 'lastoriginuniqueterm.jpg' if number == 499 else 'earlier.jpg'
            if number == 499:
                payload['capture_assertions'] = [{'local': '2030-01-02T12:00:00'}]
                payload['location_assertions'] = [{'city': 'Hill'}]
            self.store.db.execute('INSERT INTO archive_origins VALUES(?,?,?,?,?,?,?,?,0)',
                                  (origin, row['asset_id'], self.group, self.alice, row['run_id'], origin, origin, json.dumps(payload)))
        self.store.db.commit()
        def result():
            page = self.store.search(self.ben, self.group, query='lastoriginuniqueterm')
            self.assertEqual(page['total'], 1)
            return page['items'][0]
        self.assertEqual((result()['date'], result()['place']), (None, ''))
        self.store.correct_asset(self.alice, row['asset_id'], title='', capture_date='2025-01-01', place='')
        self.assertEqual((result()['date'], result()['place']), ('2025-01-01', ''))
        self.store.correct_asset(self.alice, row['asset_id'], title='', capture_date=None, place='Reviewed')
        self.assertEqual((result()['date'], result()['place']), (None, 'reviewed'))

    def test_ten_thousand_and_ten_thousand_one_have_exact_final_pages(self):
        self.seed_projection(10001)
        for total in (10001, 10000):
            if total == 10000:
                self.store.db.execute("UPDATE archive_origins SET withdrawn=1 WHERE asset_id='capacity-10000'")
                self.store.db.commit()
            page = self.store.search(self.ben, self.group, offset=9900, limit=100)
            self.assertEqual((page['total'], len(page['items']), page['next_offset']),
                             (total, 100, 10000 if total == 10001 else None))
            self.assertEqual((page['items'][0]['id'], page['items'][-1]['id']),
                             ('capacity-09900', 'capacity-09999'))
            page = self.store.search(self.ben, self.group, offset=total - 1)
            self.assertEqual(([item['id'] for item in page['items']], page['total'], page['next_offset']),
                             ([f'capacity-{total - 1:05d}'], total, None))
            page = self.store.search(self.ben, self.group, offset=10**9)
            self.assertEqual((page['items'], page['total'], page['next_offset']), ([], total, None))

    def test_visibility_reference_people_and_derivative_cleanup(self):
        self.seed_details()
        other_group = self.store.create_group(self.alice, 'Another circle')
        self.store.accept(self.ben, self.store.invite(self.alice, other_group))
        run = self.submit({'private-other-circle.jpg': helpers.picture()}, group=other_group)
        self.process(run)
        other_asset = self.store.gallery(self.alice, other_group)[0]['id']
        def vectors():
            return [tuple(row) for row in self.store.db.execute('SELECT * FROM discovery_vectors ORDER BY asset,modality')]
        def seed_vectors():
            self.store.db.execute('DELETE FROM discovery_vectors')
            for row in self.store.db.execute('SELECT id FROM archive_assets').fetchall():
                self.store.db.execute('INSERT INTO discovery_vectors VALUES(?,?,?,?,?,?)',
                                      (row[0], 'text', 'synthetic', 1, 'synthetic', '[1]'))
            self.store.db.commit()
        def assert_cleanup(visible, retained):
            page = self.store.search(self.alice, self.group)
            self.assertEqual([item['id'] for item in page['items']],
                             [f'capacity-{number:05d}' for number in visible])
            self.assertEqual(page['total'], len(visible))
            self.assertEqual([row[0] for row in vectors()],
                             sorted([other_asset, *[f'capacity-{number:05d}' for number in retained]]))
            return {item['id']: item for item in page['items']}
        seed_vectors()
        rows = assert_cleanup(list(range(20)), list(range(20)))
        self.assertEqual(rows['capacity-00000']['people'],
                         [dict(id='person-0', name='Zoe', is_me=False, can_remove=True)])
        self.assertEqual(rows['capacity-00001']['people'],
                         [dict(id='person-1', name='Alex', is_me=False, can_remove=True)])
        ben_rows = {item['id']: item for item in self.store.search(self.ben, self.group)['items']}
        self.assertEqual(ben_rows['capacity-00000']['people'],
                         [dict(id='person-0', name='Zoe', is_me=True, can_remove=False)])
        self.assertEqual(ben_rows['capacity-00001']['people'],
                         [dict(id='person-1', name='Alex', is_me=False, can_remove=True)])
        self.store.db.execute('INSERT INTO discovery_hidden VALUES(?,?)', (self.alice, 'capacity-00000'))
        self.store.db.execute('UPDATE discovery_processing SET enabled=0 WHERE subject=?', (self.ben,))
        self.store.db.commit()
        assert_cleanup(list(range(1, 20)), [0])
        self.store.db.execute('UPDATE discovery_processing SET enabled=1')
        seed_vectors()
        self.store.db.execute('UPDATE review_annotations SET actor_id=? WHERE asset_id=?', (self.outsider, 'capacity-00005'))
        self.store.db.execute('UPDATE archive_origins SET owner_id=? WHERE id=?', (self.outsider, 'copy-capacity-00001'))
        self.store.db.execute("UPDATE archive_origins SET withdrawn=1 WHERE asset_id='capacity-00002'")
        self.store.db.execute('INSERT INTO discovery_suppressions VALUES(?,?,?)', ('person-0', 'capacity-00003', self.ben))
        self.store.db.execute('UPDATE discovery_people SET account=? WHERE id=?', (self.outsider, 'person-2'))
        self.store.db.execute('UPDATE discovery_tags SET actor=? WHERE person=?', (self.outsider, 'person-1'))
        self.store.db.commit()
        rows = assert_cleanup([1, *range(3, 20)], [0, 1, 3, 4, *range(6, 20)])
        self.assertEqual(rows['capacity-00001']['people'], [])
        self.assertEqual(rows['capacity-00003']['people'], [])
        self.assertEqual(rows['capacity-00005']['people'], [])
        self.assertEqual([item['id'] for item in self.store.search(self.alice, self.group, person='person-0')['items']],
                         ['capacity-00006', 'capacity-00009', 'capacity-00012', 'capacity-00015', 'capacity-00018'])
        self.assertNotIn('capacity-00005', [row[0] for row in vectors()])
        self.assertEqual(self.store.search(self.alice, self.group, person='person-1')['total'], 0)
        self.assertEqual(self.store.search(self.alice, self.group, person='person-2')['total'], 0)
        self.assertEqual(self.store.search(self.alice, self.group, query='private-other-circle')['total'], 0)
        for asset in ('capacity-00000', 'capacity-00002', other_asset, 'missing'):
            with self.subTest(asset=asset), self.assertRaises(Denied):
                self.store.search(self.alice, self.group, similar=asset)
        with self.assertRaises(Denied):
            self.store.search(self.outsider, self.group)
        seed_vectors()
        self.store.db.execute('DELETE FROM members WHERE user_id=? AND group_id=?', (self.ben, self.group))
        self.store.db.commit()
        rows = assert_cleanup([1, *range(3, 20)], [])
        self.assertTrue(all(item['people'] == [] for item in rows.values()))
        with self.assertRaises(Denied):
            self.store.search(self.ben, self.group)

    def test_large_route_denies_hidden_reference_before_ignoring_similarity(self):
        self.seed_projection(1002)
        self.store.hide(self.ben, 'capacity-00000', True)
        for user, asset in ((self.ben, 'capacity-00000'), (self.outsider, 'capacity-00001'), (self.ben, 'missing')):
            with self.subTest(user=user, asset=asset), self.assertRaises(Denied):
                self.store.search(user, self.group, similar=asset)
        self.assertEqual(self.store.search(self.ben, self.group, similar='capacity-00001')['total'], 1001)

    def test_scan_holds_transaction_until_exact_response_and_next_request_sees_writer(self):
        self.seed_projection(1001)
        scanning, attempted, committed = threading.Event(), threading.Event(), threading.Event()
        errors = []
        def writer():
            try:
                self.assertTrue(scanning.wait(5))
                with sqlite3.connect(Path(self.temp.name) / 'mazi.sqlite3', timeout=5) as connection:
                    attempted.set()
                    connection.execute('BEGIN IMMEDIATE')
                    connection.execute('INSERT INTO discovery_hidden VALUES(?,?)', (self.ben, 'capacity-00000'))
                committed.set()
            except BaseException as error:
                errors.append(error)
        def trace(sql):
            if 'AS payload_bytes' in sql and not scanning.is_set():
                scanning.set()
                if not attempted.wait(5):
                    errors.append('Writer did not attempt the transaction during the scan')
                if committed.wait(0.05):
                    errors.append('Writer committed before the scan transaction completed')
        thread = threading.Thread(target=writer)
        thread.start()
        self.store.db.set_trace_callback(trace)
        try:
            self.assertEqual(self.store.search(self.ben, self.group)['total'], 1001)
        finally:
            self.store.db.set_trace_callback(None)
            thread.join(6)
        self.assertFalse(thread.is_alive())
        self.assertEqual(errors, [])
        self.assertTrue(committed.is_set())
        self.assertEqual(self.store.search(self.ben, self.group)['total'], 1000)

    def test_keyword_search_crosses_one_thousand_without_partial_counts(self):
        self.seed_projection(1001)
        result = self.store.search(self.ben, self.group, query='SYNTHETIC', offset=1000)
        self.assertEqual(([item['id'] for item in result['items']], result['total'], result['next_offset']),
                         (['capacity-01000'], 1001, None))
        self.assertEqual((result['mode'], result['model'], result['unindexed']), ('keyword / filters', None, 0))
        self.assertEqual(self.store.search(self.ben, self.group, mode='semantic')['total'], 1001)


if __name__ == '__main__':
    unittest.main()
