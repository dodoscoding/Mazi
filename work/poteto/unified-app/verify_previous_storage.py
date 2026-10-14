"""Compare a populated pre-consolidation archive with the current app reader."""
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile

REPO = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO))
from mazi.memories.memories import MemoryStore

BASE = sys.argv[1] if len(sys.argv) > 1 else 'ab42a0f'
SEED = '''
import hashlib, io, json, sys
from datetime import datetime, timezone, timedelta
from PIL import Image
from phase7.memories import MemoryStore
s=MemoryStore(sys.argv[1])
a=s.register('alice@example.test','correct horse battery')
b=s.register('ben@example.test','correct horse battery')
g=s.create_group(a,'Compatibility circle')
s.accept(b,s.invite(a,g))
token=s.login('alice@example.test','correct horse battery')
source=s.create_source(a,g,'apple','Synthetic Photos',{'start':'2020-01-01','end':'2030-01-01','albums':[],'types':['image']})
s.set_source(a,source,True,'authorized')
assets=[]
for i,color in enumerate(['red','blue']):
    photo=io.BytesIO()
    Image.new('RGB',(20,20),color).save(photo,'JPEG')
    data=photo.getvalue()
    r=s.begin_resource(a,source,dict(item=str(i),component='photo',version='original',filename=color+'.jpg',date='2024-01-02',kind='image',albums=[]),len(data),hashlib.sha256(data).hexdigest())
    s.resource_chunk(a,r['id'],0,data)
    s.finish_resource(a,r['id'])
    while s.work_once(): pass
    asset=s.db.execute('SELECT asset_id FROM archive_origins WHERE run_id=?',(r['id'],)).fetchone()[0]
    s.correct_asset(a,asset,title=color,capture_date='2024-01-02',place='Harbour')
    assets.append(dict(id=asset,sha256=hashlib.sha256(data).hexdigest()))
e=s.review_event(a,g,[v['id'] for v in assets],'Old shared memory','accept')
story=s.create_story(a,g,e)
story=s.write_story(a,g,story['id'],story['revision'],'Stored before consolidation')
s.hide(b,assets[0]['id'],True)
capsule=s.seal_capsule(a,g,'Sealed before migration','Private synthetic note',(datetime.now(timezone.utc)+timedelta(days=1)).isoformat())
print(json.dumps(dict(alice=a,ben=b,group=g,token=token,assets=assets,event=e,story=story,capsule=capsule)))
s.close()
'''
with tempfile.TemporaryDirectory(prefix='mazi-storage-compatibility-') as temp:
    old = Path(temp) / 'old'
    old.mkdir()
    archive = subprocess.check_output(['git', 'archive', BASE], cwd=REPO)
    with tarfile.open(fileobj=io.BytesIO(archive)) as source:
        source.extractall(old, filter='data')
    data_root = Path(temp) / 'archive'
    before = json.loads(subprocess.check_output(
        [sys.executable, '-c', SEED, str(data_root)], cwd=old, text=True))
    store = MemoryStore(data_root)
    try:
        assert store.user_for_token(before['token']) == before['alice']
        assert store.groups_for(before['alice'])[0]['id'] == before['group']
        for asset in before['assets']:
            assert hashlib.sha256(store.asset_bytes(before['alice'], asset['id'], True)).hexdigest() == asset['sha256']
        assert store.story(before['alice'], before['group'], before['story']['id']) == before['story']
        assert store.stories(before['ben'], before['group']) == []
        assert store.capsules(before['alice'], before['group'])[0] == before['capsule']
        result = dict(baseline=BASE, result='PASS', preserved=['session', 'membership', 'asset IDs', 'original bytes', 'corrections', 'story revision and contribution', 'personal hiding', 'sealed capsule'])
        print(json.dumps(result, indent=2))
    finally:
        store.close()
