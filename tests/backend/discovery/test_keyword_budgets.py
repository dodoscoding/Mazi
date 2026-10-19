"""Byte ceilings are inclusive; exhausted searches never expose a partial page."""
import json
import sqlite3
import unittest
from unittest.mock import patch

from mazi.capacity import CapacityExceeded
from mazi.discovery import discovery
from tests.backend.archive import test_capacity as capacity_helpers
from tests.backend.imports import test_engine as helpers


def payload_bytes(size, character='x'):
    prefix, suffix = '{"context":[{"text":"', '"}]}'
    remaining = size - len(prefix + suffix)
    value = prefix + character * (remaining // len(character.encode())) + 'x' * (remaining % len(character.encode())) + suffix
    assert len(value.encode()) == size
    return value


class KeywordBudgetTests(unittest.TestCase):
    submit = helpers.EngineTests.submit
    process = helpers.EngineTests.process
    setUp = capacity_helpers.ArchiveCapacityTests.setUp
    tearDown = capacity_helpers.ArchiveCapacityTests.tearDown
    seed_projection = capacity_helpers.ArchiveCapacityTests.seed_projection

    def search(self, **kwargs):
        # Isolate byte ceilings from timing instrumentation and slower CI hosts.
        with patch.object(discovery.time, 'perf_counter', return_value=0):
            return self.store.search(self.ben, self.group, **kwargs)

    def set_payload(self, value, origin='origin-capacity-00000'):
        self.store.db.execute('UPDATE archive_origins SET payload=? WHERE id=?', (value, origin))
        self.store.db.commit()

    def add_origin(self, number, value, asset='capacity-00000'):
        row = self.store.db.execute('SELECT * FROM archive_origins WHERE asset_id=? LIMIT 1', (asset,)).fetchone()
        origin = f'zz-extra-{number:05d}'
        self.store.db.execute('INSERT INTO archive_origins VALUES(?,?,?,?,?,?,?,?,0)',
                              (origin, asset, self.group, self.alice, row['run_id'], origin, origin, value))

    def test_origin_boundary_counts_utf8_and_does_not_fetch_oversized_payload(self):
        self.seed_projection(1001)
        for character in ('x', 'é', '😀'):
            with self.subTest(character=character):
                self.set_payload(payload_bytes(64 * 1024, character))
                self.assertEqual(self.search()['total'], 1001)
                self.set_payload(payload_bytes(64 * 1024 + 1, character))
                oversized = []
                def observe(cursor, values):
                    row = sqlite3.Row(cursor, values)
                    if 'payload_bytes' in row.keys() and row['payload_bytes'] > 64 * 1024:
                        oversized.append(row['payload'])
                    return row
                self.store.db.row_factory = observe
                try:
                    with self.assertRaisesRegex(CapacityExceeded, 'per-origin'):
                        self.search()
                finally:
                    self.store.db.row_factory = sqlite3.Row
                self.assertEqual(oversized, [None])

    def test_complete_asset_boundary_keeps_all_origins_then_rejects_one_extra_byte(self):
        self.seed_projection(1001)
        self.set_payload(payload_bytes(64 * 1024))
        for number in range(127):
            self.add_origin(number, payload_bytes(64 * 1024))
        self.store.db.commit()
        self.assertEqual(self.search()['total'], 1001)
        self.set_payload(payload_bytes(64 * 1024 - 1))
        self.add_origin(127, '{}')
        self.store.db.commit()
        with self.assertRaisesRegex(CapacityExceeded, 'per-photograph'):
            self.search(offset=1000)

    def test_request_boundary_and_rollback_after_counting_earlier_matches(self):
        self.seed_projection(1024)
        self.store.db.execute('UPDATE archive_origins SET payload=?', (payload_bytes(64 * 1024),))
        self.store.db.commit()
        self.assertEqual(self.search(offset=1023)['total'], 1024)
        self.set_payload(payload_bytes(64 * 1024 - 1), 'origin-capacity-01023')
        self.add_origin(0, '{}', 'capacity-01023')
        self.store.db.execute('INSERT INTO discovery_vectors VALUES(?,?,?,?,?,?)',
                              ('capacity-00000', 'text', 'synthetic', 1, 'synthetic', '[1]'))
        self.store.db.commit()
        with self.assertRaisesRegex(CapacityExceeded, 'request limit'):
            self.search(limit=1)
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM discovery_vectors').fetchone()[0], 1)
        self.assertFalse(self.store.db.in_transaction)
        self.store.db.execute("DELETE FROM archive_origins WHERE id='zz-extra-00000'")
        self.store.db.commit()
        self.assertEqual(self.search()['total'], 1024)
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM discovery_vectors').fetchone()[0], 0)

    def test_cooperative_time_budget_is_inclusive_and_rolls_back(self):
        self.seed_projection(1001)
        self.store.db.execute('INSERT INTO discovery_vectors VALUES(?,?,?,?,?,?)',
                              ('capacity-00000', 'text', 'synthetic', 1, 'synthetic', '[1]'))
        self.store.db.commit()
        with patch.object(discovery.time, 'perf_counter', side_effect=[0, 0, 2.001]):
            with self.assertRaisesRegex(CapacityExceeded, 'scan time'):
                self.store.search(self.ben, self.group, limit=1)
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM discovery_vectors').fetchone()[0], 1)
        times = iter([0])
        with patch.object(discovery.time, 'perf_counter', side_effect=lambda: next(times, 2)):
            self.assertEqual(self.store.search(self.ben, self.group)['total'], 1001)
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM discovery_vectors').fetchone()[0], 0)

    def test_postgres_projection_branch_uses_octet_length_with_the_same_byte_guard(self):
        # Executes the branch against a SQLite octet_length shim, not hosted acceptance.
        self.seed_projection(1001)
        self.set_payload(payload_bytes(64 * 1024 + 1, '😀'))
        connection = self.store.db
        connection.create_function('octet_length', 1, lambda value: len(value.encode()))
        statements = []
        class HostedProjection:
            hosted = True
            def execute(self, sql, parameters=()):
                statements.append(sql)
                return connection.execute(sql, parameters)
            def commit(self):
                connection.commit()
            def rollback(self):
                connection.rollback()
        self.store.db = HostedProjection()
        try:
            with self.assertRaisesRegex(CapacityExceeded, 'per-origin'):
                self.search()
        finally:
            self.store.db = connection
        projection = next(sql for sql in statements if 'AS payload_bytes' in sql)
        self.assertIn('octet_length(o.payload)', projection)
        self.assertIn('CASE WHEN octet_length(o.payload)<=? THEN o.payload ELSE NULL END', projection)
        self.assertNotIn('CAST(o.payload AS BLOB)', projection)

    def test_real_large_messenger_metadata_remains_searchable_below_legacy_boundary(self):
        participants = [{'name': 'Synthetic participant ' + str(n)} for n in range(2500)]
        metadata = {'title': 'Synthetic large conversation', 'participants': participants, 'messages': [
            {'sender_name': 'Synthetic sender', 'timestamp_ms': 1577836800000, 'content': 'largeconversationkeyword',
             'photos': [{'uri': 'photos/picture.jpg'}],
             'reactions': [{'actor': 'Synthetic actor ' + str(n), 'reaction': 'like'} for n in range(1000)]}]}
        run = self.submit({'messages/inbox/synthetic/message_1.json': json.dumps(metadata),
                           'photos/picture.jpg': helpers.picture()}, source='messenger')
        self.process(run)
        self.assertEqual(self.store.report(self.alice, run)['state'], 'COMPLETED')
        self.assertGreater(self.store.db.execute('SELECT length(CAST(payload AS BLOB)) FROM archive_origins').fetchone()[0], 64 * 1024)
        self.assertEqual(self.store.search(self.ben, self.group, query='largeconversationkeyword')['total'], 1)
        self.seed_projection(999)
        self.assertEqual(self.store.search(self.ben, self.group)['total'], 1000)
        self.assertEqual(self.store.search(self.ben, self.group, query='largeconversationkeyword')['total'], 1)


if __name__ == '__main__':
    unittest.main()
