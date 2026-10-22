"""Measure every production baseline index batch on a synthetic 10k archive."""
import json
import os
import sys
import time
from pathlib import Path

os.environ['MAZI_BACKEND'] = 'local'
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from tests.backend.discovery.test_remaining_capacity import RemainingCapacityTests
from tests.backend.imports.test_engine import picture

fixture = RemainingCapacityTests()
fixture.setUp()
try:
    fixture.prepare(10000)
    store = fixture.store
    store.objects.retain('archive-objects', 'synthetic', picture())
    started = time.perf_counter()
    durations = []
    indexed = 0
    while True:
        batch_start = time.perf_counter()
        result = store.index_batch(fixture.ben, fixture.group, limit=5)
        durations.append(time.perf_counter() - batch_start)
        indexed += result['indexed']
        assert result['discarded'] == 0
        assert result['remaining'] == 10000 - indexed
        if len(durations) % 100 == 0:
            print(json.dumps({'batches': len(durations), 'remaining': result['remaining'], 'seconds': round(time.perf_counter() - started, 3)}), flush=True)
        if not result['remaining']:
            break
        assert result['indexed'] == 5
    assert indexed == 10000
    page = store.search(fixture.ben, fixture.group, mode='semantic', offset=9990, limit=10)
    assert page['total'] == 10000 and page['unindexed'] == 0 and len(page['items']) == 10
    print(json.dumps({'fixture': '10000 seeded metadata records sharing one real JPEG; actual baseline encoder; no inference, clock or budget mocks', 'indexed': indexed, 'batches': len(durations), 'seconds': round(time.perf_counter() - started, 3), 'maximum_batch_seconds': round(max(durations), 3), 'final_search_unindexed': page['unindexed']}), flush=True)
finally:
    fixture.tearDown()
