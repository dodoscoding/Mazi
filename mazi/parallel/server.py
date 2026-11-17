"""HTTP entry points with authorization before admission and after generation."""
import json
from urllib.parse import urlsplit
from mazi.identity.core import Denied
from mazi.persistence import ArchiveBusy
from mazi.http_origin import validate_origin
from . import engine
from .contract import Declined, validate_request
from .provider import generate, BadOutput, Unavailable


def handler_for(store, parent):
    if engine.enabled():
        engine.initialize(store)

    class Handler(parent):
        def parallel(self, action):
            if not engine.enabled():
                return self.json(404, {'error': 'Not found'})
            try:
                profile = store.shared_session(self.token())
                if action == 'config':
                    return self.json(200, {'enabled': True, 'provider': 'fake', 'noticeVersion': engine.NOTICE_VERSION,
                                           'accepted': engine.accepted(store, profile)})
                validate_origin(self.headers.get('Origin'), self.headers.get('Host', ''))
                if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                    raise ValueError('JSON required')
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 8192:
                    raise ValueError('Request must be at most 8 KiB')
                body = json.loads(self.rfile.read(length))
                if not isinstance(body, dict):
                    raise ValueError('Object required')
                if action == 'notice':
                    engine.accept(store, profile, body.get('version'))
                    return self.json(200, {'ok': True})
                request = validate_request(body)
                engine.reserve(store, profile)
                # The bridge injects this callback; local HTTP remains single threaded.
                run = getattr(self, 'parallel_without_lock', lambda work: work())
                result = run(lambda: generate(request))
                current = store.shared_session(self.token())
                if current['user_id'] != profile['user_id'] or current['group_id'] != profile['group_id']:
                    raise Denied('Access changed')
                if not engine.enabled():
                    return self.json(404, {'error': 'Not found'})
                return self.json(200, result)
            except engine.NoticeRequired:
                return self.json(403, {'error': 'Accept the story notice before continuing.', 'code': 'parallel_notice'})
            except engine.QuotaReached:
                return self.json(400, {'error': 'The daily story limit has been reached. Try again tomorrow UTC.', 'code': 'parallel_quota'})
            except Declined as exc:
                return self.json(422, {'error': str(exc), 'code': 'parallel_declined'})
            except Denied:
                return self.json(403, {'error': 'Your access changed. Sign in again.'})
            except BadOutput:
                return self.json(502, {'error': 'The story response was invalid. Please retry.', 'code': 'parallel_bad_output'})
            except (Unavailable, ArchiveBusy):
                return self.json(503, {'error': 'Story service unavailable. Please retry.', 'code': 'parallel_unavailable'})
            except (ValueError, TypeError, KeyError):
                return self.json(400, {'error': 'Invalid story request.', 'code': 'parallel_invalid'})

        def do_GET(self):
            if urlsplit(self.path).path == '/api/parallel/config':
                return self.parallel('config')
            return super().do_GET()

        def do_POST(self):
            path = urlsplit(self.path).path
            if path in ('/api/parallel/notice', '/api/parallel/chapter'):
                return self.parallel(path.rsplit('/', 1)[1])
            return super().do_POST()
    return Handler
