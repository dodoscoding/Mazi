"""Flat conversations whose current targets and authors remain visible."""
from dataclasses import dataclass
import base64
import itertools
import json
import time
import uuid

from mazi.archive.export import ExportArray
from mazi.identity.core import Conflict, Denied
from . import social


@dataclass(frozen=True)
class Target:
    kind: str
    id: str

    @property
    def column(self):
        return 'photo_id' if self.kind == 'photo' else 'memory_id'

    def wire(self):
        return dict(kind=self.kind, id=self.id)


def _target(value):
    if not isinstance(value, dict) or set(value) != {'kind', 'id'} or value['kind'] not in ('photo', 'memory'):
        raise ValueError('Choose a photo or approved memory')
    return Target(value['kind'], social._id(value['id']))


def _stored_target(row):
    return Target('photo', row['photo_id']) if row['photo_id'] is not None else Target('memory', row['memory_id'])


def authorize_target(store, user, group, target):
    store._member(user, group)
    if target.kind == 'memory':
        social._memory(store, user, group, target.id)
        return
    asset = store._asset(user, target.id)
    if asset['group_id'] != group or store.db.execute('SELECT 1 FROM discovery_hidden WHERE "user"=? AND asset=?', (user, target.id)).fetchone():
        raise Denied('Conversation unavailable')
    hidden = store.db.execute('SELECT e.asset_ids FROM review_events e JOIN discovery_hidden_events h ON h.event=e.id WHERE e.group_id=? AND h."user"=?', (group, user))
    if any(target.id in json.loads(row[0]) for row in hidden):
        raise Denied('Conversation unavailable')


VISIBLE = (' FROM social_comments c JOIN members m ON m.group_id=c.group_id AND m.user_id=c.author_id '
           'LEFT JOIN shared_profiles sp ON sp.user_id=c.author_id WHERE c.group_id=? '
           'AND NOT EXISTS(SELECT 1 FROM social_comment_deletions d WHERE d.comment_id=c.id)')


def _row(store, user, group, identity, *, owner=False):
    row = store.db.execute('SELECT c.*,sp.display_name' + VISIBLE + ' AND c.id=?', (group, social._id(identity))).fetchone()
    if row is None or (owner and row['author_id'] != user):
        raise Denied('Comment unavailable')
    authorize_target(store, user, group, _stored_target(row))
    return row


def _view(user, row):
    return dict(id=row['id'], target=_stored_target(row).wire(), author=dict(id=row['author_id'], name=row['display_name'] or 'Grup üyesi'),
                text=row['content'], revision=row['revision'], created_at=row['created_at'], updated_at=row['updated_at'], editable=row['author_id'] == user)


def _replay(store, user, group, receipt):
    identity = receipt['result_id']
    deleted = store.db.execute('SELECT * FROM social_comment_deletions WHERE comment_id=? AND group_id=?', (identity, group)).fetchone()
    if deleted is not None:
        authorize_target(store, user, group, _stored_target(deleted))
        return dict(id=identity, deleted=True)
    exists = store.db.execute('SELECT 1 FROM social_comments WHERE id=? AND group_id=?', (identity, group)).fetchone()
    if exists is None:
        return dict(id=identity, deleted=True)
    return _view(user, _row(store, user, group, identity))


def comments(store, user, group, target, *, limit=20, cursor=None):
    target = _target(target)
    if type(limit) is not int or not 1 <= limit <= 50:
        raise ValueError('Invalid comment page')
    boundary = social._cursor(cursor)
    with store.transaction():
        authorize_target(store, user, group, target)
        clause = VISIBLE + f' AND c.{target.column}=?'
        params = [group, target.id]
        total = store.db.execute('SELECT count(*)' + clause, params).fetchone()[0]
        if boundary:
            clause += ' AND (c.created_at>? OR (c.created_at=? AND c.id>?))'
            params.extend((boundary[0], boundary[0], boundary[1]))
        rows = store.db.execute('SELECT c.*,sp.display_name' + clause + ' ORDER BY c.created_at,c.id LIMIT ?', (*params, limit + 1)).fetchall()
        selected = rows[:limit]
        next_cursor = base64.urlsafe_b64encode(json.dumps([selected[-1]['created_at'], selected[-1]['id']]).encode()).decode() if len(rows) > limit else None
        return dict(items=[_view(user, row) for row in selected], total=total, next_cursor=next_cursor)


def create_comment(store, user, group, request_key, target, text):
    target, content = _target(target), social._text(text, 4000, required=True)
    with store.transaction():
        authorize_target(store, user, group, target)
        key, digest, receipt = social._receipt(store, user, group, request_key, 'comment.create', dict(target=target.wire(), text=content))
        if receipt:
            return _replay(store, user, group, receipt)
        identity, now = str(uuid.uuid4()), time.time()
        store.db.execute('INSERT INTO social_comments VALUES(?,?,?,?,?,?,?,?,?)',
            (identity, group, target.id if target.kind == 'photo' else None, target.id if target.kind == 'memory' else None, user, content, 1, now, now))
        social._record(store, user, group, key, 'comment.create', digest, identity)
        return _view(user, _row(store, user, group, identity))


def update_comment(store, user, group, identity, revision, request_key, text):
    content = social._text(text, 4000, required=True)
    social._revision(revision)
    with store.transaction():
        store._member(user, group)
        key, digest, receipt = social._receipt(store, user, group, request_key, 'comment.update', dict(comment=identity, revision=revision, text=content))
        if receipt:
            return _replay(store, user, group, receipt)
        _row(store, user, group, identity, owner=True)
        changed = store.db.execute('UPDATE social_comments SET content=?,revision=revision+1,updated_at=? WHERE id=? AND group_id=? AND revision=?', (content, time.time(), identity, group, revision))
        if changed.rowcount != 1:
            raise Conflict('Comment changed; reload the current version')
        social._record(store, user, group, key, 'comment.update', digest, identity)
        return _view(user, _row(store, user, group, identity))


def delete_comment(store, user, group, identity, revision, request_key):
    social._revision(revision)
    with store.transaction():
        store._member(user, group)
        key, digest, receipt = social._receipt(store, user, group, request_key, 'comment.delete', dict(comment=identity, revision=revision))
        if receipt:
            return _replay(store, user, group, receipt)
        _row(store, user, group, identity, owner=True)
        changed = store.db.execute('DELETE FROM social_comments WHERE id=? AND group_id=? AND revision=?', (identity, group, revision))
        if changed.rowcount != 1:
            raise Conflict('Comment changed; reload the current version')
        social._record(store, user, group, key, 'comment.delete', digest, identity)
        return dict(id=identity, deleted=True)


def export_comments(store, user, group, fingerprint, archive=None):
    store._member(user, group)
    def visible():
        query = 'SELECT c.*,sp.display_name' + VISIBLE + ' AND c.author_id=?'
        for row in store._export_rows(query, (group, user), [('c.id', 'id', False)]):
            try:
                authorize_target(store, user, group, _stored_target(row))
            except Denied:
                continue
            yield _view(user, row)
    rows = visible()
    first = next(rows, None)
    if first is not None:
        fingerprint.json_member('comments.json', ExportArray(itertools.chain((first,), rows)), archive, ensure_ascii=False)
