"""Authorized Atlas cards from the shared archive, without synthetic content."""
import json
from math import asin, cos, radians, sin, sqrt

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
    with store.transaction():
        store._member(user, group)
        items = {item['id']: item for item in store._timeline_items(user, group)}
        hidden_assets = set()
        for row in store.db.execute(
            'SELECT e.asset_ids FROM review_events e JOIN discovery_hidden_events h ON h.event=e.id WHERE h."user"=? AND e.group_id=?', (user, group)
        ):
            hidden_assets.update(json.loads(row[0]))
        cards, grouped = [], set()

        def card(identifier, title, assets, kind):
            records = [items[asset] for asset in assets]
            dates = sorted({item['date'] for item in records if item['date']})
            complete_dates = len([item for item in records if item['date']]) == len(records)
            date_label = 'Date not recorded'
            if dates:
                date_label = dates[0] if len(dates) == 1 else f'{dates[0]} to {dates[-1]}'
                if not complete_dates:
                    date_label += ' · some dates unknown'
            photos, messages, sources, places, shared = [], [], set(), [], set()
            seen_messages = set()
            for item in records:
                places.extend(store.db.execute(
                    'SELECT p.city,p.country,p.latitude,p.longitude FROM shared_places p '
                    'JOIN archive_origins o ON o.id=p.origin JOIN members m ON m.group_id=o.group_id AND m.user_id=o.owner_id '
                    'WHERE o.asset_id=? AND o.withdrawn=0', (item['id'],)))
                shared.update(row[0] for row in store.db.execute(
                    'SELECT p.display_name FROM archive_origins o JOIN members m ON m.group_id=o.group_id AND m.user_id=o.owner_id '
                    'JOIN shared_profiles p ON p.user_id=o.owner_id WHERE o.asset_id=? AND o.withdrawn=0', (item['id'],)))
                photos.append(dict(src='/api/review/rendition/' + item['id'],
                                   alt=item['title'] or 'Archive photograph',
                                   caption=item['title'] or 'Untitled photograph'))
                for origin in store._all_origins(user, item['id']):
                    sources.add(origin.get('source') or 'archive')
                    for message in origin.get('context', []):
                        value = message.get('text', '')
                        name = message.get('sender', {}).get('label') or 'Source participant'
                        when = str(message.get('shared_at') or '')
                        key = (name, when, value)
                        if value and key not in seen_messages:
                            seen_messages.add(key)
                            messages.append(dict(name=name, time=when, text=value))
            place = _place(places) if places else None
            people = dict(shared=sorted(shared),
                          conversation=sorted({message['name'] for message in messages} - {'Source participant'}))
            return dict(id=identifier, kind=kind, shortTitle=title, title=title,
                        date=date_label, year=int(dates[0][:4]) if dates and complete_dates else None,
                        approximate=not complete_dates, by='Your circle',
                        description='An approved shared memory.' if kind == 'memory' else 'A photograph from your shared archive.',
                        source=', '.join(sorted(sources)), photos=photos, messages=messages,
                        place=place, people=people,
                        dateBasis=', '.join(sorted({item['date_basis'] for item in records})))

        for event in store._approved(user, group):
            assets = event['assets']
            if assets and all(asset in items and asset not in hidden_assets for asset in assets):
                cards.append(card(event['id'], event['title'] or 'Untitled memory', assets, 'memory'))
                grouped.update(assets)
        for asset, item in items.items():
            if asset not in grouped and asset not in hidden_assets:
                cards.append(card('photo-' + asset, item['title'] or 'Untitled photograph', [asset], 'photo'))
        cards.sort(key=lambda item: (item['year'] or 0, item['date'], item['id']), reverse=True)
        return {'memories': cards}
