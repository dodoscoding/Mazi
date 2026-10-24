"""Offline city matching against the bundled Natural Earth populated places."""
import json
import math
import unicodedata
from collections import namedtuple
from functools import lru_cache
from pathlib import Path

City = namedtuple('City', 'id name country region latitude longitude population')
CITIES = Path(__file__).parent / 'sources' / 'cities.json'
KM_PER_DEGREE = 111.2


def km(a, b):
    lat1, lon1, lat2, lon2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 12742 * math.asin(math.sqrt(h))


def fold(text):
    """Case- and accent-insensitive key; Turkish dotted and dotless i both become i."""
    decomposed = unicodedata.normalize('NFKD', text.casefold().replace('ı', 'i'))
    return ' '.join(''.join(c for c in decomposed if not unicodedata.combining(c)).split())


@lru_cache(maxsize=1)
def _gazetteer():
    data = json.loads(CITIES.read_text(encoding='utf-8'))
    found, names, grid = [], {}, {}
    for index, values in enumerate(data['places']):
        row = dict(zip(data['fields'], values))
        city = City(index, row['name'], row['country'], row['region'], row['latitude'], row['longitude'], row['population'])
        found.append(city)
        for key in {fold(name) for name in (row['name'], row['ascii'], row['turkish']) if name}:
            names.setdefault(key, []).append(city)
        grid.setdefault((math.floor(city.latitude), math.floor(city.longitude)), []).append(city)
    return found, names, grid


def cities():
    return _gazetteer()[0]


def label(city):
    return ', '.join(part for part in (city.name, city.region, city.country) if part)


def _degrees(value, ref, hemispheres):
    parts = [float(part) for part in str(value).strip('() ').split(',')]
    ref = str(ref).strip('\x00 ').upper()
    if not 1 <= len(parts) <= 3 or ref not in hemispheres or not all(math.isfinite(p) and p >= 0 for p in parts):
        raise ValueError('Malformed GPS coordinate')
    degrees = sum(part / 60 ** power for power, part in enumerate(parts))
    return -degrees if ref == hemispheres[1] else degrees


def gps_degrees(raw):
    """Decimal degrees from PIL's stringified GPS IFD, or None for malformed values and the (0,0) null fix."""
    try:
        latitude, longitude = _degrees(raw['2'], raw['1'], ('N', 'S')), _degrees(raw['4'], raw['3'], ('E', 'W'))
    except (KeyError, TypeError, ValueError):
        return None
    if latitude > 90 or longitude > 180 or (latitude, longitude) == (0, 0):
        return None
    return latitude, longitude


def nearest(latitude, longitude, limit_km=100):
    grid = _gazetteer()[2]
    rows = math.ceil(limit_km / KM_PER_DEGREE)
    # Degrees of longitude shrink towards the poles; size the search for the band's poleward edge.
    poleward = math.cos(math.radians(min(89.0, abs(latitude) + rows + 1)))
    columns = min(180, math.ceil(limit_km / (KM_PER_DEGREE * poleward)))
    row, column = math.floor(latitude), math.floor(longitude)
    best, best_km = None, limit_km
    for r in range(row - rows, row + rows + 1):
        for c in range(column - columns, column + columns + 1):
            for city in grid.get((r, (c + 180) % 360 - 180), ()):
                distance = km((latitude, longitude), (city.latitude, city.longitude))
                if distance <= best_km:
                    best, best_km = city, distance
    return best


def lookup(text):
    """Match typed place text; accepts 'City', 'City, CC' and 'City, Region, CC'."""
    if not isinstance(text, str) or not text.strip():
        return {'status': 'empty'}
    parts = [part.strip() for part in text.split(',')]
    country = parts.pop().upper() if len(parts) > 1 and len(parts[-1]) == 2 and parts[-1].isascii() and parts[-1].isalpha() else None
    region = fold(', '.join(parts[1:]))
    matches = [city for city in _gazetteer()[1].get(fold(parts[0]), ()) if country in (None, city.country)]
    # An unrecognised middle part (often a country name) narrows nothing rather than hiding every match.
    if region:
        matches = [city for city in matches if fold(city.region) == region] or matches
        # A full label names the city itself, not another city whose alternative name matches.
        matches = [city for city in matches if fold(city.name) == fold(parts[0])] or matches
    matches.sort(key=lambda city: (-city.population, city.id))
    # Natural Earth lists a few cities twice a few kilometres apart; the same name, region and country is one place.
    seen = set()
    matches = [city for city in matches if (key := (city.name, city.region, city.country)) not in seen and not seen.add(key)]
    if not matches:
        return {'status': 'missing'}
    if len(matches) == 1 or matches[0].population >= 10 * max(matches[1].population, 1):
        return {'status': 'matched', 'city': matches[0]}
    return {'status': 'ambiguous', 'candidates': matches[:5]}


def identify(city, country):
    found = [match for match in _gazetteer()[1].get(fold(city), ()) if match.country == country]
    return min(found, key=lambda match: (-match.population, match.id)).id if found else None
