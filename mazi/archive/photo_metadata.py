"""Photo facts resolved from evidence already admitted by the archive reader."""
from datetime import datetime
from functools import lru_cache

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
    for item in provenance:
        assertion = item['sharedAt']
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
