"""Versioned member declarations on currently visible photographs."""
import itertools
import time
import uuid

from mazi.archive.export import ExportArray
from mazi.identity.core import Conflict, Denied
from . import social
from .visibility import authorize_photos

DIMENSIONS = {
    'people_present': ('yes', 'no', 'unknown'),
    'screenshot': ('yes', 'no', 'unknown'),
    'ai': ('generated', 'edited', 'none-declared', 'unknown'),
}


def _assets(values):
    if not isinstance(values, list) or not 1 <= len(values) <= 50:
        raise ValueError('Choose between one and fifty photographs')
    assets = [social._id(value) for value in values]
    if len(set(assets)) != len(assets):
        raise ValueError('Choose unique photographs')
    return assets


def _versions(store, group, assets):
    slots = ','.join('?' for _ in assets)
    return {(row['asset_id'], row['dimension']): row['revision'] for row in store.db.execute(
        'SELECT asset_id,dimension,revision FROM photo_label_versions WHERE group_id=? AND asset_id IN (' + slots + ')', (group, *assets))}


def _people_query(assets, columns, *, include_suppressed=False):
    slots = ','.join('?' for _ in assets)
    query = ('SELECT ' + columns + ' FROM discovery_tags t JOIN discovery_people p ON p.id=t.person '
             'JOIN members m ON m.group_id=p.group_id AND m.user_id=t.actor WHERE p.group_id=? AND t.asset IN (' + slots + ') '
             'AND (p.account IS NULL OR EXISTS(SELECT 1 FROM members subject WHERE subject.group_id=p.group_id AND subject.user_id=p.account))')
    if not include_suppressed:
        query += ' AND NOT EXISTS(SELECT 1 FROM discovery_suppressions s WHERE s.person=t.person AND s.asset=t.asset)'
    return query


def _people(store, group, assets, *, include_suppressed=False):
    query = _people_query(assets, 't.asset,p.id,p.name,p.account', include_suppressed=include_suppressed) + ' ORDER BY p.name,p.id'
    people = {asset: [] for asset in assets}
    for row in store.db.execute(query, (group, *assets)):
        people[row['asset']].append(dict(id=row['id'], name=row['name'], verified=row['account'] is not None))
    return people


def _projection(store, group, assets):
    versions = _versions(store, group, assets)
    slots = ','.join('?' for _ in assets)
    rows = {(row['asset_id'], row['dimension']): row for row in store.db.execute(
        'SELECT l.*,m.user_id AS active_actor,sp.display_name FROM photo_labels l '
        'LEFT JOIN members m ON m.group_id=l.group_id AND m.user_id=l.actor_id '
        'LEFT JOIN shared_profiles sp ON sp.user_id=m.user_id WHERE l.group_id=? AND l.asset_id IN (' + slots + ')', (group, *assets))}
    people = _people(store, group, assets)
    result = []
    for asset in assets:
        values = {}
        for dimension in DIMENSIONS:
            revision = versions.get((asset, dimension), 0)
            row = rows.get((asset, dimension))
            current = row is not None and row['revision'] == revision and (row['active_actor'] is not None or (row['actor_id'] is None and row['value'] == 'unknown' and row['method'] is None))
            declared = row['value'] if current else 'unknown'
            value = 'yes' if dimension == 'people_present' and people[asset] else declared
            values[dimension] = dict(value=value, declared=declared, revision=revision,
                method=row['method'] if current else None,
                actor=dict(id=row['actor_id'], name=row['display_name'] or 'Grup üyesi') if current and row['active_actor'] is not None else None,
                updated_at=row['updated_at'] if current else None)
        result.append(dict(assetId=asset, people=people[asset], labels=values))
    return result


def read_labels(store, user, group, assets):
    assets = _assets(assets)
    with store.transaction():
        authorize_photos(store, user, group, assets)
        return dict(items=_projection(store, group, assets))


def _items(values):
    if not isinstance(values, list) or not 1 <= len(values) <= 50:
        raise ValueError('Choose between one and fifty photographs')
    result = []
    for item in values:
        if not isinstance(item, dict) or set(item) != {'asset', 'changes', 'expected'}:
            raise ValueError('Invalid label changes')
        changes, expected = item['changes'], item['expected']
        if not isinstance(changes, dict) or not changes or not isinstance(expected, dict) or set(changes) != set(expected):
            raise ValueError('Supply the version of each changed dimension')
        for dimension, value in changes.items():
            if dimension not in DIMENSIONS or value not in DIMENSIONS[dimension]:
                raise ValueError('Invalid label value')
            if type(expected[dimension]) is not int or expected[dimension] < 0:
                raise ValueError('Invalid label revision')
        result.append(dict(asset=social._id(item['asset']), changes=changes, expected=expected))
    _assets([item['asset'] for item in result])
    return result


