"""Bounded current-state social activity and the group's Home summary."""
import base64
import json
import time

from mazi.atlas import _selected_memory
from mazi.capacity import CapacityExceeded
from mazi.identity.core import Denied
from . import social
from .visibility import visible_photos

CHUNK = 32
SCAN_LIMIT = 512

SOURCES = {
    'comment': ('social_comments c JOIN members m ON m.group_id=c.group_id AND m.user_id=c.author_id LEFT JOIN shared_profiles sp ON sp.user_id=c.author_id',
        'c', 'c.updated_at', 'c.*,sp.display_name AS actor_name',
        'NOT EXISTS(SELECT 1 FROM social_comment_deletions d WHERE d.comment_id=c.id)'),
    'reaction': ('social_reactions r JOIN members m ON m.group_id=r.group_id AND m.user_id=r.member_id LEFT JOIN shared_profiles sp ON sp.user_id=r.member_id '
        'LEFT JOIN social_comments c ON c.id=r.comment_id AND c.group_id=r.group_id LEFT JOIN members cm ON cm.group_id=c.group_id AND cm.user_id=c.author_id',
        'r', 'r.updated_at', 'r.*,sp.display_name AS actor_name,c.photo_id AS comment_photo,c.memory_id AS comment_memory',
        'r.active=1 AND NOT EXISTS(SELECT 1 FROM social_reaction_deletions d WHERE d.reaction_id=r.id) '
        'AND (r.comment_id IS NULL OR (cm.user_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM social_comment_deletions d WHERE d.comment_id=c.id)))'),
    'plan': ('social_plans p JOIN members m ON m.group_id=p.group_id AND m.user_id=p.organizer LEFT JOIN shared_profiles sp ON sp.user_id=p.organizer',
        'p', 'p.updated_at', 'p.*,sp.display_name AS actor_name', '1=1'),
}


def _cursor(value):
    return base64.urlsafe_b64encode(json.dumps([value['occurred_at'], value['id']]).encode()).decode()


def _candidates(store, group, after, kinds, exclude=None):
    result = []
    for kind in kinds:
        source, alias, timestamp, columns, allowed = SOURCES[kind]
        query = f'SELECT {columns},{timestamp} AS occurred_at FROM {source} WHERE {alias}.group_id=? AND {allowed}'
        params = [group]
        if exclude:
            if kind == 'plan' and exclude[0] == 'plan':
                query += ' AND p.id<>?'
                params.append(exclude[1])
            elif kind != 'plan' and exclude[0] in ('photo', 'memory'):
                column = exclude[0] + '_id'
                value = f'COALESCE(r.{column},c.{column})' if kind == 'reaction' else 'c.' + column
                query += f' AND ({value} IS NULL OR {value}<>?)'
                params.append(exclude[1])
        if after:
            boundary_kind, _, identity = after[1].partition(':')
            if kind == boundary_kind:
                query += f' AND ({timestamp},{alias}.id)<(?,?)'
                params.extend((after[0], identity))
            else:
                query += f' AND {timestamp}' + ('<=?' if kind < boundary_kind else '<?')
                params.append(after[0])
        query += f' ORDER BY {timestamp} DESC,{alias}.id DESC LIMIT ?'
        for row in store.db.execute(query, (*params, CHUNK + 1)):
            event = dict(row)
            event.update(kind=kind, id=kind + ':' + row['id'], record_id=row['id'])
            if kind == 'plan':
                target = dict(kind='plan', id=row['id'])
            else:
                photo = row['photo_id'] or (row['comment_photo'] if kind == 'reaction' else None)
                memory = row['memory_id'] or (row['comment_memory'] if kind == 'reaction' else None)
                target = dict(kind='photo', id=photo) if photo else dict(kind='memory', id=memory)
            event['target'] = target
            result.append(event)
    result.sort(key=lambda item: (item['occurred_at'], item['id']), reverse=True)
    return result[:CHUNK], len(result) > CHUNK


