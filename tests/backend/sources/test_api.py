import base64
import hashlib
import io
import json
import threading
import unittest
from http.server import HTTPServer
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from tests.backend.sources import test_discord, test_sources
from mazi.sources.discord import TOKEN_URL, DiscordClient
from mazi.sources.server import handler_for


class FakeOpener:
    def __init__(self, responses):
        self.responses, self.requests = responses, []

    def open(self, request, timeout):
        self.requests.append(request)
        return io.BytesIO(json.dumps(self.responses[request.full_url]).encode())


class ApiTests(unittest.TestCase):
    def setUp(self):
        test_sources.SourceTests.setUp(self)
        self.server = HTTPServer(('127.0.0.1', 0), handler_for(self.store))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = 'http://127.0.0.1:' + str(self.server.server_port)
        self.cookie = 'mazi_session=' + self.store.login('alice@example.test', 'correct horse battery')

    def tearDown(self):
        self.server.shutdown(); self.thread.join(); self.server.server_close()
        test_sources.SourceTests.tearDown(self)

    def request(self, path, body=None, cookie=None):
        request = Request(self.base+path, data=json.dumps(body).encode() if body is not None else None,
            headers={'Content-Type':'application/json','Cookie':cookie if cookie is not None else self.cookie})
        try:
            with urlopen(request) as response:
                return response.status, response.read(), response.headers
        except HTTPError as response:
            return response.code, response.read(), response.headers

    def test_native_protocol_resume_revoke_and_no_discord_bypass(self):
        from tests.backend.imports.test_engine import picture
        data = picture()
        payload = {'connection': self.connection, 'metadata':dict(item='native',component='photo',version='v1',filename='native.jpg',date='2024-02-03',kind='image',albums=[]), 'size':len(data), 'sha256':hashlib.sha256(data).hexdigest()}
        status, body, _ = self.request('/api/sources/begin',payload)
        self.assertEqual(status,200);resource=json.loads(body)['id']
        chunk={'id':resource,'offset':0,'data':base64.b64encode(data[:100]).decode()}
        self.assertEqual(self.request('/api/sources/chunk',chunk)[0],200)
        self.assertEqual(json.loads(self.request('/api/sources/begin',payload)[1])['received'],100)
        self.assertEqual(self.request('/api/sources/state',{'id':self.connection,'enabled':False,'permission':'revoked'})[0],200)
        self.assertEqual(self.request('/api/sources/chunk',chunk)[0],403)
        self.assertEqual(self.request('/api/sources/resources?connection='+self.connection,cookie='')[0],403)
        self.assertEqual(self.request('/api/sources/create',{'group':self.group,'kind':'apple','label':'x','scope':{}})[0],400)
        test_discord.link(self.store,self.alice,self.group)
        discord=self.store.create_source(self.alice,self.group,'discord','Guild',{'guild':'10','channels':['20'],'start':'2020-01-01','end':'2030-01-01'})
        payload['connection']=discord
        self.assertEqual(self.request('/api/sources/begin',payload)[0],403)
        status,_,headers=self.request('/api/groups')
        self.assertEqual(status,200)
        self.assertEqual(headers['Cache-Control'],'no-store')
        self.assertIn("default-src 'self'",headers['Content-Security-Policy'])

    def test_member_connects_a_discord_server_and_picks_from_its_readable_channels(self):
        client = DiscordClient('synthetic-bot-token', '123456', 'synthetic-secret')
        client.http = FakeOpener({TOKEN_URL: {'access_token': 'synthetic-user-token', 'guild': {'id': '77', 'name': 'Lake house'}}})
        read = str((1 << 10) | (1 << 16))
        client.request = {'/users/@me': {'id': '30'}, '/guilds/77/members/30': {'roles': []},
            '/guilds/77/roles': [{'id': '77', 'permissions': read}],
            '/guilds/77/channels': [{'id': '71', 'name': 'photos', 'type': 0, 'position': 0},
                {'id': '72', 'name': 'staff', 'type': 0, 'position': 1, 'permission_overwrites': [{'id': '77', 'type': 0, 'allow': '0', 'deny': read}]}]}.__getitem__
        ben = 'mazi_session=' + self.store.login('ben@example.test', 'correct horse battery')
        with patch('mazi.sources.server.discord_from_env', return_value=client):
            status, body, _ = self.request('/api/sources/discord/connect', {'group': self.group})
            self.assertEqual(status, 200)
            url = urlsplit(json.loads(body)['url'])
            query = {key: value[0] for key, value in parse_qs(url.query).items()}
            state = query.pop('state')
            self.assertEqual((url.scheme, url.netloc, url.path), ('https', 'discord.com', '/oauth2/authorize'))
            self.assertEqual(query, {'client_id': '123456', 'scope': 'bot identify', 'permissions': '66560',
                'response_type': 'code', 'redirect_uri': self.base + '/places'})
            self.assertEqual(self.request('/api/sources/discord/link', {'state': state, 'code': 'synthetic-code'}, cookie=ben)[0], 403)
            self.assertEqual(self.request('/api/sources/discord/link', {'state': state, 'code': 'synthetic-code'})[0], 403)
            state = parse_qs(urlsplit(json.loads(self.request('/api/sources/discord/connect', {'group': self.group})[1])['url']).query)['state'][0]
            status, body, _ = self.request('/api/sources/discord/link', {'state': state, 'code': 'synthetic-code'})
            self.assertEqual((status, json.loads(body)), (200, {'guild': {'id': '77', 'name': 'Lake house'}}))
            self.assertEqual(parse_qs(client.http.requests[0].data.decode()), {'grant_type': ['authorization_code'],
                'code': ['synthetic-code'], 'redirect_uri': [self.base + '/places'], 'client_id': ['123456'], 'client_secret': ['synthetic-secret']})
            self.assertEqual(len(client.http.requests), 1)
            self.assertEqual(self.request('/api/sources/discord/link', {'state': state, 'code': 'synthetic-code'})[0], 403)
            self.assertEqual(json.loads(self.request('/api/sources/discord/guilds?group=' + self.group, cookie=ben)[1]), [{'id': '77', 'name': 'Lake house'}])
            status, body, _ = self.request(f'/api/sources/discord/channels?group={self.group}&guild=77')
            self.assertEqual((status, json.loads(body)), (200, [{'id': '71', 'name': 'photos'}]))
            self.assertEqual(self.request(f'/api/sources/discord/channels?group={self.group}&guild=78')[0], 403)
            scope = {'guild': '77', 'channels': ['71'], 'start': '2024-01-01', 'end': '2024-12-31'}
            self.assertEqual(self.request('/api/sources/create', {'group': self.group, 'kind': 'discord', 'label': 'Lake house', 'scope': scope})[0], 201)
            scope['guild'] = '78'
            status, body, _ = self.request('/api/sources/create', {'group': self.group, 'kind': 'discord', 'label': 'Elsewhere', 'scope': scope})
            self.assertEqual((status, json.loads(body)), (403, {'error': 'Connect this Discord server first'}))
        with patch('mazi.sources.server.discord_from_env', return_value=None):
            status, body, _ = self.request('/api/sources/discord/connect', {'group': self.group})
            self.assertEqual((status, json.loads(body)), (503, {'error': 'Discord is not configured on this server'}))
