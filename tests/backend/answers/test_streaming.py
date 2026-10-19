"""Complete answer gates over synthetic archives; resource limits never truncate output."""
import json
import math
import unittest
from datetime import datetime, timezone
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from mazi.answers import answers
from mazi.capacity import CapacityExceeded
from mazi.identity.core import Conflict, Denied
from mazi.memories.memories import MemoryStore
from tests.backend.archive import test_capacity as fixtures
from tests.backend.imports.test_engine import picture


class AnswerFixture(unittest.TestCase):
    def setUp(self):
        self.fixture = fixtures.ArchiveCapacityTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.tearDown)
        self.s = self.fixture.store
        self.u, self.g, self.a = self.fixture.ben, self.fixture.group, self.fixture.alice
        self.fixture.seed_projection(1001)
        for subject in ('*', self.a, self.u):
            self.s.db.execute('INSERT INTO discovery_processing VALUES(?,?,1)', (self.g, subject))
            self.s.db.execute('INSERT INTO answer_processing VALUES(?,?,1)', (self.g, subject))
        self.s.db.commit()

    def ask(self, question='synthetic'):
        return self.s.answer(self.u, self.g, question)

    def usage(self):
        return self.s.answer_settings(self.u, self.g)['usage']

    def origin(self, asset='capacity-01000'):
        return dict(self.s.db.execute('SELECT * FROM archive_origins WHERE asset_id=? ORDER BY id LIMIT 1', (asset,)).fetchone())

    def payload(self, payload, asset='capacity-01000'):
        self.s.db.execute('UPDATE archive_origins SET payload=? WHERE asset_id=?',
                          (json.dumps(payload, ensure_ascii=False), asset))
        self.s.db.commit()

    def extra_origin(self, identity, payload, asset='capacity-01000', owner=None):
        row = self.origin(asset)
        self.s.db.execute('INSERT INTO archive_origins VALUES(?,?,?,?,?,?,?,?,0)',
                          (identity, asset, self.g, owner or self.a, row['run_id'], identity,
                           identity, json.dumps(payload, ensure_ascii=False)))
        self.s.db.commit()


