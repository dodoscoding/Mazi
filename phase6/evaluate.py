"""Synthetic, templated regression set; not independent production T13 acceptance."""
import hashlib
import io
import json
import tempfile
from pathlib import Path
from PIL import Image
from .answers import AnswerStore


def evaluate():
    fixtures = json.loads((Path(__file__).parent / 'tests/answer_holdout.json').read_text())
    with tempfile.TemporaryDirectory() as root:
        store = AnswerStore(root)
        try:
            user = store.register('eval@example.test', 'correct horse battery')
            group = store.create_group(user, 'Synthetic evaluation')
            store.processing(user, group, True, group_wide=True)
            store.processing(user, group, True)
            store.answer_processing(user, group, True, group_wide=True)
            store.answer_processing(user, group, True)
            store.daily_limit = 200  # Isolated evaluation, not the application limit.
            source = store.create_source(user, group, 'apple', 'Synthetic evaluation', {'start':'2020-01-01','end':'2030-01-01','albums':[],'types':['image']})
            store.set_source(user, source, True, 'authorized')
            ids = {}
            for index, fixture in enumerate(fixtures['fixtures']):
                image = io.BytesIO()
                Image.new('RGB', (10 + index, 10), (index * 10, 80, 120)).save(image, 'PNG')
                data = image.getvalue()
                resource = store.begin_resource(user, source, dict(item=str(index), component='photo', version='original', filename=f'{index}.png', date=fixture['date'], kind='image', albums=[]), len(data), hashlib.sha256(data).hexdigest())
                store.resource_chunk(user, resource['id'], 0, data)
                store.finish_resource(user, resource['id'])
                while store.work_once():
                    pass
                asset = store.db.execute('SELECT asset_id FROM archive_origins WHERE run_id=?', (resource['id'],)).fetchone()[0]
                ids[fixture['key']] = asset
                store.correct_asset(user, asset, title=fixture['title'], capture_date=fixture['date'], place=fixture['place'])
            supported = abstained = 0
            failures = []
            for case in fixtures['questions']:
                result = store.answer(user, group, case['question'])
                if case['expected'] is None:
                    correct = result['status'] == 'abstained' and not result['claims'] and not result['evidence']
                    abstained += int(correct)
                else:
                    expected = next(f for f in fixtures['fixtures'] if f['key'] == case['expected'])
                    correct = (result['status'] == 'supported' and len(result['evidence']) == 1 and
                               result['evidence'][0]['id'] == ids[case['expected']] and
                               result['evidence'][0]['date'] == expected['date'] and
                               result['evidence'][0]['title'] == expected['title'] and
                               result['claims'][0]['evidence_ids'] == [ids[case['expected']]])
                    supported += int(correct)
                if not correct:
                    failures.append(case['question'])
            return dict(scope='150 templated synthetic regression questions; not independent production acceptance',
                        answerable=100, supported=supported, unanswerable=50, correct_abstentions=abstained, failures=failures)
        finally:
            store.close()


if __name__ == '__main__':
    result = evaluate()
    print(json.dumps(result, indent=2))
    raise SystemExit(bool(result['failures']))
