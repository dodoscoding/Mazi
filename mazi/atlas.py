"""Authorized Atlas cards from the shared archive, without synthetic content."""
import json
import time
from datetime import datetime, timezone

from mazi.identity.core import Denied
from mazi.capacity import CapacityExceeded
from mazi.social.visibility import authorize_photos
from mazi.archive.photo_context import SharingContext
from mazi.imports.adapters import date_orders, settle_date_order
from mazi.persistence import insertion_order
from mazi.places import fold, identify, km, label, lookup
from mazi.archive.photo_metadata import origin_timestamps, place_evidence, resolve_photo, sharing_provenance
from mazi.archive.photo_context import hidden_event_assets as _hidden_event_assets

SAME_PLACE_KM = 50
SELECTED_REQUEST_BYTES = 64 * 1024 * 1024
SELECTED_REQUEST_ORIGINS = 65536


def _place(rows):
    """One place only when every row names the same city within SAME_PLACE_KM."""
    if len({identify(row['city'], row['country']) or ('name', fold(row['city']), row['country']) for row in rows}) != 1:
        return None
    centre = (sum(row['latitude'] for row in rows) / len(rows),
              sum(row['longitude'] for row in rows) / len(rows))
    if any(km(centre, (row['latitude'], row['longitude'])) > SAME_PLACE_KM for row in rows):
        return None
    spellings = [row['city'] for row in rows]
    name = min(set(spellings), key=lambda city: (-spellings.count(city), city))
    return dict(name=name, country=rows[0]['country'], latitude=centre[0], longitude=centre[1])


def _export(row, origin):
    return row['run_id'], (origin.get('conversation') or {}).get('id')


def atlas_view(store, user, group):
    transaction = store.db.read_transaction() if getattr(store.db, "hosted", False) else store.transaction()
    with transaction:
        store._member(user, group)
        items = {item['id']: item for item in store._timeline_items(user, group)}
        return _project_cards(store, user, group, items, store._approved(user, group))


