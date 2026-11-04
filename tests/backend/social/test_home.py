import unittest
import json
from unittest.mock import patch

from mazi import atlas
from mazi.identity.core import Denied
from mazi.capacity import CapacityExceeded
from tests.backend import test_atlas
from mazi.social import conversations, home, labels, reactions, social
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

    def test_edit_action_time_is_separate_from_immutable_comment_creation_and_archive_dates(self):
        with patch.object(conversations.time, 'time', return_value=2000000000):
            first = self.create()
        with patch.object(conversations.time, 'time', return_value=2000000010):
            self.create(key='later', target=self.target(1))
        with patch.object(conversations.time, 'time', return_value=2000000020):
            conversations.update_comment(self.store, self.alice, self.group, first['id'], 1, 'edit', 'Edited today')
        result = home.home_view(self.store, self.ben, self.group)
        self.assertEqual(result['featured']['activity']['occurred_at'], 2000000020)
        self.assertEqual(result['featured']['activity']['action'], 'edited')
        self.assertEqual(result['featured']['preview']['photos'][0]['evidence']['capture']['days'], ['2020-01-02'])

    def test_ten_thousand_native_rows_do_not_trigger_full_archive_or_unbounded_projection(self):
        with self.store.transaction():
            for index in range(10000):
                self.store.db.execute('INSERT INTO social_comments VALUES(?,?,?,?,?,?,?,?,?)',
                    (f'large-{index:05d}', self.group, self.assets[0], None, self.ben, 'Synthetic large activity', 1, index, index))
        queries = []
        self.store.db.set_trace_callback(queries.append)
        try:
            with patch.object(atlas, 'atlas_view', side_effect=AssertionError('Full Atlas forbidden')), patch.object(self.store, '_timeline_items', side_effect=AssertionError('Full timeline forbidden')):
                result = home.home_view(self.store, self.alice, self.group)
        finally:
            self.store.db.set_trace_callback(None)
        self.assertEqual(result['featured']['activity']['id'], 'comment:large-09999')
        self.assertEqual(result['activity']['items'], [])
        self.assertFalse(result['activity']['partial'])
        self.assertLessEqual(len(queries), 40)

    def test_filtered_candidate_budget_returns_a_continuation_without_skipping_visible_older_actions(self):
        with self.store.transaction():
            for index in range(home.SCAN_LIMIT + 20):
                self.store.db.execute('INSERT INTO social_comments VALUES(?,?,?,?,?,?,?,?,?)',
                    (f'hidden-{index:05d}', self.group, self.assets[0], None, self.ben, 'Hidden action', 1, index + 1000, index + 1000))
        with patch.object(conversations.time, 'time', return_value=1):
            old = self.create(target=self.target(1))
        self.store.hide(self.alice, self.assets[0], True)
        page = home.activity(self.store, self.alice, self.group, limit=1)
        self.assertEqual(page['items'], [])
        self.assertTrue(page['partial'])
        seen = [row['id'] for row in page['items']]
        while page['next_cursor']:
            page = home.activity(self.store, self.alice, self.group, limit=1, cursor=page['next_cursor'])
            seen.extend(row['id'] for row in page['items'])
        self.assertEqual(seen, ['comment:' + old['id']])

    def test_selected_photo_resolves_legacy_date_order_from_its_permitted_run_without_source_mutation(self):
        test_atlas.AtlasTests._whatsapp_shares(self,
            '04/05/2024, 21:00 - Ana: a.jpg (file attached)\n23/05/2024, 10:00 - Ana: b.jpg (file attached)')
        cards = atlas.atlas_view(self.store, self.ben, self.group)['memories']
        expected = next(card for card in cards if card['photos'][0].get('provenance', [{}])[0].get('sharedAt', {}).get('raw') == '04/05/2024, 21:00')
        asset = expected['photos'][0]['assetId']
        before = self.store.photo_correction(self.ben, self.group, asset)['snapshot']
        result = atlas.memory_view(self.store, self.ben, self.group, expected['id'])['memory']
        self.assertEqual(result, expected)
        self.assertEqual(result['photos'][0]['provenance'][0]['sharedAt']['local'], '2024-05-04T21:00:00')
        self.assertEqual(self.store.photo_correction(self.ben, self.group, asset)['snapshot'], before)

    def test_selected_photo_rejects_oversized_metadata_before_projecting_it(self):
        origin = self._origin(self.assets[0])
        row = self.store.db.execute('SELECT payload FROM archive_origins WHERE id=?', (origin,)).fetchone()
        payload = json.loads(row[0])
        payload['context'] = [dict(text='x' * 70000, sender={}, shared_at=None)]
        with self.store.transaction():
            self.store.db.execute('UPDATE archive_origins SET payload=? WHERE id=?', (json.dumps(payload), origin))
        with self.assertRaises(CapacityExceeded):
            atlas.memory_view(self.store, self.ben, self.group, 'photo-' + self.assets[0])

    def test_same_time_actions_from_all_source_tables_page_in_global_identity_order(self):
        with patch.object(conversations.time, 'time', return_value=2000000000):
            comment = self.create()
            reaction = reactions.set_reaction(self.store, self.ben, self.group, 'react', self.target(), '👍', True)
            plan = social.create_plan(self.store, self.alice, self.group, 'plan', dict(title='Meet', start_local='2030-06-01T18:00', timezone='UTC'))
        page = home.activity(self.store, self.alice, self.group, limit=1)
        values = []
        while True:
            values.extend(row['id'] for row in page['items'])
            if not page['next_cursor']:
                break
            page = home.activity(self.store, self.alice, self.group, limit=1, cursor=page['next_cursor'])
        self.assertEqual([value.split(':')[0] for value in values], ['reaction', 'plan', 'comment'])
        self.assertEqual(len(set(values)), 3)

    def test_selected_cards_and_home_previews_use_the_shared_compact_label_hook(self):
        labels.set_labels(self.store, self.alice, self.group, 'label', [dict(asset=self.assets[0], changes={'screenshot': 'yes', 'ai': 'edited'}, expected={'screenshot': 0, 'ai': 0})])
        event = self.store.review_event(self.alice, self.group, self.assets, 'Two winters', 'accept')
        expected = atlas.atlas_view(self.store, self.ben, self.group)['memories'][0]
        with patch.object(atlas, 'atlas_view', side_effect=AssertionError('Full Atlas forbidden')), patch.object(self.store, '_timeline_items', side_effect=AssertionError('Full timeline forbidden')):
            selected = atlas.memory_view(self.store, self.ben, self.group, event)['memory']
        self.assertEqual(selected, expected)
        self.assertEqual(selected['photos'][0]['labels'], dict(screenshot='yes', ai='edited'))
        self.assertNotIn('labels', selected['photos'][1])
        self.create()
        summary = home.home_view(self.store, self.ben, self.group)
        self.assertEqual(summary['featured']['preview']['photos'][0]['labels'], dict(screenshot='yes', ai='edited'))
