"""Local Map and Sources UI; extends the existing archive, never binds publicly."""
import base64

from mazi.persistence import ArchiveBusy
from mazi.http_origin import validate_origin
import json
import os
import threading
import time
from http.server import HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from mazi.identity.core import Conflict, Denied
from mazi.archive.server import handler_for as review_handler
from .sources import SourceStore
from .discord import DiscordClient, ProviderDenied, RateLimited, poll_source



def handler_for(store):
    class Handler(review_handler(store)):
        def do_GET(self):
            parts = urlsplit(self.path)
            if not parts.path.startswith('/api/sources') and parts.path != '/api/places':
                return super().do_GET()
            try:
                user, query = self.user(), parse_qs(parts.query)
                group = query.get('group', [''])[0]
                if parts.path == '/api/places':
                    return self.json(200, store.places(user, group, query.get('country', [''])[0], query.get('city', [''])[0], query.get('paths', ['0'])[0] == '1'))
                if parts.path == '/api/sources':
                    return self.json(200, store.sources(user, group))
                if parts.path == '/api/sources/resources':
                    return self.json(200, store.resources(user, query.get('connection', [''])[0]))
                if parts.path == '/api/sources/original':
                    return self.send(200, store.resource_bytes(user, query.get('id', [''])[0]), 'application/octet-stream')
                return self.json(404, {'error': 'Not found'})
            except ArchiveBusy:
                return self.json(503, {"error": "Archive is busy; retry shortly"})
            except Denied as exc:
                self.json(403, {'error': str(exc)})
            except (ValueError, TypeError):
                self.json(400, {'error': 'Invalid request'})
            except OSError:
                self.json(503, {'error': 'Stored resource unavailable'})

        def do_POST(self):
            path = urlsplit(self.path).path
            if not path.startswith('/api/sources/') and path != '/api/places':
                return super().do_POST()
            try:
                validate_origin(self.headers.get('Origin'), self.headers.get('Host', ''))
                if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                    raise ValueError('JSON required')
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 768 * 1024:
                    raise ValueError('Invalid request size')
                body = json.loads(self.rfile.read(length))
                if not isinstance(body, dict):
                    raise ValueError('Expected object')
                user = self.user()
                if path == '/api/sources/create':
                    return self.json(201, {'id': store.create_source(user, body['group'], body['kind'], body['label'], body['scope'])})
                if path == '/api/sources/state':
                    store.set_source(user, body['id'], body['enabled'], body['permission'])
                elif path == '/api/sources/begin':
                    # Discord ingestion is only performed by the permission-verifying server worker.
                    if store._source(user, body['connection'])['kind'] != 'apple':
                        raise Denied('Discord resources require the bot worker')
                    return self.json(200, store.begin_resource(user, body['connection'], body['metadata'], body['size'], body['sha256']))
                elif path in ('/api/sources/chunk', '/api/sources/finish'):
                    if store._resource(user, body['id'])[1]['kind'] != 'apple':
                        raise Denied('Discord resources require the bot worker')
                    if path.endswith('/chunk'):
                        return self.json(200, {'received': store.resource_chunk(user, body['id'], body['offset'], base64.b64decode(body['data'], validate=True))})
                    store.finish_resource(user, body['id'])
                elif path == '/api/sources/withdraw':
                    store.withdraw_resource(user, body['id'])
                elif path == '/api/places':
                    store.set_place(user, body['origin'], body.get('country', ''), body.get('city', ''), body.get('latitude'), body.get('longitude'), body.get('day'))
                else:
                    return self.json(404, {'error': 'Not found'})
                self.json(200, {'ok': True})
            except ArchiveBusy:
                return self.json(503, {"error": "Archive is busy; retry shortly"})
            except Denied as exc:
                self.json(403, {'error': str(exc)})
            except Conflict as exc:
                self.json(409, {'error': str(exc)})
            except (ValueError, KeyError, TypeError):
                self.json(400, {'error': 'Invalid request'})
            except OSError:
                self.json(503, {'error': 'Storage unavailable; retry later'})
    return Handler


def settle_poll(store, user, connection, client):
    try:
        poll_source(store, user, connection, client)
    except ProviderDenied:
        try:
            store.set_source(user, connection, False, 'revoked')
        except Denied:
            pass
        return 'revoked'
    except Denied:
        return 'paused'
    return 'ok'


def worker(root, stop):
    from mazi.memories.memories import MemoryStore
    store = MemoryStore(root)
    token = os.environ.get('MAZI_DISCORD_BOT_TOKEN')
    client = DiscordClient(token) if token else None
    if client:
        store.discord_authorize = client.authorize
        store.discord_sources = set(filter(None, os.environ.get('MAZI_DISCORD_SOURCES', '').split(',')))
    next_poll = 0
    try:
        while not stop.is_set():
            try:
                if client and time.monotonic() >= next_poll:
                    next_poll = time.monotonic() + 30
                    for source in store.db.execute("SELECT * FROM continuous_sources WHERE kind='discord' AND enabled=1").fetchall():
                        if source['id'] not in store.discord_sources:
                            continue
                        settle_poll(store, source['owner_id'], source['id'], client)
                if not store.work_once():
                    stop.wait(0.5)
            except RateLimited as exc:
                next_poll = time.monotonic() + exc.seconds
                stop.wait(min(exc.seconds, 30))
            except (OSError, ValueError, Conflict):
                # Do not print credentials, URLs or private message contents. Durable state remains retryable.
                stop.wait(5)
    finally:
        store.close()