def _project_cards(store, user, group, items, events, *, selected=False, budget=None):
    hidden_assets = _hidden_event_assets(store, user, group)
    cards, grouped = [], set()

    consumers = {}
    details = []

    def card(identifier, title, assets, kind):
        records = [items[asset] for asset in assets]
        # Undated photos do not blank the others; conflicting evidence widens the range.
        dates = sorted({day for item in records for day in item['dates']})
        date_label = 'Date not recorded'
        if dates:
            date_label = dates[0] if len(dates) == 1 else f'{dates[0]} to {dates[-1]}'
        photos = [dict(src='/api/review/rendition/' + item['id'],
                       alt=item['title'] or 'Archive photograph',
                       caption=item['title'] or 'Untitled photograph', assetId=item['id']) for item in records]
        detail = dict(messages={}, sources=set(), places=[], shared=set(),
                      provenance=[{} for _ in records],
                      untitled={position for position, item in enumerate(records) if not item['title']})
        details.append(detail)
        for position, asset in enumerate(assets):
            consumers.setdefault(asset, []).append((detail, position))
        return dict(id=identifier, kind=kind, shortTitle=title, title=title,
                    date=date_label, year=int(dates[0][:4]) if dates else None,
                    approximate=not all(item['date'] for item in records), by='Your circle',
                    description='An approved shared memory.' if kind == 'memory' else 'A photograph from your shared archive.',
                    source='', photos=photos, messages=[],
                    place=None, people=dict(shared=[], conversation=[]),
                    dateBasis=', '.join(sorted({item['date_basis'] for item in records})))

    for event in events:
        assets = event['assets']
        if assets and all(asset in items and asset not in hidden_assets for asset in assets):
            cards.append(card(event['id'], event['title'] or 'Untitled memory', assets, 'memory'))
            grouped.update(assets)
    for asset, item in items.items():
        if asset not in grouped and asset not in hidden_assets:
            cards.append(card('photo-' + asset, item['title'] or 'Untitled photograph', [asset], 'photo'))
    joins = (' FROM archive_origins o JOIN archive_assets a ON a.id=o.asset_id AND a.group_id=o.group_id '
             'JOIN members m ON m.user_id=o.owner_id AND m.group_id=o.group_id '
             'JOIN members reader ON reader.group_id=o.group_id AND reader.user_id=? ')
    where = 'WHERE o.group_id=? AND o.withdrawn=0 '
    params = (user, group)
    if selected:
        where += ' AND o.asset_id IN (' + ','.join('?' for _ in items) + ') '
        params += tuple(items)
    context = SharingContext(store, user, group, budget.started, 2, consume=budget.consume) if selected else None
    origins = ('SELECT o.asset_id,o.run_id,o.payload,p.display_name' + joins +
               'LEFT JOIN shared_profiles p ON p.user_id=o.owner_id ' + where +
               'ORDER BY o.asset_id,' + insertion_order(store.db, 'o'))
    # One uploaded chat writes all its dates in one order; any of its timestamps can settle it.
    # Two streamed passes keep large payloads from accumulating.
    proven = {}
    if not selected:
        for row in store.db.execute(origins, params):
            if row['asset_id'] not in items or row['asset_id'] in hidden_assets:
                continue
            origin = json.loads(row['payload'])
            proven.setdefault(_export(row, origin), set()).update(date_orders(origin_timestamps(origin)))
    rows = store.db.execute(origins, params)
    for origin_position, row in enumerate(rows):
        targets = consumers.get(row['asset_id'])
        if not targets:
            continue
        origin = json.loads(row['payload'])
        evidence = context.provenance(row['run_id'], origin) if context else sharing_provenance(origin, settle_date_order(proven[_export(row, origin)]))
        sender, raw = evidence['sender'], evidence['sharedAt']['raw']
        evidence_key = (sender, evidence['source'], *evidence['sharedAt'].values())
        for detail, asset_position in targets:
            detail['sources'].add(evidence['source'])
            if sender or raw is not None or evidence['sharedAt']['local']:
                detail['provenance'][asset_position].setdefault(evidence_key, evidence)
            if row['display_name'] is not None:
                detail['shared'].add(row['display_name'])
            for message_position, message in enumerate(origin.get('context', [])):
                value = message.get('text', '')
                name = message.get('sender', {}).get('label') or 'Source participant'
                when = str(message.get('shared_at') or '')
                key = (name, when, value)
                if value:
                    position = (asset_position, origin_position, message_position)
                    previous = detail['messages'].get(key)
                    if previous is None or position < previous:
                        detail['messages'][key] = position
    # A city named in Review stands in for every source location of that photograph.
    reviewed = {}
    reviewed_text = {}
    annotation_query = "SELECT asset_id,place FROM review_annotations WHERE group_id=? AND place<>''"
    annotation_params = (group,)
    if selected:
        annotation_query += ' AND asset_id IN (' + ','.join('?' for _ in items) + ')'
        annotation_params += tuple(items)
    for row in store.db.execute(annotation_query, annotation_params):
        reviewed_text[row['asset_id']] = row['place']
        match = lookup(row['place']) if row['asset_id'] in consumers else {}
        if match.get('status') == 'matched':
            city = match['city']
            reviewed[row['asset_id']] = dict(city=city.name, country=city.country, latitude=city.latitude, longitude=city.longitude)
    for asset, row in reviewed.items():
        for detail, asset_position in consumers[asset]:
            detail['places'].append((asset_position, -1, row))
    places = store.db.execute(
        'SELECT o.asset_id,p.city,p.country,p.latitude,p.longitude' + joins +
        'JOIN shared_places p ON p.origin=o.id ' + where +
        'ORDER BY o.asset_id,' + insertion_order(store.db, 'o'), params)
    for place_position, row in enumerate(places):
        if row['asset_id'] in reviewed:
            continue
        for detail, asset_position in consumers.get(row['asset_id'], ()):
            detail['places'].append((asset_position, place_position, row))
    for result, detail in zip(cards, details):
        for position, photo in enumerate(result['photos']):
            asset = photo['assetId']
            evidence = list(detail['provenance'][position].values())
            if evidence:
                photo['provenance'] = evidence
            photo['evidence'] = resolve_photo(items[asset]['dates'], evidence, reviewed_text.get(asset),
                [entry[2] for entry in detail['places'] if entry[0] == position])
            names = sorted({item['sender'] for item in evidence if item['sender']})
            if names and position in detail['untitled']:
                title = 'Photo shared by ' + (
                    ' and '.join(names) if len(names) <= 2 else
                    ', '.join(names[:2]) + f' and {len(names) - 2} more')
                photo['caption'] = title
                photo['alt'] = title
                if result['kind'] == 'photo':
                    result['title'] = result['shortTitle'] = title
        result['source'] = ', '.join(sorted(detail['sources']))
        result['messages'] = [dict(name=key[0], time=key[1], text=key[2])
                              for key in sorted(detail['messages'], key=detail['messages'].get)]
        ordered_places = [entry[2] for entry in sorted(detail['places'])]
        result['place'] = _place(ordered_places) if ordered_places else None
        result['people'] = dict(shared=sorted(detail['shared']), conversation=sorted(
            {message['name'] for message in result['messages']} - {'Source participant'}))
    store._attach_photo_labels(group, [photo for card in cards for photo in card['photos']])
    cards.sort(key=lambda item: (item['year'] or 0, item['date'], item['id']), reverse=True)
    return {'memories': cards}


