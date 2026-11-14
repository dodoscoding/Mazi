"""Run UI-produced edit patches against an isolated synthetic archive."""
import json
import os
import sys

os.environ["MAZI_BACKEND"] = "local"

from mazi.social import social
from tests.backend.social.test_plans import PlanMemoryTests


def main():
    patches = json.load(sys.stdin)
    fixture = PlanMemoryTests()
    fixture.setUp()
    try:
        store, user, group = fixture.store, fixture.alice, fixture.group
        event = store.review_event(user, group, fixture.assets, 'Winter together', 'accept')
        plan = social.create_plan(store, user, group, 'linked', dict(
            title='Meet again', start_local='2030-06-01T18:00', timezone='UTC', memory=event))
        store.hide_event(user, group, event, True)
        assert social.get_plan(store, user, group, plan['id'])['memory'] is None
        assert social.get_plan(store, fixture.ben, group, plan['id'])['memory']['id'] == event
        edited = social.update_plan(store, user, group, plan['id'], 1, 'title', patches['hidden'])
        assert edited['title'] == 'Yeni başlık'
        assert store.db.execute('SELECT memory_id FROM social_plans WHERE id=?', (plan['id'],)).fetchone()[0] == event
        store.hide_event(user, group, event, False)
        assert social.get_plan(store, user, group, plan['id'])['memory']['id'] == event
        removed = social.update_plan(store, user, group, plan['id'], 2, 'unlink', patches['unlink'])
        assert removed['memory'] is None
        assert social.get_plan(store, fixture.ben, group, plan['id'])['memory'] is None
        print('hidden link preserved; visible unlink applied')
    finally:
        fixture.tearDown()


if __name__ == '__main__':
    main()
