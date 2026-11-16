"""Measure only bounded reads using synthetic hosted archive fixtures."""
import json
import os
from pathlib import Path
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from mazi import atlas
from mazi.social import conversations, home, social
from tests.backend.social.test_home_postgres import HostedHomeTests

if os.environ.get('MAZI_TEST_POSTGRES') != '1' or not os.environ.get('MAZI_DATABASE_SCHEMA', '').endswith('_test') or os.environ.get('MAZI_STORAGE_BUCKET') != 'mazi-social-test':
    raise RuntimeError('Use only the isolated synthetic schema and private bucket')

fixture = HostedHomeTests()
fixture.setUp()
try:
    samples = {}
    def measure(name, read):
        execute = fixture.store.db.execute
        calls = [0]
        def counted(*args, **kwargs):
            calls[0] += 1
            return execute(*args, **kwargs)
        fixture.store.db.execute = counted
        values = []
        try:
            for _ in range(2):
                calls[0] = 0
                started = time.perf_counter()
                result = read()
                values.append(dict(seconds=round(time.perf_counter() - started, 3), sql_calls=calls[0], bytes=len(json.dumps(result).encode())))
        finally:
            fixture.store.db.execute = execute
        samples[name] = values
    measure('archive_only', lambda: home.home_view(fixture.store, fixture.alice, fixture.group))
    for index in range(20):
        conversations.create_comment(fixture.store, fixture.ben, fixture.group, str(index), fixture.target(), 'Synthetic discussion')
    measure('active_conversation', lambda: home.home_view(fixture.store, fixture.alice, fixture.group))
    social.create_plan(fixture.store, fixture.alice, fixture.group, 'plan', dict(title='Synthetic plan', start_local='2030-06-01T18:00', timezone='UTC'))
    measure('upcoming_plan', lambda: home.home_view(fixture.store, fixture.alice, fixture.group))
    measure('selected_photo', lambda: atlas.memory_view(fixture.store, fixture.alice, fixture.group, 'photo-' + fixture.asset))
    print(json.dumps(samples, indent=2))
finally:
    fixture.tearDown()
