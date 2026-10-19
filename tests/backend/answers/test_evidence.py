import io
import hashlib
import zipfile
import json
import unittest
from unittest.mock import patch

from PIL import Image
from mazi.identity.core import Denied
from tests.backend.answers import test_answers


class DirectEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.fixture = test_answers.AnswerTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.tearDown)
        self.store = self.fixture.store
        self.user, self.group, self.asset = self.fixture.ben, self.fixture.group, self.fixture.asset

    def evidence(self):
        return self.store.evidence(self.user, self.group, self.asset)

    def test_direct_evidence_does_not_build_unrelated_records(self):
        expected = next(record['evidence'] for record in self.store._records(self.user, self.group) if record['evidence']['id'] == self.asset)
        with patch.object(self.store, '_records', side_effect=AssertionError('Whole archive must not be read')):
            self.assertEqual(self.evidence(), expected)

    def test_cross_circle_request_denied_even_when_reader_belongs_to_both(self):
        other = self.store.create_group(self.user, 'Other circle')
        self.store.processing(self.user, other, True, group_wide=True)
        self.store.answer_processing(self.user, other, True, group_wide=True)
        self.store.answer_processing(self.user, other, True)
        with self.assertRaises(Denied):
            self.store.evidence(self.user, other, self.asset)

    def test_hide_withdrawal_and_membership_changes_are_rechecked(self):
        self.assertEqual(self.evidence()['id'], self.asset)
        self.store.hide(self.user, self.asset, True)
        with self.assertRaises(Denied): self.evidence()
        self.store.hide(self.user, self.asset, False)
        self.store.withdraw(self.fixture.alice, self.fixture.run)
        with self.assertRaises(Denied): self.evidence()

    def test_reader_revocation_and_all_consent_gates_are_rechecked(self):
        for change, restore in [
            (lambda: self.store.processing(self.fixture.alice, self.group, False, group_wide=True), lambda: self.store.processing(self.fixture.alice, self.group, True, group_wide=True)),
            (lambda: self.store.answer_processing(self.fixture.alice, self.group, False, group_wide=True), lambda: self.store.answer_processing(self.fixture.alice, self.group, True, group_wide=True)),
            (lambda: self.store.answer_processing(self.user, self.group, False), lambda: self.store.answer_processing(self.user, self.group, True)),
            (lambda: self.store.processing(self.fixture.alice, self.group, False), lambda: self.store.processing(self.fixture.alice, self.group, True)),
            (lambda: self.store.answer_processing(self.fixture.alice, self.group, False), lambda: self.store.answer_processing(self.fixture.alice, self.group, True)),
        ]:
            change()
            with self.assertRaises(Denied): self.evidence()
            restore()
            self.assertEqual(self.evidence()['id'], self.asset)
        self.store.remove_member(self.fixture.alice, self.group, self.user)
        with self.assertRaises(Denied): self.evidence()

    def test_annotation_author_consent_and_membership_are_rechecked(self):
        self.store.processing(self.user, self.group, True)
        self.store.correct_asset(self.user, self.asset, title='Reviewed', capture_date='2024-02-03', place='London')
        self.assertEqual(self.evidence()['title'], 'Reviewed')
        self.store.answer_processing(self.user, self.group, False)
        with self.assertRaises(Denied): self.store.evidence(self.fixture.alice, self.group, self.asset)
        self.store.answer_processing(self.user, self.group, True)
        self.store.remove_member(self.fixture.alice, self.group, self.user)
        with self.assertRaises(Denied): self.store.evidence(self.fixture.alice, self.group, self.asset)

    def test_all_origin_dates_and_corrections_match_answer_evidence(self):
        row = self.store.db.execute('SELECT id,payload FROM archive_origins WHERE asset_id=?', (self.asset,)).fetchone()
        payload = json.loads(row['payload'])
        payload['capture_assertions'] = [{'local': '2020-01-02'}]
        self.store.db.execute('UPDATE archive_origins SET payload=? WHERE id=?', (json.dumps(payload), row['id']))
        for index in range(101):
            extra = dict(payload, capture_assertions=[{'local': '2021-01-02' if index == 100 else '2020-01-02'}])
            self.store.db.execute('INSERT INTO archive_origins VALUES(?,?,?,?,?,?,?,?,0)',
                                  (f'evidence-origin-{index}', self.asset, self.group, self.fixture.alice, self.fixture.run, f'evidence-occurrence-{index}', 'fingerprint', json.dumps(extra)))
        self.store.db.commit()
        self.store.correct_asset(self.fixture.alice, self.asset, title='Evidence', capture_date=None, place='')
        result = self.evidence()
        self.assertEqual(result['dates'], ['2020-01-02', '2021-01-02'])
        self.assertIsNone(result['date'])
        self.assertEqual(result, self.store._records(self.user, self.group)[0]['evidence'])
        self.store.correct_asset(self.fixture.alice, self.asset, title='Evidence', capture_date='2022-03-04', place='')
        self.assertEqual(self.evidence()['dates'], ['2022-03-04'])

    def test_only_requested_asset_document_is_materialized(self):
        image = io.BytesIO()
        Image.new('RGB', (8, 8), 'blue').save(image, 'PNG')
        run = self.fixture.submit({'unrelated.png': image.getvalue()})
        self.fixture.process(run)
        with patch.object(self.store, '_document', wraps=self.store._document) as document:
            self.evidence()
        self.assertEqual([call.args[1] for call in document.call_args_list], [self.asset])

    def test_withdrawal_preserves_an_independent_eligible_copy(self):
        self.store.processing(self.user, self.group, True)
        output = io.BytesIO()
        with zipfile.ZipFile(output, 'w') as archive:
            archive.writestr('independent.jpg', self.store.asset_bytes(self.user, self.asset, original=True))
        data = output.getvalue()
        run = self.store.begin_import(self.user, self.group, 'manual', 'independent', len(data), hashlib.sha256(data).hexdigest(), {})
        self.store.write_chunk(self.user, run, 0, data)
        self.store.finish_transfer(self.user, run)
        self.store.scan(run)
        self.store.confirm(self.user, run)
        while self.store.work_once():
            pass
        self.assertEqual(self.store.report(self.user, run)['state'], 'COMPLETED')
        self.store.withdraw(self.fixture.alice, self.fixture.run)
        self.assertEqual(self.evidence()['id'], self.asset)
        self.store.withdraw(self.user, run)
        with self.assertRaises(Denied):
            self.evidence()
