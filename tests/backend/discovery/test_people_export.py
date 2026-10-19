"""Public export/People parity, privacy races and bounded city retention."""
from collections import Counter
from contextlib import contextmanager
import io
import json
import unittest
from unittest.mock import patch
import weakref
import zipfile

from PIL import Image

from mazi.discovery import discovery
from mazi.discovery.discovery import DiscoveryStore
from mazi.identity.core import Conflict, Denied
from mazi.memories.memories import MemoryStore
from mazi.server import handler_for
from tests.backend.imports import test_engine as helpers


class PeopleExportTests(unittest.TestCase):
    submit = helpers.EngineTests.submit
    process = helpers.EngineTests.process

    def setUp(self):
        helpers.EngineTests.setUp(self)
        self.store.close()
        self.store = MemoryStore(self.temp.name)
        self.run = self.submit()
        self.process(self.run)
        self.asset = self.store.gallery(self.ben, self.group)[0]['id']
        self.origin = self.store.owned_origins(self.alice, self.group)[0]['id']
        self.store.correct_asset(self.alice, self.asset, title='Canal',
                                 capture_date='2020-01-02', place='Amsterdam')
        self.store.set_place(self.alice, self.origin, 'NL', 'Amsterdam', 52.37, 4.9, '2020-01-02')
        self.amy = self.store.create_person(self.alice, self.group, 'Amy')
        self.person_ben = self.store.create_person(self.alice, self.group, 'Ben')
        self.store.propose_identity(self.alice, self.person_ben, self.ben)
        self.store.confirm_identity(self.ben, self.person_ben)
        for person in (self.amy, self.person_ben):
            self.store.tag(self.alice, person, self.asset, True)

    def tearDown(self):
        helpers.EngineTests.tearDown(self)

    def expected(self, cities=None):
        cities = ['Amsterdam', 'amsterdam'] if cities is None else cities
        return [dict(id=self.amy, name='Amy', assets=[self.asset], count=1,
                     is_me=False, verified=False, places=cities, memories=[]),
                dict(id=self.person_ben, name='Ben', assets=[self.asset], count=1,
                     is_me=True, verified=True, places=cities, memories=[])]

    def exported(self, *, file=True):
        if file:
            with self.store.export_archive_file(self.ben, self.group) as source:
                with zipfile.ZipFile(source) as archive:
                    return {name: archive.read(name) for name in archive.namelist()}
        with zipfile.ZipFile(io.BytesIO(self.store.export_archive(self.ben, self.group))) as archive:
            return {name: archive.read(name) for name in archive.namelist()}

    @contextmanager
    def documents(self):
        # Supplemental diagnostics wrap real documents; behavior is asserted
        # through public People and complete export member contents below.
        document = self.store._document
        calls, references = [], []
        class ObservedDocument(dict):
            pass
        def observe(user, asset):
            self.assertTrue(all(reference() is None for reference in references))
            result = ObservedDocument(document(user, asset))
            calls.append(asset)
            references.append(weakref.ref(result))
            return result
        with patch.object(self.store, '_document', observe):
            yield calls
        self.assertTrue(all(reference() is None for reference in references))

    def test_export_reuses_only_city_tuples_and_rebuilds_them_for_final_admission(self):
        self.assertEqual(self.store.people(self.ben, self.group), self.expected())
        with self.documents() as calls:
            members = self.exported()
        self.assertEqual(json.loads(members['people.json']), self.expected())
        self.assertEqual(members['originals/' + self.asset], helpers.picture())
        record = json.loads(members['manifest.json'])['assets'][0]
        self.assertEqual(record['annotation'], dict(title='Canal', capture_date='2020-01-02',
                                                  place='Amsterdam', anniversary=0))
        self.assertEqual(calls, [self.asset, self.asset])

    def writer(self):
        writer = MemoryStore(self.temp.name)
        self.addCleanup(writer.close)
        return writer

    def test_ordinary_people_still_denies_withdrawal_between_repeated_asset_reads(self):
        self.assertEqual(self.store.people(self.ben, self.group), self.expected())
        writer, document = self.writer(), self.store._document
        calls = []
        def withdraw_after_first_document(user, asset):
            result = document(user, asset)
            calls.append(asset)
            if len(calls) == 1:
                writer.withdraw(self.alice, self.run)
            return result
        with patch.object(self.store, '_document', withdraw_after_first_document):
            with self.assertRaisesRegex(Denied, 'Media unavailable'):
                self.store.people(self.ben, self.group)
        self.assertEqual(calls, [self.asset])
        self.assertEqual(self.store.gallery(self.ben, self.group), [])

    def test_export_withdrawal_during_city_projection_conflicts_before_yield(self):
        writer, document = self.writer(), self.store._document
        calls, yielded = [], []
        def withdraw_after_first_document(user, asset):
            result = document(user, asset)
            calls.append(asset)
            if len(calls) == 1:
                writer.withdraw(self.alice, self.run)
            return result
        with patch.object(self.store, '_document', withdraw_after_first_document):
            with self.assertRaisesRegex(Conflict, 'Archive changed while preparing export; retry'):
                with self.store.export_archive_file(self.ben, self.group):
                    yielded.append(True)
        self.assertEqual(yielded, [])
        self.assertEqual(calls, [self.asset])
        self.assertEqual(self.store.gallery(self.ben, self.group), [])

    def http_export(self):
        self.store.setup_shared(admin_name='Alice', group_id=self.group,
                                mappings={'Alice': self.alice, 'Ben': self.ben})
        handler = object.__new__(handler_for(self.store))
        handler.path = '/api/review/export?group=' + self.group
        handler.user = lambda: self.ben
        handler.wfile = io.BytesIO()
        statuses, headers = [], {}
        handler.send_response = statuses.append
        handler.send_header = lambda key, value: headers.update({key: value})
        handler.end_headers = lambda: None
        handler.do_GET()
        return statuses, headers, handler.wfile.getvalue()

    def test_final_admission_recomputes_changed_cities_before_http_headers(self):
        writer = self.writer()
        build, document = self.store._build_export_archive, self.store._document
        cities = []
        def change_after_build(*args):
            result = build(*args)
            writer.correct_asset(self.alice, self.asset, title='Canal',
                                 capture_date='2020-01-02', place='Utrecht')
            return result
        def observe(user, asset):
            result = document(user, asset)
            cities.append(result['cities'])
            return result
        with patch.object(self.store, '_build_export_archive', change_after_build), \
             patch.object(self.store, '_document', observe):
            statuses, headers, body = self.http_export()
        self.assertEqual(statuses, [409])
        self.assertEqual(headers['Content-Type'], 'application/json')
        self.assertEqual(json.loads(body), {'error': 'Archive changed while preparing export; retry'})
        self.assertNotIn(b'PK\x03\x04', body)
        self.assertEqual(cities, [['Amsterdam', 'amsterdam'], ['Amsterdam', 'utrecht']])
        self.assertEqual(json.loads(self.exported()['people.json']), self.expected(['Amsterdam', 'utrecht']))
        self.assertEqual(self.store.people(self.ben, self.group), self.expected(['Amsterdam', 'utrecht']))

    def test_retention_budget_exact_and_one_over_preserve_every_export_member(self):
        reference = self.exported()
        for budget, exact in [('EXPORT_PEOPLE_CITY_KEYS', 1),
                              ('EXPORT_PEOPLE_CITY_ENTRIES', 2),
                              ('EXPORT_PEOPLE_CITY_CHARACTERS', 18)]:
            for limit, document_count in [(exact, 2), (exact - 1, 4)]:
                with self.subTest(budget=budget, limit=limit):
                    with patch.object(discovery, budget, limit), self.documents() as calls:
                        actual = self.exported()
                    self.assertEqual(actual, reference)
                    self.assertEqual(json.loads(actual['people.json']), self.expected())
                    self.assertEqual(calls, [self.asset] * document_count)
                    self.assertEqual(self.store.people(self.ben, self.group), self.expected())

    def test_empty_cities_are_reused_even_when_entry_and_character_budgets_are_zero(self):
        self.store.correct_asset(self.alice, self.asset, title='No city', capture_date=None, place='')
        self.store.set_place(self.alice, self.origin, '', '', None, None, None)
        with patch.object(discovery, 'EXPORT_PEOPLE_CITY_ENTRIES', 0), \
             patch.object(discovery, 'EXPORT_PEOPLE_CITY_CHARACTERS', 0), self.documents() as calls:
            actual = self.exported()
        self.assertEqual(json.loads(actual['people.json']), self.expected([]))
        self.assertEqual(calls, [self.asset, self.asset])
        with self.documents() as calls:
            self.assertEqual(self.store.people(self.ben, self.group), self.expected([]))
        self.assertEqual(calls, [self.asset, self.asset])

    def test_character_budget_counts_unicode_characters_without_truncation(self):
        city = '😀' * 200
        self.store.correct_asset(self.alice, self.asset, title='Unicode city', capture_date=None, place=city)
        self.store.set_place(self.alice, self.origin, 'JP', city, 35.68, 139.69, None)
        reference = self.exported()
        for limit, count in [(200, 2), (199, 4)]:
            with self.subTest(limit=limit), \
                 patch.object(discovery, 'EXPORT_PEOPLE_CITY_CHARACTERS', limit), self.documents() as calls:
                actual = self.exported()
            self.assertEqual(actual, reference)
            self.assertEqual(json.loads(actual['people.json']), self.expected([city]))
            self.assertEqual(calls, [self.asset] * count)

    def add_photo(self, color='blue'):
        image = io.BytesIO()
        Image.new('RGB', (8, 8), color).save(image, 'PNG')
        run = self.submit({color + '.png': image.getvalue()})
        self.process(run)
        return next(row['asset'] for row in self.store.owned_origins(self.alice, self.group)
                    if row['filename'] == color + '.png')

    def test_cumulative_key_budget_bypasses_only_overflowing_assets(self):
        second, third = self.add_photo('blue'), self.add_photo('green')
        for asset in (second, third):
            for person in (self.amy, self.person_ben):
                self.store.tag(self.alice, person, asset, True)
        assets = sorted([self.asset, second, third])
        expected = self.expected()
        for person in expected:
            person.update(assets=assets, count=3)
        reference = self.exported()
        for limit, counts in [(3, [2, 2, 2]), (2, [2, 2, 4])]:
            with self.subTest(limit=limit), \
                 patch.object(discovery, 'EXPORT_PEOPLE_CITY_KEYS', limit), self.documents() as calls:
                actual = self.exported()
            self.assertEqual(actual, reference)
            self.assertEqual(json.loads(actual['people.json']), expected)
            self.assertEqual(Counter(calls), dict(zip(assets, counts)))

    def test_oversized_city_tuple_does_not_prevent_later_small_tuple_reuse(self):
        second = self.add_photo()
        for person in (self.amy, self.person_ben):
            self.store.tag(self.alice, person, second, True)
        large, small = sorted([self.asset, second])
        self.store.set_place(self.alice, self.origin, '', '', None, None, None)
        origins = {row['asset']: row['id'] for row in self.store.owned_origins(self.alice, self.group)}
        self.store.correct_asset(self.alice, large, title='Large tuple', capture_date=None, place='A')
        self.store.set_place(self.alice, origins[large], 'NL', 'A', 52.37, 4.9, None)
        self.store.correct_asset(self.alice, small, title='Small tuple', capture_date=None, place='B')
        expected = self.expected(['A', 'a', 'b'])
        for person in expected:
            person.update(assets=[large, small], count=2)
        reference = self.exported()
        for budget, limit in [('EXPORT_PEOPLE_CITY_ENTRIES', 1), ('EXPORT_PEOPLE_CITY_CHARACTERS', 1)]:
            with self.subTest(budget=budget), patch.object(discovery, budget, limit), self.documents() as calls:
                actual = self.exported()
            self.assertEqual(actual, reference)
            self.assertEqual(json.loads(actual['people.json']), expected)
            self.assertEqual(Counter(calls), {large: 4, small: 2})

    def assert_parity(self, expected):
        with patch.object(discovery, 'EXPORT_PEOPLE_CITY_KEYS', 0):
            uncached = self.exported()
        cached = self.exported()
        self.assertEqual(cached, uncached)
        self.assertEqual(self.exported(file=False), uncached)
        self.assertEqual(json.loads(cached['people.json']), expected)
        self.assertEqual(self.store.people(self.ben, self.group), expected)
        return cached

    def test_source_city_conflicts_dates_case_and_corrections_keep_complete_metadata(self):
        run = self.submit({'copy.jpg': helpers.picture()}, user=self.ben)
        self.store.confirm(self.ben, run)
        job = self.store.claim()
        prepared = self.store.prepare(job)
        prepared['locations'] = [{'city': 'Utrecht'}, {'city': 'Paris'}]
        prepared['capture'] = [{'local': '2022-03-04T12:00:00'}]
        self.store.complete(job, prepared)
        other_origin = self.store.owned_origins(self.ben, self.group)[0]['id']
        self.store.set_place(self.ben, other_origin, 'NL', 'AMSTERDAM', 52.37, 4.9, None)
        self.store.correct_asset(self.alice, self.asset, title='Source conflict', capture_date=None, place='')
        members = self.assert_parity(self.expected(['AMSTERDAM', 'Amsterdam']))
        records = json.loads(members['manifest.json'])['assets'][0]['origins']
        source = next(row for row in records if row['original_filename'] == 'copy.jpg')
        self.assertEqual(source['location_assertions'], [{'city': 'Utrecht'}, {'city': 'Paris'}])
        item = self.store.timeline(self.ben, self.group)['items'][0]
        self.assertEqual((item['date'], item['place']), ('2022-03-04', None))
        self.store.correct_asset(self.alice, self.asset, title='Reviewed',
                                 capture_date='2023-04-05', place='London')
        members = self.assert_parity(self.expected(['AMSTERDAM', 'Amsterdam', 'london']))
        record = json.loads(members['manifest.json'])['assets'][0]
        self.assertEqual(record['annotation'], dict(title='Reviewed', capture_date='2023-04-05',
                                                  place='London', anniversary=0))
        self.assertEqual(record['origins'], records)

    def test_overlapping_tags_and_accepted_hidden_memories_preserve_order(self):
        second, third = self.add_photo('blue'), self.add_photo('green')
        self.store.tag(self.alice, self.amy, second, True)
        self.store.tag(self.alice, self.person_ben, third, True)
        accepted = self.store.review_event(self.alice, self.group, [self.asset, second], 'Canal trip', 'accept')
        hidden = self.store.review_event(self.alice, self.group, [self.asset, third], 'Hidden trip', 'accept')
        self.store.hide_event(self.ben, self.group, hidden, True)
        expected = self.expected()
        expected[0].update(assets=sorted([self.asset, second]), count=2)
        expected[1].update(assets=sorted([self.asset, third]), count=2)
        for person in expected:
            person['memories'] = [dict(id=accepted, title='Canal trip')]
        self.assert_parity(expected)
        self.store.hide_event(self.ben, self.group, accepted, True)
        for person in expected:
            person['memories'] = []
        self.assert_parity(expected)
        self.store.hide(self.ben, self.asset, True)
        expected[0].update(assets=[second], count=1, places=[])
        expected[1].update(assets=[third], count=1, places=[])
        self.assert_parity(expected)

    def test_subject_and_private_review_suppressions_preserve_full_export_parity(self):
        self.assert_parity(self.expected())
        self.store.disassociate(self.ben, self.person_ben, self.asset)
        self.assert_parity(self.expected()[:1])
        self.store.nonmember_review(self.alice, self.amy, self.asset, True)
        members = self.assert_parity([])
        self.assertEqual(len(json.loads(members['manifest.json'])['assets']), 1)
        self.store.restore_association(self.ben, self.person_ben, self.asset)
        self.assert_parity(self.expected()[1:])
        self.store.nonmember_review(self.alice, self.amy, self.asset, True, restore=True)
        self.assert_parity(self.expected())

    def test_departed_tagger_and_identity_cannot_resurface_through_city_reuse(self):
        self.store.accept(self.outsider, self.store.invite(self.alice, self.group))
        self.store.untag(self.alice, self.amy, self.asset)
        self.store.tag(self.outsider, self.amy, self.asset, True)
        self.assert_parity(self.expected())
        self.store.leave_group(self.outsider, self.group)
        self.assert_parity(self.expected()[1:])
        self.store.leave_group(self.ben, self.group)
        with self.assertRaises(Denied):
            self.store.people(self.ben, self.group)
        with self.assertRaises(Denied):
            self.exported()
        self.assertEqual(self.store.people(self.alice, self.group), [])
        self.store.accept(self.ben, self.store.invite(self.alice, self.group))
        self.assert_parity([])
        self.assertEqual(len(self.store.gallery(self.ben, self.group)), 1)

    def test_withdrawal_and_membership_loss_do_not_reuse_previous_export_cities(self):
        self.assert_parity(self.expected())
        self.store.withdraw(self.alice, self.run)
        members = self.assert_parity([])
        self.assertEqual(json.loads(members['manifest.json'])['assets'], [])
        self.store.remove_member(self.alice, self.group, self.ben)
        with self.assertRaises(Denied):
            self.exported()

    def test_public_manage_option_remains_uncached_and_export_excludes_empty_people(self):
        self.store.untag(self.alice, self.amy, self.asset)
        ordinary = self.store.people(self.alice, self.group, manage=True)
        self.assertEqual(ordinary[0], dict(id=self.amy, name='Amy', assets=[], count=0,
                                         is_me=False, verified=False, places=[], memories=[]))
        self.assert_parity(self.expected()[1:])
        with self.assertRaises(TypeError):
            self.store.people(self.ben, self.group, reuse_cities=True)

    def test_discovery_store_and_memory_store_bytes_file_http_exports_match(self):
        reference = self.assert_parity(self.expected())
        statuses, headers, body = self.http_export()
        self.assertEqual(statuses, [200])
        self.assertEqual(headers['Content-Type'], 'application/zip')
        self.assertEqual(int(headers['Content-Length']), len(body))
        with zipfile.ZipFile(io.BytesIO(body)) as archive:
            self.assertEqual({name: archive.read(name) for name in archive.namelist()}, reference)
        self.store.close()
        self.store = DiscoveryStore(self.temp.name)
        self.assertEqual(self.assert_parity(self.expected()), reference)

    def test_changes_during_city_construction_are_rejected_before_http_headers(self):
        writer = self.writer()
        cases = [
            ('correction',
             lambda: writer.correct_asset(self.alice, self.asset, title='Changed', capture_date=None, place='Utrecht'),
             lambda: writer.correct_asset(self.alice, self.asset, title='Canal', capture_date='2020-01-02', place='Amsterdam')),
            ('shared-place removal',
             lambda: writer.set_place(self.alice, self.origin, '', '', None, None, None),
             lambda: writer.set_place(self.alice, self.origin, 'NL', 'Amsterdam', 52.37, 4.9, '2020-01-02')),
            ('private subject suppression',
             lambda: writer.nonmember_review(self.alice, self.amy, self.asset, True),
             lambda: writer.nonmember_review(self.alice, self.amy, self.asset, True, restore=True)),
        ]
        for name, change, restore in cases:
            with self.subTest(change=name):
                document, calls = self.store._document, []
                def interleave(user, asset):
                    result = document(user, asset)
                    calls.append(asset)
                    if len(calls) == 1:
                        change()
                    return result
                try:
                    with patch.object(self.store, '_document', interleave):
                        statuses, headers, body = self.http_export()
                    self.assertEqual(statuses, [409])
                    self.assertEqual(headers['Content-Type'], 'application/json')
                    self.assertEqual(json.loads(body), {'error': 'Archive changed while preparing export; retry'})
                    self.assertNotIn(b'PK\x03\x04', body)
                finally:
                    restore()
                self.assert_parity(self.expected())

    def test_cumulative_city_entries_and_characters_bypass_only_the_later_tuple(self):
        second = self.add_photo()
        self.store.set_place(self.alice, self.origin, '', '', None, None, None)
        assets = sorted([self.asset, second])
        for asset, city in zip(assets, ['AA', 'BB']):
            self.store.correct_asset(self.alice, asset, title='City', capture_date=None, place=city)
            for person in (self.amy, self.person_ben):
                self.store.tag(self.alice, person, asset, True)
        expected = self.expected(['aa', 'bb'])
        for person in expected:
            person.update(assets=assets, count=2)
        reference = self.exported()
        for budget, exact in [('EXPORT_PEOPLE_CITY_ENTRIES', 2), ('EXPORT_PEOPLE_CITY_CHARACTERS', 4)]:
            for limit, counts in [(exact, [2, 2]), (exact - 1, [2, 4])]:
                with self.subTest(budget=budget, limit=limit), \
                     patch.object(discovery, budget, limit), self.documents() as calls:
                    actual = self.exported()
                self.assertEqual(actual, reference)
                self.assertEqual(json.loads(actual['people.json']), expected)
                self.assertEqual(Counter(calls), dict(zip(assets, counts)))
