"""Authenticated HTTP adapter for private social contributions."""
import json
from urllib.parse import parse_qs, urlsplit

from mazi.http_origin import validate_origin
from mazi.identity.core import Conflict, Denied
from mazi.memories.server import handler_for as memory_handler
from mazi.persistence import ArchiveBusy
from mazi.capacity import CapacityExceeded
from . import conversations, home, labels, reactions, social


def handler_for(store):
    class Handler(memory_handler(store)):
        def do_GET(self):
            parts = urlsplit(self.path)
            if not parts.path.startswith('/api/social/'):
                return super().do_GET()
            try:
                query = {key: values[0] for key, values in parse_qs(parts.query).items()}
                user = self.user()
                if parts.path == '/api/social/home':
                    return self.json(200, home.home_view(store, user, query['group']))
                if parts.path == '/api/social/activity':
                    return self.json(200, home.activity(store, user, query['group'], limit=int(query.get('limit', '20')), cursor=query.get('cursor')))
                if parts.path == '/api/social/labels':
                    return self.json(200, labels.read_labels(store, user, query['group'], json.loads(query['assets'])))
                if parts.path == '/api/social/reactions/batch':
                    return self.json(200, reactions.batch_reactions(store, user, query['group'], json.loads(query['targets'])))
                if parts.path == '/api/social/reactions':
                    return self.json(200, reactions.reactions(store, user, query['group'], dict(kind=query['kind'], id=query['target'])))
                if parts.path == '/api/social/comments':
                    return self.json(200, conversations.comments(store, user, query['group'], dict(kind=query['kind'], id=query['target']),
                        limit=int(query.get('limit', '20')), cursor=query.get('cursor')))
                if parts.path == '/api/social/plans':
                    return self.json(200, social.plans(store, user, query['group'], scope=query.get('scope', 'upcoming'),
                        limit=int(query.get('limit', '20')), cursor=query.get('cursor')))
                if parts.path == '/api/social/plan':
                    return self.json(200, social.get_plan(store, user, query['group'], query['plan']))
                return self.json(404, {'error': 'Not found'})
            except CapacityExceeded as exc:
                return self.json(400, {'code': 'capacity_exceeded', 'error': str(exc)})
            except ArchiveBusy:
                return self.json(503, {'error': 'Archive is busy; retry shortly'})
            except Denied as exc:
                return self.json(403, {'error': str(exc)})
            except (KeyError, ValueError, TypeError):
                return self.json(400, {'error': 'Invalid request'})

        def do_POST(self):
            path = urlsplit(self.path).path
            if not path.startswith('/api/social/'):
                return super().do_POST()
            try:
                validate_origin(self.headers.get('Origin'), self.headers.get('Host', ''))
                if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                    raise ValueError('JSON required')
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= 32768:
                    raise ValueError('Invalid request size')
                body = json.loads(self.rfile.read(size))
                if not isinstance(body, dict) or not isinstance(body.get('group'), str) or not 0 < len(body['group']) <= 200:
                    raise ValueError('Invalid group')
                user, group = self.user(), body['group']
                if path == '/api/social/labels/set':
                    return self.json(200, labels.set_labels(store, user, group, body['request_key'], body['items']))
                if path == '/api/social/reactions/set':
                    return self.json(200, reactions.set_reaction(store, user, group, body['request_key'], body['target'], body['emoji'], body['active']))
                if path == '/api/social/comments/create':
                    return self.json(200, conversations.create_comment(store, user, group, body['request_key'], body['target'], body['text']))
                if path == '/api/social/comments/update':
                    return self.json(200, conversations.update_comment(store, user, group, body['comment'], body['revision'], body['request_key'], body['text']))
                if path == '/api/social/comments/delete':
                    return self.json(200, conversations.delete_comment(store, user, group, body['comment'], body['revision'], body['request_key']))
                if path == '/api/social/plans/create':
                    data = {key: value for key, value in body.items() if key not in ('group', 'request_key')}
                    return self.json(200, social.create_plan(store, user, group, body['request_key'], data))
                if path == '/api/social/plans/update':
                    return self.json(200, social.update_plan(store, user, group, body['plan'], body['revision'], body['request_key'], body['patch']))
                if path == '/api/social/plans/cancel':
                    return self.json(200, social.cancel_plan(store, user, group, body['plan'], body['revision'], body['request_key']))
                if path == '/api/social/plans/delete':
                    return self.json(200, social.delete_plan(store, user, group, body['plan'], body['revision'], body['request_key']))
                if path == '/api/social/attendance':
                    return self.json(200, social.set_attendance(store, user, group, body['plan'], body['state'], body['request_key']))
                return self.json(404, {'error': 'Not found'})
            except ArchiveBusy:
                return self.json(503, {'error': 'Archive is busy; retry shortly'})
            except Denied as exc:
                return self.json(403, {'error': str(exc)})
            except Conflict as exc:
                return self.json(409, {'error': str(exc)})
            except (KeyError, ValueError, TypeError) as exc:
                return self.json(400, {'error': str(exc) if isinstance(exc, ValueError) else 'Invalid request'})
    return Handler
