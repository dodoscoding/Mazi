"""Bounded, current-access date-order context for legacy raw chat timestamps."""
import json
import time

from mazi.capacity import CapacityExceeded
from mazi.imports.adapters import date_orders, settle_date_order
from .photo_metadata import origin_timestamps, sharing_provenance


def hidden_event_assets(store, user, group):
    hidden = set()
    for row in store.db.execute('SELECT e.asset_ids FROM review_events e JOIN discovery_hidden_events h ON h.event=e.id WHERE h."user"=? AND e.group_id=?', (user, group)):
        hidden.update(json.loads(row[0]))
    return hidden


class SharingContext:
    def __init__(self, store, user, group, started, seconds, bounded=True, consume=None):
        self.store, self.user, self.group = store, user, group
        self.started, self.seconds, self.bounded = started, seconds, bounded
        self.consume = consume
        self.runs = {}
        self.bytes = self.origins = 0

    def provenance(self, run, origin):
        evidence = sharing_provenance(origin)
        if evidence['sharedAt']['ambiguous']:
            if run not in self.runs:
                self._load(run)
            conversation = (origin.get('conversation') or {}).get('id')
            evidence = sharing_provenance(origin, settle_date_order(self.runs[run].get(conversation, set())))
        return evidence

    def _load(self, run):
        self.store._member(self.user, self.group)
        hidden = hidden_event_assets(self.store, self.user, self.group)
        orders, after = {}, ''
        asset_bytes, asset_origins = {}, {}
        size = 'octet_length(o.payload)' if getattr(self.store.db, 'hosted', False) else 'length(CAST(o.payload AS BLOB))'
        payload = f'CASE WHEN {size}<=65536 THEN o.payload ELSE NULL END' if self.bounded else 'o.payload'
        while True:
            if time.perf_counter() - self.started > self.seconds:
                raise CapacityExceeded('Words & filters exceeded the local metadata scan time budget')
            rows = self.store.db.execute(f'''SELECT o.id,o.asset_id,{size} AS payload_bytes,{payload} AS payload
                FROM archive_origins o JOIN archive_assets a ON a.id=o.asset_id AND a.group_id=o.group_id
                JOIN members m ON m.group_id=o.group_id AND m.user_id=o.owner_id
                JOIN members reader ON reader.group_id=o.group_id AND reader.user_id=?
                WHERE o.group_id=? AND o.run_id=? AND o.withdrawn=0 AND o.id>?
                AND NOT EXISTS (SELECT 1 FROM discovery_hidden h WHERE h."user"=? AND h.asset=o.asset_id)
                ORDER BY o.id LIMIT 256''', (self.user, self.group, run, after, self.user)).fetchall()
            if not rows:
                break
            for row in rows:
                self.bytes += row['payload_bytes']
                self.origins += 1
                asset_bytes[row['asset_id']] = asset_bytes.get(row['asset_id'], 0) + row['payload_bytes']
                asset_origins[row['asset_id']] = asset_origins.get(row['asset_id'], 0) + 1
                if self.bounded and row['payload_bytes'] > 65536:
                    raise CapacityExceeded('Words & filters metadata exceeds the 64 KiB per-origin limit')
                if self.consume:
                    self.consume(row['payload_bytes'])
                if self.bounded and (self.bytes > 64 * 1024 * 1024 or self.origins > 100000):
                    raise CapacityExceeded('Words & filters metadata exceeds the request limit')
                if self.bounded and asset_bytes[row['asset_id']] > 8 * 1024 * 1024:
                    raise CapacityExceeded('Words & filters metadata exceeds the 8 MiB per-photograph limit')
                if self.bounded and asset_origins[row['asset_id']] > 8192:
                    raise CapacityExceeded('Local discovery exceeded its metadata origin-count budget')
                if row['asset_id'] in hidden:
                    continue
                origin = json.loads(row['payload'])
                conversation = (origin.get('conversation') or {}).get('id')
                orders.setdefault(conversation, set()).update(date_orders(origin_timestamps(origin)))
            after = rows[-1]['id']
        self.runs[run] = orders