def set_labels(store, user, group, request_key, items):
    items = _items(items)
    assets = [item['asset'] for item in items]
    with store.transaction():
        authorize_photos(store, user, group, assets)
        payload = sorted(items, key=lambda item: item['asset'])
        key, digest, receipt = social._receipt(store, user, group, request_key, 'labels.set', payload)
        if receipt:
            return dict(items=_projection(store, group, assets))
        versions = _versions(store, group, assets)
        tagged = _people(store, group, assets, include_suppressed=True)
        for item in items:
            for dimension, revision in item['expected'].items():
                if versions.get((item['asset'], dimension), 0) != revision:
                    raise Conflict('Labels changed; reload the current photographs')
            if item['changes'].get('people_present') == 'no' and tagged[item['asset']]:
                raise Conflict('An approved person association prevents this declaration')
        now = time.time()
        for item in items:
            for dimension, value in item['changes'].items():
                revision = item['expected'][dimension]
                if revision == 0:
                    store.db.execute('INSERT INTO photo_label_versions VALUES(?,?,?,?)', (group, item['asset'], dimension, 1))
                else:
                    changed = store.db.execute('UPDATE photo_label_versions SET revision=revision+1 WHERE group_id=? AND asset_id=? AND dimension=? AND revision=?',
                        (group, item['asset'], dimension, revision))
                    if changed.rowcount != 1:
                        raise Conflict('Labels changed; reload the current photographs')
                store.db.execute('INSERT INTO photo_labels VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(group_id,asset_id,dimension) DO UPDATE SET value=excluded.value,method=excluded.method,actor_id=excluded.actor_id,revision=excluded.revision,updated_at=excluded.updated_at',
                    (group, item['asset'], dimension, value, 'member', user, revision + 1, now))
        social._record(store, user, group, key, 'labels.set', digest, str(uuid.uuid4()))
        return dict(items=_projection(store, group, assets))


def export_labels(store, user, group, fingerprint, archive=None):
    store._member(user, group)
    def visible():
        query = ('SELECT l.* FROM photo_labels l JOIN members m ON m.group_id=l.group_id AND m.user_id=l.actor_id '
                 'JOIN photo_label_versions v ON v.group_id=l.group_id AND v.asset_id=l.asset_id AND v.dimension=l.dimension AND v.revision=l.revision WHERE l.group_id=? AND l.actor_id=?')
        for row in store._export_rows(query, (group, user), [('l.asset_id', 'asset_id', False), ('l.dimension', 'dimension', False)]):
            try:
                authorize_photos(store, user, group, [row['asset_id']])
            except Denied:
                continue
            yield dict(assetId=row['asset_id'], dimension=row['dimension'], declared=row['value'], method=row['method'],
                revision=row['revision'], actor=row['actor_id'], updated_at=row['updated_at'])
    rows = visible()
    first = next(rows, None)
    if first is not None:
        fingerprint.json_member('labels.json', ExportArray(itertools.chain((first,), rows)), archive, ensure_ascii=False)


def summaries(store, group, assets):
    """Compact facts for the caller's already-authorized photo projection."""
    assets = list(dict.fromkeys(assets))
    result = {}
    if not assets:
        return result
    if len(assets) > 10000:
        from mazi.capacity import CapacityExceeded
        raise CapacityExceeded('Labels support up to 10,000 projected photographs')
    batch = assets
    slots = ','.join('?' for _ in batch)
    for row in store.db.execute(
        'SELECT l.asset_id,l.dimension,l.value FROM photo_labels l '
        'JOIN photo_label_versions v ON v.group_id=l.group_id AND v.asset_id=l.asset_id AND v.dimension=l.dimension AND v.revision=l.revision '
        'JOIN members m ON m.group_id=l.group_id AND m.user_id=l.actor_id '
        'WHERE l.group_id=? AND l.asset_id IN (' + slots + ") AND l.value<>'unknown'", (group, *batch)):
        result.setdefault(row['asset_id'], {})[row['dimension']] = row['value']
    for row in store.db.execute(_people_query(batch, 'DISTINCT t.asset'), (group, *batch)):
        result.setdefault(row['asset'], {})['people_present'] = 'yes'
    return result


def attach_summaries(store, group, photos):
    for offset in range(0, len(photos), 10000):
        page = photos[offset:offset + 10000]
        facts = summaries(store, group, [photo['assetId'] for photo in page])
        for photo in page:
            if photo['assetId'] in facts:
                photo['labels'] = facts[photo['assetId']]
