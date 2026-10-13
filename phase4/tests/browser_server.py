import hashlib
import io
import os
import tempfile
from PIL import Image
from phase4.sources import SourceStore
from phase4.server import main

with tempfile.TemporaryDirectory(prefix='mazi-places-browser-') as root:
    store = SourceStore(root)
    alice = store.register('alice@example.test', 'correct horse battery')
    outsider = store.register('outsider@example.test', 'correct horse battery')
    group = store.create_group(alice, 'Places circle')
    source = store.create_source(alice, group, 'apple', 'Synthetic Photos', {'start':'2020-01-01','end':'2030-01-01','albums':[],'types':['image','video']})
    store.set_source(alice, source, True, 'authorized')
    for index, color in enumerate(['red', 'blue']):
        image = io.BytesIO(); Image.new('RGB',(40,40),color).save(image,'JPEG')
        data = image.getvalue()
        resource = store.begin_resource(alice,source,dict(item=str(index),component='photo',version='original',filename=f'{color}.jpg',date='2024-01-02',kind='image',albums=[]),len(data),hashlib.sha256(data).hexdigest())
        store.resource_chunk(alice,resource['id'],0,data);store.finish_resource(alice,resource['id'])
        while store.work_once(): pass
        origin=store.db.execute('SELECT id FROM archive_origins WHERE run_id=?',(resource['id'],)).fetchone()[0]
        store.set_place(alice,origin,'NL' if index==0 else 'TR','Amsterdam' if index==0 else 'Istanbul',52.37 if index==0 else 41.01,4.9 if index==0 else 28.97,f'2024-01-0{index+2}')
    store.close()
    os.environ['MAZI_IMPORT_DATA_DIR']=root
    main()
