"""Completed photograph copies above the ordinary browsing boundary."""
import hashlib
import json
import tempfile
import unittest
from unittest.mock import patch
import zipfile

from mazi.capacity import CapacityExceeded
from mazi.memories.memories import MemoryStore
from tests.backend.imports import test_engine as helpers


class ExportCapacityTests(unittest.TestCase):
    submit = helpers.EngineTests.submit
    process = helpers.EngineTests.process

    def setUp(self):
        helpers.EngineTests.setUp(self)
        self.store.close()
        self.store = MemoryStore(self.temp.name)
        self.run = self.submit()
        self.process(self.run)
        self.asset = self.store.gallery(self.alice, self.group)[0]['id']

    def tearDown(self):
        helpers.EngineTests.tearDown(self)

    def seed(self, count):
        asset = dict(self.store.db.execute('SELECT * FROM archive_assets WHERE id=?', (self.asset,)).fetchone())
        origin = dict(self.store.db.execute('SELECT * FROM archive_origins WHERE asset_id=?', (self.asset,)).fetchone())
        for number in range(count - 1):
            identifier = f'export-{number:05d}'
            data = helpers.picture() + str(number).encode()
            self.store.objects.retain("archive-objects", identifier, data)
            values = dict(asset, id=identifier, sha256=hashlib.sha256(data).hexdigest(), original_key=identifier, size=len(data))
            self.store.db.execute('INSERT INTO archive_assets VALUES(?,?,?,?,?,?,?,?,?)', tuple(values.values()))
            values = dict(origin, id='origin-' + identifier, asset_id=identifier, occurrence=identifier)
            self.store.db.execute('INSERT INTO archive_origins VALUES(?,?,?,?,?,?,?,?,?)', tuple(values.values()))
        self.store.db.commit()

    def test_one_thousand_and_one_originals_have_no_obsolete_guard(self):
        self.seed(1001)
        with self.store.export_archive_file(self.ben, self.group) as output:
            with zipfile.ZipFile(output) as archive:
                self.assertEqual(len(json.loads(archive.read('manifest.json'))['assets']), 1001)
                self.assertEqual(archive.read('originals/export-00999'), helpers.picture() + b'999')

    def test_people_event_and_personal_pages_preserve_exact_json(self):
        self.seed(132)
        assets = self.store._visible_ids(self.ben, self.group)
        for number in range(130):
            person = self.store.create_person(self.alice, self.group, f'Person {number:03d}')
            self.store.tag(self.alice, person, assets[number], True)
            self.store.tag(self.alice, person, assets[number + 1], True)
            event = self.store.review_event(self.alice, self.group, assets[number:number + 2], f'Memory {number:03d}', 'accept')
            if number % 2:
                self.store.hide_event(self.ben, self.group, event, True)
        expected_people = json.dumps(self.store.people(self.ben, self.group)).encode()
        expected_personal = json.dumps(dict(hidden=self.store.hidden(self.ben, self.group),
                                           hidden_memories=self.store.hidden_events(self.ben, self.group),
                                           suppressed=self.store.suppressed(self.ben, self.group),
                                           processing=self.store.settings(self.ben, self.group))).encode()
        with self.store.export_archive_file(self.ben, self.group) as output:
            with zipfile.ZipFile(output) as archive:
                self.assertEqual(archive.read('people.json'), expected_people)
                self.assertEqual(archive.read('personal-discovery.json'), expected_personal)

    def test_reverse_personal_actions_preserve_exact_hidden_and_suppressed_order(self):
        self.seed(4)
        person = self.store.create_person(self.alice, self.group, 'Ben')
        self.store.propose_identity(self.alice, person, self.ben)
        self.store.confirm_identity(self.ben, person)
        for asset in reversed(self.store._visible_ids(self.ben, self.group)):
            self.store.tag(self.alice, person, asset, True)
            self.store.disassociate(self.ben, person, asset)
            self.store.hide(self.ben, asset, True)
        expected = dict(hidden=self.store.hidden(self.ben, self.group),
                        hidden_memories=self.store.hidden_events(self.ben, self.group),
                        suppressed=self.store.suppressed(self.ben, self.group),
                        processing=self.store.settings(self.ben, self.group))
        with self.store.export_archive_file(self.ben, self.group) as output:
            with zipfile.ZipFile(output) as archive:
                self.assertEqual(archive.read('personal-discovery.json'), json.dumps(expected).encode())

    def test_hidden_memory_timestamp_ties_preserve_mixed_status_order(self):
        self.seed(5)
        assets = self.store._visible_ids(self.ben, self.group)
        for index, decision in enumerate(('reject', 'accept', 'reject', 'accept')):
            event = self.store.review_event(self.alice, self.group, assets[index:index + 2], f'Memory {index}', decision)
            self.store.hide_event(self.ben, self.group, event, True)
        self.store.db.execute("UPDATE review_events SET updated_at='2026-10-22 12:00:00'")
        self.store.db.commit()
        expected = self.store.hidden_events(self.ben, self.group)
        self.assertEqual([item['title'] for item in expected], ['Memory 1', 'Memory 3', 'Memory 0', 'Memory 2'])
        with self.store.export_archive_file(self.ben, self.group) as output:
            with zipfile.ZipFile(output) as archive:
                self.assertEqual(json.loads(archive.read('personal-discovery.json'))['hidden_memories'], expected)

    def test_ten_thousand_originals_and_manifest_records_are_complete(self):
        self.seed(10000)
        with self.store.export_archive_file(self.ben, self.group) as output:
            with zipfile.ZipFile(output) as archive:
                assets = json.loads(archive.read('manifest.json'))['assets']
                self.assertEqual(len(assets), 10000)
                self.assertEqual(len([name for name in archive.namelist() if name.startswith('originals/')]), 10000)
                self.assertEqual(archive.read('originals/export-09998'), helpers.picture() + b'9998')
                self.assertEqual(assets[0]['origins'][0]['original_filename'], 'photo.jpg')

    def test_ten_thousand_and_one_has_an_explicit_photo_boundary(self):
        self.seed(10001)
        with self.assertRaisesRegex(CapacityExceeded, '10,000 photographs'):
            with self.store.export_archive_file(self.ben, self.group):
                self.fail('Over-capacity copy admitted')


