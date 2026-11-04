"""Local People/search UI with the complete existing archive routes."""
import json

from mazi.capacity import CapacityExceeded
from mazi.persistence import ArchiveBusy
from mazi.http_origin import validate_origin
import os
import threading
from http.server import HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from mazi.identity.core import Conflict, Denied
from mazi.sources.server import handler_for as source_handler, worker
from .discovery import DiscoveryStore



def handler_for(store):
    class Handler(source_handler(store)):
        def do_GET(self):
            parts = urlsplit(self.path)
            if not parts.path.startswith('/api/discovery/'):
                return super().do_GET()
            try:
                user = self.user()
                query = {key: values[0] for key, values in parse_qs(parts.query).items()}
                group = query.pop('group', '')
                if parts.path in ('/api/discovery/search', '/api/discovery/matches'):
                    for field in ('offset', 'limit'):
                        if field in query:
                            query[field] = int(query[field])
                    return self.json(200, (store.photo_matches if parts.path.endswith('/matches') else store.search)(user, group, **query))
                if parts.path == '/api/discovery/state':
                    return self.json(200, dict(people=store.people(user, group, manage=True), memories=store.accepted_events(user, group), hidden_memories=store.hidden_events(user, group), hidden=store.hidden(user, group), suppressed=store.suppressed(user, group), identities=store.identity_requests(user, group), settings=store.settings(user, group)))
                return self.json(404, {'error': 'Not found'})
            except Conflict as exc:
                self.json(409, {'error': str(exc)})
            except CapacityExceeded as exc:
                return self.json(400, {"error": str(exc), "code": "capacity_exceeded"})
            except ArchiveBusy:
                return self.json(503, {"error": "Archive is busy; retry shortly"})
            except Denied as exc:
                self.json(403, {'error': str(exc)})
            except (ValueError, TypeError):
                self.json(400, {'error': 'Invalid request'})
            except OSError:
                self.json(503, {'error': 'Media unavailable; retry later'})

        def do_POST(self):
            path = urlsplit(self.path).path
            if not path.startswith('/api/discovery/'):
                return super().do_POST()
            try:
                validate_origin(self.headers.get('Origin'), self.headers.get('Host', ''))
                if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                    raise ValueError('JSON required')
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= 16 * 1024:
                    raise ValueError('Invalid size')
                body = json.loads(self.rfile.read(size))
                if not isinstance(body, dict):
                    raise ValueError('Expected object')
                for field in ('group', 'person', 'asset', 'account', 'event'):
                    if field in body and (not isinstance(body[field], str) or len(body[field]) > 200):
                        raise ValueError('Invalid identifier')
                user = self.user()
                if path == '/api/discovery/index':
                    return self.json(200, store.index_batch(user, body['group'], body.get('limit', 2)))
                if path == '/api/discovery/person':
                    return self.json(201, {'id': store.create_person(user, body['group'], body['name'])})
                elif path == '/api/discovery/tag':
                    store.tag(user, body['person'], body['asset'], body['confirmed'])
                elif path == '/api/discovery/untag':
                    store.untag(user, body['person'], body['asset'])
                elif path == '/api/discovery/identity/propose':
                    store.propose_identity(user, body['person'], body['account'])
                elif path == '/api/discovery/identity/confirm':
                    store.confirm_identity(user, body['person'])
                elif path == '/api/discovery/disassociate':
                    store.disassociate(user, body['person'], body['asset'])
                elif path == '/api/discovery/restore':
                    store.restore_association(user, body['person'], body['asset'])
                elif path == '/api/discovery/nonmember-review':
                    store.nonmember_review(user, body['person'], body['asset'], body['verified'], body.get('restore', False))
                elif path == '/api/discovery/hide-memory':
                    store.hide_event(user, body['group'], body['event'], body['enabled'])
                elif path == '/api/discovery/hide':
                    store.hide(user, body['asset'], body['enabled'])
                elif path == '/api/discovery/processing':
                    store.processing(user, body['group'], body['enabled'], body.get('group_wide', False))
                else:
                    return self.json(404, {'error': 'Not found'})
                self.json(200, {'ok': True})
            except CapacityExceeded as exc:
                return self.json(400, {"error": str(exc), "code": "capacity_exceeded"})
            except ArchiveBusy:
                return self.json(503, {"error": "Archive is busy; retry shortly"})
            except Denied as exc:
                self.json(403, {'error': str(exc)})
            except Conflict as exc:
                self.json(409, {'error': str(exc)})
            except (KeyError, ValueError, TypeError):
                self.json(400, {'error': 'Invalid request'})
    return Handler

