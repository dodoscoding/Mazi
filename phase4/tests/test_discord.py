import hashlib
import json
import unittest
import test_sources
from phase1.core import Denied
from phase4.discord import DiscordClient, poll_source, RateLimited, snowflake


class FakeDiscord:
    def __init__(self):
        self.allowed = True
        self.reads = 0
        self.messages_data = [{'id': str(int(snowflake('2024-01-02'))+1), 'channel_id': '20', 'timestamp': '2024-01-02T10:00:00Z',
            'content': 'At the lake', 'author': {'id': '30'},
            'attachments': [{'id': '40', 'filename': 'photo.jpg', 'content_type': 'image/jpeg'}]}]

    def authorize(self, guild, channel):
        if not self.allowed:
            raise Denied('Permission revoked')
        assert (guild, channel) == ('10', '20')

    def messages(self, channel, after):
        return self.messages_data

    def attachment(self, attachment):
        from test_engine import picture
        self.reads += 1
        return picture()


class DiscordTests(unittest.TestCase):
    setUp = test_sources.SourceTests.setUp
    tearDown = test_sources.SourceTests.tearDown

    def test_switch_scope_replay_and_permission_change_before_worker_commit(self):
        connection = self.store.create_source(self.alice, self.group, 'discord', 'Selected channel',
            {'guild': '10', 'channels': ['20'], 'start': '2024-01-01', 'end': '2030-12-31'})
        client = FakeDiscord()
        self.store.discord_authorize = client.authorize
        self.store.discord_sources = {connection}
        with self.assertRaises(Denied):
            poll_source(self.store, self.alice, connection, client)
        self.assertEqual(client.reads, 0)
        self.store.set_source(self.alice, connection, True, 'authorized')
        poll_source(self.store, self.alice, connection, client)
        job = self.store.claim()
        prepared = self.store.prepare(job)
        client.allowed = False
        with self.assertRaises(Denied):
            self.store.complete(job, prepared)
        self.assertEqual(self.store.gallery(self.ben, self.group), [])
        client.allowed = True
        self.store.complete(job, prepared)
        poll_source(self.store, self.alice, connection, client)
        while self.store.work_once():
            pass
        self.assertEqual(len(self.store.gallery(self.ben, self.group)[0]['origins']), 1)
        client.messages_data[0]['channel_id'] = '21'
        with self.assertRaises(Denied):
            poll_source(self.store, self.alice, connection, client)
        self.assertEqual(client.reads, 1)

    def test_permission_overwrites_and_cdn_rejection(self):
        client = DiscordClient('synthetic-not-a-token')
        responses = {'/users/@me': {'id': '30'}, '/guilds/10/members/30': {'roles': ['50']},
            '/guilds/10/roles': [{'id': '10', 'permissions': str((1<<10)|(1<<16))}],
            '/channels/20': {'guild_id': '10', 'type': 0, 'permission_overwrites': [{'id': '30', 'type': 1, 'deny': str(1<<16), 'allow': '0'}]}}
        client.request = responses.__getitem__
        with self.assertRaises(Denied):
            client.authorize('10', '20')
        responses['/channels/20']['permission_overwrites'] = []
        client.authorize('10', '20')
        for url in ['http://127.0.0.1/a', 'https://example.com/attachments/x', 'https://cdn.discordapp.com.evil.test/attachments/x', 'https://user@cdn.discordapp.com/attachments/x']:
            with self.assertRaises(Denied):
                client.attachment({'url':url,'size':10})
        self.assertEqual(RateLimited(0).seconds, 1)

    def test_more_than_one_page_is_not_skipped_and_unsupported_outcomes_are_durable(self):
        connection=self.store.create_source(self.alice,self.group,'discord','Backlog',{'guild':'10','channels':['20'],'start':'2024-01-01','end':'2030-01-01'})
        self.store.set_source(self.alice,connection,True,'authorized')
        client=FakeDiscord()
        messages=[{'id':str(int(snowflake('2024-01-02'))+i+1),'channel_id':'20','timestamp':'2024-01-02T12:00:00Z','attachments':[]} for i in range(205)]
        client.messages=lambda channel,before: sorted([m for m in messages if int(m['id'])<int(before)],key=lambda m:int(m['id']),reverse=True)[:100]
        for _ in range(4): poll_source(self.store,self.alice,connection,client)
        self.assertEqual(len(self.store.resources(self.alice,connection)),205)
        self.assertEqual(client.reads,0)

    def test_pause_resume_after_checkpoint_keeps_pending_image(self):
        connection=self.store.create_source(self.alice,self.group,'discord','Resume',{'guild':'10','channels':['20'],'start':'2024-01-01','end':'2030-01-01'})
        self.store.set_source(self.alice,connection,True,'authorized')
        client=FakeDiscord()
        self.store.discord_authorize=client.authorize
        self.store.discord_sources={connection}
        poll_source(self.store,self.alice,connection,client)
        stale=self.store.claim()
        prepared=self.store.prepare(stale)
        self.store.set_source(self.alice,connection,False,'authorized')
        self.store.set_source(self.alice,connection,True,'authorized')
        from phase1.core import Conflict
        with self.assertRaises(Conflict): self.store.complete(stale,prepared)
        poll_source(self.store,self.alice,connection,client)
        self.assertEqual(client.reads,1)
        while self.store.work_once(): pass
        self.assertEqual(len(self.store.gallery(self.ben,self.group)),1)
        self.assertEqual(len(self.store.gallery(self.ben,self.group)[0]['origins']),1)
