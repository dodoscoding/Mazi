"""Create a synthetic fixture only in this run's isolated hosted target."""
import json
import os
import sys
from contextlib import closing
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from mazi.memories.memories import MemoryStore
from mazi.storage import StorageHTTP

SCHEMA = 'mazi_acceptance_20261022_test'
BUCKET = 'mazi-acceptance-20261022-test'

if os.environ.get('MAZI_DATABASE_SCHEMA') != SCHEMA or os.environ.get('MAZI_STORAGE_BUCKET') != BUCKET:
    raise RuntimeError('This fixture requires the isolated acceptance schema and bucket')

remote = StorageHTTP(os.environ['MAZI_SUPABASE_URL'], os.environ['MAZI_SUPABASE_SECRET_KEY'], BUCKET)
bucket = next((item for item in json.loads(remote._request('GET', '/bucket')) if item['id'] == BUCKET), None)
if bucket:
    if bucket['public']:
        raise RuntimeError('The acceptance bucket must be private')
else:
    remote._request('POST', '/bucket', json.dumps({'id': BUCKET, 'name': BUCKET, 'public': False}).encode())

with closing(MemoryStore('/tmp/mazi-acceptance-hosted')) as store:
    if store.db.execute('SELECT 1 FROM shared_policy').fetchone():
        raise RuntimeError('The synthetic fixture is already configured')
    user = store.register('acceptance-owner@example.test', 'synthetic-acceptance-password')
    guest = store.register('acceptance-member@example.test', 'synthetic-acceptance-password')
    group = store.create_group(user, 'Synthetic acceptance circle')
    store.accept(guest, store.invite(user, group))
    code = store.setup_shared(admin_name='Alice', group_id=group, mappings={'Alice': user, 'Ben': guest})
    target = Path('/tmp/mazi-acceptance-hosted-fixture.json')
    target.write_text(json.dumps({'user': user, 'guest': guest, 'group': group, 'code': code}))
    target.chmod(0o600)
    print('Configured isolated hosted fixture')
