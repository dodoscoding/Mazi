"""Naming a memory's city from the Atlas: place-only writes, authorization and the HTTP contract."""
import http.client
import json
import threading
import unittest
from http.server import HTTPServer

from mazi.atlas import atlas_view, place_memory
from mazi.identity.core import Denied
from mazi.server import handler_for
from tests.backend import test_atlas

KYRENIA = {'name': 'Kyrenia', 'country': 'CY', 'latitude': 35.326, 'longitude': 33.333}


class Fixture(unittest.TestCase):
    """AtlasTests' two-member circle with two titled photographs, without rerunning its tests."""
    setUp, tearDown, _origin = test_atlas.AtlasTests.setUp, test_atlas.AtlasTests.tearDown, test_atlas.AtlasTests._origin


class PlaceMemoryTests(Fixture):
    def card(self, identifier, user=None):
        return next(card for card in atlas_view(self.store, user or self.alice, self.group)['memories'] if card['id'] == identifier)

    def annotation(self, asset):
        return dict(self.store.db.execute(
            'SELECT title,capture_date,place,anniversary,actor_id FROM review_annotations WHERE asset_id=?', (asset,)).fetchone())

    def test_any_member_places_a_photo_without_changing_title_date_or_anniversary(self):
        self.store.correct_asset(self.alice, self.assets[0], title='Red', capture_date='2020-01-02', place='', anniversary=True)
        result = place_memory(self.store, self.ben, self.group, 'photo-' + self.assets[0], 'girne')
        self.assertEqual(result, {'place_match': 'matched', 'place': 'Kyrenia, CY', 'candidates': [], 'pin': KYRENIA})
        self.assertEqual(self.annotation(self.assets[0]), {
            'title': 'Red', 'capture_date': '2020-01-02', 'place': 'Kyrenia, CY', 'anniversary': 1, 'actor_id': self.ben})
        self.assertEqual(self.card('photo-' + self.assets[0])['place'], KYRENIA)
        self.assertEqual(self.card('photo-' + self.assets[0])['title'], 'Red')

    def test_placing_a_memory_pins_every_photo_and_creates_annotations_where_none_existed(self):
        with self.store.transaction():
            self.store.db.execute('DELETE FROM review_annotations WHERE asset_id=?', (self.assets[1],))
        event = self.store.review_event(self.alice, self.group, self.assets, 'Island week', 'accept')
        place_memory(self.store, self.ben, self.group, event, 'Victoria, CA')
        self.assertEqual({self.annotation(asset)['place'] for asset in self.assets}, {'Victoria, British Columbia, CA'})
        self.assertEqual(self.annotation(self.assets[1])['title'], '')
        self.assertIsNone(self.annotation(self.assets[1])['capture_date'])
        self.assertEqual(self.card(event, self.ben)['place']['name'], 'Victoria')
        self.assertEqual(self.store.db.execute(
            "SELECT action,target_id FROM audit WHERE actor_id=? AND action LIKE 'atlas.%'", (self.ben,)).fetchall()[0][:],
            ('atlas.place', event))

    def test_ambiguous_and_unknown_cities_write_nothing(self):
        before = self.annotation(self.assets[0])
        ambiguous = place_memory(self.store, self.alice, self.group, 'photo-' + self.assets[0], 'Victoria')
        self.assertEqual((ambiguous['place_match'], ambiguous['place'], ambiguous['pin']), ('ambiguous', None, None))
        self.assertEqual(ambiguous['candidates'][:2], ['Victoria, British Columbia, CA', 'Victoria, Texas, US'])
        self.assertEqual(place_memory(self.store, self.alice, self.group, 'photo-' + self.assets[0], 'Nowhereville'),
                         {'place_match': 'missing', 'place': None, 'candidates': [], 'pin': None})
        self.assertEqual(self.annotation(self.assets[0]), before)
        self.assertIsNone(self.card('photo-' + self.assets[0])['place'])

    def test_a_tapped_candidate_label_pins_that_city(self):
        candidate = place_memory(self.store, self.alice, self.group, 'photo-' + self.assets[0], 'Victoria')['candidates'][1]
        result = place_memory(self.store, self.alice, self.group, 'photo-' + self.assets[0], candidate)
        self.assertEqual((result['place'], self.card('photo-' + self.assets[0])['place']['country']), ('Victoria, US', 'US'))

    def test_clearing_returns_the_source_location_and_creates_no_annotation(self):
        self.store.set_place(self.alice, self._origin(self.assets[0]), 'TR', 'Istanbul', 41.1, 29.0, None)
        place_memory(self.store, self.ben, self.group, 'photo-' + self.assets[0], 'girne')
        self.assertEqual(self.card('photo-' + self.assets[0])['place'], KYRENIA)
        self.assertEqual(place_memory(self.store, self.ben, self.group, 'photo-' + self.assets[0], '  '),
                         {'place_match': 'empty', 'place': None, 'candidates': [], 'pin': None})
        self.assertEqual(self.annotation(self.assets[0])['place'], '')
        self.assertEqual(self.annotation(self.assets[0])['title'], 'Red')
        self.assertEqual(self.card('photo-' + self.assets[0])['place']['name'], 'Istanbul')
        with self.store.transaction():
            self.store.db.execute('DELETE FROM review_annotations WHERE asset_id=?', (self.assets[1],))
        place_memory(self.store, self.ben, self.group, 'photo-' + self.assets[1], '')
        self.assertIsNone(self.store.db.execute('SELECT 1 FROM review_annotations WHERE asset_id=?', (self.assets[1],)).fetchone())

    def test_outsiders_departed_members_and_unknown_cards_are_denied_without_writing(self):
        for user, memory in ((self.outsider, 'photo-' + self.assets[0]), (self.alice, 'photo-missing'),
                             (self.alice, 'photo-'), (self.alice, 'not-an-approved-memory')):
            with self.assertRaises(Denied, msg=memory):
                place_memory(self.store, user, self.group, memory, 'girne')
        other = self.store.create_group(self.outsider, 'Elsewhere')
        with self.assertRaises(Denied):
            place_memory(self.store, self.outsider, other, 'photo-' + self.assets[0], 'girne')
        self.store.remove_member(self.alice, self.group, self.ben)
        with self.assertRaises(Denied):
            place_memory(self.store, self.ben, self.group, 'photo-' + self.assets[0], 'girne')
        self.assertEqual({self.annotation(asset)['place'] for asset in self.assets}, {'Harbour'})

    def test_personally_hidden_photos_and_memories_are_denied(self):
        self.store.hide(self.ben, self.assets[0], True)
        with self.assertRaises(Denied):
            place_memory(self.store, self.ben, self.group, 'photo-' + self.assets[0], 'girne')
        self.assertEqual(place_memory(self.store, self.alice, self.group, 'photo-' + self.assets[0], 'girne')['place'], 'Kyrenia, CY')
        self.store.hide(self.ben, self.assets[0], False)
        event = self.store.review_event(self.alice, self.group, self.assets, 'Hidden winter', 'accept')
        self.store.hide_event(self.ben, self.group, event, True)
        for memory in (event, 'photo-' + self.assets[1]):
            with self.assertRaises(Denied, msg=memory):
                place_memory(self.store, self.ben, self.group, memory, 'Paris')
        self.assertEqual(self.annotation(self.assets[1])['place'], 'Harbour')

    def test_withdrawn_photo_is_denied(self):
        self.store.delete_origin(self.alice, self._origin(self.assets[0]))
        with self.assertRaises(Denied):
            place_memory(self.store, self.alice, self.group, 'photo-' + self.assets[0], 'girne')

    def test_invalid_input_is_rejected(self):
        for memory, place in ((None, 'girne'), ('photo-' + self.assets[0], None), ('photo-' + self.assets[0], 'x' * 201), ('', 'girne')):
            with self.assertRaises(ValueError):
                place_memory(self.store, self.alice, self.group, memory, place)


