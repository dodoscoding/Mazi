"""Remove only the synthetic private Storage bucket created by this run."""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from mazi.storage import StorageHTTP

bucket = 'mazi-acceptance-20261022-test'
if os.environ.get('MAZI_STORAGE_BUCKET') != bucket:
    raise RuntimeError('Cleanup requires the exact isolated acceptance bucket')
remote = StorageHTTP(os.environ['MAZI_SUPABASE_URL'], os.environ['MAZI_SUPABASE_SECRET_KEY'], bucket)
keys = remote.list()
for key in keys:
    remote.delete(key)
assert remote.list() == []
remote._request('DELETE', '/bucket/' + bucket)
assert not any(item['id'] == bucket for item in json.loads(remote._request('GET', '/bucket')))
print(json.dumps({'removed_synthetic_objects': len(keys), 'isolated_bucket_removed': True}))
