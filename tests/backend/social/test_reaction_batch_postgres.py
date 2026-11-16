import os
import unittest
from unittest.mock import patch

from mazi.social import conversations, reactions
from tests.backend.social import test_reactions_postgres


@unittest.skipUnless(os.environ.get('MAZI_TEST_POSTGRES') == '1', 'requires isolated hosted test schema')
class HostedReactionBatchTests(unittest.TestCase):
    setUp = test_reactions_postgres.HostedReactionsTests.setUp
    tearDown = test_reactions_postgres.HostedReactionsTests.tearDown
    target = test_reactions_postgres.HostedReactionsTests.target

    def test_twenty_comment_page_has_bounded_sql_authorization(self):
        targets = [self.target()]
        for index in range(20):
            comment = conversations.create_comment(self.store, self.ben, self.group, str(index), self.target(), 'Synthetic page')
            targets.append(dict(kind='comment', id=comment['id']))
        with patch.object(self.store.db, 'execute', wraps=self.store.db.execute) as execute:
            result = reactions.batch_reactions(self.store, self.alice, self.group, targets)
        self.assertEqual(len(result['items']), 21)
        self.assertLessEqual(execute.call_count, 15)
