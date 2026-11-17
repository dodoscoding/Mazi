"""Deterministic sample provider. External AI is intentionally unavailable."""
from .contract import CHOICES, validate_chapter


class BadOutput(Exception):
    pass


class Unavailable(Exception):
    pass


def fake_chapter(request):
    depth = request['depth']
    seed = sum(ord(c) for c in (request['choice']['label'] if request['choice'] else request['origin']['whatIf']))
    return {'title': ('The door left open', 'A different rhythm', 'The unexpected invitation', 'A life made by hand')[depth],
            'year': (request['path'][-1]['year']+2 if request['path'] else request['origin']['startYear']),
            'narrative': ('This is a sample fictional chapter. A different decision opens a door to an unfamiliar routine. '
                          'You find a small room with a window facing a busy street. Each morning brings a chance to '
                          'practise something you once put off. A new colleague offers help, and you begin to feel less '
                          'like a visitor. The change has costs too: money is tighter, familiar friendships need more effort, '
                          'and some evenings feel uncertain. One afternoon, an invitation arrives. It could deepen the life '
                          'you are building, or pull you in another direction. There is no perfect answer, only another '
                          'choice and the time needed to discover what it means. This invented possibility is not a prediction.'),
            'location': 'A new city', 'career': 'Independent collaborator',
            'deltas': {'finances': seed % 15-7, 'relationships': 7-seed % 15, 'freedom': 6-depth*3, 'wellbeing': depth*3-4},
            'keyEvents': ['Found a new routine', 'Made an unfamiliar connection'],
            'twist': depth == 2 and request['origin']['tone'] != 'realistic',
            'choices': [{'label': 'Follow the opportunity', 'description': 'Invest time in a new project.'},
                        {'label': 'Build a quieter life', 'description': 'Protect your relationships and accept a slower pace.'},
                        {'label': 'Start somewhere new', 'description': 'Trade some stability for another beginning.'}][:CHOICES[depth]],
            'ending': {'title': request['choice']['label'] + ': a place to belong', 'epilogue': 'You made a home beside the doors you opened.'} if depth == 3 else None}


def generate(request, provider=fake_chapter):
    for _ in range(2):
        try:
            return validate_chapter(provider(request), request)
        except (ValueError, KeyError, TypeError):
            pass
        except (TimeoutError, OSError) as exc:
            raise Unavailable() from exc
    raise BadOutput()
