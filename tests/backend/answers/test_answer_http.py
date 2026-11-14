import http.client
import json
import threading
import unittest
from http.server import HTTPServer
from tests.backend.answers import test_answers
from mazi.answers.server import handler_for


class ApiTests(unittest.TestCase):
    setUp = test_answers.AnswerTests.setUp
    tearDown = test_answers.AnswerTests.tearDown
    submit = test_answers.AnswerTests.submit
    process = test_answers.AnswerTests.process

    def test_generation_and_processing_are_retired_without_usage_or_consent_mutation(self):
        server = HTTPServer(('127.0.0.1', 0), handler_for(self.store))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        token = self.store.login('ben@example.test', 'correct horse battery')
        def request(method, path, body=None, **headers):
            conn = http.client.HTTPConnection('127.0.0.1', server.server_port)
            defaults = {'Cookie':'mazi_session=' + token, 'Content-Type':'application/json'}
            defaults.update(headers)
            conn.request(method, path, json.dumps(body) if body is not None else None, defaults)
            response = conn.getresponse()
            result = response.status, response.read(), dict(response.getheaders())
            conn.close()
            return result
        try:
            body = {'group':self.group, 'question':'When was bicycle?'}
            before = json.loads(request('GET', '/api/answers/state?group=' + self.group)[1])
            for path in ('/api/answers/ask', '/api/answers/processing'):
                status, data, headers = request('POST', path, {**body, 'enabled': True})
                self.assertEqual(status, 410)
                self.assertIn('retired', json.loads(data)['error'])
                self.assertIn('no-store', headers['Cache-Control'])
                self.assertEqual(request('POST', path, body, Origin='https://evil.test')[0], 403)
            after = json.loads(request('GET', '/api/answers/state?group=' + self.group)[1])
            self.assertEqual(after, before)
            for invalid in [[], {}, {'group': [], 'question':'x'}]:
                self.assertEqual(request('POST', '/api/answers/ask', invalid)[0], 400)
            link = f'/api/answers/evidence?group={self.group}&asset={self.asset}'
            self.store.answer_processing(self.alice, self.group, False, group_wide=True)
            status, data, _ = request('GET', link)
            self.assertEqual(status, 200)
            self.assertEqual(json.loads(data)['photo']['assetId'], self.asset)
            self.store.hide(self.ben, self.asset, True)
            self.assertEqual(request('GET', link)[0], 403)
            token = self.store.login('outsider@example.test', 'correct horse battery')
            self.assertEqual(request('POST', '/api/answers/ask', body)[0], 403)
            self.assertEqual(request('GET', link)[0], 403)
        finally:
            server.shutdown()
            thread.join()
            server.server_close()
