"""No-cost structural evaluation of the sample provider, never a paid invocation."""
import json
from pathlib import Path
from .contract import validate_request
from .provider import generate


def evaluate():
    scenarios = json.loads((Path(__file__).resolve().parents[2] / 'tests/backend/parallel/scenarios.json').read_text())
    chapters = 0
    for origin in scenarios:
        request = {'origin': origin, 'path': [], 'state': dict(location='A city', career='Student',
                   finances=50, relationships=50, freedom=50, wellbeing=50), 'choice': None, 'depth': 0}
        for depth in range(4):
            request['depth'] = depth
            output = generate(validate_request(request))
            chapters += 1
            if depth < 3:
                selected = output['choices'][depth % len(output['choices'])]
                request['path'].append({'title': output['title'], 'year': output['year'],
                                        'choice': selected['label'], 'keyEvents': output['keyEvents']})
                request['choice'] = selected
                request['state'] = dict(output['state'], location=output['location'], career=output['career'])
    return {'provider': 'fake', 'scenarios': len(scenarios), 'chapters': chapters,
            'result': 'pass', 'scope': 'Structural validation only; sample text is English. Live language and writing quality are not evaluated.'}


if __name__ == '__main__':
    print(json.dumps(evaluate(), indent=2))
