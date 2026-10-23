import base64
import hashlib
import json
import threading
import unittest
from http.server import HTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from tests.backend.sources import test_discord, test_sources
from mazi.sources.server import handler_for


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
