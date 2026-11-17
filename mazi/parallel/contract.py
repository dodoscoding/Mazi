"""Bounded plain-JSON contracts for the disabled-by-default sample engine."""
import math
import re
import unicodedata

METERS = ('finances', 'relationships', 'freedom', 'wellbeing')
CHOICES = (3, 2, 2, 0)


class Declined(ValueError):
    pass


def text(value, limit):
    if not isinstance(value, str) or len(value) > limit:
        raise ValueError('Invalid text length')
    value = ''.join(c for c in value if unicodedata.category(c) != 'Cc').strip()
    if not value:
        raise ValueError('Text required')
    return value


def integer(value, low, high):
    if type(value) is not int or not low <= value <= high:
        raise ValueError('Invalid number')
    return value


def choice(value):
    if not isinstance(value, dict):
        raise ValueError('Choice required')
    return {'label': text(value.get('label'), 80), 'description': text(value.get('description'), 200)}


def events(value):
    if not isinstance(value, list) or not 1 <= len(value) <= 3:
        raise ValueError('One to three events required')
    return [text(e, 200) for e in value]


def validate_request(value):
    if not isinstance(value, dict):
        raise ValueError('Object required')
    depth = integer(value.get('depth'), 0, 3)
    origin = value.get('origin')
    state = value.get('state')
    path = value.get('path')
    if not isinstance(origin, dict) or not isinstance(state, dict) or not isinstance(path, list) or len(path) != depth:
        raise ValueError('Invalid story context')
    tone = origin.get('tone')
    if tone not in ('realistic', 'cinematic', 'chaotic'):
        raise ValueError('Invalid tone')
    clean_origin = {'about': text(origin.get('about'), 280), 'whatIf': text(origin.get('whatIf'), 280),
                    'startYear': integer(origin.get('startYear'), 1900, 2100), 'tone': tone}
    clean_path = []
    year = clean_origin['startYear']
    for entry in path:
        if not isinstance(entry, dict):
            raise ValueError('Invalid path')
        year = integer(entry.get('year'), year, year+6)
        clean_path.append({'title': text(entry.get('title'), 120), 'year': year,
                           'choice': text(entry.get('choice'), 80), 'keyEvents': events(entry.get('keyEvents'))})
    clean_choice = choice(value.get('choice')) if depth else None
    if not depth and value.get('choice') is not None:
        raise ValueError('Root has no choice')
    clean_state = {m: integer(state.get(m), 0, 100) for m in METERS}
    clean_state.update(location=text(state.get('location'), 120), career=text(state.get('career'), 120))
    result = {'origin': clean_origin, 'path': clean_path, 'state': clean_state, 'choice': clean_choice, 'depth': depth}
    # Deliberately conservative fallback, not a claim of comprehensive safety detection.
    def raw_strings(item):
        if isinstance(item, str):
            yield item
        elif isinstance(item, dict):
            for child in item.values():
                yield from raw_strings(child)
        elif isinstance(item, list):
            for child in item:
                yield from raw_strings(child)
    raw = unicodedata.normalize('NFKC', ' '.join(raw_strings(value))).casefold()
    # Preserve word boundaries before removing controls; ignore invisible format marks.
    raw = ''.join(' ' if c.isspace() else c for c in raw)
    raw = ''.join(c for c in raw if unicodedata.category(c) not in ('Cc', 'Cf'))
    sensitive = ' '.join(raw.split())
    if re.search(r'\b(suicid\w*|self[ -]?harm\w*|kill myself|end my life|intihar\w*|kendimi öldür\w*)\b', sensitive):
        raise Declined('This story cannot continue. If this connects to how you feel, consider reaching out to someone you trust or local emergency support if you are in immediate danger.')
    return result


def validate_chapter(value, request):
    if not isinstance(value, dict):
        raise ValueError('Chapter required')
    narrative = text(value.get('narrative'), 4000)
    if not 80 <= len(narrative.split()) <= 260:
        raise ValueError('Invalid narrative length')
    previous_year = request['path'][-1]['year'] if request['path'] else request['origin']['startYear']
    year = integer(value.get('year'), previous_year, previous_year+6)
    deltas = value.get('deltas')
    if not isinstance(deltas, dict):
        raise ValueError('Changes required')
    clamped = {}
    for meter in METERS:
        n = deltas.get(meter)
        if type(n) not in (int, float) or not math.isfinite(n):
            raise ValueError('Invalid change')
        clamped[meter] = max(-15, min(15, round(n)))
    choices = value.get('choices')
    if not isinstance(choices, list) or len(choices) != CHOICES[request['depth']]:
        raise ValueError('Wrong choice count')
    ending = value.get('ending')
    if request['depth'] == 3:
        if not isinstance(ending, dict):
            raise ValueError('Ending required')
        ending = {'title': text(ending.get('title'), 120), 'epilogue': text(ending.get('epilogue'), 280)}
    elif ending is not None:
        raise ValueError('Unexpected ending')
    if type(value.get('twist')) is not bool:
        raise ValueError('Invalid twist')
    return {'title': text(value.get('title'), 120), 'year': year, 'narrative': narrative,
            'location': text(value.get('location'), 120), 'career': text(value.get('career'), 120),
            'state': {m: max(0, min(100, request['state'][m]+clamped[m])) for m in METERS},
            'deltas': clamped, 'keyEvents': events(value.get('keyEvents')), 'choices': [choice(c) for c in choices],
            'ending': ending, 'twist': value['twist']}
