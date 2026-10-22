import json
import time
import unittest
from unittest.mock import patch

from mazi.capacity import CapacityExceeded
from mazi.discovery.embeddings import BaselineEncoder
from tests.backend.archive.test_capacity import ArchiveCapacityTests


class RemainingCapacityTests(unittest.TestCase):
    setUp = ArchiveCapacityTests.setUp
    tearDown = ArchiveCapacityTests.tearDown
    submit = ArchiveCapacityTests.submit
    process = ArchiveCapacityTests.process
    seed_projection = ArchiveCapacityTests.seed_projection

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


if __name__ == '__main__':
    unittest.main()