def _memory_assets(store, user, group, memory):
    """The photographs behind one Atlas card, rechecked exactly as atlas_view shows them."""
    visible = set(store._visible_ids(user, group))
    hidden = _hidden_event_assets(store, user, group)
    if memory.startswith('photo-'):
        assets = [memory[6:]]
        if assets[0] not in visible:
            raise Denied('Memory unavailable')
    else:
        assets = next((event['assets'] for event in store._approved(user, group) if event['id'] == memory), None)
        if not assets:
            raise Denied('Memory unavailable')
    if hidden.intersection(assets):
        raise Denied('Memory unavailable')
    return assets


def place_memory(store, user, group, memory, place):
    """Name the city of every photograph in one Atlas card; title, date and anniversary stay as they are.

    A single matching city is stored as its full label so it always resolves to the same pin.
    Empty text clears the place. Ambiguous or unknown text writes nothing and returns candidates.
    """
    if not all(isinstance(value, str) for value in (group, memory, place)) or not 0 < len(memory) <= 200 or len(place) > 200:
        raise ValueError('Invalid memory or place')
    match = lookup(place)
    city = match.get('city')
    write = {
        'matched': 'INSERT INTO review_annotations(place,actor_id,updated_at,asset_id,group_id) VALUES(?,?,?,?,?) '
                   'ON CONFLICT(asset_id) DO UPDATE SET place=excluded.place,actor_id=excluded.actor_id,updated_at=excluded.updated_at',
        # Clearing never creates an annotation, so it adds no annotation author to an untouched photograph.
        'empty': "UPDATE review_annotations SET place=?,actor_id=?,updated_at=? WHERE asset_id=? AND group_id=? AND place<>''",
    }.get(match['status'])
    with store.transaction():
        assets = _memory_assets(store, user, group, memory)
        if write:
            now = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
            for asset in assets:
                store.db.execute(write, (label(city) if city else '', user, now, asset, group))
            store._audit(user, 'atlas.place' if city else 'atlas.place.clear', memory)
    return {'place_match': match['status'], 'place': city and f'{city.name}, {city.country}',
            'candidates': [label(candidate) for candidate in match.get('candidates', [])],
            'pin': city and place_evidence(label(city), [])['pin']}


class _SelectedBudget:
    def __init__(self):
        self.started = time.perf_counter()
        self.bytes = self.origins = 0

    def consume(self, size):
        self.bytes += size
        self.origins += 1
        if size > 65536 or self.bytes > SELECTED_REQUEST_BYTES or self.origins > SELECTED_REQUEST_ORIGINS or time.perf_counter() - self.started > 2:
            raise CapacityExceeded('Selected memory exceeds the metadata read budget')


