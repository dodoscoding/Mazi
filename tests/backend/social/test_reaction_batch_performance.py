import unittest

from mazi.identity.core import Denied
from mazi.social import conversations, reactions
from tests.backend.social.test_comments import CommentsFixture


class ReactionBatchQueryTests(CommentsFixture):
    def page(self):
        targets = [self.target()]
        for index in range(20):
            comment = self.create(user=self.ben, key=str(index))
            targets.append(dict(kind='comment', id=comment['id']))
        return targets

    def test_twenty_comment_page_authorization_has_bounded_query_count(self):
        targets = self.page()
        queries = []
        self.store.db.set_trace_callback(queries.append)
        try:
            result = reactions.batch_reactions(self.store, self.alice, self.group, targets)
        finally:
            self.store.db.set_trace_callback(None)
        self.assertEqual(len(result['items']), 21)
        self.assertLessEqual(len(queries), 15)
        self.assertTrue(all(item['total'] == 0 for item in result['items']))

    def test_bulk_authorization_rechecks_every_comment_and_underlying_target(self):
        targets = self.page()
        self.store.hide(self.alice, self.assets[0], True)
        with self.assertRaises(Denied):
            reactions.batch_reactions(self.store, self.alice, self.group, targets)
        self.store.hide(self.alice, self.assets[0], False)
        comment = targets[-1]
        row = self.store.db.execute('SELECT revision FROM social_comments WHERE id=?', (comment['id'],)).fetchone()
        conversations.delete_comment(self.store, self.ben, self.group, comment['id'], row[0], 'delete')
        with self.assertRaises(Denied):
            reactions.batch_reactions(self.store, self.alice, self.group, targets)
        self.store.remove_member(self.alice, self.group, self.ben)
        with self.assertRaises(Denied):
            reactions.batch_reactions(self.store, self.alice, self.group, targets[:-1])

    def test_memory_targets_require_all_original_children_and_no_hidden_overlap(self):
        event = self.store.review_event(self.alice, self.group, self.assets, 'Two winters', 'accept')
        target = dict(kind='memory', id=event)
        comment = self.create(target=target)
        targets = [self.target(), target, dict(kind='comment', id=comment['id'])]
        self.assertEqual(len(reactions.batch_reactions(self.store, self.ben, self.group, targets)['items']), 3)
        self.store.hide(self.ben, self.assets[1], True)
        with self.assertRaises(Denied):
            reactions.batch_reactions(self.store, self.ben, self.group, targets)
        self.store.hide(self.ben, self.assets[1], False)
        self.store.hide_event(self.ben, self.group, event, True)
        with self.assertRaises(Denied):
            reactions.batch_reactions(self.store, self.ben, self.group, targets)

    def test_other_group_missing_target_and_withdrawn_last_source_deny_whole_page(self):
        targets = self.page()
        other = self.store.create_group(self.outsider, 'Elsewhere')
        with self.assertRaises(Denied):
            reactions.batch_reactions(self.store, self.outsider, other, targets)
        with self.assertRaises(Denied):
            reactions.batch_reactions(self.store, self.alice, self.group, targets + [dict(kind='comment', id='missing')])
        self.store.delete_origin(self.alice, self._origin(self.assets[0]))
        with self.assertRaises(Denied):
            reactions.batch_reactions(self.store, self.alice, self.group, targets)
