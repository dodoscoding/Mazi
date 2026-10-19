"""Exact UTF-8, row, serialized evidence, and cooperative clock boundaries."""
import json
import unittest
from datetime import date, timedelta
from unittest.mock import patch

from mazi.answers import answers
from mazi.capacity import CapacityExceeded
from mazi.persistence import bind_sql
from tests.backend.answers import test_streaming as fixtures


class ObservedConnection:
    """Observe actual driver transfers; optionally exercise the hosted SQL dialect."""
    def __init__(self, db, observer, hosted=False):
        self.db, self.observer, self.hosted = db, observer, hosted

    def __getattr__(self, name):
        return getattr(self.db, name)

    def __enter__(self):
        self.db.__enter__()
        return self

    def __exit__(self, *args):
        return self.db.__exit__(*args)

    def execute(self, query, params=()):
        cursor = self.db.execute(query, params)
        if 'WITH projected AS' in query:
            rows = cursor.fetchall()
            self.observer(query, params, rows)
            class Batch:
                def fetchall(self):
                    return rows
            return Batch()
        self.observer(query, params, None)
        return cursor


def padded_payload(size, unit='x', **fields):
    payload = dict(original_filename='synthetic', padding='', **fields)
    overhead = len(json.dumps(payload, ensure_ascii=False).encode())
    remaining = size - overhead
    assert remaining >= 0
    payload['padding'] = unit * (remaining // len(unit.encode())) + 'x' * (remaining % len(unit.encode()))
    result = json.dumps(payload, ensure_ascii=False)
    assert len(result.encode()) == size
    return result


class ResourceAnswerTests(fixtures.AnswerFixture):
    def update_raw(self, raw, identity=None):
        with self.s.db:
            self.s.db.execute('UPDATE archive_origins SET payload=? WHERE id=?', (raw, identity or self.origin()['id']))

    def projected_size(self, origin):
        row = self.s.db.execute('''SELECT a.id,o.id,m.user_id,o.payload,n.title,n.capture_date,
                n.place,n.actor_id,am.user_id,p.city FROM archive_origins o
            JOIN archive_assets a ON a.id=o.asset_id
            LEFT JOIN members m ON m.group_id=o.group_id AND m.user_id=o.owner_id
            LEFT JOIN review_annotations n ON n.asset_id=a.id
            LEFT JOIN members am ON am.group_id=a.group_id AND am.user_id=n.actor_id
            LEFT JOIN shared_places p ON p.origin=o.id WHERE o.id=?''', (origin,)).fetchone()
        return sum(len(value.encode()) for value in row if value is not None)

    def fill_projected_row(self, identity, target, unit='x'):
        row = self.s.db.execute('SELECT payload FROM archive_origins WHERE id=?', (identity,)).fetchone()
        overhead = self.projected_size(identity) - len(row['payload'].encode())
        self.update_raw(padded_payload(target - overhead, unit), identity)
        self.assertEqual(self.projected_size(identity), target)

    def test_origin_utf8_exact_and_one_byte_over_are_prefetch_safe(self):
        for unit in ('a', 'é', '🧪'):
            with self.subTest(unit=unit):
                raw = padded_payload(65536, unit)
                self.update_raw(raw)
                self.assertEqual(self.ask()['matching_records'], 1001)
                self.update_raw(raw + ' ')
                before = self.usage()
                captured = []
                original = self.s.db
                self.s.db = ObservedConnection(original, lambda q, p, r: captured.extend(r or []))
                try:
                    with self.assertRaisesRegex(CapacityExceeded, '64 KiB.*origin'):
                        self.ask()
                finally:
                    self.s.db = original
                rejected = next(row for row in captured if row['payload_bytes'] == 65537)
                for field in ('id', 'origin', 'live_owner', 'payload', 'title', 'capture_date', 'place', 'actor_id', 'annotation_member', 'city'):
                    self.assertIsNone(rejected[field], field)
                self.assertEqual(self.usage(), before)

    def test_combined_row_exact_and_one_byte_over_mask_every_text_cell(self):
        origin = self.origin()['id']
        for unit in ('a', 'é', '🧪'):
            with self.subTest(unit=unit):
                with self.s.db:
                    self.s.db.execute('DELETE FROM shared_places WHERE origin=?', (origin,))
                self.update_raw(padded_payload(65536, unit))
                available = 69632 - self.projected_size(origin)
                city = unit * (available // len(unit.encode())) + 'x' * (available % len(unit.encode()))
                with self.s.db:
                    self.s.db.execute('INSERT INTO shared_places VALUES(?,?,?,?,?,?)', (origin, 'NL', city, 1, 1, '2020-01-01'))
                self.assertEqual(self.projected_size(origin), 69632)
                self.assertEqual(self.ask()['matching_records'], 1001)
                with self.s.db:
                    self.s.db.execute("UPDATE shared_places SET city=city || 'x' WHERE origin=?", (origin,))
                before, captured, original = self.usage(), [], self.s.db
                self.s.db = ObservedConnection(original, lambda q, p, r: captured.extend(r or []))
                try:
                    with self.assertRaisesRegex(CapacityExceeded, '68 KiB'):
                        self.ask()
                finally:
                    self.s.db = original
                rejected = next(row for row in captured if row['row_bytes'] == 69633)
                self.assertTrue(all(rejected[field] is None for field in ('id', 'origin', 'live_owner', 'payload', 'title', 'capture_date', 'place', 'actor_id', 'annotation_member', 'city')))
                self.assertEqual(self.usage(), before)

    def test_asset_combined_bytes_exact_and_one_byte_over(self):
        row = self.origin()
        self.s.correct_asset(self.a, row['asset_id'], title='synthetic ' + 'x' * 180,
                             capture_date='2020-01-01', place='Amsterdam')
        for n in range(127):
            self.extra_origin(f'zz-asset-{n:04d}', {})
        identities = [r[0] for r in self.s.db.execute('SELECT id FROM archive_origins WHERE asset_id=? ORDER BY id', (row['asset_id'],))]
        for unit in ('a', 'é', '🧪'):
            with self.subTest(unit=unit):
                for identity in identities:
                    self.fill_projected_row(identity, 65536, unit)
                self.assertEqual(sum(self.projected_size(identity) for identity in identities), 8388608)
                self.assertEqual(self.ask()['matching_records'], 1001)
                before = self.usage()
                with self.s.db:
                    self.s.db.execute("UPDATE archive_origins SET payload=payload || ' ' WHERE id=?", (identities[-1],))
                with self.assertRaisesRegex(CapacityExceeded, '8 MiB'):
                    self.ask()
                self.assertEqual(self.usage(), before)

    def test_pass_combined_bytes_exact_and_one_byte_over_including_ineligible_records(self):
        for n in range(23):
            self.extra_origin(f'copy-pass-{n:04d}', {}, f'capacity-{n:05d}')
        identities = [r[0] for r in self.s.db.execute('SELECT id FROM archive_origins ORDER BY asset_id,id')]
        self.assertEqual(len(identities), 1024)
        for unit in ('a', 'é', '🧪'):
            with self.subTest(unit=unit):
                self.s.answer_processing(self.a, self.g, True)
                for identity in identities:
                    self.fill_projected_row(identity, 65536, unit)
                self.assertEqual(sum(self.projected_size(identity) for identity in identities), 67108864)
                self.assertEqual(self.ask()['matching_records'], 1001)
                with self.s.db:
                    self.s.db.execute("UPDATE archive_origins SET payload=payload || ' ' WHERE id=?", (identities[-1],))
                # Ineligibility does not avoid work already read by a complete check.
                self.s.answer_processing(self.a, self.g, False)
                before = self.usage()
                with self.assertRaisesRegex(CapacityExceeded, '64 MiB.*evidence check'):
                    self.ask()
                self.assertEqual(self.usage(), before)

    def test_asset_row_exact_and_one_over_counts_departed_and_ineligible_origins(self):
        row = self.origin()
        with self.s.db:
            for n in range(8191):
                self.s.db.execute('INSERT INTO archive_origins VALUES(?,?,?,?,?,?,?,?,0)',
                                  (f'zz-row-{n:05d}', row['asset_id'], self.g, self.fixture.outsider,
                                   row['run_id'], f'zz-row-{n:05d}', 'test', 'x' * 100000 if n == 8190 else '{}'))
        # Departed source payloads are neither transferred nor parsed, but rows count.
        self.assertEqual(self.ask()['matching_records'], 1000)
        self.extra_origin('zzzz-over-row', {}, owner=self.fixture.outsider)
        before = self.usage()
        with self.assertRaisesRegex(CapacityExceeded, '8,192'):
            self.ask()
        self.assertEqual(self.usage(), before)

    def test_pass_row_exact_and_one_over(self):
        row = self.origin()
        with self.s.db:
            for n in range(98999):
                identity, asset = f'copy-rows-{n:06d}', f'capacity-{n % 1001:05d}'
                self.s.db.execute('INSERT INTO archive_origins VALUES(?,?,?,?,?,?,?,?,0)',
                                  (identity, asset, self.g, self.a, row['run_id'], identity, 'test', '{}'))
        self.assertEqual(self.s.db.execute('SELECT count(*) FROM archive_origins').fetchone()[0], 100000)
        # Deterministic resource boundary, not timing evidence: the 3s ceiling is independent.
        with patch.object(answers.time, 'monotonic', return_value=0):
            self.assertEqual(self.ask()['matching_records'], 1001)
            self.extra_origin('zzzz-pass-row', {})
            before = self.usage()
            with self.assertRaisesRegex(CapacityExceeded, '100,000'):
                self.ask()
            self.assertEqual(self.usage(), before)

    def test_serialized_evidence_exact_plus_one_and_unshown_record_limit(self):
        # A source place is preserved in evidence, including default JSON escaping.
        for unit in ('x', 'é', '🧪'):
            self.payload(dict(original_filename='synthetic', location_assertions=[{'city': 'a'}]))
            reference = self.s.evidence(self.u, self.g, 'capacity-01000')
            overhead = len(json.dumps(reference).encode()) - 1
            escaped = len(json.dumps(unit)) - 2
            remaining = 65536 - overhead
            place = unit * (remaining // escaped) + 'x' * (remaining % escaped)
            self.payload(dict(original_filename='synthetic', location_assertions=[{'city': place}]))
            self.assertEqual(len(json.dumps(self.s.evidence(self.u, self.g, 'capacity-01000')).encode()), 65536)
            self.assertEqual(self.ask()['matching_records'], 1001)
            before = self.usage()
            self.payload(dict(original_filename='synthetic', location_assertions=[{'city': place + 'x'}]))
            with self.assertRaisesRegex(CapacityExceeded, '64 KiB evidence'):
                self.ask('absent')
            self.assertEqual(self.usage(), before)

    def test_distinct_source_dates_exhaust_evidence_below_asset_budget(self):
        for n in range(6):
            assertions = [{'local': (date(2000, 1, 1) + timedelta(days=n * 1000 + d)).isoformat()} for d in range(1000)]
            self.extra_origin(f'dates-{n}', dict(capture_assertions=assertions))
        total = sum(self.projected_size(r[0]) for r in self.s.db.execute('SELECT id FROM archive_origins WHERE asset_id=?', ('capacity-01000',)))
        self.assertLess(total, 8388608)
        before = self.usage()
        with self.assertRaisesRegex(CapacityExceeded, '64 KiB evidence'):
            self.ask()
        self.assertEqual(self.usage(), before)

    def test_budget_failures_roll_back_initial_and_keep_later_requests_without_seconds(self):
        before = self.usage()
        with patch.object(answers, 'ANSWER_PASS_ROWS', 1000):
            with self.assertRaises(CapacityExceeded):
                self.ask()
        self.assertEqual(self.usage(), before)
        for stage in ('dispatch', 'delivery'):
            before = self.usage()
            def change(current):
                if current == stage:
                    answers.ANSWER_PASS_ROWS = 1000
            self.s._checkpoint = change
            try:
                with self.assertRaises(CapacityExceeded):
                    self.ask()
            finally:
                answers.ANSWER_PASS_ROWS = 100000
                self.s._checkpoint = lambda _: None
            after = self.usage()
            self.assertEqual((after['requests'], after['seconds']), (before['requests'] + 1, before['seconds']))

    def test_later_serialized_evidence_overflow_keeps_request_without_seconds(self):
        for stage in ('dispatch', 'delivery'):
            before = self.usage()
            def change(current):
                if current == stage:
                    self.payload(dict(original_filename='synthetic', location_assertions=[{'city': '🧪' * 6000}]))
            self.s._checkpoint = change
            with self.assertRaisesRegex(CapacityExceeded, '64 KiB evidence'):
                self.ask()
            after = self.usage()
            self.assertEqual((after['requests'], after['seconds']), (before['requests'] + 1, before['seconds']))
            self.s._checkpoint = lambda _: None
            self.payload(dict(original_filename='synthetic'))

    def test_page_budget_is_charged_before_any_payload_in_that_page_is_parsed(self):
        first = self.origin('capacity-00000')
        self.update_raw('invalid json', first['id'])
        self.update_raw(padded_payload(65536) + ' ', self.origin('capacity-00127')['id'])
        with self.assertRaisesRegex(CapacityExceeded, '64 KiB.*origin'):
            self.ask()

    def test_hidden_and_other_group_metadata_do_not_consume_budget(self):
        self.update_raw('not valid JSON' * 10000)
        self.s.hide(self.u, 'capacity-01000', True)
        # Keep the bounded route with another valid asset.
        row = self.origin('capacity-00000')
        with self.s.db:
            self.s.db.execute('INSERT INTO archive_assets SELECT ?,group_id,?,original_key,preview_key,mime,size,width,height FROM archive_assets WHERE id=?',
                              ('zz-extra', 'zz-extra', row['asset_id']))
            self.s.db.execute('INSERT INTO archive_origins VALUES(?,?,?,?,?,?,?,?,0)',
                              ('zz-extra-origin', 'zz-extra', self.g, self.a, row['run_id'], 'zz-extra', 'test', row['payload']))
        other_group = self.s.create_group(self.fixture.outsider, 'Other circle')
        with self.s.db:
            self.s.db.execute('INSERT INTO archive_assets VALUES(?,?,?,?,?,?,?,?,?)',
                              ('outsider-asset', other_group, 'outsider-asset', 'synthetic', 'synthetic', 'image/jpeg', 1, 8, 8))
            self.s.db.execute('INSERT INTO archive_origins VALUES(?,?,?,?,?,?,?,?,0)',
                              ('outsider-origin', 'outsider-asset', other_group, self.fixture.outsider,
                               row['run_id'], 'outsider-only', 'test', 'malformed private metadata' * 10000))
        self.assertEqual(self.ask()['matching_records'], 1001)

    def test_hosted_byte_expressions_binds_and_guards_on_sqlite_shim(self):
        self.update_raw(padded_payload(65536, '🧪'))
        original, captured = self.s.db, []
        original.create_function('octet_length', 1, lambda value: None if value is None else len(value.encode()))
        self.s.db = ObservedConnection(original, lambda q, p, r: captured.append((q, p)) if r is not None else None, hosted=True)
        try:
            self.assertEqual(self.ask()['matching_records'], 1001)
            self.update_raw(padded_payload(65536, '🧪') + ' ')
            with self.assertRaisesRegex(CapacityExceeded, '64 KiB.*origin'):
                self.ask()
        finally:
            self.s.db = original
        self.assertTrue(captured)
        for query, params in captured:
            self.assertIn('octet_length(payload)', query)
            self.assertNotIn('AS BLOB', query)
            self.assertEqual(query.count('?'), len(params))
            self.assertEqual(bind_sql(query).count('%s'), len(params))


class ClockAnswerTests(fixtures.AnswerFixture):
    def test_exact_pass_deadline_and_one_tick_over(self):
        for elapsed in (3, 3.000001):
            clock = [0]
            original, changed = self.s.db, [False]
            def observe(query, params, rows):
                if rows is not None and not changed[0]:
                    clock[0] = elapsed
                    changed[0] = True
            self.s.db = ObservedConnection(original, observe)
            before = self.usage()
            try:
                with patch.object(answers.time, 'monotonic', side_effect=lambda: clock[0]):
                    if elapsed == 3:
                        self.assertEqual(self.ask()['matching_records'], 1001)
                    else:
                        with self.assertRaisesRegex(CapacityExceeded, 'processing budget'):
                            self.ask()
            finally:
                self.s.db = original
            if elapsed > 3:
                self.assertEqual(self.usage(), before)

    def test_exact_request_deadline_and_one_tick_over_preserve_committed_usage(self):
        for elapsed in (8, 8.000001):
            clock = [0]
            self.s._checkpoint = lambda stage: clock.__setitem__(0, 4 if stage == 'dispatch' else elapsed)
            before = self.usage()
            with patch.object(answers.time, 'monotonic', side_effect=lambda: clock[0]):
                if elapsed == 8:
                    result = self.ask()
                    self.assertEqual(result['usage']['seconds'], 8)
                else:
                    with self.assertRaisesRegex(CapacityExceeded, 'processing budget'):
                        self.ask()
            after = self.usage()
            self.assertEqual(after['requests'], before['requests'] + 1)
            if elapsed > 8:
                self.assertEqual(after['seconds'], before['seconds'])

    def test_request_clock_includes_initial_lock_and_route_probe(self):
        for boundary in ('BEGIN IMMEDIATE', 'LIMIT 1001'):
            clock, original = [0], self.s.db
            def observe(query, params, rows):
                if boundary in query:
                    clock[0] = 8.000001
            before = self.usage()
            self.s.db = ObservedConnection(original, observe)
            try:
                with patch.object(answers.time, 'monotonic', side_effect=lambda: clock[0]):
                    with self.assertRaises(CapacityExceeded):
                        self.ask()
            finally:
                self.s.db = original
            self.assertEqual(self.usage(), before)

    def test_request_clock_checked_after_response_usage_assembly(self):
        clock, calls = [0], [0]
        original = self.s._usage
        before = self.usage()
        def usage(*args):
            result = original(*args)
            calls[0] += 1
            if calls[0] == 2:
                clock[0] = 8.000001
            return result
        with patch.object(answers.time, 'monotonic', side_effect=lambda: clock[0]), patch.object(self.s, '_usage', side_effect=usage):
            with self.assertRaises(CapacityExceeded):
                self.ask()
        after = self.usage()
        self.assertEqual((after['requests'], after['seconds']), (before['requests'] + 1, before['seconds']))


if __name__ == '__main__':
    unittest.main()
