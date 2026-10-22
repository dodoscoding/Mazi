"""Authorized Atlas cards from the shared archive, without synthetic content."""
import json
from math import asin, cos, radians, sin, sqrt

from mazi.persistence import insertion_order

SAME_PLACE_KM = 50


def _km(a, b):
    lat1, lon1, lat2, lon2 = map(radians, (a[0], a[1], b[0], b[1]))
    h = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
    return 12742 * asin(sqrt(h))


def _place(rows):
    """One place only when every row names the same city within SAME_PLACE_KM."""
    if len({(row['city'].casefold(), row['country']) for row in rows}) != 1:
        return None
    centre = (sum(row['latitude'] for row in rows) / len(rows),
              sum(row['longitude'] for row in rows) / len(rows))
    if any(_km(centre, (row['latitude'], row['longitude'])) > SAME_PLACE_KM for row in rows):
        return None
    spellings = [row['city'] for row in rows]
    name = min(set(spellings), key=lambda city: (-spellings.count(city), city))
    return dict(name=name, country=rows[0]['country'], latitude=centre[0], longitude=centre[1])


def atlas_view(store, user, group):
    transaction = store.db.read_transaction() if getattr(store.db, "hosted", False) else store.transaction()
    with transaction:
        store._member(user, group)
        items = {item['id']: item for item in store._timeline_items(user, group)}
        hidden_assets = set()
        for row in store.db.execute(
            'SELECT e.asset_ids FROM review_events e JOIN discovery_hidden_events h ON h.event=e.id WHERE h."user"=? AND e.group_id=?', (user, group)
        ):
            hidden_assets.update(json.loads(row[0]))
        cards, grouped = [], set()

        # Card membership is compact; payloads are decoded one at a time below.
        consumers = {}
        details = []

        def card(identifier, title, assets, kind):
            records = [items[asset] for asset in assets]
            dates = sorted({item['date'] for item in records if item['date']})
            complete_dates = len([item for item in records if item['date']]) == len(records)
            date_label = 'Date not recorded'
            if dates:
                date_label = dates[0] if len(dates) == 1 else f'{dates[0]} to {dates[-1]}'
                if not complete_dates:
                    date_label += ' · some dates unknown'
            photos = [dict(src='/api/review/rendition/' + item['id'],
                           alt=item['title'] or 'Archive photograph',
                           caption=item['title'] or 'Untitled photograph') for item in records]
            detail = dict(messages={}, sources=set(), places=[], shared=set())
            details.append(detail)
            for position, asset in enumerate(assets):
                consumers.setdefault(asset, []).append((detail, position))
            return dict(id=identifier, kind=kind, shortTitle=title, title=title,
                        date=date_label, year=int(dates[0][:4]) if dates and complete_dates else None,
                        approximate=not complete_dates, by='Your circle',
                        description='An approved shared memory.' if kind == 'memory' else 'A photograph from your shared archive.',
                        source='', photos=photos, messages=[],
                        place=None, people=dict(shared=[], conversation=[]),
                        dateBasis=', '.join(sorted({item['date_basis'] for item in records})))

        for event in store._approved(user, group):
            assets = event['assets']
            if assets and all(asset in items and asset not in hidden_assets for asset in assets):
                cards.append(card(event['id'], event['title'] or 'Untitled memory', assets, 'memory'))
                grouped.update(assets)
        for asset, item in items.items():
            if asset not in grouped and asset not in hidden_assets:
                cards.append(card('photo-' + asset, item['title'] or 'Untitled photograph', [asset], 'photo'))
        # Two group-scoped streams replace the three lookups per represented photo.
        # Keep the policy transaction around both reads and all card assembly.
        joins = (' FROM archive_origins o JOIN archive_assets a ON a.id=o.asset_id AND a.group_id=o.group_id '
                 'JOIN members m ON m.user_id=o.owner_id AND m.group_id=o.group_id '
                 'JOIN members reader ON reader.group_id=o.group_id AND reader.user_id=? ')
        where = 'WHERE o.group_id=? AND o.withdrawn=0 '
        rows = store.db.execute(
            'SELECT o.asset_id,o.payload,p.display_name' + joins +
            'LEFT JOIN shared_profiles p ON p.user_id=o.owner_id ' + where +
            'ORDER BY o.asset_id,' + insertion_order(store.db, 'o'), (user, group))
        for origin_position, row in enumerate(rows):
            targets = consumers.get(row['asset_id'])
            if not targets:
                continue
            origin = json.loads(row['payload'])
            for detail, asset_position in targets:
                detail['sources'].add(origin.get('source') or 'archive')
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
        places = store.db.execute(
            'SELECT o.asset_id,p.city,p.country,p.latitude,p.longitude' + joins +
            'JOIN shared_places p ON p.origin=o.id ' + where +
            'ORDER BY o.asset_id,' + insertion_order(store.db, 'o'), (user, group))
        for place_position, row in enumerate(places):
            for detail, asset_position in consumers.get(row['asset_id'], ()):
                detail['places'].append((asset_position, place_position, row))
        for result, detail in zip(cards, details):
            result['source'] = ', '.join(sorted(detail['sources']))
            result['messages'] = [dict(name=key[0], time=key[1], text=key[2])
                                  for key in sorted(detail['messages'], key=detail['messages'].get)]
            ordered_places = [entry[2] for entry in sorted(detail['places'])]
            result['place'] = _place(ordered_places) if ordered_places else None
            result['people'] = dict(shared=sorted(detail['shared']), conversation=sorted(
                {message['name'] for message in result['messages']} - {'Source participant'}))
        cards.sort(key=lambda item: (item['year'] or 0, item['date'], item['id']), reverse=True)
        return {'memories': cards}
