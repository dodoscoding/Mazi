"""One same-photo predicate for archive photo surfaces."""
import json
from collections import Counter
from mazi.archive.photo_metadata import matches_dates
from mazi.social.labels import DIMENSIONS, _people_query


def values(raw, allowed=None):
    if not isinstance(raw, str) or len(raw) > 10000:
        raise ValueError('Invalid photo filter')
    if not raw:
        return set()
    parts = json.loads(raw) if raw.startswith('[') else raw.split(',')
    if not isinstance(parts, list) or not 1 <= len(parts) <= 50 or any(not isinstance(value, str) or not value or len(value) > 200 for value in parts):
        raise ValueError('Invalid photo filter')
    result = set(parts)
    if allowed is not None and not result <= set(allowed):
        raise ValueError('Invalid photo filter value')
    return result


class PhotoFilter:
    def __init__(self, store, user, group, *, person='', people_present='', screenshot='', ai='', source='', shared_by='', place='', country='', start='', end='', date_basis='', years='', places='', uncertain=''):
        self.labels = {key: values(raw, DIMENSIONS[key]) for key, raw in dict(people_present=people_present, screenshot=screenshot, ai=ai).items()}
        self.person = values(person)
        self.source = values(source)
        if not isinstance(shared_by, str) or len(shared_by) > 10000 or (not shared_by.startswith('[') and len(shared_by) > 200):
            raise ValueError('Invalid sharer filter')
        self.sharers = values(shared_by) if shared_by.startswith('[') else ({shared_by} if shared_by else set())
        self.places = values(places)
        self.years = values(years)
        if any(not year.isdigit() or not 1 <= int(year) <= 9999 for year in self.years) or uncertain not in ('', 'true'):
            raise ValueError('Invalid photo date filter')
        self.place, self.country, self.start, self.end, self.date_basis, self.uncertain = place, country, start, end, date_basis, uncertain
        self.facts, self.people, self.names = {}, {}, {}
        visible = store._correction_visible_ids(user, group)
        photos = [dict(assetId=asset) for asset in visible]
        store._attach_photo_labels(group, photos)
        self.facts = {photo['assetId']: photo.get('labels', {}) for photo in photos}
        for offset in range(0, len(photos), 10000):
            page = [photo['assetId'] for photo in photos[offset:offset + 10000]]
            for row in store.db.execute(_people_query(page, 'DISTINCT t.asset,p.id,p.name'), (group, *page)):
                self.people.setdefault(row['asset'], set()).add(row['id'])
                self.names[row['id']] = row['name']
                self.facts[row['asset']]['people_present'] = 'yes'
        self.counts = {key: Counter() for key in (*DIMENSIONS, 'person', 'years', 'places')}
        self.denominator = 0

    @staticmethod
    def photo_years(doc):
        evidence = doc['evidence']['chronology']
        if evidence['status'] in ('range', 'approximate') and evidence.get('start') and evidence.get('through'):
            return {str(year) for year in range(int(evidence['start'][:4]), int(evidence['through'][:4]) + 1)}
        return {day[:4] for day in evidence['days']}

    def count(self, doc):
        self.denominator += 1
        for dimension in DIMENSIONS:
            self.counts[dimension][self.facts.get(doc['id'], {}).get(dimension, 'unknown')] += 1
        self.counts['person'].update(self.people.get(doc['id'], set()))
        self.counts['years'].update(self.photo_years(doc))
        self.counts['places'].update(set(doc['cities']))

    def matches(self, doc):
        asset = doc['id']
        if asset not in self.facts:
            return False
        if self.person and not self.person.intersection(self.people.get(asset, set())):
            return False
        if any(selected and self.facts[asset].get(key, 'unknown') not in selected for key, selected in self.labels.items()):
            return False
        if self.source and not self.source.intersection(doc['sources']) or self.sharers and not self.sharers.intersection(doc['shared_by']):
            return False
        if self.place and not any(self.place.casefold() in text.casefold() for text in doc['cities']) or self.places and not self.places.intersection(doc['cities']):
            return False
        if self.country and self.country.upper() not in doc['countries']:
            return False
        if self.years and not self.years.intersection(self.photo_years(doc)):
            return False
        if self.uncertain and doc['evidence']['chronology']['status'] == 'exact':
            return False
        return matches_dates(doc['evidence'], self.date_basis, self.start, self.end, doc['date'])

    def facets(self):
        return dict(denominator=self.denominator, denominator_basis='all currently visible photographs',
                    **{key: [dict(value=value, count=count, **({'name': self.names[value]} if key == 'person' else {})) for value, count in sorted(counts.items())] for key, counts in self.counts.items()})
