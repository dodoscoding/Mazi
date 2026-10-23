"""Local Map and Sources UI; extends the existing archive, never binds publicly."""
import base64

from mazi.capacity import CapacityExceeded
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
            except CapacityExceeded as exc:
                return self.json(400, {"error": str(exc), "code": "capacity_exceeded"})
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


IDLE_SECONDS = 0.5


class Worker:
    """One unit of background work, shared by the always-on thread and request-driven drains."""

    def __init__(self, store):
        self.store = store
        token = os.environ.get('MAZI_DISCORD_BOT_TOKEN')
        self.client = DiscordClient(token) if token else None
        if self.client:
            store.discord_authorize = self.client.authorize
        self.next_poll = 0

    def step(self):
        """Return seconds to wait before the next step; 0 means more work is ready."""
        try:
            if self.client and time.monotonic() >= self.next_poll:
                self.next_poll = time.monotonic() + 30
                for source in self.store.db.execute("SELECT * FROM continuous_sources WHERE kind='discord' AND enabled=1").fetchall():
                    settle_poll(self.store, source['owner_id'], source['id'], self.client)
            return 0 if self.store.work_once() else IDLE_SECONDS
        except RateLimited as exc:
            self.next_poll = time.monotonic() + exc.seconds
            return min(exc.seconds, 30)
        except (OSError, ValueError, Conflict):
            # Do not print credentials, URLs or private message contents. Durable state remains retryable.
            return 5


def worker(root, stop):
    from mazi.memories.memories import MemoryStore
    store = MemoryStore(root)
    work = Worker(store)
    try:
        while not stop.is_set():
            delay = work.step()
            if delay:
                stop.wait(delay)
    finally:
        store.close()


def drain(work, budget_seconds):
    """Run steps until the queue is idle or the cooperative budget is spent."""
    deadline = time.monotonic() + budget_seconds
    while time.monotonic() < deadline:
        delay = work.step()
        if delay == IDLE_SECONDS:
            work.store.reconcile()
        if delay:
            return {'pending': False}
    return {'pending': True}
