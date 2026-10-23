"""Read-only Discord REST intake. Tokens stay in the operator environment."""
from __future__ import annotations
import hashlib
import json
import time
from datetime import datetime, timezone
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler

from mazi.identity.core import Denied


class ProviderDenied(Denied):
    pass
from mazi.imports.adapters import MAX_FILE


class RateLimited(Exception):
    def __init__(self, seconds):
        self.seconds = min(3600, max(1, float(seconds)))


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args):
        raise Denied('Redirect refused')


class DiscordClient:
    def __init__(self, token):
        self.token = token
        self.http = build_opener(NoRedirect)

    def request(self, path):
        request = Request('https://discord.com/api/v10' + path,
            headers={'Authorization': 'Bot ' + self.token, 'User-Agent': 'MaziLocal/0.1'})
        try:
            with self.http.open(request, timeout=20) as response:
                data = response.read(4 * 1024 * 1024 + 1)
                if len(data) > 4 * 1024 * 1024:
                    raise ValueError('Discord response exceeds local limit')
                return json.loads(data)
        except HTTPError as exc:
            if exc.code in (401, 403, 404):
                raise ProviderDenied('Discord access unavailable') from None
            if exc.code == 429:
                raise RateLimited(json.loads(exc.read(4096)).get('retry_after', 60)) from None
            raise

    def _permissions(self, guild):
        me = self.request('/users/@me')
        member = self.request(f'/guilds/{guild}/members/{me["id"]}')
        return me['id'], member['roles'], self.request(f'/guilds/{guild}/roles')

    def authorize(self, guild, channel):
        user, member_roles, roles = self._permissions(guild)
        info = self.request(f'/channels/{channel}')
        if info.get('guild_id') != guild or info.get('type') not in (0, 5):
            raise ProviderDenied('Only selected text and announcement channels are supported')
        if not readable(channel_permissions(guild, member_roles, roles, info.get('permission_overwrites', []), user)):
            raise ProviderDenied('View Channel and Read Message History are required')

    def readable_channels(self, guild):
        user, member_roles, roles = self._permissions(guild)
        channels = [c for c in self.request(f'/guilds/{guild}/channels') if c.get('type') in (0, 5)
                    and readable(channel_permissions(guild, member_roles, roles, c.get('permission_overwrites', []), user))]
        return [{'id': c['id'], 'name': c['name']} for c in sorted(channels, key=lambda c: c.get('position', 0))]

    def messages(self, channel, before):
        return self.request(f'/channels/{channel}/messages?limit=100&before={before}')

    def attachment(self, attachment):
        parts = urlsplit(attachment['url'])
        if parts.scheme != 'https' or parts.hostname not in ('cdn.discordapp.com', 'media.discordapp.net') or parts.port not in (None, 443) or parts.username or parts.password or not parts.path.startswith('/attachments/'):
            raise Denied('Untrusted attachment URL')
        if type(attachment.get('size')) is not int or not 0 < attachment['size'] <= MAX_FILE:
            raise ValueError('Attachment exceeds 25 MiB')
        # Never send the bot credential to the CDN. Never follow redirects.
        with self.http.open(Request(attachment['url'], headers={'User-Agent': 'MaziLocal/0.1'}), timeout=30) as response:
            data = response.read(MAX_FILE + 1)
        if len(data) != attachment['size']:
            raise ValueError('Attachment size mismatch')
        return data


ADMINISTRATOR = 1 << 3
VIEW_AND_HISTORY = (1 << 10) | (1 << 16)


def channel_permissions(guild, member_roles, roles, overwrites, user):
    owned = {guild, *member_roles}
    permissions = 0
    for role in roles:
        if role['id'] in owned:
            permissions |= int(role['permissions'])
    if permissions & ADMINISTRATOR:
        return permissions
    for layer in ([o for o in overwrites if o['id'] == guild],
                  [o for o in overwrites if o['type'] == 0 and o['id'] in member_roles],
                  [o for o in overwrites if o['type'] == 1 and o['id'] == user]):
        allow = deny = 0
        for overwrite in layer:
            allow |= int(overwrite['allow'])
            deny |= int(overwrite['deny'])
        permissions = (permissions & ~deny) | allow
    return permissions


def readable(permissions):
    return bool(permissions & ADMINISTRATOR) or permissions & VIEW_AND_HISTORY == VIEW_AND_HISTORY


def snowflake(day):
    epoch = datetime.fromisoformat(day).replace(tzinfo=timezone.utc).timestamp() * 1000
    return str(max(0, int(epoch - 1420070400000)) << 22)


