"""Photo facts resolved from evidence already admitted by the archive reader."""
from datetime import datetime
from functools import lru_cache
import re

from mazi.imports.adapters import time_assertion

from mazi.places import cities, fold, label, lookup


def date_evidence(days=(), *, basis='unknown', status=None, timezone=None):
    valid = []
    for value in days:
        try:
            valid.append(datetime.fromisoformat(str(value).replace('Z', '+00:00')).date().isoformat())
        except (ValueError, TypeError):
            pass
    valid = sorted(set(valid))
    return dict(basis=basis if valid else 'unknown',
                status=status or ('conflict' if len(valid) > 1 else 'exact' if valid else 'unknown'),
                days=valid, start=valid[0] if valid else None,
                through=valid[-1] if valid else None, timezone=timezone if valid else None)


@lru_cache(maxsize=1)
def _city_names():
    result = {}
    for city in cities():
        result.setdefault((fold(city.name), city.country), []).append(city)
    return result


def _city_place(city):
    ambiguous = len({candidate.region for candidate in _city_names()[(fold(city.name), city.country)]}) > 1
    text = label(city) if ambiguous else f'{city.name}, {city.country}'
    pin = dict(name=city.name, country=city.country, latitude=city.latitude, longitude=city.longitude)
    if ambiguous:
        pin['region'] = city.region
    return dict(status='known', text=text, pin=pin)


def _source_city(row):
    candidates = _city_names().get((fold(row['city']), row['country']), [])
    matches = [city for city in candidates
               if abs(city.latitude - row['latitude']) < 1e-8 and abs(city.longitude - row['longitude']) < 1e-8]
    if matches:
        return lookup(label(matches[0])).get('city')
    if len({city.region for city in candidates}) > 1:
        return None
    return lookup(f"{row['city']}, {row['country']}").get('city')


def place_evidence(reviewed, places):
    if reviewed:
        match = lookup(reviewed)
        if match['status'] != 'matched':
            return dict(status='unmapped', text=reviewed, pin=None)
        return _city_place(match['city'])
    if not places:
        return dict(status='unknown', text=None, pin=None)
    resolved = [_source_city(row) for row in places]
    identities = {city.id if city else (fold(row['city']), row['country'], row['latitude'], row['longitude'])
                  for row, city in zip(places, resolved)}
    if len(identities) != 1:
        return dict(status='conflict', text=None, pin=None)
    if not resolved[0]:
        return dict(status='unmapped', text=f"{places[0]['city']}, {places[0]['country']}", pin=None)
    return _city_place(resolved[0])


def resolve_photo(dates, provenance, reviewed_place, places):
    capture = date_evidence(dates, basis='capture')
    shared = []
    seen = set()
    for item in provenance:
        assertion = item['sharedAt']
        key = (item['sender'], item['source'], *assertion.values())
        if key in seen or not (item['sender'] or assertion['raw'] is not None or assertion['local']):
            continue
        seen.add(key)
        local = assertion['local']
        utc = item['source'] == 'discord' and bool(local) and local.endswith(('+00:00', 'Z'))
        shared.append(date_evidence(
            [local] if local and not assertion['ambiguous'] else [], basis='shared',
            status='ambiguous' if assertion['ambiguous'] else None, timezone='UTC' if utc else None))
    reliable = sorted((item for item in shared if item['days']), key=lambda item: item['start'])
    chronology = capture if capture['days'] else reliable[0] if reliable else date_evidence(
        status='ambiguous' if any(item['status'] == 'ambiguous' for item in shared) else 'unknown')
    return dict(capture=capture, shared=shared, chronology=chronology,
                place=place_evidence(reviewed_place, places))


def origin_timestamps(origin):
    return [(origin.get('shared_at_assertion') or {}).get('raw'),
            *(message.get('shared_at') for message in origin.get('context', []))]


def sharing_provenance(origin, date_order=None):
    assertion = origin.get('shared_at_assertion') or {}
    if not assertion.get('local') and assertion.get('raw') is not None:
        resolved = time_assertion(assertion['raw'], date_order)
        assertion = {**assertion, 'local': resolved['local'], 'precision': resolved['precision']}
    raw = assertion.get('raw')
    parts = re.match(r'^(\d{1,2})[/.](\d{1,2})[/.]\d{2,4}\b', str(raw or '').strip())
    ambiguous = (not assertion.get('local') and parts is not None and
                 1 <= int(parts[1]) <= 12 and 1 <= int(parts[2]) <= 12 and int(parts[1]) != int(parts[2]))
    return dict(sender=(origin.get('sender') or {}).get('label') or None,
                source=origin.get('source_type') or 'archive', sharedAt=dict(
                    local=assertion.get('local') or None, raw=str(raw) if raw is not None else None,
                    precision=assertion.get('precision') or 'unknown', ambiguous=bool(ambiguous)))


def matches_dates(evidence, basis, start, through, legacy=None):
    if not start and not through:
        return True
    if not basis:
        return bool(legacy and (not start or legacy >= start) and (not through or legacy <= through))
    dates = evidence['shared'] if basis == 'shared' else [evidence[basis if basis == 'capture' else 'chronology']]
    for item in dates:
        if item['status'] in ('range', 'approximate'):
            if item['start'] and (not through or item['start'] <= through) and (not start or item['through'] >= start):
                return True
        elif any((not start or day >= start) and (not through or day <= through) for day in item['days']):
            return True
    return False
