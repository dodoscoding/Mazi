import hashlib
import io
import os
import tempfile
from PIL import Image
from mazi.identity.core import Denied
from mazi.sources import server as source_server
from mazi.sources.discord import DiscordClient
from mazi.sources.sources import SourceStore
from mazi.server import main
from .shared_fixture import configure_shared


class SyntheticDiscord(DiscordClient):
    """Answers in place of discord.com; the browser test intercepts the install page."""

    def exchange(self, code, redirect_uri):
        if code != 'synthetic-code':
            raise Denied('Discord did not accept this connection; connect the server again')
        return {'id': '77', 'name': 'Lake house'}

    def readable_channels(self, guild):
        return [{'id': '71', 'name': 'photos'}, {'id': '72', 'name': 'general'}]

    def authorize(self, guild, channel):
        raise Denied('Synthetic Discord never polls')


source_server.discord_from_env = lambda: SyntheticDiscord('synthetic-bot', '123456', 'synthetic-secret')

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
    partial = b'partial-bytes-not-a-full-photo'
    waiting = store.begin_resource(alice, source, dict(item='partial', component='photo', version='original', filename='partial.jpg', date='2024-01-02', kind='image', albums=[]), len(partial), hashlib.sha256(partial).hexdigest())
    store.resource_chunk(alice, waiting['id'], 0, partial[:8])
    store.set_source(alice, source, False, 'authorized')
    configure_shared(store, group, {"Alice": alice})
    store.close()
    os.environ['MAZI_IMPORT_DATA_DIR']=root
    main()
