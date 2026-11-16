"""Measure a synthetic reaction page using the guarded hosted test fixture."""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from mazi.social import conversations, reactions
from tests.backend.social.test_reactions_postgres import HostedReactionsTests

fixture = HostedReactionsTests()
fixture.setUp()
try:
    targets = [fixture.target()]
    for index in range(20):
        comment = conversations.create_comment(
            fixture.store, fixture.ben, fixture.group,
            'profile-comment-' + str(index), fixture.target(),
            'Synthetic batch measurement',
        )
        targets.append(dict(kind='comment', id=comment['id']))
    execute = fixture.store.db.execute
    calls = [0]

    def measured_execute(*args, **kwargs):
        calls[0] += 1
        return execute(*args, **kwargs)

    fixture.store.db.execute = measured_execute
    measurements = []
    for _ in range(2):
        calls[0] = 0
        started = time.perf_counter()
        result = reactions.batch_reactions(
            fixture.store, fixture.alice, fixture.group, targets,
        )
        measurements.append(dict(
            targets=len(result['items']),
            seconds=round(time.perf_counter() - started, 3),
            sql_calls=calls[0],
        ))
    fixture.store.db.execute = execute
    print(json.dumps(measurements))
finally:
    fixture.tearDown()
