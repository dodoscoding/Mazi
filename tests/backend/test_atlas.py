import hashlib
import io
import json
import tempfile
import unittest
from PIL import Image
from mazi.identity.core import Denied
from mazi.memories.memories import MemoryStore
from mazi.atlas import atlas_view


class AtlasTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = MemoryStore(self.temp.name)
        self.alice = self.store.register('alice@example.test', 'correct horse battery')
        self.ben = self.store.register('ben@example.test', 'correct horse battery')
        self.outsider = self.store.register('outsider@example.test', 'correct horse battery')
        self.group = self.store.create_group(self.alice, 'Our circle')
        self.store.accept(self.ben, self.store.invite(self.alice, self.group))
        source = self.store.create_source(self.alice, self.group, 'apple', 'Photos', {
            'start': '2020-01-01', 'end': '2030-01-01', 'albums': [], 'types': ['image']})
        self.store.set_source(self.alice, source, True, 'authorized')
        self.assets = []
        for index, color in enumerate(('red', 'blue')):
            image = io.BytesIO()
            Image.new('RGB', (20, 20), color).save(image, 'JPEG')
            data = image.getvalue()
            resource = self.store.begin_resource(self.alice, source, {
                'item': str(index), 'component': 'photo', 'version': 'original',
                'filename': f'{color}.jpg', 'date': f'202{index}-01-02', 'kind': 'image', 'albums': []
            }, len(data), hashlib.sha256(data).hexdigest())
            self.store.resource_chunk(self.alice, resource['id'], 0, data)
            self.store.finish_resource(self.alice, resource['id'])
            while self.store.work_once():
                pass
            asset = self.store.db.execute('SELECT asset_id FROM archive_origins WHERE run_id=?', (resource['id'],)).fetchone()[0]
            self.assets.append(asset)
            self.store.correct_asset(self.alice, asset, title=color.title(), capture_date=f'202{index}-01-02', place='Harbour')

    def tearDown(self):
        self.store.close()
        self.temp.cleanup()

    def test_real_photos_and_cross_year_approved_memory(self):
        cards = atlas_view(self.store, self.ben, self.group)['memories']
        self.assertEqual({card['title'] for card in cards}, {'Red', 'Blue'})
        self.assertEqual({card['kind'] for card in cards}, {'photo'})
        event = self.store.review_event(self.alice, self.group, self.assets, 'Two winters', 'accept')
        cards = atlas_view(self.store, self.ben, self.group)['memories']
        self.assertEqual(len(cards), 1)
        self.assertEqual(cards[0]['id'], event)
        self.assertEqual(cards[0]['date'], '2020-01-02 to 2021-01-02')
        self.assertEqual(len(cards[0]['photos']), 2)
        self.assertEqual(cards[0]['messages'], [])
        self.assertTrue(cards[0]['photos'][0]['src'].startswith('/api/review/rendition/'))

    def _discord_card(self):
        from mazi.sources.discord import poll_source
        from tests.backend.sources.test_discord import FakeDiscord, link, message, paged
        link(self.store, self.alice, self.group)
        connection = self.store.create_source(self.alice, self.group, 'discord', 'Lake', {
            'guild': '10', 'channels': ['20'], 'start': '2024-01-01', 'end': '2024-12-31'})
        self.store.set_source(self.alice, connection, True, 'authorized')
        client = FakeDiscord()
        self.store.discord_authorize = client.authorize
        client.messages = paged([message(1, 'Göle vardık', author={'id': '31', 'global_name': 'Ayşe'}),
                                 message(2, 'Look at this', attachments=[1], author={'id': '32', 'username': 'mehmet'})])
        poll_source(self.store, self.alice, connection, client)
        while self.store.work_once():
            pass
        return self._non_fixture_card()

    def _non_fixture_card(self):
        [card] = [card for card in atlas_view(self.store, self.ben, self.group)['memories'] if card['title'] not in ('Red', 'Blue')]
        return card

    def _forget_reviewed_date(self, asset, captures=()):
        with self.store.transaction():
            self.store.db.execute('DELETE FROM review_annotations WHERE asset_id=?', (asset,))
            row = self.store.db.execute('SELECT id,payload FROM archive_origins WHERE asset_id=?', (asset,)).fetchone()
            payload = json.loads(row['payload'])
            payload['capture_assertions'] = [{'local': local, 'source': 'capture_exif'} for local in captures]
            self.store.db.execute('UPDATE archive_origins SET payload=? WHERE id=?', (json.dumps(payload), row['id']))

    def test_an_undated_photo_leaves_the_memory_dated_by_its_other_photos(self):
        self._forget_reviewed_date(self.assets[1])
        memory = self._memory()
        self.assertEqual((memory['date'], memory['year'], memory['approximate']), ('2020-01-02', 2020, True))

    def test_conflicting_capture_dates_give_a_range(self):
        self._forget_reviewed_date(self.assets[1], ['2021-01-02T09:00:00', '2021-03-04T09:00:00'])
        photo = next(card for card in atlas_view(self.store, self.ben, self.group)['memories'] if card['title'] == 'Untitled photograph')
        self.assertEqual((photo['date'], photo['year'], photo['approximate']), ('2021-01-02 to 2021-03-04', 2021, True))
        memory = self._memory()
        self.assertEqual((memory['date'], memory['year'], memory['approximate']), ('2020-01-02 to 2021-03-04', 2020, True))

    def test_discord_photo_shows_its_sender_and_neighbouring_messages(self):
        card = self._discord_card()
        self.assertEqual(card['messages'], [
            {'name': 'Ayşe', 'time': '2024-01-02T10:00:01+00:00', 'text': 'Göle vardık'},
            {'name': 'mehmet', 'time': '2024-01-02T10:00:02+00:00', 'text': 'Look at this'}])
        self.assertEqual(card['title'], 'Photo shared by mehmet')
        self.assertEqual(card['people']['conversation'], ['Ayşe', 'mehmet'])
        self.assertEqual(card['source'], 'discord')
        self.assertEqual(card['photos'][0]['provenance'][0]['source'], 'discord')

    def test_cards_report_the_import_source_of_their_photographs(self):
        cards = atlas_view(self.store, self.ben, self.group)['memories']
        self.assertEqual({card['title']: card['source'] for card in cards}, {'Red': 'apple', 'Blue': 'apple'})

    def _discord_origin(self):
        return next((row['id'], json.loads(row['payload'])) for row in self.store.db.execute('SELECT id,payload FROM archive_origins')
                    if json.loads(row['payload'])['source_type'] == 'discord')

    def test_discord_bot_photo_has_a_resolved_share_date(self):
        card = self._discord_card()
        self.assertEqual(card['photos'][0]['provenance'][0]['sharedAt'], dict(
            local='2024-01-02T10:00:02+00:00', raw='2024-01-02T10:00:02+00:00', precision='second', ambiguous=False))
        # The stored assertion is part of the origin fingerprint; reshaping it would turn a re-sync into IDENTITY_CONFLICT.
        self.assertEqual(self._discord_origin()[1]['shared_at_assertion'], {'raw': '2024-01-02T10:00:02+00:00', 'source': 'discord_message'})

    def test_discord_photo_imported_before_resolution_still_shows_its_share_date(self):
        self._discord_card()
        origin, payload = self._discord_origin()
        payload['shared_at_assertion'] = {'raw': '2024-01-02T10:00:02.517000+00:00', 'source': 'discord_message'}
        with self.store.transaction():
            self.store.db.execute('UPDATE archive_origins SET payload=? WHERE id=?', (json.dumps(payload), origin))
        self.assertEqual(self._non_fixture_card()['photos'][0]['provenance'][0]['sharedAt'], dict(
            local='2024-01-02T10:00:02.517000+00:00', raw='2024-01-02T10:00:02.517000+00:00', precision='second', ambiguous=False))

    def test_hidden_photo_suppresses_event_title_and_membership_denies(self):
        self.store.review_event(self.alice, self.group, self.assets, 'Private event title', 'accept')
        self.store.hide(self.ben, self.assets[0], True)
        cards = atlas_view(self.store, self.ben, self.group)['memories']
        self.assertNotIn('Private event title', str(cards))
        self.assertEqual([card['title'] for card in cards], ['Blue'])
        with self.assertRaises(Denied):
            atlas_view(self.store, self.outsider, self.group)
        self.store.remove_member(self.alice, self.group, self.ben)
        with self.assertRaises(Denied):
            atlas_view(self.store, self.ben, self.group)

    def test_hiding_an_event_does_not_restore_it_as_photographs(self):
        event = self.store.review_event(self.alice, self.group, self.assets, 'Hidden winter', 'accept')
        self.store.hide_event(self.ben, self.group, event, True)
        self.assertEqual(atlas_view(self.store, self.ben, self.group)['memories'], [])

    def _origin(self, asset):
        return self.store.db.execute('SELECT id FROM archive_origins WHERE asset_id=?', (asset,)).fetchone()[0]

    def _memory(self):
        self.store.review_event(self.alice, self.group, self.assets, 'Island week', 'accept')
        return atlas_view(self.store, self.ben, self.group)['memories'][0]

    def test_assets_sharing_one_city_give_that_place(self):
        self.store.set_place(self.alice, self._origin(self.assets[0]), 'GR', 'Naxos', 37.25, 25.5, None)
        self.store.set_place(self.alice, self._origin(self.assets[1]), 'GR', 'Naxos', 37.75, 25.0, None)
        self.assertEqual(self._memory()['place'],
                         {'name': 'Naxos', 'country': 'GR', 'latitude': 37.5, 'longitude': 25.25})

    def test_unplaced_asset_does_not_block_agreeing_place(self):
        self.store.set_place(self.alice, self._origin(self.assets[0]), 'GR', 'Naxos', 37.1, 25.4, None)
        self.assertEqual(self._memory()['place'],
                         {'name': 'Naxos', 'country': 'GR', 'latitude': 37.1, 'longitude': 25.4})

    def test_assets_in_different_cities_give_no_place(self):
        self.store.set_place(self.alice, self._origin(self.assets[0]), 'GR', 'Naxos', 37.1, 25.4, None)
        self.store.set_place(self.alice, self._origin(self.assets[1]), 'GR', 'Paros', 37.1, 25.2, None)
        cards = atlas_view(self.store, self.ben, self.group)['memories']
        self.assertEqual({card['title']: card['place']['name'] for card in cards}, {'Red': 'Naxos', 'Blue': 'Paros'})
        self.assertIsNone(self._memory()['place'])

    def test_no_shared_place_rows_give_no_place_despite_annotation(self):
        cards = atlas_view(self.store, self.ben, self.group)['memories']
        self.assertEqual([card['place'] for card in cards], [None, None])
        self.assertIsNone(self._memory()['place'])

    def test_shared_people_are_visible_contributor_names(self):
        self.assertEqual(self._memory()['people']['shared'], [])
        self.store.setup_shared(admin_name='Alice', group_id=self.group, mappings={'Alice': self.alice, 'Ben': self.ben})
        self.assertEqual(atlas_view(self.store, self.ben, self.group)['memories'][0]['people'],
                         {'shared': ['Alice'], 'conversation': []})
        with self.assertRaises(Denied):
            atlas_view(self.store, self.outsider, self.group)

    def test_conversation_people_exclude_fallback_label(self):
        context = [{'text': 'Ferry?', 'sender': {'label': 'Maya'}, 'shared_at': '21:14'},
                   {'text': 'We live here now.', 'sender': {'label': 'Deniz'}, 'shared_at': '21:16'},
                   {'text': 'Still here.', 'sender': {'label': 'Maya'}, 'shared_at': '21:20'},
                   {'text': 'Unlabelled', 'sender': {}, 'shared_at': '21:22'}]
        for asset in self.assets:
            row = self.store.db.execute('SELECT id,payload FROM archive_origins WHERE asset_id=?', (asset,)).fetchone()
            payload = json.loads(row['payload'])
            payload['context'] = context
            self.store.db.execute('UPDATE archive_origins SET payload=? WHERE id=?', (json.dumps(payload), row['id']))
        self.store.db.commit()
        card = self._memory()
        self.assertIn('Source participant', [message['name'] for message in card['messages']])
        self.assertEqual(card['people']['conversation'], ['Deniz', 'Maya'])

    def test_city_spelling_case_still_agrees(self):
        self.store.set_place(self.alice, self._origin(self.assets[0]), 'GR', 'Naxos', 37.25, 25.5, None)
        self.store.set_place(self.alice, self._origin(self.assets[1]), 'GR', 'naxos', 37.75, 25.0, None)
        self.assertEqual(self._memory()['place'],
                         {'name': 'Naxos', 'country': 'GR', 'latitude': 37.5, 'longitude': 25.25})

    def test_same_name_far_apart_gives_no_place(self):
        self.store.set_place(self.alice, self._origin(self.assets[0]), 'US', 'Springfield', 39.8, -89.6, None)
        self.store.set_place(self.alice, self._origin(self.assets[1]), 'US', 'Springfield', 37.2, -93.3, None)
        self.assertIsNone(self._memory()['place'])

    def test_turkish_dotted_capital_agrees_with_lowercase(self):
        self.store.set_place(self.alice, self._origin(self.assets[0]), 'TR', 'İstanbul', 41.0, 29.0, None)
        self.store.set_place(self.alice, self._origin(self.assets[1]), 'TR', 'istanbul', 41.1, 29.1, None)
        self.assertEqual(self._memory()['place'],
                         {'name': 'istanbul', 'country': 'TR', 'latitude': 41.05, 'longitude': 29.05})
        self.store.set_place(self.alice, self._origin(self.assets[1]), 'TR', 'Ankara', 39.93, 32.86, None)
        self.assertIsNone(atlas_view(self.store, self.ben, self.group)['memories'][0]['place'])

    def _review_place(self, asset, place):
        self.store.correct_asset(self.ben, asset, title='Red', capture_date='2020-01-02', place=place)
        return next(card for card in atlas_view(self.store, self.alice, self.group)['memories'] if card['id'] == 'photo-' + asset)['place']

    def test_city_named_in_review_pins_the_photo_over_its_source_location(self):
        self.store.set_place(self.alice, self._origin(self.assets[0]), 'TR', 'Istanbul', 41.1, 29.0, None)
        kyrenia = {'name': 'Kyrenia', 'country': 'CY', 'latitude': 35.326, 'longitude': 33.333}
        self.assertEqual(self._review_place(self.assets[0], 'girne'), kyrenia)
        self.assertEqual(self._review_place(self.assets[1], 'GİRNE'), kyrenia)
        self.assertEqual(self._memory()['place'], kyrenia)

    def test_unmatched_review_text_leaves_the_source_location(self):
        self.store.set_place(self.alice, self._origin(self.assets[0]), 'TR', 'Istanbul', 41.1, 29.0, None)
        for text in ('Victoria', 'Nowhereville'):
            self.assertEqual(self._review_place(self.assets[0], text)['name'], 'Istanbul')
            self.assertIsNone(self._review_place(self.assets[1], text))

    def _ben_copy_of_red(self):
        source = self.store.create_source(self.ben, self.group, 'apple', 'Photos', {
            'start': '2020-01-01', 'end': '2030-01-01', 'albums': [], 'types': ['image']})
        self.store.set_source(self.ben, source, True, 'authorized')
        image = io.BytesIO()
        Image.new('RGB', (20, 20), 'red').save(image, 'JPEG')
        data = image.getvalue()
        resource = self.store.begin_resource(self.ben, source, {
            'item': 'ben-red', 'component': 'photo', 'version': 'original',
            'filename': 'red.jpg', 'date': '2020-01-02', 'kind': 'image', 'albums': []
        }, len(data), hashlib.sha256(data).hexdigest())
        self.store.resource_chunk(self.ben, resource['id'], 0, data)
        self.store.finish_resource(self.ben, resource['id'])
        while self.store.work_once():
            pass
        origin = self.store.db.execute('SELECT id,asset_id FROM archive_origins WHERE run_id=?', (resource['id'],)).fetchone()
        self.assertEqual(origin['asset_id'], self.assets[0])
        self.store.setup_shared(admin_name='Alice', group_id=self.group, mappings={'Alice': self.alice, 'Ben': self.ben})
        return resource['id'], origin['id']

    def _red_card(self):
        return next(card for card in atlas_view(self.store, self.alice, self.group)['memories'] if card['title'] == 'Red')

    def test_withdrawn_origin_hides_its_place_and_contributor(self):
        resource, origin = self._ben_copy_of_red()
        self.store.set_place(self.ben, origin, 'GR', 'Naxos', 37.1, 25.4, None)
        self.assertEqual(self._red_card()['place']['name'], 'Naxos')
        self.assertEqual(self._red_card()['people']['shared'], ['Alice', 'Ben'])
        self.store.withdraw_resource(self.ben, resource)
        self.assertIsNone(self._red_card()['place'])
        self.assertEqual(self._red_card()['people']['shared'], ['Alice'])

    def test_removed_member_place_and_name_leave_the_card(self):
        _, origin = self._ben_copy_of_red()
        self.store.set_place(self.ben, origin, 'GR', 'Naxos', 37.1, 25.4, None)
        self.store.remove_member(self.alice, self.group, self.ben)
        self.assertIsNone(self._red_card()['place'])
        self.assertEqual(self._red_card()['people']['shared'], ['Alice'])

    def _source_evidence(self, origin, sender, shared_at, *, ambiguous=False):
        row = self.store.db.execute('SELECT payload FROM archive_origins WHERE id=?', (origin,)).fetchone()
        payload = json.loads(row['payload'])
        payload.update(source_type='whatsapp', sender={'label': sender}, shared_at_assertion=shared_at,
                       capture_assertions=[], warnings=['AMBIGUOUS_DATE'] if ambiguous else [])
        with self.store.transaction():
            self.store.db.execute('UPDATE archive_origins SET payload=? WHERE id=?', (json.dumps(payload), origin))

    def test_source_share_evidence_names_an_untitled_photo_without_changing_capture_chronology(self):
        asset = self.assets[0]
        with self.store.transaction():
            self.store.db.execute('DELETE FROM review_annotations WHERE asset_id=?', (asset,))
        self._source_evidence(self._origin(asset), 'Ana',
                              {'raw': '23/04/2024, 21.08.02', 'local': '2024-04-23T21:08:02', 'precision': 'second'})
        card = next(card for card in atlas_view(self.store, self.ben, self.group)['memories'] if card['id'] == 'photo-' + asset)
        self.assertEqual(card['title'], 'Photo shared by Ana')
        self.assertEqual(card['shortTitle'], card['title'])
        self.assertEqual(card['photos'][0]['caption'], card['title'])
        self.assertEqual((card['date'], card['year'], card['dateBasis']), ('Date not recorded', None, 'undated'))
        self.assertEqual(card['photos'][0]['provenance'], [dict(sender='Ana', source='whatsapp', sharedAt=dict(
            raw='23/04/2024, 21.08.02', local='2024-04-23T21:08:02', precision='second', ambiguous=False))])

    def test_ambiguous_numeric_and_multiple_source_evidence_preserves_reviewed_title_and_date(self):
        _, ben_origin = self._ben_copy_of_red()
        self._source_evidence(self._origin(self.assets[0]), 'Ana',
                              {'raw': '04/05/2024, 21:00', 'local': None, 'precision': 'unknown'}, ambiguous=True)
        self._source_evidence(ben_origin, 'Ben', {'raw': 1713906482000, 'local': None, 'precision': 'unknown'})
        card = self._red_card()
        self.assertEqual((card['title'], card['date'], card['year']), ('Red', '2020-01-02', 2020))
        evidence = card['photos'][0]['provenance']
        self.assertEqual([item['sender'] for item in evidence], ['Ana', 'Ben'])
        self.assertTrue(evidence[0]['sharedAt']['ambiguous'])
        self.assertEqual(evidence[1]['sharedAt']['raw'], '1713906482000')
        self.assertFalse(evidence[1]['sharedAt']['ambiguous'])
        with self.store.transaction():
            self.store.db.execute('DELETE FROM review_annotations WHERE asset_id=?', (self.assets[0],))
        untitled = next(card for card in atlas_view(self.store, self.alice, self.group)['memories']
                        if card['id'] == 'photo-' + self.assets[0])
        self.assertEqual(untitled['title'], 'Photo shared by Ana and Ben')
        self.assertIsNone(untitled['year'])
        self._source_evidence(ben_origin, 'Ben', {'raw': 'not a date', 'local': None}, ambiguous=True)
        malformed = next(card for card in atlas_view(self.store, self.alice, self.group)['memories']
                         if card['id'] == 'photo-' + self.assets[0])
        self.assertFalse(malformed['photos'][0]['provenance'][1]['sharedAt']['ambiguous'])
        self.store.review_event(self.alice, self.group, self.assets, 'Circle story', 'accept')
        self.assertEqual(atlas_view(self.store, self.alice, self.group)['memories'][0]['title'], 'Circle story')

    def _whatsapp_shares(self, chat):
        from tests.backend.imports.test_adapters import zip_bytes
        files = {'chat.txt': chat}
        for name, color in (('a.jpg', 'green'), ('b.jpg', 'yellow')):
            image = io.BytesIO()
            Image.new('RGB', (20, 20), color).save(image, 'JPEG')
            files[name] = image.getvalue()
        data = zip_bytes(files)
        run = self.store.begin_import(self.alice, self.group, 'whatsapp', 'synthetic-chat', len(data),
                                      hashlib.sha256(data).hexdigest(), {})
        self.store.write_chunk(self.alice, run, 0, data)
        self.store.finish_transfer(self.alice, run)
        self.store.scan(run)
        self.store.confirm(self.alice, run)
        while self.store.work_once():
            pass
        cards = atlas_view(self.store, self.ben, self.group)['memories']
        return {card['photos'][0]['provenance'][0]['sharedAt']['raw']: card['photos'][0]['provenance'][0]['sharedAt']
                for card in cards if card['title'] not in ('Red', 'Blue')}

    def test_one_unambiguous_day_settles_the_date_order_of_the_whole_chat(self):
        shares = self._whatsapp_shares('04/05/2024, 21:00 - Ana: a.jpg (file attached)\n'
                                       '23/05/2024, 10:00 - Ana: b.jpg (file attached)')
        self.assertEqual(shares['04/05/2024, 21:00'], dict(
            local='2024-05-04T21:00:00', raw='04/05/2024, 21:00', precision='second', ambiguous=False))
        self.assertEqual(shares['23/05/2024, 10:00']['local'], '2024-05-23T10:00:00')

    def test_neighbouring_messages_settle_the_date_order_of_a_lone_photo(self):
        shares = self._whatsapp_shares('05/28/2024, 20:59 - Ben: Ferry?\n'
                                       '06/04/2024, 21:00 - Ana: a.jpg (file attached)')
        self.assertEqual(shares['06/04/2024, 21:00']['local'], '2024-06-04T21:00:00')
        self.assertFalse(shares['06/04/2024, 21:00']['ambiguous'])

    def test_a_chat_without_an_unambiguous_day_stays_ambiguous(self):
        shares = self._whatsapp_shares('04/05/2024, 21:00 - Ana: a.jpg (file attached)\n'
                                       '05/04/2024, 10:00 - Ana: b.jpg (file attached)')
        self.assertEqual(shares['04/05/2024, 21:00'], dict(
            local=None, raw='04/05/2024, 21:00', precision='unknown', ambiguous=True))
        self.assertTrue(shares['05/04/2024, 10:00']['ambiguous'])

    def test_source_evidence_deduplicates_and_rechecks_withdrawal_and_owner_membership(self):
        resource, ben_origin = self._ben_copy_of_red()
        assertion = {'raw': '2024-04-23', 'local': '2024-04-23T21:08:02', 'precision': 'second'}
        self._source_evidence(self._origin(self.assets[0]), 'Ana', assertion)
        self._source_evidence(ben_origin, 'Ana', assertion)
        self.assertEqual(len(self._red_card()['photos'][0]['provenance']), 1)
        self._source_evidence(ben_origin, 'Ben', assertion)
        self.assertEqual(len(self._red_card()['photos'][0]['provenance']), 2)
        self.store.withdraw_resource(self.ben, resource)
        self.assertEqual([item['sender'] for item in self._red_card()['photos'][0]['provenance']], ['Ana'])
        with self.store.transaction():
            self.store.db.execute('UPDATE archive_origins SET withdrawn=0 WHERE id=?', (ben_origin,))
        self.store.remove_member(self.alice, self.group, self.ben)
        self.assertEqual([item['sender'] for item in self._red_card()['photos'][0]['provenance']], ['Ana'])

    def test_photo_evidence_has_stable_identity_and_reviewed_capture_and_place(self):
        self.store.correct_asset(self.alice, self.assets[0], title='Red', capture_date='2020-01-02', place='İstanbul')
        before = [tuple(row) for row in self.store.db.execute('SELECT id,payload FROM archive_origins ORDER BY id')]
        photo = self._red_card()['photos'][0]
        self.assertEqual(photo['assetId'], self.assets[0])
        self.assertEqual(photo['evidence']['capture'], dict(basis='capture', status='exact', days=['2020-01-02'],
                                                         start='2020-01-02', through='2020-01-02', timezone=None))
        self.assertEqual(photo['evidence']['chronology'], photo['evidence']['capture'])
        self.assertEqual(photo['evidence']['place']['text'], 'Istanbul, TR')
        self.assertEqual(photo['evidence']['place']['status'], 'known')
        self.assertEqual(before, [tuple(row) for row in self.store.db.execute('SELECT id,payload FROM archive_origins ORDER BY id')])

    def test_photo_evidence_uses_discord_share_day_and_never_upload_time(self):
        photo = self._discord_card()['photos'][0]
        self.assertEqual(photo['evidence']['capture']['status'], 'unknown')
        self.assertEqual(photo['evidence']['chronology'], dict(basis='shared', status='exact', days=['2024-01-02'],
                                                            start='2024-01-02', through='2024-01-02', timezone='UTC'))
        self.assertEqual(photo['evidence']['place'], dict(status='unknown', text=None, pin=None))
        self._forget_reviewed_date(self.assets[1])
        blue = next(card for card in atlas_view(self.store, self.ben, self.group)['memories'] if card['id'] == 'photo-' + self.assets[1])
        self.assertEqual(blue['photos'][0]['evidence']['chronology']['status'], 'unknown')

    def test_photo_evidence_keeps_capture_conflicts_and_each_childs_own_place(self):
        self._forget_reviewed_date(self.assets[1], ['2021-01-02T23:30:00-03:00', '2021-03-04T00:30:00+03:00'])
        self.store.correct_asset(self.alice, self.assets[0], title='Red', capture_date='2020-01-02', place='İstanbul')
        photos = {photo['assetId']: photo for photo in self._memory()['photos']}
        self.assertEqual(photos[self.assets[1]]['evidence']['chronology']['status'], 'conflict')
        self.assertEqual(photos[self.assets[1]]['evidence']['capture']['days'], ['2021-01-02', '2021-03-04'])
        self.assertEqual(photos[self.assets[1]]['evidence']['place']['status'], 'unknown')
        self.assertEqual(photos[self.assets[0]]['evidence']['place']['status'], 'known')

    def test_unmapped_reviewed_place_is_visible_without_borrowing_a_source_pin(self):
        self.store.set_place(self.alice, self._origin(self.assets[0]), 'GR', 'Naxos', 37.1, 25.4, None)
        evidence = self._red_card()['photos'][0]['evidence']
        self.assertEqual(evidence['place'], dict(status='unmapped', text='Harbour', pin=None))

    def test_photo_evidence_different_reviewed_cities_remain_on_their_own_children(self):
        self.store.correct_asset(self.alice, self.assets[0], title='Red', capture_date='2020-01-02', place='Istanbul, TR')
        self.store.correct_asset(self.alice, self.assets[1], title='Blue', capture_date='2021-01-02', place='Paris, FR')
        memory = self._memory()
        self.assertIsNone(memory['place'])
        places = {photo['assetId']: photo['evidence']['place']['text'] for photo in memory['photos']}
        self.assertEqual(places, {self.assets[0]: 'Istanbul, TR', self.assets[1]: 'Paris, FR'})

    def test_photo_evidence_distinguishes_unresolved_chat_days(self):
        self._whatsapp_shares('04/05/2024, 21:00 - Ana: a.jpg (file attached)\n'
                              '05/04/2024, 10:00 - Ana: b.jpg (file attached)')
        photos = [photo for card in atlas_view(self.store, self.ben, self.group)['memories']
                  for photo in card['photos'] if photo['assetId'] not in self.assets]
        self.assertTrue(photos)
        self.assertTrue(all(photo['evidence']['chronology']['status'] == 'ambiguous' for photo in photos))
        self.assertTrue(all(photo['evidence']['capture']['status'] == 'unknown' for photo in photos))

    def test_photo_evidence_preserves_same_name_city_regions_and_source_centroids(self):
        from mazi.places import lookup
        from mazi.archive.photo_metadata import place_evidence
        massachusetts = lookup('Springfield, Massachusetts, US')['city']
        illinois = lookup('Springfield, Illinois, US')['city']
        self.store.correct_asset(self.alice, self.assets[0], title='Red', capture_date='2020-01-02', place='Springfield, Massachusetts, US')
        self.store.correct_asset(self.alice, self.assets[1], title='Blue', capture_date='2021-01-02', place='Springfield, Illinois, US')
        photos = {photo['assetId']: photo for photo in self._memory()['photos']}
        self.assertEqual(photos[self.assets[0]]['evidence']['place']['text'], 'Springfield, Massachusetts, US')
        self.assertEqual(photos[self.assets[1]]['evidence']['place']['text'], 'Springfield, Illinois, US')
        for city in (massachusetts, illinois):
            source = dict(city=city.name, country=city.country, latitude=city.latitude, longitude=city.longitude)
            resolved = place_evidence('', [source])
            self.assertEqual(resolved['status'], 'known')
            self.assertEqual((resolved['pin']['latitude'], resolved['pin']['longitude']), (city.latitude, city.longitude))
            self.assertEqual(resolved['text'], f'Springfield, {city.region}, US')
        conflict = place_evidence('', [dict(city=city.name, country=city.country, latitude=city.latitude, longitude=city.longitude) for city in (massachusetts, illinois)])
        self.assertEqual(conflict, dict(status='conflict', text=None, pin=None))
