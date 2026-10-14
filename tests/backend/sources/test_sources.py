import hashlib
import sys
from pathlib import Path
import unittest

from tests.backend.imports import test_engine as helpers
from mazi.identity.core import Denied, Conflict
from mazi.sources.sources import SourceStore


class SourceTests(helpers.EngineTests):
    # Run inherited ingestion regressions against the extended store too.
    def setUp(self):
        helpers.EngineTests.setUp(self)
        self.store.close()
        self.store = SourceStore(self.temp.name)
        self.connection = self.store.create_source(self.alice, self.group, 'apple', 'Library',
            {'start': '2020-01-01', 'end': '2030-01-01', 'albums': [], 'types': ['image', 'video']})
        self.store.set_source(self.alice, self.connection, True, 'authorized')

    def begin(self, **changes):
        metadata = dict(item='photo-1', component='photo', version='original', filename='a.jpg',
                        date='2024-01-02', kind='image', albums=[])
        metadata.update(changes)
        data = helpers.picture()
        return self.store.begin_resource(self.alice, self.connection, metadata, len(data), hashlib.sha256(data).hexdigest()), data

    def finish(self, resource, data):
        self.store.resource_chunk(self.alice, resource['id'], resource['received'], data[resource['received']:])
        self.store.finish_resource(self.alice, resource['id'])
        while self.store.work_once():
            pass

    def test_restart_replay_versions_and_related_resources(self):
        resource, data = self.begin()
        self.store.resource_chunk(self.alice, resource['id'], 0, data[:100])
        self.store.close()
        self.store = SourceStore(self.temp.name)
        again, _ = self.begin()
        self.assertEqual(again['received'], 100)
        self.finish(again, data)
        self.assertEqual(self.begin()[0]['id'], resource['id'])
        edited, data = self.begin(version='edited-2')
        self.finish(edited, data)
        self.assertEqual(len(self.store.gallery(self.ben, self.group)[0]['origins']), 2)
        movie = b'paired movie bytes'
        resource = self.store.begin_resource(self.alice, self.connection,
            dict(item='photo-1', component='pairedVideo', version='original', filename='motion.mov',
                 date='2024-01-02', kind='video', albums=[]), len(movie), hashlib.sha256(movie).hexdigest())
        self.finish(resource, movie)
        self.assertEqual(self.store.resource_bytes(self.ben, resource['id']), movie)
        self.assertEqual(self.store.resources(self.alice, self.connection)[-1]['state'], 'RETAINED_NO_PREVIEW')

    def test_pause_revocation_and_late_worker_stop(self):
        resource, data = self.begin()
        self.store.resource_chunk(self.alice, resource['id'], 0, data)
        self.store.finish_resource(self.alice, resource['id'])
        job = self.store.claim()
        prepared = self.store.prepare(job)
        self.store.set_source(self.alice, self.connection, False, 'revoked')
        with self.assertRaises((Denied, Conflict)):
            self.store.complete(job, prepared)
        self.assertEqual(self.store.gallery(self.ben, self.group), [])
        with self.assertRaises(Denied):
            self.begin(item='new')
        self.store.set_source(self.alice, self.connection, True, 'authorized')
        resource, _ = self.begin()
        self.store.finish_resource(self.alice, resource['id'])
        while self.store.work_once():
            pass
        self.assertEqual(len(self.store.gallery(self.ben, self.group)), 1)

    def test_scope_ownership_checksum_and_withdrawal(self):
        with self.assertRaises(Denied):
            self.begin(date='2010-01-01')
        with self.assertRaises(Denied):
            self.store.set_source(self.ben, self.connection, True, 'authorized')
        resource, data = self.begin()
        self.store.resource_chunk(self.alice, resource['id'], 0, b'x' * len(data))
        with self.assertRaises(Conflict):
            self.store.finish_resource(self.alice, resource['id'])
        self.assertEqual(self.begin()[0]['received'], 0)
        self.finish(self.begin()[0], data)
        self.store.withdraw_resource(self.alice, resource['id'])
        with self.assertRaises(Denied):
            self.store.resource_bytes(self.ben, resource['id'])
        with self.assertRaises(Denied):
            self.begin()
        self.assertEqual(self.store.gallery(self.ben, self.group), [])

    def test_map_places_filters_paths_and_origin_visibility(self):
        resource, data = self.begin()
        self.finish(resource, data)
        origin = self.store.owned_origins(self.alice, self.group)[0]['id']
        self.assertEqual(self.store.places(self.ben, self.group)['points'], [])
        self.store.set_place(self.alice, origin, 'NL', 'Amsterdam', 52.37, 4.9, '2024-01-02')
        result = self.store.places(self.ben, self.group, country='NL', paths=True)
        self.assertEqual(result['points'][0]['city'], 'Amsterdam')
        self.assertEqual(result['paths'], [])
        self.assertEqual(self.store.places(self.ben, self.group, country='TR')['points'], [])
        with self.assertRaises(Denied):
            self.store.places(self.outsider, self.group)
        with self.assertRaises(Denied):
            self.store.set_place(self.ben, origin, 'TR', 'Istanbul', 41, 29, None)
        with self.assertRaises(ValueError):
            self.store.set_place(self.alice, origin, 'NL', 'Amsterdam', float('nan'), 4.9, None)
        self.store.set_place(self.alice, origin, '', '', None, None, None)
        self.assertEqual(self.store.places(self.ben, self.group)['countries'], [])
        self.store.set_place(self.alice, origin, 'NL', 'Amsterdam', 52, 4, None)
        self.store.withdraw_resource(self.alice, resource['id'])
        self.assertEqual(self.store.places(self.ben, self.group)['points'], [])

    def test_departure_denies_resources_and_map(self):
        resource, data = self.begin()
        self.finish(resource, data)
        self.store.remove_member(self.alice, self.group, self.ben)
        with self.assertRaises(Denied):
            self.store.resource_bytes(self.ben, resource['id'])
        with self.assertRaises(Denied):
            self.store.places(self.ben, self.group)

    def test_opaque_resources_restore_export_and_rejoin_tombstones(self):
        import io
        import json
        import zipfile
        from mazi.archive.ops import create_backup, restore_backup
        # Use a non-admin owner so departure followed by a new invitation is exercised.
        connection = self.store.create_source(self.ben, self.group, 'apple', 'Ben library',
            {'start':'2020-01-01','end':'2030-01-01','albums':[],'types':['video']})
        self.store.set_source(self.ben, connection, True, 'authorized')
        data=b'synthetic paired movie'
        metadata=dict(item='live',component='pairedVideo',version='v1',filename='live.mov',date='2024-01-01',kind='video',albums=[])
        resource=self.store.begin_resource(self.ben, connection, metadata, len(data), hashlib.sha256(data).hexdigest())
        self.store.resource_chunk(self.ben,resource['id'],0,data)
        self.store.finish_resource(self.ben,resource['id'])
        with zipfile.ZipFile(io.BytesIO(self.store.export_archive(self.alice,self.group))) as archive:
            self.assertEqual(archive.read('resources/'+resource['id']),data)
        backup=Path(self.temp.name).parent/(Path(self.temp.name).name+'-backup')
        restored=Path(self.temp.name).parent/(Path(self.temp.name).name+'-restored')
        import shutil
        try:
            create_backup(self.temp.name,backup)
            restore_backup(backup,restored)
            recovered=SourceStore(restored)
            try: self.assertEqual(recovered.resource_bytes(self.alice,resource['id']),data)
            finally: recovered.close()
        finally:
            shutil.rmtree(backup,ignore_errors=True);shutil.rmtree(restored,ignore_errors=True)
        self.store.remove_member(self.alice,self.group,self.ben)
        self.store.accept(self.ben,self.store.invite(self.alice,self.group))
        with self.assertRaises(Denied): self.store.resource_bytes(self.alice,resource['id'])
        with self.assertRaises(Denied): self.store.begin_resource(self.ben,connection,metadata,len(data),hashlib.sha256(data).hexdigest())