def poll_source(store, user, connection, client):
    source = store._source(user, connection, True)
    scope = json.loads(source['scope'])
    if source['kind'] != 'discord':
        raise ValueError('Not a Discord source')
    store.discord_linked(source['group_id'], scope['guild'])
    for channel in scope['channels']:
        store._source(user, connection, True)
        client.authorize(scope['guild'], channel)
        row = store.db.execute('SELECT cursor FROM discord_cursors WHERE connection=? AND channel=?', (connection, channel)).fetchone()
        ceiling = int(snowflake(scope['end'])) + (86_400_000 << 22)
        initial_floor = int(snowflake(scope['start'])) - 1
        checkpoint = json.loads(row[0]) if row else {'floor': initial_floor, 'high': initial_floor, 'before': ceiling, 'closed': False}
        if checkpoint['closed']:
            continue
        # Page backwards from the selected upper bound. This never skips a busy channel's backlog.
        messages = sorted(client.messages(channel, str(checkpoint['before'])), key=lambda message: int(message['id']), reverse=True)
        if any(int(message['id']) >= checkpoint['before'] for message in messages):
            raise ValueError('Discord pagination did not advance')
        for message in messages:
            current = store._source(user, connection, True)
            if current['generation'] != source['generation']:
                raise Denied('Source selection changed')
            if message.get('channel_id') != channel:
                raise Denied('Unexpected channel')
            if int(message['id']) <= checkpoint['floor']:
                continue
            checkpoint['high'] = max(checkpoint['high'], int(message['id']))
            day = message['timestamp'][:10]
            if scope['start'] <= day <= scope['end']:
                if not message.get('attachments'):
                    store.record_source_outcome(user, connection, {'item': message['id'], 'filename': 'Message without accessible attachments', 'component': 'message', 'version': 'original'}, 'NO_MEDIA_OR_CONTENT_UNAVAILABLE')
                for attachment in message.get('attachments', []):
                    client.authorize(scope['guild'], channel)
                    try:
                        data = client.attachment(attachment)
                    except ProviderDenied:
                        raise
                    except (ValueError, Denied):
                        store.record_source_outcome(user, connection, {'item': message['id'], 'filename': attachment.get('filename', 'Attachment'), 'component': attachment['id'], 'version': message.get('edited_timestamp') or 'original'}, 'UNSUPPORTED_SIZE_OR_INVALID_RESOURCE')
                        continue
                    metadata = dict(item=message['id'], component=attachment['id'],
                        version=message.get('edited_timestamp') or 'original', filename=attachment['filename'],
                        date=day, kind='image' if attachment.get('content_type', '').startswith('image/') else 'video',
                        guild=scope['guild'], channel=channel,
                        text=message.get('content', '')[:2000], sender=message.get('author', {}).get('id', ''),
                        shared_at=message['timestamp'])
                    try:
                        resource = store.begin_resource(user, connection, metadata, len(data), hashlib.sha256(data).hexdigest())
                    except ValueError:
                        store.record_source_outcome(user, connection, {'item': message['id'], 'filename': attachment.get('filename', 'Attachment'), 'component': attachment['id'], 'version': metadata['version']}, 'INVALID_RESOURCE_METADATA')
                        continue
                    if resource['state'] == 'UPLOADING':
                        for offset in range(resource['received'], len(data), 512 * 1024):
                            store._source(user, connection, True)
                            client.authorize(scope['guild'], channel)
                            store.resource_chunk(user, resource['id'], offset, data[offset:offset + 512 * 1024])
                    client.authorize(scope['guild'], channel)
                    store.finish_resource(user, resource['id'])
        finished = not messages or len(messages) < 100 or min(int(m['id']) for m in messages) <= checkpoint['floor']
        if finished:
            checkpoint['floor'] = checkpoint['high']
            checkpoint['before'] = ceiling
            checkpoint['closed'] = int((time.time() * 1000 - 1420070400000)) << 22 >= ceiling
        else:
            checkpoint['before'] = min(int(m['id']) for m in messages)
        with store.transaction():
            current = store._source(user, connection, True)
            if current['generation'] != source['generation']:
                raise Denied('Source changed before checkpoint')
            store.db.execute('INSERT INTO discord_cursors VALUES(?,?,?) ON CONFLICT(connection,channel) DO UPDATE SET cursor=excluded.cursor', (connection, channel, json.dumps(checkpoint)))
