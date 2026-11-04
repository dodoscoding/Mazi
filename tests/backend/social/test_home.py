import unittest
from unittest.mock import patch

from mazi import atlas
from mazi.identity.core import Denied
from mazi.social import conversations, home, reactions, social
from tests.backend.social.test_comments import CommentsFixture
from tests.backend.social.test_plans import PlansFixture


class EmptyHomeTests(PlansFixture):
    def test_empty_group_has_first_plan_action_without_loading_archive(self):
        with patch.object(atlas, 'atlas_view', side_effect=AssertionError('Full Atlas forbidden')), patch.object(self.store, '_timeline_items', side_effect=AssertionError('Full timeline forbidden')):
            result = home.home_view(self.store, self.ben, self.group)
        self.assertIsNone(result['featured'])
        self.assertEqual(result['activity']['items'], [])
        self.assertTrue(result['can_plan'])

    def test_nearest_active_plan_is_compact_and_does_not_resolve_optional_memory(self):
        later = self.create(key='later', start_local='2030-06-02T18:00')
        nearest = self.create(key='near')
        with self.store.transaction():
            self.store.db.execute('UPDATE social_plans SET memory_id=? WHERE id=?', ('unrelated-large-memory', nearest['id']))
        with patch.object(social, '_view', side_effect=AssertionError('Full plan forbidden')):
            result = home.home_view(self.store, self.ben, self.group)
        self.assertEqual((result['featured']['kind'], result['featured']['plan']['id']), ('plan', nearest['id']))
        self.assertNotIn(nearest['id'], [row['target']['id'] for row in result['activity']['items']])
        self.assertIn(later['id'], [row['target']['id'] for row in result['activity']['items']])
        with self.assertRaises(Denied):
            home.home_view(self.store, self.other, self.group)


class SocialHomeTests(CommentsFixture):
    def test_archive_only_fallback_is_one_real_photo_with_evidence(self):
        with patch.object(atlas, 'atlas_view', side_effect=AssertionError('Full Atlas forbidden')), patch.object(self.store, '_timeline_items', side_effect=AssertionError('Full timeline forbidden')):
            result = home.home_view(self.store, self.ben, self.group)
        self.assertEqual(result['featured']['kind'], 'memory')
        memory = result['featured']['memory']
        self.assertEqual(len(memory['photos']), 1)
        photo = memory['photos'][0]
        self.assertIn(photo['assetId'], self.assets)
        self.assertEqual(photo['evidence']['capture']['status'], 'exact')
        self.assertEqual(memory['date'], photo['evidence']['capture']['days'][0])

    def test_recent_conversation_uses_action_time_and_excludes_featured_target_from_activity(self):
        with patch.object(conversations.time, 'time', return_value=2000000000):
            conversations.create_comment(self.store, self.ben, self.group, 'older', self.target(1), 'Older action')
        with patch.object(conversations.time, 'time', return_value=2000000010):
            latest = self.create(text='Recent action')
        result = home.home_view(self.store, self.alice, self.group)
        self.assertEqual(result['featured']['kind'], 'conversation')
        featured = result['featured']['activity']
        self.assertEqual((featured['text'], featured['occurred_at']), ('Recent action', latest['created_at']))
        self.assertEqual(featured['memory_id'], 'photo-' + self.assets[0])
        self.assertLessEqual(len(result['activity']['items']), 3)
        self.assertTrue(all(row['target'] != featured['target'] for row in result['activity']['items']))

    def test_same_second_keyset_pages_do_not_duplicate_or_skip_existing_actions(self):
        with patch.object(conversations.time, 'time', return_value=2000000000):
            created = [self.create(key=str(index)) for index in range(5)]
        page = home.activity(self.store, self.alice, self.group, limit=2)
        seen = [row['id'] for row in page['items']]
        with patch.object(conversations.time, 'time', return_value=2000000010):
            new = self.create(key='new')
        cursor = page['next_cursor']
        while cursor:
            page = home.activity(self.store, self.alice, self.group, limit=2, cursor=cursor)
            seen.extend(row['id'] for row in page['items'])
            cursor = page['next_cursor']
        self.assertEqual(seen, sorted(['comment:' + row['id'] for row in created], reverse=True))
        self.assertNotIn('comment:' + new['id'], seen)

    def test_hidden_withdrawn_departed_and_inactive_reactions_disappear(self):
        self.create(user=self.ben)
        self.create(key='other', target=self.target(1))
        reactions.set_reaction(self.store, self.alice, self.group, 'on', self.target(), '👍', True)
        reactions.set_reaction(self.store, self.alice, self.group, 'off', self.target(), '👍', False)
        self.store.hide(self.alice, self.assets[0], True)
        result = home.activity(self.store, self.alice, self.group)
        self.assertEqual([row['text'] for row in result['items']], ['First thought'])
        self.store.delete_origin(self.alice, self._origin(self.assets[1]))
        self.assertEqual(home.activity(self.store, self.alice, self.group)['items'], [])
        self.store.hide(self.alice, self.assets[0], False)
        self.store.remove_member(self.alice, self.group, self.ben)
        self.assertEqual(home.activity(self.store, self.alice, self.group)['items'], [])

    def test_selected_event_reuses_atlas_projection_and_grouped_photo_still_opens(self):
        event = self.store.review_event(self.alice, self.group, self.assets, 'Two winters', 'accept')
        expected = atlas.atlas_view(self.store, self.ben, self.group)['memories'][0]
        with patch.object(atlas, 'atlas_view', side_effect=AssertionError('Full Atlas forbidden')), patch.object(self.store, '_timeline_items', side_effect=AssertionError('Full timeline forbidden')):
            selected = atlas.memory_view(self.store, self.ben, self.group, event)['memory']
            photo = atlas.memory_view(self.store, self.ben, self.group, 'photo-' + self.assets[0])['memory']
        self.assertEqual(selected, expected)
        self.assertEqual(photo['photos'][0]['assetId'], self.assets[0])
        self.store.hide(self.ben, self.assets[1], True)
        with self.assertRaises(Denied):
            atlas.memory_view(self.store, self.ben, self.group, event)
        self.assertEqual(atlas.memory_view(self.store, self.ben, self.group, 'photo-' + self.assets[0])['memory']['id'], 'photo-' + self.assets[0])
