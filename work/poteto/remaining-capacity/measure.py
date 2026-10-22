import json
import time
import tracemalloc

from tests.backend.discovery.test_remaining_capacity import RemainingCapacityTests
from tests.backend.imports.test_engine import picture

fixture = RemainingCapacityTests()
fixture.setUp()
try:
    fixture.prepare(10000)
    store, user, group = fixture.store, fixture.ben, fixture.group
    store.objects.retain('archive-objects', 'synthetic', picture())
    results = {'fixture': '10000 seeded authorized metadata records sharing one real 8px JPEG preview; not an import benchmark', 'operations': {}}
    for name, operation in (
            ('related', lambda: store.search(user, group, mode='semantic', offset=9990, limit=10)),
            ('index', lambda: store.index_batch(user, group, limit=5)),
            ('events', lambda: store.event_suggestions(user, group)),
            ('duplicates', lambda: store.duplicate_suggestions(user, group)),
            ('places', lambda: store.places(user, group))):
        tracemalloc.start()
        started = time.perf_counter()
        result = operation()
        elapsed = time.perf_counter() - started
        _, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        shape = {'total': result['total']} if name == 'related' else result if name == 'index' else {'rows': len(result['points'])} if name == 'places' else {'rows': len(result)}
        results['operations'][name] = dict(seconds=round(elapsed, 4), traced_peak_bytes=peak, result=shape)
    print(json.dumps(results, indent=2))
finally:
    fixture.tearDown()
