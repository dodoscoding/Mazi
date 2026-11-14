import hashlib
import io
import os
import tempfile
from PIL import Image
from mazi.memories.memories import MemoryStore as DiscoveryStore
from mazi.server import main
from .shared_fixture import configure_shared

with tempfile.TemporaryDirectory(prefix='mazi-discovery-browser-') as root:
    store = DiscoveryStore(root)
    alice = store.register('alice@example.test', 'correct horse battery')
    ben = store.register('ben@example.test', 'correct horse battery')
    store.register('outsider@example.test', 'correct horse battery')
    group = store.create_group(alice, 'Our small circle')
    store.accept(ben, store.invite(alice, group))
    source = store.create_source(alice, group, 'apple', 'Synthetic Photos', {'start':'2020-01-01','end':'2030-01-01','albums':[],'types':['image']})
    store.set_source(alice, source, True, 'authorized')
    person = store.create_person(alice, group, 'Ben')
    store.propose_identity(alice, person, ben)
    store.confirm_identity(ben, person)
    for index, color in enumerate(['red', 'blue', 'green']):
        image = io.BytesIO()
        Image.new('RGB', (80, 80), color).save(image, 'JPEG')
        data = image.getvalue()
        resource = store.begin_resource(alice, source, dict(item=str(index), component='photo', version='original', filename=f'photo-{index}.jpg', date='2024-01-02', kind='image', albums=[]), len(data), hashlib.sha256(data).hexdigest())
        store.resource_chunk(alice, resource['id'], 0, data)
        store.finish_resource(alice, resource['id'])
        while store.work_once(): pass
        asset = store.db.execute('SELECT asset_id FROM archive_origins WHERE run_id=?', (resource['id'],)).fetchone()[0]
        store.correct_asset(alice, asset, title=['Bicycle beside the sea','Dinner with friends','Garden in the morning'][index], capture_date='2024-01-02', place=['Amsterdam','Istanbul','Amsterdam'][index])
        store.tag(alice, person, asset, True)
    store.processing(alice, group, True, group_wide=True)
    store.processing(alice, group, True)
    store.processing(ben, group, True)
    store.answer_processing(alice, group, True, group_wide=True)
    store.answer_processing(alice, group, True)
    store.answer_processing(ben, group, True)
    store.review_event(alice, group, store._visible_ids(alice, group), 'Our summer', 'accept')
    configure_shared(store, group, {"Alice": alice, "Ben": ben})
    store.close()
    os.environ['MAZI_IMPORT_DATA_DIR'] = root
    main()
