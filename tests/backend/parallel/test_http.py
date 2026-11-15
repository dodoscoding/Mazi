import json
import tempfile
import threading
import unittest
from unittest.mock import patch
from api import index
from mazi.memories.memories import MemoryStore
from mazi.server import handler_for
from mazi.parallel.provider import fake_chapter
from tests.backend.test_vercel_bridge import call
from .test_contract import request

class HttpTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.env=patch.dict('os.environ',{'MAZI_BACKEND':'local','MAZI_PARALLEL_ENABLED':'1','MAZI_PARALLEL_PROVIDER':'fake'})
        self.env.start()
        self.store=MemoryStore(self.temp.name)
        code=self.store.setup_shared(admin_name='Sample')
        self.profile,token=self.store.enter_shared(code=code,name='Sample')
        self.headers={'Cookie':'mazi_session='+token,'Origin':'http://127.0.0.1'}
        self.handler=handler_for(self.store)
        self.app=index.make_app(lambda:self.handler)
    def tearDown(self):
        self.store.close();self.env.stop();self.temp.cleanup()
    def send(self,path,body=None,headers=None,method='POST'):
        status,_,chunks=call(self.app,method,'/api/parallel/'+path,body,self.headers if headers is None else headers)
        return status,json.loads(b''.join(chunks))
    def accept(self): self.assertEqual(self.send('notice',{'version':'sample-v1'})[0],200)
    def test_access_notice_flags_and_no_archive_storage(self):
        self.assertEqual(self.send('chapter',request(),headers={})[0],403)
        self.assertEqual(self.send('chapter',request())[1]['code'],'parallel_notice')
        self.accept(); self.assertEqual(self.send('chapter',request())[0],200)
        with patch.dict('os.environ',{'MAZI_PARALLEL_ENABLED':'0'}): self.assertEqual(self.send('chapter',request())[0],404)
        with patch.dict('os.environ',{'MAZI_PARALLEL_PROVIDER':'anthropic'}): self.assertEqual(self.send('chapter',request())[0],404)
        self.assertEqual(self.store.db.execute('SELECT COUNT(*) FROM parallel_usage').fetchone()[0],1)
    def test_quota_and_invalid_inputs(self):
        self.accept()
        with patch.dict('os.environ',{'MAZI_PARALLEL_MEMBER_LIMIT':'1'}):
            self.assertEqual(self.send('chapter',request())[0],200)
            self.assertEqual(self.send('chapter',request())[1]['code'],'parallel_quota')
        self.assertEqual(self.send('chapter',request(4))[0],400)
        r=request();r['origin']['whatIf']='suicide';self.assertEqual(self.send('chapter',r)[0],422)
        self.assertEqual(self.send('chapter',{'x':'x'*9000})[0],400)
        self.assertEqual(self.send('notice',{'version':'wrong'})[0],400)
    def test_slow_generation_releases_bridge_lock_and_rechecks_access(self):
        self.accept();started=threading.Event();finish=threading.Event();result=[]
        def slow(r): started.set(); finish.wait(5);return fake_chapter(r)
        with patch('mazi.parallel.server.generate',side_effect=lambda r: __import__('mazi.parallel.provider',fromlist=['generate']).generate(r,slow)):
            worker=threading.Thread(target=lambda:result.append(self.send('chapter',request())))
            worker.start(); self.assertTrue(started.wait(3))
            status,_,_=call(self.app,'GET','/api/session',headers=self.headers)
            self.assertEqual(status,200); self.assertFalse(finish.is_set())
            call(self.app,'POST','/api/logout',{},self.headers)
            finish.set();worker.join(5)
        self.assertEqual(result[0][0],403)
