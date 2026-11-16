"""Current source and personal-hide authorization for bounded photograph sets."""
import json

from mazi.identity.core import Denied


def visible_photos(store, user, group, assets):
    store._member(user, group)
    slots = ','.join('?' for _ in assets)
    query = ('SELECT a.id FROM archive_assets a WHERE a.group_id=? AND a.id IN (' + slots + ') '
             'AND EXISTS(SELECT 1 FROM archive_origins o JOIN members m ON m.group_id=o.group_id AND m.user_id=o.owner_id WHERE o.asset_id=a.id AND o.group_id=a.group_id AND o.withdrawn=0) '
             'AND NOT EXISTS(SELECT 1 FROM discovery_hidden h WHERE h.asset=a.id AND h."user"=?)')
    visible = {row[0] for row in store.db.execute(query, (group, *assets, user))}
    hidden = store.db.execute('SELECT e.asset_ids FROM review_events e JOIN discovery_hidden_events h ON h.event=e.id WHERE e.group_id=? AND h."user"=?', (group, user))
    for row in hidden:
        visible.difference_update(json.loads(row[0]))
    return visible


def authorize_photos(store, user, group, assets):
    if visible_photos(store, user, group, assets) != set(assets):
        raise Denied('Photograph unavailable')
