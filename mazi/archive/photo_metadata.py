"""Photo facts resolved from evidence already admitted by the archive reader."""
from datetime import datetime

from mazi.places import identify, lookup


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


def place_evidence(reviewed, places):
    if reviewed:
        match = lookup(reviewed)
        if match['status'] != 'matched':
            return dict(status='unmapped', text=reviewed, pin=None)
        city = match['city']
        return dict(status='known', text=f'{city.name}, {city.country}', pin=dict(
            name=city.name, country=city.country, latitude=city.latitude, longitude=city.longitude))
    if not places:
        return dict(status='unknown', text=None, pin=None)
    cities = {identify(row['city'], row['country']) or (row['city'].casefold(), row['country']) for row in places}
    if len(cities) != 1:
        return dict(status='conflict', text=None, pin=None)
    match = lookup(f"{places[0]['city']}, {places[0]['country']}")
    if match['status'] != 'matched':
        return dict(status='unmapped', text=f"{places[0]['city']}, {places[0]['country']}", pin=None)
    city = match['city']
    return dict(status='known', text=f'{city.name}, {city.country}', pin=dict(
        name=city.name, country=city.country, latitude=city.latitude, longitude=city.longitude))


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