class ExportArrayTests(unittest.TestCase):
    def test_empty_null_nested_and_unicode_records_keep_standard_json(self):
        from mazi.archive.export import ExportArray
        for records in ([], [None], [None, 1, {'text': 'Café', 'values': [True, False]}]):
            for ensure_ascii in (True, False):
                with self.subTest(records=records, ensure_ascii=ensure_ascii):
                    expected = json.dumps(records, ensure_ascii=ensure_ascii)
                    self.assertEqual(json.dumps(ExportArray(iter(records)), ensure_ascii=ensure_ascii), expected)
                    self.assertEqual(''.join(json.JSONEncoder(ensure_ascii=ensure_ascii).iterencode(ExportArray(iter(records)))), expected)

    def test_metadata_spool_is_private_and_closed_on_encoding_failure(self):
        from mazi.archive.export import ExportArray, ExportFingerprint
        import os
        files = []
        def temporary_file(*args, **kwargs):
            source = tempfile.TemporaryFile(*args, **kwargs)
            files.append(source)
            self.assertEqual(os.fstat(source.fileno()).st_mode & 0o777, 0o600)
            return source
        def records():
            yield {'retained': 'metadata'}
            raise OSError('Metadata scan failed')
        with patch('mazi.archive.export.TemporaryFile', temporary_file):
            with self.assertRaisesRegex(OSError, 'Metadata scan failed'):
                ExportFingerprint(lambda size: None).json_member('metadata.json', ExportArray(records()))
        self.assertEqual(len(files), 1)
        self.assertTrue(files[0].closed)

    def test_incomplete_metadata_spool_write_fails_and_closes(self):
        from mazi.archive.export import ExportFingerprint
        source = tempfile.TemporaryFile(mode='w+b')
        source.write = lambda data: 0
        with patch('mazi.archive.export.TemporaryFile', return_value=source):
            with self.assertRaisesRegex(OSError, 'Incomplete metadata spool write'):
                ExportFingerprint(lambda size: None).json_member('metadata.json', {'value': 'complete'})
        self.assertTrue(source.closed)

    def test_a_consumed_array_cannot_silently_be_serialized_twice(self):
        from mazi.archive.export import ExportArray
        records = ExportArray(iter([None, 1]))
        self.assertEqual(''.join(json.JSONEncoder().iterencode(records)), '[null, 1]')
        with self.assertRaisesRegex(RuntimeError, 'only be serialized once'):
            ''.join(json.JSONEncoder().iterencode(records))


if __name__ == '__main__':
    unittest.main()