class PlaceMemoryHttpTests(Fixture):
    def setUp(self):
        super().setUp()
        code = self.store.setup_shared(admin_name='Alice', group_id=self.group, mappings={'Alice': self.alice, 'Ben': self.ben})
        self.tokens = {user: self.store.enter_shared(code=code, name=name)[1] for user, name in [(self.alice, 'Alice'), (self.ben, 'Ben')]}
        self.server = HTTPServer(('127.0.0.1', 0), handler_for(self.store))
        thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(lambda: (self.server.shutdown(), thread.join(), self.server.server_close()))

    def post(self, body, user=None, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=30)
        sent = {'Content-Type': 'application/json', **({'Cookie': 'mazi_session=' + self.tokens[user]} if user else {}), **(headers or {})}
        connection.request('POST', '/api/atlas/place', json.dumps(body), sent)
        response = connection.getresponse()
        result = response.status, json.loads(response.read())
        connection.close()
        return result

    def test_place_round_trip_and_rejections(self):
        memory = 'photo-' + self.assets[0]
        self.assertEqual(self.post({'group': self.group, 'memory': memory, 'place': 'GİRNE'}, self.ben),
                         (200, {'ok': True, 'place_match': 'matched', 'place': 'Kyrenia, CY', 'candidates': [], 'pin': KYRENIA}))
        cards = atlas_view(self.store, self.alice, self.group)['memories']
        self.assertEqual(next(card for card in cards if card['id'] == memory)['place'], KYRENIA)
        self.assertEqual(self.post({'group': self.group, 'memory': memory, 'place': 'girne'})[0], 403)
        self.assertEqual(self.post({'group': self.group, 'memory': memory, 'place': 'girne'}, self.ben,
                                   {'Origin': 'https://evil.example'})[0], 403)
        self.assertEqual(self.post({'group': self.group, 'memory': 'photo-missing', 'place': 'girne'}, self.ben),
                         (403, {'error': 'Memory unavailable'}))
        self.assertEqual(self.post({'group': self.group, 'place': 'girne'}, self.ben)[0], 400)
        self.assertEqual(self.post({'group': [self.group], 'memory': memory, 'place': 'girne'}, self.ben)[0], 400)
