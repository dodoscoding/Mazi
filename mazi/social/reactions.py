"""Desired-state reactions with current target visibility and bounded member lists."""
import itertools
import time
import uuid
from dataclasses import dataclass
from collections import defaultdict

from mazi.archive.export import ExportArray
from mazi.identity.core import Denied
from . import conversations, social
from .visibility import authorize_photos

EMOJIS = ('👍', '❤️', '😂', '🎉')
COLUMNS = {'photo': 'photo_id', 'memory': 'memory_id', 'comment': 'comment_id'}
MEMBER_LIMIT = 50


@dataclass(frozen=True)
class Target:
    kind: str
    id: str

    @property
    def column(self):
        return COLUMNS[self.kind]

    def wire(self):
        return dict(kind=self.kind, id=self.id)


def _target(value):
    if not isinstance(value, dict) or set(value) != {'kind', 'id'} or not isinstance(value['kind'], str) or value['kind'] not in COLUMNS:
        raise ValueError('Choose a photo, approved memory or comment')
    return Target(value['kind'], social._id(value['id']))


def _stored_target(row):
    return next(Target(kind, row[column]) for kind, column in COLUMNS.items() if row[column] is not None)


def authorize_target(store, user, group, target):
    if target.kind == 'comment':
        conversations._row(store, user, group, target.id)
    else:
        conversations.authorize_target(store, user, group, conversations.Target(target.kind, target.id))


VISIBLE = (' FROM social_reactions r JOIN members m ON m.group_id=r.group_id AND m.user_id=r.member_id '
           'LEFT JOIN shared_profiles sp ON sp.user_id=r.member_id WHERE r.group_id=? AND r.active=1 '
           'AND NOT EXISTS(SELECT 1 FROM social_reaction_deletions d WHERE d.reaction_id=r.id)')


def _views(store, user, group, targets):
    clause = VISIBLE + ' AND (' + ' OR '.join(f'r.{target.column}=?' for target in targets) + ')'
    params = (group, *(target.id for target in targets))
    query = 'SELECT r.photo_id,r.memory_id,r.comment_id,r.emoji,count(*) AS total,max(CASE WHEN r.member_id=? THEN 1 ELSE 0 END) AS mine'
    totals = {}
    for row in store.db.execute(query + clause + ' GROUP BY r.photo_id,r.memory_id,r.comment_id,r.emoji', (user, *params)):
        target = _stored_target(row)
        totals[(target.kind, target.id, row['emoji'])] = row
    members = defaultdict(list)
    if totals:
        ranked = ('SELECT r.photo_id,r.memory_id,r.comment_id,r.emoji,r.member_id,sp.display_name,'
                  'row_number() OVER(PARTITION BY r.photo_id,r.memory_id,r.comment_id,r.emoji ORDER BY r.member_id) AS member_rank')
        for row in store.db.execute('SELECT * FROM (' + ranked + clause + ') ranked WHERE member_rank<=? ORDER BY member_rank', (*params, MEMBER_LIMIT + 1)):
            target = _stored_target(row)
            members[(target.kind, target.id, row['emoji'])].append(dict(id=row['member_id'], name=row['display_name'] or 'Grup üyesi'))
    values = []
    for target in targets:
        result = []
        for emoji in EMOJIS:
            key = (target.kind, target.id, emoji)
            row, people = totals.get(key), members[key]
            result.append(dict(emoji=emoji, count=row['total'] if row else 0, mine=bool(row['mine']) if row else False,
                members=people[:MEMBER_LIMIT], members_truncated=len(people) > MEMBER_LIMIT))
        values.append(dict(target=target.wire(), allowed_emojis=list(EMOJIS), total=sum(row['count'] for row in result), reactions=result))
    return values


def batch_reactions(store, user, group, targets):
    if not isinstance(targets, list) or not 1 <= len(targets) <= 50:
        raise ValueError('Choose between one and fifty targets')
    parsed = [_target(target) for target in targets]
    if len(set(parsed)) != len(parsed):
        raise ValueError('Choose unique targets')
    with store.transaction():
        store._member(user, group)
        archive_targets = {conversations.Target(target.kind, target.id) for target in parsed if target.kind != 'comment'}
        comments = {target.id for target in parsed if target.kind == 'comment'}
        if comments:
            slots = ','.join('?' for _ in comments)
            rows = store.db.execute('SELECT c.id,c.photo_id,c.memory_id' + conversations.VISIBLE + ' AND c.id IN (' + slots + ')', (group, *sorted(comments))).fetchall()
            if {row['id'] for row in rows} != comments:
                raise Denied('Comment unavailable')
            archive_targets.update(conversations._stored_target(row) for row in rows)
        photos = sorted(target.id for target in archive_targets if target.kind == 'photo')
        if photos:
            authorize_photos(store, user, group, photos)
        for target in archive_targets:
            if target.kind == 'memory':
                social._memory(store, user, group, target.id)
        return dict(items=_views(store, user, group, parsed))


def reactions(store, user, group, target):
    target = _target(target)
    with store.transaction():
        authorize_target(store, user, group, target)
        return _views(store, user, group, [target])[0]


def set_reaction(store, user, group, request_key, target, emoji, active):
    target = _target(target)
    if emoji not in EMOJIS or type(active) is not bool:
        raise ValueError('Choose an allowed emoji and a boolean active state')
    with store.transaction():
        authorize_target(store, user, group, target)
        key, digest, receipt = social._receipt(store, user, group, request_key, 'reaction.set', dict(target=target.wire(), emoji=emoji, active=active))
        if receipt:
            return _views(store, user, group, [target])[0]
        row = store.db.execute(f'SELECT * FROM social_reactions WHERE group_id=? AND {target.column}=? AND member_id=? AND emoji=?', (group, target.id, user, emoji)).fetchone()
        if row is not None and store.db.execute('SELECT 1 FROM social_reaction_deletions WHERE reaction_id=?', (row['id'],)).fetchone():
            store.db.execute('DELETE FROM social_reactions WHERE id=?', (row['id'],))
            row = None
        identity, now = row['id'] if row else str(uuid.uuid4()), time.time()
        if row is None:
            store.db.execute('INSERT INTO social_reactions VALUES(?,?,?,?,?,?,?,?,?,?)',
                (identity, group, target.id if target.kind == 'photo' else None, target.id if target.kind == 'memory' else None,
                 target.id if target.kind == 'comment' else None, user, emoji, int(active), now, now))
        elif bool(row['active']) != active:
            store.db.execute('UPDATE social_reactions SET active=?,updated_at=? WHERE id=?', (int(active), now, identity))
        social._record(store, user, group, key, 'reaction.set', digest, identity)
        return _views(store, user, group, [target])[0]


def export_reactions(store, user, group, fingerprint, archive=None):
    store._member(user, group)
    def visible():
        for row in store._export_rows('SELECT r.*' + VISIBLE + ' AND r.member_id=?', (group, user), [('r.id', 'id', False)]):
            target = _stored_target(row)
            try:
                authorize_target(store, user, group, target)
            except Denied:
                continue
            yield dict(id=row['id'], target=target.wire(), emoji=row['emoji'], created_at=row['created_at'], updated_at=row['updated_at'])
    rows = visible()
    first = next(rows, None)
    if first is not None:
        fingerprint.json_member('reactions.json', ExportArray(itertools.chain((first,), rows)), archive, ensure_ascii=False)