def _visible_targets(store, user, group, events):
    photos = {row['target']['id'] for row in events if row['target']['kind'] == 'photo'}
    requested = {row['target']['id'] for row in events if row['target']['kind'] == 'memory'}
    memories = {}
    if requested:
        for row in store.db.execute("SELECT id,asset_ids FROM review_events WHERE group_id=? AND status='accepted' AND id IN (" + ','.join('?' for _ in requested) + ')', (group, *sorted(requested))):
            assets = json.loads(row['asset_ids'])
            if not assets or len(assets) > 100:
                raise CapacityExceeded('Activity memory exceeds its child budget')
            memories[row['id']] = assets
            photos.update(assets)
    visible = visible_photos(store, user, group, sorted(photos)) if photos else set()
    result = {('photo', asset): asset for asset in visible}
    result.update({('memory', identity): assets[0] for identity, assets in memories.items() if set(assets) <= visible})
    result.update({('plan', row['target']['id']): None for row in events if row['target']['kind'] == 'plan'})
    return result


def _attendance(store, user, group, plans):
    values = {identity: dict(yes=0, maybe=0, no=0, mine=None, revision=0) for identity in plans}
    if not plans:
        return values
    query = ('SELECT a.plan_id,a.state,count(*) AS total,max(CASE WHEN a.member_id=? THEN 1 ELSE 0 END) AS mine,'
        'max(CASE WHEN a.member_id=? THEN a.revision ELSE 0 END) AS revision FROM social_attendance a '
        'JOIN members m ON m.group_id=a.group_id AND m.user_id=a.member_id WHERE a.group_id=? AND a.plan_id IN (' + ','.join('?' for _ in plans) + ') GROUP BY a.plan_id,a.state')
    for row in store.db.execute(query, (user, user, group, *plans)):
        value = values[row['plan_id']]
        if row['state']:
            value[row['state']] = row['total']
        if row['mine']:
            value.update(mine=row['state'], revision=row['revision'])
    return values


def _compact_plan(row, attendance):
    return dict(id=row['record_id'], title=row['title'], revision=row['revision'], status=row['status'],
        starts_at=social._iso(row['starts_at']), starts_epoch=row['starts_at'], start_local=row['start_local'], start_offset=row['start_offset'],
        ends_at=social._iso(row['ends_at']) if row['ends_at'] is not None else None, end_local=row['end_local'], end_offset=row['end_offset'],
        timezone=row['timezone'], place=row['place'], description=row['description'],
        organizer=dict(id=row['organizer'], name=row['actor_name'] or 'Grup üyesi'), attendance=attendance,
        created_at=row['created_at'], updated_at=row['updated_at'])


def _project(store, user, group, events, visible):
    attendance = _attendance(store, user, group, [row['record_id'] for row in events if row['kind'] == 'plan'])
    result = []
    for row in events:
        target = row['target']
        actor = row['author_id'] if row['kind'] == 'comment' else row['member_id'] if row['kind'] == 'reaction' else row['organizer']
        if row['kind'] == 'comment':
            action = 'edited' if row['revision'] > 1 else 'created'
        elif row['kind'] == 'plan':
            action = 'cancelled' if row['status'] == 'cancelled' else 'updated' if row['revision'] > 1 else 'created'
        else:
            action = 'reacted'
        item = dict(id=row['id'], kind=row['kind'], action=action, occurred_at=row['occurred_at'], target=target,
            actor=dict(id=actor, name=row['actor_name'] or 'Grup üyesi'))
        if row['kind'] == 'plan':
            item['plan'] = _compact_plan(row, attendance[row['record_id']])
        else:
            photo = visible[(target['kind'], target['id'])]
            item.update(asset_id=photo, memory_id='photo-' + target['id'] if target['kind'] == 'photo' else target['id'],
                thumbnail='/api/review/rendition/' + photo)
            if row['kind'] == 'comment':
                item['text'] = row['content']
                item['comment_id'] = row['record_id']
            else:
                item['emoji'] = row['emoji']
                if row['comment_id']:
                    item['comment_id'] = row['comment_id']
        result.append(item)
    return result