def _selected_items(store, user, group, assets, budget):
    result, after = {}, ('', '')
    size = 'octet_length(o.payload)' if getattr(store.db, 'hosted', False) else 'length(CAST(o.payload AS BLOB))'
    while True:
        rows = store.db.execute('SELECT a.id,o.id AS origin_id,' + size + ' AS payload_bytes,CASE WHEN ' + size + '<=65536 THEN o.payload ELSE NULL END AS payload,r.title,r.capture_date,r.place,r.anniversary '
            'FROM archive_assets a JOIN archive_origins o ON o.asset_id=a.id AND o.group_id=a.group_id '
            'JOIN members owner ON owner.group_id=o.group_id AND owner.user_id=o.owner_id '
            'LEFT JOIN review_annotations r ON r.asset_id=a.id WHERE a.group_id=? AND o.withdrawn=0 AND a.id IN (' + ','.join('?' for _ in assets) + ') '
            'AND (a.id>? OR (a.id=? AND o.id>?)) ORDER BY a.id,o.id LIMIT 256', (group, *assets, after[0], after[0], after[1])).fetchall()
        if not rows:
            break
        for row in rows:
            budget.consume(row['payload_bytes'])
            item = result.setdefault(row['id'], dict(id=row['id'], title=row['title'] or '', dates=set(), cities=set(),
                annotation=row, origin_count=0, metadata_bytes=0))
            item['origin_count'] += 1
            item['metadata_bytes'] += row['payload_bytes']
            if item['origin_count'] > 8192 or item['metadata_bytes'] > 8 * 1024 * 1024:
                raise CapacityExceeded('Selected photograph exceeds the metadata read budget')
            dates, cities = store._date_place_evidence(row['id'], json.loads(row['payload']), row)
            item['dates'].update(dates)
            item['cities'].update(cities)
        after = rows[-1]['id'], rows[-1]['origin_id']
    for item in result.values():
        dates, cities, annotation = item['dates'], item.pop('cities'), item.pop('annotation')
        day = next(iter(dates)) if len(dates) == 1 else None
        item.update(date=day, dates=sorted(dates), place=next(iter(cities)) if len(cities) == 1 else None,
            date_basis='reviewed correction' if annotation['capture_date'] else 'conflicting source evidence' if len(dates) > 1 else 'source capture evidence' if day else 'undated',
            anniversary=bool(annotation['anniversary']))
    return result


def _selected_memory(store, user, group, memory):
    if not isinstance(memory, str) or not 0 < len(memory) <= 200:
        raise ValueError('Invalid memory')
    events = []
    if memory.startswith('photo-'):
        assets = [memory[6:]]
    else:
        row = store.db.execute("SELECT id,title,asset_ids FROM review_events WHERE id=? AND group_id=? AND status='accepted'", (memory, group)).fetchone()
        if row is None:
            raise Denied('Memory unavailable')
        assets = json.loads(row['asset_ids'])
        if not assets or len(assets) > 100:
            raise CapacityExceeded('Selected memory supports at most 100 photographs')
        events = [dict(id=row['id'], title=row['title'], assets=assets)]
    authorize_photos(store, user, group, assets)
    budget = _SelectedBudget()
    items = _selected_items(store, user, group, assets, budget)
    if set(items) != set(assets):
        raise Denied('Memory unavailable')
    cards = _project_cards(store, user, group, items, events, selected=True, budget=budget)['memories']
    return next((card for card in cards if card['id'] == memory), None)


def memory_view(store, user, group, memory):
    transaction = store.db.read_transaction() if getattr(store.db, 'hosted', False) else store.transaction()
    with transaction:
        store._member(user, group)
        selected = _selected_memory(store, user, group, memory)
        if selected is None:
            raise Denied('Memory unavailable')
        return dict(memory=selected)
