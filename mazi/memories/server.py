"""Loopback-only Advanced memories, inheriting import/review/discovery routes."""
import json

from mazi.persistence import ArchiveBusy
import os
import threading
from http.server import HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from mazi.identity.core import Conflict, Denied
from mazi.answers.server import handler_for as discovery_handler, worker
from .memories import MemoryStore



def handler_for(store):
    class Handler(discovery_handler(store)):
        def do_GET(self):
            parts = urlsplit(self.path)
            if not parts.path.startswith('/api/memories/'):
                return super().do_GET()
            try:
                user = self.user()
                query = {key: values[0] for key, values in parse_qs(parts.query).items()}
                if parts.path == '/api/memories/capsules':
                    return self.json(200, store.capsules(user, query['group']))
                if parts.path == '/api/memories/capsule':
                    return self.json(200, store.capsule(user, query['group'], query['capsule']))
                if parts.path == '/api/memories/capsule-export':
                    return self.json(200, store.capsule_export(user, query['group'], query['capsule']))
                if parts.path == '/api/memories/capsule-photo':
                    return self.send(200, store.capsule_photo(user, query['group'], query['capsule']), 'image/jpeg')
                if parts.path == '/api/memories/notifications':
                    return self.json(200, store.notifications(user, query['group']))
                if parts.path == '/api/memories/frame':
                    return self.send(200, store.story_frame(user, query['group'], query['story'], query['asset']), 'image/jpeg')
                if parts.path == '/api/memories/recap':
                    return self.json(200, store.recap(user, query['group'], int(query['year'])))
                if parts.path == '/api/memories/stories':
                    return self.json(200, store.stories(user, query['group']))
                if parts.path in ('/api/memories/story', '/api/memories/export'):
                    return self.json(200, store.story(user, query['group'], query['story']))
                return self.json(404, {'error': 'Not found'})
            except ArchiveBusy:
                return self.json(503, {"error": "Archive is busy; retry shortly"})
            except Denied as exc:
                self.json(403, {'error': str(exc)})
            except (KeyError, TypeError, ValueError):
                self.json(400, {'error': 'Invalid request'})

        def do_POST(self):
            path = urlsplit(self.path).path
            if not path.startswith('/api/memories/'):
                return super().do_POST()
            try:
                origin = self.headers.get('Origin')
                if origin and origin != 'http://' + self.headers.get('Host', ''):
                    raise Denied('Invalid origin')
                if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                    raise ValueError('JSON required')
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= 3000000:
                    raise ValueError('Invalid size')
                body = json.loads(self.rfile.read(size))
                if not isinstance(body, dict) or not isinstance(body.get('group'), str) or len(body['group']) > 200:
                    raise ValueError('Invalid request')
                user = self.user()
                if path == '/api/memories/seal':
                    return self.json(200, store.seal_capsule(user, body['group'], body['title'], body['text'], body['unlock_at'], body.get('photo', '')))
                if path == '/api/memories/delete-capsule':
                    store.delete_capsule(user, body['group'], body['capsule'])
                    return self.json(200, {'ok': True})
                if path == '/api/memories/notifications':
                    store.notification_opt_in(user, body['group'], body['enabled'])
                    return self.json(200, {'ok': True})
                if path == '/api/memories/subevents':
                    return self.json(200, store.save_subevents(user, body['group'], body['story'], body['revision'], body['sections']))
                if path == '/api/memories/video':
                    return self.send(200, store.story_video(user, body['group'], body['story']), 'video/x-msvideo')
                if path == '/api/memories/create':
                    return self.json(200, store.create_story(user, body['group'], body['event']))
                if path == '/api/memories/write':
                    return self.json(200, store.write_story(user, body['group'], body['story'], body['revision'], body['text']))
                if path == '/api/memories/delete':
                    store.delete_story(user, body['group'], body['story'], body['revision'])
                    return self.json(200, {'ok': True})
                return self.json(404, {'error': 'Not found'})
            except ArchiveBusy:
                return self.json(503, {"error": "Archive is busy; retry shortly"})
            except Denied as exc:
                self.json(403, {'error': str(exc)})
            except Conflict as exc:
                self.json(409, {'error': str(exc)})
            except (KeyError, ValueError, TypeError):
                self.json(400, {'error': 'Invalid request'})
    return Handler

