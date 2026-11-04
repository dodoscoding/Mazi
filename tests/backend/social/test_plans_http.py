import http.client
import json
import threading
from http.server import HTTPServer

from mazi.server import handler_for
from tests.backend.social.test_plans import PlansFixture


class PlansHttpTests(PlansFixture):
    def setUp(self):
        super().setUp()
        code = self.store.setup_shared(admin_name='Alice', group_id=self.group,
                                       mappings={'Alice': self.alice, 'Ben': self.ben})
        self.tokens = {user: self.store.enter_shared(code=code, name=name)[1]
                       for user, name in ((self.alice, 'Alice'), (self.ben, 'Ben'))}
        self.server = HTTPServer(('127.0.0.1', 0), handler_for(self.store))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.stop_server)

    def stop_server(self):
        self.server.shutdown()
        self.thread.join()
        self.server.server_close()

    def request(self, path, body=None, user=None, authenticated=True, origin=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=30)
        headers = {'Cookie': 'mazi_session=' + self.tokens[user or self.alice]} if authenticated else {}
        if body is not None:
            headers['Content-Type'] = 'application/json'
        if origin:
            headers['Origin'] = origin
        connection.request('GET' if body is None else 'POST', path,
                           None if body is None else json.dumps(body), headers)
        response = connection.getresponse()
        status, data = response.status, response.read()
        connection.close()
        return status, json.loads(data)

    def payload(self, key='new'):
        return dict(group=self.group, request_key=key, title='Saturday', start_local='2030-06-01T18:00', timezone='Europe/Copenhagen')

    def test_authenticated_plan_journey_and_active_participant_names(self):
        status, plan = self.request('/api/social/plans/create', self.payload())
        self.assertEqual(status, 200)
        status, joined = self.request('/api/social/attendance', dict(group=self.group, plan=plan['id'], state='yes', request_key='join'), user=self.ben)
        self.assertEqual((status, joined['attendance']['yes']), (200, 1))
        self.assertEqual(joined['participants'], [dict(id=self.ben, name='Ben', state='yes')])
        status, page = self.request('/api/social/plans?group=' + self.group)
        self.assertEqual((status, [row['id'] for row in page['items']]), (200, [plan['id']]))
        status, detail = self.request('/api/social/plan?group=' + self.group + '&plan=' + plan['id'])
        self.assertEqual((status, detail['organizer']['name']), (200, 'Alice'))
        status, updated = self.request('/api/social/plans/update', dict(group=self.group, plan=plan['id'], revision=1, request_key='edit', patch={'place': 'Pier'}))
        self.assertEqual((status, updated['place'], updated['revision']), (200, 'Pier', 2))
        status, cancelled = self.request('/api/social/plans/cancel', dict(group=self.group, plan=plan['id'], revision=2, request_key='cancel'))
        self.assertEqual((status, cancelled['status']), (200, 'cancelled'))

    def test_missing_session_wrong_origin_invalid_input_and_stale_versions(self):
        self.assertEqual(self.request('/api/social/plans?group=' + self.group, authenticated=False)[0], 403)
        self.assertEqual(self.request('/api/social/plans/create', self.payload(), authenticated=False)[0], 403)
        self.assertEqual(self.request('/api/social/plans/create', self.payload(), origin='https://elsewhere.test')[0], 403)
        self.assertEqual(self.request('/api/social/plans/create', dict(self.payload(), timezone='Unknown/Zone'))[0], 400)
        self.assertEqual(self.request('/api/social/plans?group=' + self.group + '&limit=51')[0], 400)
        self.assertEqual(self.request('/api/social/plans?group=' + self.group + '&cursor=bad')[0], 400)
        _, plan = self.request('/api/social/plans/create', self.payload())
        body = dict(group=self.group, plan=plan['id'], revision=1, request_key='edit', patch={'title': 'Changed'})
        self.assertEqual(self.request('/api/social/plans/update', body)[0], 200)
        self.assertEqual(self.request('/api/social/plans/update', dict(body, request_key='stale'))[0], 409)
        self.assertEqual(self.request('/api/social/plans/delete', dict(group=self.group, plan=plan['id'], revision=2, request_key='delete'), user=self.ben)[0], 403)
        self.assertEqual(self.request('/api/social/missing', dict(group=self.group))[0], 404)

    def test_http_replay_after_delete_and_group_revocation(self):
        _, plan = self.request('/api/social/plans/create', self.payload())
        self.assertEqual(self.request('/api/social/plans/delete', dict(group=self.group, plan=plan['id'], revision=1, request_key='delete'))[0], 200)
        self.assertEqual(self.request('/api/social/plans/create', self.payload()), (200, dict(id=plan['id'], deleted=True)))
        self.store.remove_member(self.alice, self.group, self.ben)
        self.assertEqual(self.request('/api/social/plans?group=' + self.group, user=self.ben)[0], 403)
        self.assertEqual(self.request('/api/social/attendance', dict(group=self.group, plan=plan['id'], state='yes', request_key='join'), user=self.ben)[0], 403)
