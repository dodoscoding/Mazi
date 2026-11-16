import os
import unittest
from unittest.mock import patch

from mazi import atlas
from mazi.identity.core import Denied, Store
from mazi.social import conversations, home, reactions, social
from tests.backend.social import test_comments_postgres


@unittest.skipUnless(os.environ.get('MAZI_TEST_POSTGRES') == '1', 'requires isolated hosted test schema')
class HostedHomeTests(unittest.TestCase):
    setUp = test_comments_postgres.HostedCommentsTests.setUp
    tearDown = test_comments_postgres.HostedCommentsTests.tearDown
    target = test_comments_postgres.HostedCommentsTests.target

    def test_home_selected_projection_and_plan_summary_without_archive_scan(self):
        with patch.object(atlas, 'atlas_view', side_effect=AssertionError('Full Atlas forbidden')), patch.object(self.store, '_timeline_items', side_effect=AssertionError('Full timeline forbidden')):
            archive = home.home_view(self.store, self.ben, self.group)
            selected = atlas.memory_view(self.store, self.ben, self.group, 'photo-' + self.asset)
        self.assertEqual(archive['featured']['memory'], selected['memory'])
        self.assertEqual(selected['memory']['photos'][0]['assetId'], self.asset)
        plan = social.create_plan(self.store, self.alice, self.group, 'plan', dict(title='Synthetic plan', start_local='2030-06-01T18:00', timezone='UTC'))
        with patch.object(social, '_view', side_effect=AssertionError('Full plan forbidden')):
            planned = home.home_view(self.store, self.ben, self.group)
        self.assertEqual((planned['featured']['kind'], planned['featured']['plan']['id']), ('plan', plan['id']))

    def test_same_time_cursor_current_visibility_and_departed_actions(self):
        with patch.object(conversations.time, 'time', return_value=1792000000.1234567):
            first = conversations.create_comment(self.store, self.alice, self.group, 'first', self.target(), 'First')
            second = conversations.create_comment(self.store, self.ben, self.group, 'second', self.target(), 'Second')
        page = home.activity(self.store, self.alice, self.group, limit=1)
        following = home.activity(self.store, self.alice, self.group, limit=1, cursor=page['next_cursor'])
        self.assertEqual({page['items'][0]['id'], following['items'][0]['id']}, {'comment:' + first['id'], 'comment:' + second['id']})
        self.assertEqual(page['items'][0]['occurred_at'], 1792000000.1234567)
        target = dict(kind='comment', id=second['id'])
        reactions.set_reaction(self.store, self.alice, self.group, 'react', target, '👍', True)
        older = Store(self.temp.name)
        try:
            older.remove_member(self.alice, self.group, self.ben)
        finally:
            older.close()
        rows = home.activity(self.store, self.alice, self.group)['items']
        self.assertEqual([row['id'] for row in rows], ['comment:' + first['id']])
        self.store.hide(self.alice, self.asset, True)
        self.assertEqual(home.activity(self.store, self.alice, self.group)['items'], [])
        with self.assertRaises(Denied):
            atlas.memory_view(self.store, self.alice, self.group, 'photo-' + self.asset)

    def test_group_action_indexes_and_bounded_native_row_projection(self):
        rows = [(self.fixture + f'{index:04d}', self.group, self.asset, None, self.ben, 'Synthetic activity', 1, index, index) for index in range(2000)]
        with self.store.transaction():
            self.store.db.execute('INSERT INTO social_comments VALUES' + ','.join('(?,?,?,?,?,?,?,?,?)' for _ in rows), tuple(value for row in rows for value in row))
        with patch.object(home, '_candidates', wraps=home._candidates) as candidates:
            result = home.home_view(self.store, self.alice, self.group)
        self.assertEqual(result['featured']['activity']['text'], 'Synthetic activity')
        self.assertEqual(result['activity']['items'], [])
        self.assertLessEqual(candidates.call_count, 2)
        with self.store.transaction():
            self.store.db.execute('SET LOCAL enable_seqscan=off')
            for kind, index in (('comment', 'social_comments_activity'), ('reaction', 'social_reactions_activity'), ('plan', 'social_plans_activity')):
                source, alias, timestamp, columns, allowed = home.SOURCES[kind]
                query = f'SELECT {columns} FROM {source} WHERE {alias}.group_id=? AND {allowed} ORDER BY {timestamp} DESC,{alias}.id DESC LIMIT 33'
                details = ' '.join(row[0] for row in self.store.db.execute('EXPLAIN ' + query, (self.group,)))
                self.assertIn(index, details)
