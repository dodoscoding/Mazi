"""Derive cities.json from Natural Earth's 1:10m populated places (public domain).

python -m mazi.sources.build_cities ne_10m_populated_places.geojson
"""
import json
import sys
from pathlib import Path

CITIES = Path(__file__).parent / 'cities.json'
FIELDS = ['name', 'ascii', 'turkish', 'country', 'region', 'latitude', 'longitude', 'population']
# Natural Earth leaves ISO_A2 at -99 for these; shared places need an ISO 3166 code.
ISO_FALLBACK = {'CYN': 'CY', 'KOS': 'XK', 'SOL': 'SO'}


def rows(data):
    for feature in data['features']:
        p = feature['properties']
        country = ISO_FALLBACK.get(p.get('ADM0_A3'), p.get('ISO_A2') or '')
        if len(country) != 2 or not country.isalpha():
            continue
        name = p.get('NAME_EN') or p['NAME']
        turkish = p.get('NAME_TR') or ''
        yield [name, p.get('NAMEASCII') or '', '' if turkish == name else turkish, country.upper(),
               p.get('ADM1NAME') or '', round(p['LATITUDE'], 4), round(p['LONGITUDE'], 4), int(p.get('POP_MAX') or 0)]


def main(source):
    places = sorted(rows(json.loads(Path(source).read_text())), key=lambda row: (row[3], row[0], -row[7]))
    CITIES.write_text(json.dumps(dict(source='Natural Earth 1:10m populated places', fields=FIELDS, places=places),
                                 ensure_ascii=False, separators=(',', ':')) + '\n')
    print(len(places), CITIES.stat().st_size)


if __name__ == '__main__':
    main(sys.argv[1])