class StreamingAnswerTests(AnswerFixture):
    def test_ten_thousand_exact_totals_five_citations_and_bounded_sql(self):
        run = self.origin()['run_id']
        payload = self.origin()['payload']
        with self.s.db:
            for n in range(1001, 10000):
                asset = f'capacity-{n:05d}'
                self.s.db.execute('INSERT INTO archive_assets VALUES(?,?,?,?,?,?,?,?,?)',
                                  (asset, self.g, asset, 'synthetic', 'synthetic', 'image/jpeg', 1, 8, 8))
                self.s.db.execute('INSERT INTO archive_origins VALUES(?,?,?,?,?,?,?,?,0)',
                                  ('origin-' + asset, asset, self.g, self.a, run, asset, asset, payload))
        statements = []
        self.s.db.set_trace_callback(statements.append)
        try:
            result = self.ask()
        finally:
            self.s.db.set_trace_callback(None)
        self.assertEqual((result['status'], result['matching_records'], result['shown']), ('supported', 10000, 5))
        self.assertEqual([row['id'] for row in result['evidence']], [f'capacity-{n:05d}' for n in range(5)])
        self.assertEqual(len(result['claims']), 5)
        self.assertEqual(result['usage']['requests'], 1)
        self.assertLess(len(statements), 3 * (math.ceil(10000 / 128) + 1) + 50)
        self.assertFalse(any('SELECT DISTINCT owner_id' in statement for statement in statements))
        self.assertEqual(self.s.evidence(self.u, self.g, 'capacity-00000'), result['evidence'][0])

    def test_exact_legacy_records_digest_and_reducer_semantics(self):
        # The frozen legacy implementation is the compatibility oracle below its cap.
        with self.s.db:
            self.s.db.execute("DELETE FROM archive_origins WHERE asset_id>='capacity-00030'")
            self.s.db.execute("DELETE FROM archive_assets WHERE id>='capacity-00030'")
        for n in range(30):
            payload = dict(original_filename=f'Straße {n}.jpg',
                           context=[{'text': ''}, {'text': ' synthetic '}, {'text': None}, {'text': 42}, {'text': 'ﬃ İ é élève 𐐀 東京 _foo'}],
                           capture_assertions=[{'local': '2020-01-01T23:00:00Z'}, {'local': 'invalid'}],
                           location_assertions=[{'city': '  Harbour '}, {'city': None}])
            self.payload(payload, f'capacity-{n:05d}')
            self.extra_origin(f'copy-{n:04d}', dict(original_filename='', context=[],
                                                 capture_assertions=[{'local': '2020-01-01'}]),
                              f'capacity-{n:05d}', self.u)
        self.s.correct_asset(self.a, 'capacity-00029', title=' Reviewed ', capture_date=None, place=' Hill ')
        with self.s.db:
            self.s.db.execute('INSERT INTO shared_places VALUES(?,?,?,?,?,?)',
                              ('copy-0029', 'NL', 'Évora', 1, 1, '2020-01-01'))
        started = answers.time.monotonic()
        expected, digest = self.s._snapshot(self.u, self.g)
        actual = list(self.s._answer_records(self.u, self.g, started, started))
        self.assertEqual(actual, expected)
        for question in ('synthetic', 'STRASSE', 'synthet', 'earliest synthetic', 'latest synthetic',
                         'earliest latest synthetic', 'why synthetic', 'what photos', 'absent',
                         'FFI', 'i', 'e', 'élève', '𐐨', '東京', '_foo', '42', 'strass', 'STRASSE 42'):
            with self.subTest(question=question):
                reference = self.ask(question)
                bounded = self.s._bounded_snapshot(self.u, self.g, answers.time.monotonic(), question)
                self.assertEqual(bounded.pop('digest'), digest)
                self.assertEqual(bounded, {key: reference[key] for key in bounded})

    def test_late_ties_unknown_conflicting_dates_and_independent_corrections(self):
        self.s.correct_asset(self.a, 'capacity-00990', title='synthetic', capture_date='2025-01-01', place='')
        for n in range(991, 1001):
            self.payload(dict(original_filename='synthetic', capture_assertions=[{'local': '2025-01-01'}]), f'capacity-{n:05d}')
        result = self.ask('earliest latest synthetic')
        self.assertEqual(result['matching_records'], 11)
        self.assertEqual([e['id'] for e in result['evidence']], [f'capacity-{n:05d}' for n in range(990, 995)])
        self.payload(dict(original_filename='synthetic', capture_assertions=[]))
        self.assertEqual(self.ask('latest synthetic')['matching_records'], 0)
        self.payload(dict(original_filename='synthetic', capture_assertions=[{'local': '2020-01-01'}, {'local': '2021-01-01'}],
                          location_assertions=[{'city': 'A'}, {'city': 'B'}]))
        self.s.correct_asset(self.a, 'capacity-01000', title='synthetic', capture_date=None, place='Resolved')
        self.assertEqual(self.ask('earliest synthetic')['matching_records'], 0)
        self.s.correct_asset(self.a, 'capacity-01000', title='synthetic', capture_date='2030-01-01', place='')
        result = self.ask('latest synthetic')
        self.assertEqual((result['matching_records'], result['evidence'][0]['place']), (1, ''))
        self.assertEqual(result['evidence'][0]['date_basis'], 'reviewed correction')

    def test_all_origins_cross_pages_and_late_nonconsenting_owner_excludes_asset(self):
        for n in range(500):
            self.extra_origin(f'zz-{n:04d}', dict(original_filename='lateunique' if n == 499 else '',
                                               capture_assertions=[{'local': '2030-01-01'}] if n == 499 else []))
        result = self.ask('lateunique')
        self.assertEqual(result['matching_records'], 1)
        self.assertEqual(result['evidence'][0]['dates'], ['2020-01-02', '2030-01-01'])
        self.assertEqual(self.ask('earliest lateunique')['matching_records'], 0)
        self.s.accept(self.fixture.outsider, self.s.invite(self.a, self.g))
        self.extra_origin('zzzz-no-consent', {}, owner=self.fixture.outsider)
        self.assertEqual(self.ask('lateunique')['matching_records'], 0)
        with self.s.db:
            self.s.db.execute("UPDATE archive_origins SET withdrawn=1 WHERE id='zzzz-no-consent'")
        self.assertEqual(self.ask('lateunique')['matching_records'], 1)

    def test_departed_payload_excluded_but_answer_consent_still_required(self):
        self.extra_origin('independent', dict(original_filename='independent'), owner=self.u)
        with self.s.db:
            self.s.db.execute('UPDATE archive_origins SET payload=? WHERE owner_id=? AND asset_id=?',
                              (json.dumps(dict(original_filename='departed', context=[{'text': 'x' * 70000}])), self.a, 'capacity-01000'))
        with self.s.db:
            self.s.db.execute('DELETE FROM members WHERE group_id=? AND user_id=?', (self.g, self.a))
        # Keep >1,000 visible photographs with a second live copy for every asset.
        with self.s.db:
            for n in range(1000):
                row = self.origin(f'capacity-{n:05d}')
                self.s.db.execute('INSERT INTO archive_origins VALUES(?,?,?,?,?,?,?,?,0)',
                                  (f'live-{n:04d}', row['asset_id'], self.g, self.u, row['run_id'],
                                   f'live-{n:04d}', 'test', json.dumps({'original_filename': 'independent'})))
        self.assertEqual(self.ask('independent')['matching_records'], 0)
        # An explicitly retained consent row still cannot make departed payload searchable.
        with self.s.db:
            self.s.db.execute('INSERT INTO answer_processing VALUES(?,?,1)', (self.g, self.a))
        result = self.ask('independent')
        self.assertEqual(result['matching_records'], 1001)
        self.assertEqual(self.ask('departed')['matching_records'], 0)

    def test_requester_local_contribution_is_not_required_without_their_evidence(self):
        self.s.processing(self.u, self.g, False)
        self.assertEqual(self.ask()['matching_records'], 1001)
        self.s.processing(self.a, self.g, False)
        self.assertEqual(self.ask()['matching_records'], 0)
        self.s.processing(self.a, self.g, True)
        self.s.correct_asset(self.u, 'capacity-01000', title='synthetic', capture_date=None, place='')
        self.assertEqual(self.ask()['matching_records'], 1000)
        self.s.processing(self.u, self.g, True)
        self.assertEqual(self.ask()['matching_records'], 1001)
        with self.s.db:
            self.s.db.execute('UPDATE review_annotations SET actor_id=?', (self.fixture.outsider,))
        self.assertEqual(self.ask()['matching_records'], 1000)

    def test_all_snapshot_mutations_fence_both_checkpoints_and_keep_committed_usage(self):
        other = MemoryStore(self.fixture.temp.name)
        self.addCleanup(other.close)
        for stage in ('dispatch', 'delivery'):
            for mutation in ('raw', 'annotation', 'shared_city', 'hide', 'withdraw', 'consent'):
                with self.subTest(stage=stage, mutation=mutation):
                    before, generation = self.usage(), self.s._generation(self.g)
                    old = self.origin()
                    def change(current):
                        if current != stage:
                            return
                        if mutation == 'raw':
                            payload = json.loads(old['payload']); payload['unsearched'] = before['requests']
                            other.db.execute('UPDATE archive_origins SET payload=? WHERE id=?', (json.dumps(payload), old['id']))
                            other.db.commit()
                        elif mutation == 'annotation':
                            other.correct_asset(self.a, old['asset_id'], title=f'Unmatched {before["requests"]}', capture_date=None, place='')
                        elif mutation == 'shared_city':
                            other.db.execute('INSERT INTO shared_places VALUES(?,?,?,?,?,?) ON CONFLICT(origin) DO UPDATE SET city=excluded.city',
                                             (old['id'], 'NL', str(before['requests']), 1, 1, '2020-01-01'))
                            other.db.commit()
                        elif mutation == 'hide':
                            other.hide(self.u, old['asset_id'], True)
                        elif mutation == 'withdraw':
                            other.db.execute('UPDATE archive_origins SET withdrawn=1 WHERE id=?', (old['id'],)); other.db.commit()
                        else:
                            other.answer_processing(self.a, self.g, False)
                            other.answer_processing(self.a, self.g, True)
                    self.s._checkpoint = change
                    with self.assertRaises(Conflict):
                        self.ask('0')
                    after = self.usage()
                    self.assertEqual((after['requests'], after['seconds']), (before['requests'] + 1, before['seconds']))
                    if mutation != 'consent':
                        self.assertEqual(self.s._generation(self.g), generation)
                    self.s._checkpoint = lambda _: None
                    with self.s.db:
                        self.s.db.execute('UPDATE archive_origins SET withdrawn=0 WHERE id=?', (old['id'],))
                    self.s.hide(self.u, old['asset_id'], False)

    def test_fixed_route_crosses_1000_both_directions_at_both_checkpoints(self):
        for stage in ('dispatch', 'delivery'):
            with self.subTest(stage=stage, route='bounded'):
                self.s._checkpoint = lambda current: self.s.hide(self.u, 'capacity-01000', True) if current == stage else None
                with self.assertRaises(Conflict):
                    self.ask()
            with self.subTest(stage=stage, route='legacy'):
                self.s._checkpoint = lambda current: self.s.hide(self.u, 'capacity-01000', False) if current == stage else None
                with self.assertRaises(CapacityExceeded):
                    self.ask()
        # Removing an ineligible photograph changes the route count, not the evidence.
        self.s.correct_asset(self.fixture.ben, 'capacity-01000', title='synthetic', capture_date=None, place='')
        with self.s.db:
            self.s.db.execute('UPDATE review_annotations SET actor_id=?', (self.fixture.outsider,))
        for stage in ('dispatch', 'delivery'):
            self.s._checkpoint = lambda current: self.s.hide(self.u, 'capacity-01000', True) if current == stage else None
            self.assertEqual(self.ask()['matching_records'], 1000)
            self.s._checkpoint = lambda _: None
            self.s.hide(self.u, 'capacity-01000', False)

    def test_authorization_rechecked_before_metadata_at_all_gates(self):
        with self.assertRaises(Denied):
            self.s.answer(self.fixture.outsider, self.g, 'synthetic')
        self.assertEqual(self.usage()['requests'], 0)
        for stage in ('dispatch', 'delivery'):
            for subject in ('*', self.u):
                before = self.usage()
                self.s._checkpoint = lambda current: self.s.answer_processing(self.a if subject == '*' else self.u, self.g, False,
                                                                             group_wide=subject == '*') if current == stage else None
                with self.assertRaises(Denied):
                    self.ask()
                self.assertEqual((self.usage()['requests'], self.usage()['seconds']), (before['requests'] + 1, before['seconds']))
                self.s.answer_processing(self.a if subject == '*' else self.u, self.g, True, group_wide=subject == '*')
        self.s._checkpoint = lambda _: None

    def test_unsupported_empty_and_no_result_still_have_three_complete_gates(self):
        for question in ('why synthetic', 'what photos', 'absent'):
            statements = []
            self.s.db.set_trace_callback(statements.append)
            try:
                result = self.ask(question)
            finally:
                self.s.db.set_trace_callback(None)
            self.assertEqual((result['status'], result['matching_records'], result['shown']), ('abstained', 0, 0))
            self.assertEqual(sum('WITH projected AS' in q for q in statements), 3 * (math.ceil(1001 / 128) + 1))
        self.s.daily_limit = 4
        self.ask()
        before = self.usage()
        with self.assertRaisesRegex(Conflict, 'Daily'):
            self.ask()
        self.assertEqual(self.usage(), before)

    def test_authorized_member_of_both_circles_gets_only_requested_circle_evidence(self):
        other_group = self.s.create_group(self.a, 'Another circle')
        self.s.accept(self.u, self.s.invite(self.a, other_group))
        run = self.fixture.submit({'onlyothercircle.jpg': picture()}, group=other_group)
        self.fixture.process(run)
        for subject in ('*', self.a, self.u):
            self.s.db.execute('INSERT INTO discovery_processing VALUES(?,?,1)', (other_group, subject))
            self.s.db.execute('INSERT INTO answer_processing VALUES(?,?,1)', (other_group, subject))
        self.s.db.commit()
        other = self.s.answer(self.u, other_group, 'onlyothercircle')
        self.assertEqual(other['matching_records'], 1)
        result = self.ask('onlyothercircle')
        self.assertEqual((result['matching_records'], result['evidence']), (0, []))
        self.assertEqual(self.ask()['matching_records'], 1001)
        with self.assertRaises(Denied):
            self.s.evidence(self.u, self.g, other['evidence'][0]['id'])

    def test_daily_50th_request_serializes_and_persists_across_connections(self):
        day = self.usage()['day_utc']
        with self.s.db:
            self.s.db.execute('INSERT INTO answer_usage VALUES(?,?,?,?,?)', (self.g, self.u, day, 49, 0))
        other = MemoryStore(self.fixture.temp.name)
        self.addCleanup(other.close)
        barrier = Barrier(2)
        def request(store):
            barrier.wait(timeout=5)
            try:
                return store.answer(self.u, self.g, 'synthetic')['status']
            except Conflict:
                return 'daily limit'
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(request, (self.s, other)))
        self.assertCountEqual(results, ['supported', 'daily limit'])
        self.assertEqual(self.usage()['requests'], 50)
        self.assertEqual(other.answer_settings(self.u, self.g)['usage']['requests'], 50)

    def test_utc_rollover_keeps_captured_accounting_day(self):
        current = [datetime(2026, 10, 19, 23, 59, 59, tzinfo=timezone.utc)]
        class ClockDateTime(datetime):
            @classmethod
            def now(cls, tz=None):
                return current[0]
        self.s._checkpoint = lambda stage: current.__setitem__(0, datetime(2026, 10, 20, tzinfo=timezone.utc))
        with patch.object(answers, 'datetime', ClockDateTime):
            result = self.ask()
            self.assertEqual((result['usage']['day_utc'], result['usage']['requests']), ('2026-10-20', 0))
            current[0] = datetime(2026, 10, 19, tzinfo=timezone.utc)
            self.assertEqual(self.usage()['requests'], 1)
            self.assertGreaterEqual(self.usage()['seconds'], 0)

    def test_group_local_processing_and_requester_membership_rechecked(self):
        for stage in ('dispatch', 'delivery'):
            for change in ('local', 'member'):
                before = self.usage()
                def revoke(current):
                    if current != stage:
                        return
                    if change == 'local':
                        self.s.processing(self.a, self.g, False, group_wide=True)
                    else:
                        self.s.remove_member(self.a, self.g, self.u)
                self.s._checkpoint = revoke
                with self.assertRaises(Denied):
                    self.ask()
                self.s._checkpoint = lambda _: None
                if change == 'local':
                    self.s.processing(self.a, self.g, True, group_wide=True)
                else:
                    self.s.accept(self.u, self.s.invite(self.a, self.g))
                    self.s.answer_processing(self.u, self.g, True)
                self.assertEqual((self.usage()['requests'], self.usage()['seconds']),
                                 (before['requests'] + 1, before['seconds']))

    def test_legacy_messenger_origin_over_64k_remains_supported(self):
        with self.s.db:
            self.s.db.execute('DELETE FROM archive_origins')
            self.s.db.execute('DELETE FROM archive_assets')
        metadata = dict(title='Synthetic conversation', participants=[{'name': 'Synthetic ' + str(n)} for n in range(2500)],
                        messages=[dict(sender_name='Synthetic sender', timestamp_ms=1577836800000,
                                       content='largeconversationkeyword', photos=[{'uri': 'photos/picture.jpg'}],
                                       reactions=[{'actor': 'Synthetic actor ' + str(n), 'reaction': 'like'} for n in range(1000)])])
        run = self.fixture.submit({'messages/inbox/synthetic/message_1.json': json.dumps(metadata), 'photos/picture.jpg': picture()},
                                  source='messenger')
        self.fixture.process(run)
        size = self.s.db.execute('SELECT length(CAST(payload AS BLOB)) FROM archive_origins').fetchone()[0]
        self.assertGreater(size, 65536)
        result = self.ask('largeconversationkeyword')
        self.assertEqual(result['matching_records'], 1)
        self.assertEqual(self.s.evidence(self.u, self.g, result['evidence'][0]['id']), result['evidence'][0])


if __name__ == '__main__':
    unittest.main()
