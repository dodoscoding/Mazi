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
        resource = store.begin_resource(alice, source, dict(item=str(index), component='photo', version='original', filename=f'photo-{index}.jpg', date='2024-01-02', kind='image', albums=[], context=[{'locator': '0', 'text': 'Anyone checked the ferry time?', 'sender': {'label': 'Maya'}, 'shared_at': '2024-01-02T21:14:00'}, {'locator': 'reply-0', 'text': 'Worth missing the ferry for.', 'sender': {'label': 'Alex'}, 'shared_at': '2024-01-02T21:18:00'}] if index == 0 else []), len(data), hashlib.sha256(data).hexdigest())
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
    if os.environ.get('MAZI_PHOTOS_FIXTURE') == '1':
        # Extra chronology examples are isolated from the existing unified contracts.
        examples = [
            ('Winter walk', 'yellow', ['2025-02-20'], None),
            ('Spring picnic', 'purple', ['2023-03-10'], None),
            ('Unlabelled photograph', 'orange', [], None),
            ('Shared at the reunion', 'cyan', [], '2026-04-12T10:00:00+00:00'),
            ('Conflicting years', 'navy', ['2022-06-01', '2023-07-01'], None),
        ]
        for title, color, captures, shared in examples:
            image = io.BytesIO()
            Image.new('RGB', (90, 60), color).save(image, 'JPEG')
            data = image.getvalue()
            for version, capture in enumerate(captures or [None]):
                metadata = dict(item=f'photos-{color}-{version}', component='photo', version='original', filename=f'{color}.jpg', date='2024-01-02', kind='image', albums=[])
                if capture:
                    metadata['capture_date'] = capture
                if shared:
                    metadata['shared_at'] = shared
                resource = store.begin_resource(alice, source, metadata, len(data), hashlib.sha256(data).hexdigest())
                store.resource_chunk(alice, resource['id'], 0, data)
                store.finish_resource(alice, resource['id'])
                while store.work_once():
                    pass
            asset = store.db.execute('SELECT asset_id FROM archive_origins WHERE run_id=?', (resource['id'],)).fetchone()[0]
            store.correct_asset(alice, asset, title=title, capture_date=None, place='')
    configure_shared(store, group, {"Alice": alice, "Ben": ben})
    store.close()
    os.environ['MAZI_IMPORT_DATA_DIR'] = root
    main()
