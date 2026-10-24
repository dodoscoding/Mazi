import io
import unittest

from PIL import Image
from mazi.identity.core import Denied
from mazi.discovery.discovery import DiscoveryStore
from tests.backend.imports import test_engine as helpers


def picture(color):
    output = io.BytesIO()
    Image.new('RGB', (8, 8), color).save(output, 'JPEG')
    return output.getvalue()


class SharedBySourceTests(unittest.TestCase):
    submit = helpers.EngineTests.submit
    process = helpers.EngineTests.process

    def setUp(self):
        helpers.EngineTests.setUp(self)
        self.store.close()
        self.store = DiscoveryStore(self.temp.name)
        self.store.setup_shared(admin_name='Alice', group_id=self.group,
                                mappings={'Alice': self.alice, 'Ben': self.ben})
        chat = ('01/02/2024, 12:00 - Ana: ana.jpg (file attached)\n'
                '01/02/2024, 12:01 - Deniz: deniz.jpg (file attached)\n')
        self.process(self.submit({'chat.txt': chat.encode(), 'ana.jpg': picture('blue'),
                                  'deniz.jpg': picture('green')}, source='whatsapp'))
        export = 'ID,Timestamp,Contents,Attachments\n987,2024-02-03 12:00:00,lake,lake.jpg\n'
        self.process(self.submit({'messages/c1/messages.csv': export.encode(), 'lake.jpg': picture('yellow')},
                                 source='discord', user=self.ben), self.ben)

    def tearDown(self):
        helpers.EngineTests.tearDown(self)

    def found(self, user, **filters):
        result = self.store.search(user, self.group, **filters)
        return sorted((item['sources'], item['shared_by']) for item in result['items'])

    def test_chat_sender_or_importing_member_is_who_shared_each_photograph(self):
        self.assertEqual(self.found(self.alice), [(['discord'], ['Ben']), (['whatsapp'], ['Ana']),
                                                  (['whatsapp'], ['Deniz'])])
        self.assertEqual(self.found(self.alice, shared_by='Ana'), [(['whatsapp'], ['Ana'])])
        self.assertEqual(self.found(self.alice, shared_by='Ben'), [(['discord'], ['Ben'])])
        self.assertEqual(self.found(self.alice, shared_by='Alice'), [])

    def test_source_and_shared_by_combine(self):
        self.assertEqual(self.found(self.alice, source='discord'), [(['discord'], ['Ben'])])
        self.assertEqual(self.found(self.alice, source='whatsapp', shared_by='Deniz'), [(['whatsapp'], ['Deniz'])])
        self.assertEqual(self.found(self.alice, source='discord', shared_by='Deniz'), [])

    def test_filter_options_list_every_visible_photograph_regardless_of_filters(self):
        expected = {'sources': [{'value': 'whatsapp', 'count': 2}, {'value': 'discord', 'count': 1}],
                    'shared_by': [{'value': 'Ana', 'count': 1}, {'value': 'Ben', 'count': 1},
                                  {'value': 'Deniz', 'count': 1}]}
        self.assertEqual(self.store.search(self.alice, self.group)['facets'], expected)
        self.assertEqual(self.store.search(self.alice, self.group, query='nothing matches', source='discord')['facets'],
                         expected)

    def test_options_and_matches_follow_personal_hiding_and_membership(self):
        ana = next(item['id'] for item in self.store.search(self.ben, self.group, shared_by='Ana')['items'])
        self.store.hide(self.ben, ana, True)
        self.assertEqual(self.found(self.ben, shared_by='Ana'), [])
        self.assertEqual([option['value'] for option in self.store.search(self.ben, self.group)['facets']['shared_by']],
                         ['Ben', 'Deniz'])
        self.assertEqual(self.found(self.alice, shared_by='Ana'), [(['whatsapp'], ['Ana'])])
        with self.assertRaises(Denied):
            self.store.search(self.outsider, self.group, shared_by='Ana')
        self.store.remove_member(self.alice, self.group, self.ben)
        self.assertEqual(self.store.search(self.alice, self.group)['facets'],
                         {'sources': [{'value': 'whatsapp', 'count': 2}],
                          'shared_by': [{'value': 'Ana', 'count': 1}, {'value': 'Deniz', 'count': 1}]})
        self.assertEqual(self.found(self.alice, shared_by='Ben'), [])

    def test_related_search_applies_the_same_filters_and_options(self):
        self.store.processing(self.alice, self.group, True, group_wide=True)
        self.store.processing(self.alice, self.group, True)
        self.store.processing(self.ben, self.group, True)
        result = self.store.search(self.alice, self.group, mode='semantic', shared_by='Deniz')
        self.assertEqual([(item['sources'], item['shared_by']) for item in result['items']], [(['whatsapp'], ['Deniz'])])
        self.assertEqual([option['value'] for option in result['facets']['sources']], ['whatsapp', 'discord'])


if __name__ == '__main__':
    unittest.main()