def _activity(store, user, group, limit, cursor=None, *, kinds=tuple(SOURCES), exclude=None):
    after = social._cursor(cursor)
    if after:
        kind, separator, identity = after[1].partition(':')
        if not separator or kind not in SOURCES or not identity:
            raise ValueError('Invalid activity cursor')
    events, scanned, more, last = [], 0, False, None
    visible_all = {}
    while scanned < SCAN_LIMIT and len(events) <= limit:
        rows, more = _candidates(store, group, after, kinds, exclude)
        if not rows:
            more = False
            break
        visible = _visible_targets(store, user, group, rows)
        visible_all.update(visible)
        for row in rows:
            key = row['target']['kind'], row['target']['id']
            if key in visible and key != exclude:
                events.append(row)
        scanned += len(rows)
        last = rows[-1]
        after = (last['occurred_at'], last['id'])
        if not more:
            break
    if len(events) > limit:
        next_cursor = _cursor(events[limit - 1])
    else:
        next_cursor = _cursor(last) if more and last else None
    return dict(items=_project(store, user, group, events[:limit], visible_all), next_cursor=next_cursor,
        partial=more and len(events) <= limit)


def activity(store, user, group, *, limit=20, cursor=None):
    if type(limit) is not int or not 1 <= limit <= 50:
        raise ValueError('Invalid activity page')
    with store.transaction():
        store._member(user, group)
        return _activity(store, user, group, limit, cursor)


def _preview(store, user, group, photo):
    memory = _selected_memory(store, user, group, 'photo-' + photo)
    memory['messages'] = []
    memory['people']['conversation'] = []
    for key in ('title', 'shortTitle'):
        memory[key] = memory[key][:200]
    for image in memory['photos']:
        image.pop('provenance', None)
        image['caption'] = image['caption'][:200]
        image['alt'] = image['alt'][:200]
    if len(json.dumps(memory).encode()) > 65536:
        raise CapacityExceeded('Home preview exceeds its response budget')
    return memory


def _fallback(store, user, group):
    after = None
    for _ in range(SCAN_LIMIT // CHUNK):
        query = ('SELECT a.id FROM archive_assets a WHERE a.group_id=? AND EXISTS(SELECT 1 FROM archive_origins o '
            'JOIN members m ON m.group_id=o.group_id AND m.user_id=o.owner_id WHERE o.asset_id=a.id AND o.group_id=a.group_id AND o.withdrawn=0) '
            'AND NOT EXISTS(SELECT 1 FROM discovery_hidden h WHERE h.asset=a.id AND h."user"=?)')
        params = [group, user]
        if after:
            query += ' AND a.id<?'
            params.append(after)
        rows = store.db.execute(query + ' ORDER BY a.id DESC LIMIT ?', (*params, CHUNK)).fetchall()
        if not rows:
            return None
        visible = visible_photos(store, user, group, [row['id'] for row in rows])
        chosen = next((row['id'] for row in rows if row['id'] in visible), None)
        if chosen:
            return _preview(store, user, group, chosen)
        after = rows[-1]['id']
        if len(rows) < CHUNK:
            return None
    raise CapacityExceeded('Home photo selection exceeds its candidate budget')


def home_view(store, user, group):
    with store.transaction():
        store._member(user, group)
        now = time.time()
        row = store.db.execute("SELECT p.*,sp.display_name AS actor_name FROM social_plans p JOIN members m ON m.group_id=p.group_id AND m.user_id=p.organizer LEFT JOIN shared_profiles sp ON sp.user_id=p.organizer WHERE p.group_id=? AND p.status='active' AND p.starts_at>=? ORDER BY p.starts_at,p.id LIMIT 1", (group, now)).fetchone()
        featured, exclude = None, None
        if row:
            value = dict(row)
            value['record_id'] = row['id']
            featured = dict(kind='plan', plan=_compact_plan(value, _attendance(store, user, group, [row['id']])[row['id']]))
            exclude = ('plan', row['id'])
        else:
            conversation = _activity(store, user, group, 1, kinds=('comment',))
            if conversation['items']:
                item = conversation['items'][0]
                featured = dict(kind='conversation', activity=item, preview=_preview(store, user, group, item['asset_id']))
                exclude = (item['target']['kind'], item['target']['id'])
            elif conversation['partial']:
                raise CapacityExceeded('Home conversation selection exceeds its candidate budget')
            else:
                memory = _fallback(store, user, group)
                if memory:
                    featured = dict(kind='memory', memory=memory)
        return dict(featured=featured, activity=_activity(store, user, group, 3, exclude=exclude), server_time=social._iso(now), can_plan=True)
