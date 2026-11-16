"""Read normalized source messages without inventing a photograph or an AI answer."""
import json
import re
import time

from mazi.archive.photo_context import hidden_event_assets
from mazi.capacity import CapacityExceeded

PAGE_ROWS = 256
ROW_BYTES = 65536


def _rows(store, user, group, cursor='', record=None):
    size = 'octet_length(i.payload)' if getattr(store.db, 'hosted', False) else 'length(CAST(i.payload AS BLOB))'
    where = 'i.id=?' if record is not None else 'i.id>?'
    return store.db.execute(f'''SELECT i.id,i.asset_id,i.run_id,{size} AS payload_bytes,
        CASE WHEN {size}<={ROW_BYTES} THEN i.payload ELSE NULL END AS payload
        FROM import_items i JOIN import_runs r ON r.id=i.run_id
        JOIN members owner ON owner.group_id=r.group_id AND owner.user_id=r.owner_id
        JOIN members reader ON reader.group_id=r.group_id AND reader.user_id=?
        WHERE r.group_id=? AND r.withdrawn=0 AND {where}
        AND (i.outcome='AVAILABLE_TO_GROUP' OR (i.outcome='SKIPPED' AND i.reason='NO_MEDIA'
            AND (r.state IN ('PROCESSING','COMPLETED') OR EXISTS (
                SELECT 1 FROM audit a WHERE a.target_id=r.id AND a.action='import.confirm_group_sharing'))))
        AND (i.asset_id IS NULL OR (EXISTS (SELECT 1 FROM archive_origins o
            WHERE o.asset_id=i.asset_id AND o.run_id=r.id AND o.occurrence=i.occurrence AND o.withdrawn=0)
            AND NOT EXISTS (SELECT 1 FROM discovery_hidden h WHERE h."user"=? AND h.asset=i.asset_id)))
        ORDER BY i.id LIMIT {PAGE_ROWS + 1}''', (user, group, record if record is not None else cursor, user)).fetchall()


def _record(row):
    if row['payload'] is None:
        raise CapacityExceeded('Conversation source exceeds the 64 KiB record limit; no partial context returned')
    payload = json.loads(row['payload'])
    messages = payload.get('context') or []
    locator = (payload.get('original_metadata_reference') or '').rsplit('#', 1)[-1]
    primary = next((message for message in messages if message.get('locator') == locator), None)
    if primary is None:
        return None
    source = payload.get('source_type', '')
    conversation = payload.get('conversation') or payload.get('channel') or {}
    return dict(id=row['id'], source=source, conversation=conversation.get('label') or conversation.get('id') or source,
                sender=(primary.get('sender') or {}).get('label') or 'Kaynak katılımcısı',
                sharedAt=str(primary.get('shared_at') or ''), text=str(primary.get('text') or ''),
                hasPhoto=row['asset_id'] is not None, sourceRef=payload.get('original_metadata_reference', ''), messages=messages)


def conversations(store, user, group, query='', cursor='', limit=50, source='', shared_by=''):
    if not isinstance(query, str) or len(query) > 500 or len(cursor) > 200 or not 1 <= limit <= 50:
        raise ValueError('Invalid conversation search')
    terms = set(re.findall(r'\w+', query.casefold()))
    sources = set(source.split(',')) if source else set()
    senders = set(json.loads(shared_by)) if shared_by.startswith('[') else ({shared_by} if shared_by else set())
    if not all(isinstance(value, str) for value in senders):
        raise ValueError('Invalid sender filter')
    started = time.perf_counter()
    with store.transaction():
        store._member(user, group)
        hidden = hidden_event_assets(store, user, group)
        rows = _rows(store, user, group, cursor)
        items, after, scanned = [], cursor, 0
        for row in rows[:PAGE_ROWS]:
            if time.perf_counter() - started > 2:
                raise CapacityExceeded('Conversation scan exceeded its time budget; retry or narrow the query')
            after, scanned = row['id'], scanned + 1
            if row['asset_id'] in hidden:
                continue
            value = _record(row)
            if not value or (sources and value['source'] not in sources) or (senders and value['sender'] not in senders):
                continue
            words = set(re.findall(r'\w+', ' '.join([value['text'], value['sender'], value['conversation']]).casefold()))
            if terms and terms <= words:
                items.append({key: val for key, val in value.items() if key not in ('messages', 'sourceRef')})
                if len(items) == limit:
                    break
        more = scanned < len(rows)
        return dict(items=items, next_cursor=after if more else None, complete=not more)


def context(store, user, group, record):
    if not isinstance(record, str) or not record or len(record) > 200:
        raise ValueError('Invalid source record')
    with store.transaction():
        store._member(user, group)
        rows = _rows(store, user, group, record=record)
        if not rows or rows[0]['asset_id'] in hidden_event_assets(store, user, group):
            raise LookupError('Source context unavailable')
        value = _record(rows[0])
        if value is None:
            raise LookupError('Source context unavailable')
        return value
