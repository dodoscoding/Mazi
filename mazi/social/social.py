"""Current-member plans and attendance, with durable command replay."""
import base64
import hashlib
import json
import math
import re
import time
import uuid
from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from mazi.archive.export import ExportArray
from mazi.identity.core import Conflict, Denied

PLAN_FIELDS = {'title', 'start_local', 'timezone', 'start_offset', 'end_local', 'end_offset', 'place', 'description', 'memory'}


def _text(value, limit, *, required=False):
    if not isinstance(value, str) or len(value) > limit or '\x00' in value:
        raise ValueError('Invalid text')
    value = value.strip()
    if required and not value:
        raise ValueError('Text required')
    return value


def _id(value):
    return _text(value, 200, required=True)


def _revision(value):
    if type(value) is not int or value < 1:
        raise ValueError('Invalid revision')
    return value


def _wall(value, zone, offset):
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?', value):
        raise ValueError('Use a local calendar date and time')
    local = datetime.fromisoformat(value)
    options = {}
    for fold in (0, 1):
        aware = local.replace(tzinfo=zone, fold=fold)
        if aware.astimezone(timezone.utc).astimezone(zone).replace(tzinfo=None) == local:
            minutes = int(aware.utcoffset().total_seconds() // 60)
            label = ('+' if minutes >= 0 else '-') + f'{abs(minutes) // 60:02d}:{abs(minutes) % 60:02d}'
            options[label] = aware.timestamp()
    if not options:
        raise ValueError('This local time does not exist; choose another time')
    if offset is None:
        if len(options) != 1:
            raise ValueError('This local time occurs twice; choose a UTC offset')
        offset = next(iter(options))
    if offset not in options:
        raise ValueError('Choose a valid UTC offset for this local time')
    return local.isoformat(timespec='seconds'), offset, options[offset]


def _memory(store, user, group, identity):
    if not identity:
        return None
    row = store.db.execute("SELECT id,title,asset_ids FROM review_events WHERE id=? AND group_id=? AND status='accepted'", (identity, group)).fetchone()
    if row is None or store.db.execute('SELECT 1 FROM discovery_hidden_events WHERE event=? AND "user"=?', (identity, user)).fetchone():
        raise Denied('Memory unavailable')
    for asset in json.loads(row['asset_ids']):
        original = store._asset(user, asset)
        if original['group_id'] != group or store.db.execute('SELECT 1 FROM discovery_hidden WHERE asset=? AND "user"=?', (asset, user)).fetchone():
            raise Denied('Memory unavailable')
    return dict(id=row['id'], title=row['title'])


def _fields(store, user, group, data, *, validate_memory=True):
    if not isinstance(data, dict) or set(data) - PLAN_FIELDS:
        raise ValueError('Invalid plan fields')
    title = _text(data.get('title'), 200, required=True)
    zone_name = _text(data.get('timezone'), 100, required=True)
    try:
        zone = ZoneInfo(zone_name)
    except (ValueError, ZoneInfoNotFoundError):
        raise ValueError('Choose an IANA timezone') from None
    start_local, start_offset, starts_at = _wall(data.get('start_local'), zone, data.get('start_offset'))
    end_local = data.get('end_local') or None
    end_offset = ends_at = None
    if end_local is not None:
        end_local, end_offset, ends_at = _wall(end_local, zone, data.get('end_offset'))
        if ends_at <= starts_at:
            raise ValueError('The end must follow the start')
    elif data.get('end_offset') is not None:
        raise ValueError('An end offset requires an end time')
    memory = data.get('memory') or None
    if memory is not None:
        memory = _id(memory)
        if validate_memory:
            _memory(store, user, group, memory)
    return dict(title=title, start_local=start_local, timezone=zone_name, start_offset=start_offset,
                starts_at=starts_at, end_local=end_local, end_offset=end_offset, ends_at=ends_at,
                place=_text(data.get('place', ''), 200), description=_text(data.get('description', ''), 4000), memory_id=memory)


def _row(store, user, group, identity, *, owner=False):
    store._member(user, group)
    row = store.db.execute('SELECT p.*,sp.display_name FROM social_plans p JOIN members m ON m.group_id=p.group_id AND m.user_id=p.organizer '
                           'LEFT JOIN shared_profiles sp ON sp.user_id=p.organizer WHERE p.id=? AND p.group_id=?', (_id(identity), group)).fetchone()
    if row is None or (owner and row['organizer'] != user):
        raise Denied('Plan unavailable')
    return row


def _iso(epoch):
    return datetime.fromtimestamp(epoch, timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def _view(store, user, row):
    group, identity = row['group_id'], row['id']
    attendance = dict(yes=0, maybe=0, no=0, mine=None, revision=0)
    people = []
    for reply in store.db.execute('SELECT a.member_id,a.state,a.revision,sp.display_name FROM social_attendance a '
                                  'JOIN members m ON m.user_id=a.member_id AND m.group_id=? '
                                  'LEFT JOIN shared_profiles sp ON sp.user_id=a.member_id WHERE a.plan_id=? ORDER BY a.member_id', (group, identity)):
        if reply['state']:
            attendance[reply['state']] += 1
            people.append(dict(id=reply['member_id'], name=reply['display_name'] or 'Grup üyesi', state=reply['state']))
        if reply['member_id'] == user:
            attendance.update(mine=reply['state'], revision=reply['revision'])
    memory = None
    if row['memory_id']:
        try:
            memory = _memory(store, user, group, row['memory_id'])
        except Denied:
            pass
    return dict(id=identity, title=row['title'], revision=row['revision'], status=row['status'],
                start_local=row['start_local'], start_offset=row['start_offset'], starts_at=_iso(row['starts_at']), starts_epoch=row['starts_at'],
                end_local=row['end_local'], end_offset=row['end_offset'], ends_at=_iso(row['ends_at']) if row['ends_at'] is not None else None,
                timezone=row['timezone'], place=row['place'], description=row['description'],
                organizer=dict(id=row['organizer'], name=row['display_name'] or 'Grup üyesi'), editable=row['organizer'] == user,
                attendance=attendance, participants=people, memory=memory,
                created_at=row['created_at'], updated_at=row['updated_at'])


def _receipt(store, user, group, key, operation, payload):
    key = _text(key, 200, required=True)
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()
    receipt = store.db.execute('SELECT operation,payload_hash,result_id FROM social_receipts WHERE group_id=? AND actor_id=? AND request_key=?', (group, user, key)).fetchone()
    if receipt is not None and (receipt['operation'] != operation or receipt['payload_hash'] != digest):
        raise Conflict('Request key already used for a different command')
    return key, digest, receipt


def _replay(store, user, group, receipt):
    identity = receipt['result_id']
    try:
        return _view(store, user, _row(store, user, group, identity))
    except Denied:
        return dict(id=identity, deleted=True)


def _record(store, user, group, key, operation, digest, identity):
    store.db.execute('INSERT INTO social_receipts VALUES(?,?,?,?,?,?,?)', (group, user, key, operation, digest, identity, time.time()))
    store._audit(user, 'social.' + operation, identity)


def _cursor(value):
    if not value:
        return None
    try:
        if not isinstance(value, str) or len(value) > 500:
            raise ValueError()
        result = json.loads(base64.urlsafe_b64decode(value.encode()))
        if not isinstance(result, list) or len(result) != 2 or type(result[0]) not in (int, float) or not math.isfinite(result[0]):
            raise ValueError()
        return result[0], _id(result[1])
    except (ValueError, TypeError, UnicodeError):
        raise ValueError('Invalid cursor') from None


def plans(store, user, group, *, scope='upcoming', limit=20, cursor=None):
    if scope not in ('upcoming', 'all') or type(limit) is not int or not 1 <= limit <= 50:
        raise ValueError('Invalid plan page')
    boundary = _cursor(cursor)
    with store.transaction():
        store._member(user, group)
        now = time.time()
        query = 'SELECT p.*,sp.display_name FROM social_plans p JOIN members m ON m.group_id=p.group_id AND m.user_id=p.organizer LEFT JOIN shared_profiles sp ON sp.user_id=p.organizer WHERE p.group_id=?'
        params = [group]
        if scope == 'upcoming':
            query += " AND p.status='active' AND p.starts_at>=?"
            params.append(now)
        if boundary:
            query += ' AND (p.starts_at>? OR (p.starts_at=? AND p.id>?))'
            params.extend((boundary[0], boundary[0], boundary[1]))
        query += ' ORDER BY p.starts_at,p.id LIMIT ?'
        params.append(limit + 1)
        rows = store.db.execute(query, params).fetchall()
        selected = rows[:limit]
        next_cursor = base64.urlsafe_b64encode(json.dumps([selected[-1]['starts_at'], selected[-1]['id']]).encode()).decode() if len(rows) > limit else None
        return dict(items=[_view(store, user, row) for row in selected], next_cursor=next_cursor, server_time=_iso(now))


def get_plan(store, user, group, identity):
    with store.transaction():
        return _view(store, user, _row(store, user, group, identity))


def create_plan(store, user, group, request_key, data):
    with store.transaction():
        store._member(user, group)
        key, digest, receipt = _receipt(store, user, group, request_key, 'plan.create', data)
        if receipt:
            return _replay(store, user, group, receipt)
        values = _fields(store, user, group, data)
        identity, now = str(uuid.uuid4()), time.time()
        store.db.execute('INSERT INTO social_plans(id,group_id,organizer,title,start_local,timezone,start_offset,starts_at,end_local,end_offset,ends_at,place,description,memory_id,status,revision,created_at,updated_at) '
                         'VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                         (identity, group, user, values['title'], values['start_local'], values['timezone'], values['start_offset'], values['starts_at'],
                          values['end_local'], values['end_offset'], values['ends_at'], values['place'], values['description'], values['memory_id'], 'active', 1, now, now))
        _record(store, user, group, key, 'plan.create', digest, identity)
        return _view(store, user, _row(store, user, group, identity))


def update_plan(store, user, group, identity, revision, request_key, patch):
    if not isinstance(patch, dict) or not patch or set(patch) - PLAN_FIELDS:
        raise ValueError('Invalid plan patch')
    _revision(revision)
    with store.transaction():
        store._member(user, group)
        key, digest, receipt = _receipt(store, user, group, request_key, 'plan.update', dict(plan=identity, revision=revision, patch=patch))
        if receipt:
            return _replay(store, user, group, receipt)
        row = _row(store, user, group, identity, owner=True)
        if row['status'] != 'active':
            raise Conflict('Cancelled plans cannot change')
        data = {field: row['memory_id'] if field == 'memory' else row[field] for field in PLAN_FIELDS}
        if any(field in patch for field in ('start_local', 'timezone')) and 'start_offset' not in patch:
            data['start_offset'] = None
        if any(field in patch for field in ('end_local', 'timezone')) and 'end_offset' not in patch:
            data['end_offset'] = None
        data.update(patch)
        values = _fields(store, user, group, data, validate_memory='memory' in patch)
        changed = store.db.execute('UPDATE social_plans SET title=?,start_local=?,timezone=?,start_offset=?,starts_at=?,end_local=?,end_offset=?,ends_at=?,place=?,description=?,memory_id=?,revision=revision+1,updated_at=? WHERE id=? AND group_id=? AND revision=?',
            (values['title'], values['start_local'], values['timezone'], values['start_offset'], values['starts_at'], values['end_local'], values['end_offset'], values['ends_at'], values['place'], values['description'], values['memory_id'], time.time(), identity, group, revision))
        if changed.rowcount != 1:
            raise Conflict('Plan changed; reload the current version')
        _record(store, user, group, key, 'plan.update', digest, identity)
        return _view(store, user, _row(store, user, group, identity))


def _finish_plan(store, user, group, identity, revision, request_key, *, deletion):
    _revision(revision)
    operation = 'plan.delete' if deletion else 'plan.cancel'
    with store.transaction():
        store._member(user, group)
        key, digest, receipt = _receipt(store, user, group, request_key, operation, dict(plan=identity, revision=revision))
        if receipt:
            return _replay(store, user, group, receipt)
        _row(store, user, group, identity, owner=True)
        if deletion:
            changed = store.db.execute('DELETE FROM social_plans WHERE id=? AND group_id=? AND revision=?', (identity, group, revision))
        else:
            changed = store.db.execute("UPDATE social_plans SET status='cancelled',revision=revision+1,updated_at=? WHERE id=? AND group_id=? AND revision=?", (time.time(), identity, group, revision))
        if changed.rowcount != 1:
            raise Conflict('Plan changed; reload the current version')
        _record(store, user, group, key, operation, digest, identity)
        return dict(id=identity, deleted=True) if deletion else _view(store, user, _row(store, user, group, identity))


def cancel_plan(store, user, group, identity, revision, request_key):
    return _finish_plan(store, user, group, identity, revision, request_key, deletion=False)


def delete_plan(store, user, group, identity, revision, request_key):
    return _finish_plan(store, user, group, identity, revision, request_key, deletion=True)


def set_attendance(store, user, group, identity, state, request_key):
    if state not in ('yes', 'maybe', 'no', None):
        raise ValueError('Invalid attendance state')
    with store.transaction():
        store._member(user, group)
        key, digest, receipt = _receipt(store, user, group, request_key, 'attendance.set', dict(plan=identity, state=state))
        if receipt:
            return _replay(store, user, group, receipt)
        plan = _row(store, user, group, identity)
        if plan['status'] != 'active':
            raise Conflict('This plan is cancelled')
        previous = store.db.execute('SELECT state,revision FROM social_attendance WHERE plan_id=? AND member_id=?', (identity, user)).fetchone()
        if previous is None or previous['state'] != state:
            store.db.execute('INSERT INTO social_attendance VALUES(?,?,?,?,?,?) ON CONFLICT(plan_id,member_id) DO UPDATE SET state=excluded.state,revision=social_attendance.revision+1,updated_at=excluded.updated_at',
                             (identity, user, state, 1, time.time(), group))
        _record(store, user, group, key, 'attendance.set', digest, identity)
        return _view(store, user, plan)


def export_social(store, user, group, fingerprint, archive=None):
    store._member(user, group)
    authored = store.db.execute('SELECT 1 FROM social_plans WHERE group_id=? AND organizer=? LIMIT 1', (group, user)).fetchone()
    attendance = store.db.execute('SELECT 1 FROM social_attendance a JOIN social_plans p ON p.id=a.plan_id JOIN members m ON m.group_id=p.group_id AND m.user_id=p.organizer WHERE p.group_id=? AND a.member_id=? AND a.state IS NOT NULL LIMIT 1', (group, user)).fetchone()
    if authored is None and attendance is None:
        return
    def own_plans():
        for row in store._export_rows('SELECT p.*,sp.display_name FROM social_plans p JOIN members m ON m.group_id=p.group_id AND m.user_id=p.organizer LEFT JOIN shared_profiles sp ON sp.user_id=p.organizer WHERE p.group_id=? AND p.organizer=?',
                                     (group, user), [('p.id', 'id', False)]):
            value = _view(store, user, row)
            value.pop('participants')
            value.pop('attendance')
            yield value
    def own_attendance():
        for row in store._export_rows('SELECT a.plan_id,a.state,a.revision,a.updated_at FROM social_attendance a JOIN social_plans p ON p.id=a.plan_id JOIN members m ON m.user_id=p.organizer AND m.group_id=p.group_id WHERE p.group_id=? AND a.member_id=? AND a.state IS NOT NULL',
                                     (group, user), [('a.plan_id', 'plan_id', False)]):
            yield dict(plan=row['plan_id'], state=row['state'], revision=row['revision'], updated_at=row['updated_at'])
    fingerprint.json_member('social.json', dict(plans=ExportArray(own_plans()), attendance=ExportArray(own_attendance())), archive, ensure_ascii=False)
