import hashlib
import json
import unittest
from tests.backend.sources import test_sources
from mazi.identity.core import Denied
from mazi.sources.discord import DiscordClient, channel_permissions, poll_source, RateLimited, snowflake


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
        from tests.backend.imports.test_engine import picture
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

    def test_untrusted_attachment_and_pause_do_not_revoke_the_source(self):
        from mazi.sources.server import settle_poll
        connection = self.store.create_source(self.alice, self.group, 'discord', 'Selected channel',
            {'guild': '10', 'channels': ['20'], 'start': '2024-01-01', 'end': '2030-12-31'})
        self.store.set_source(self.alice, connection, True, 'authorized')
        client = FakeDiscord()
        client.attachment = lambda attachment: (_ for _ in ()).throw(Denied('Untrusted attachment URL'))
        self.assertEqual(settle_poll(self.store, self.alice, connection, client), 'ok')
        source = self.store.db.execute('SELECT enabled, permission FROM continuous_sources WHERE id=?', (connection,)).fetchone()
        self.assertEqual((source['enabled'], source['permission']), (1, 'authorized'))
        self.assertEqual(self.store.resources(self.alice, connection)[-1]['state'], 'UNSUPPORTED_SIZE_OR_INVALID_RESOURCE')
        self.assertIsNotNone(self.store.db.execute('SELECT cursor FROM discord_cursors WHERE connection=?', (connection,)).fetchone())

        def pause(channel, before):
            self.store.set_source(self.alice, connection, False, 'authorized')
            return client.messages_data
        client.messages = pause
        client.attachment = lambda attachment: FakeDiscord.attachment(client, attachment)
        self.assertEqual(settle_poll(self.store, self.alice, connection, client), 'paused')
        source = self.store.db.execute('SELECT enabled, permission FROM continuous_sources WHERE id=?', (connection,)).fetchone()
        self.assertEqual((source['enabled'], source['permission']), (0, 'authorized'))

    def test_discord_permission_check_does_not_hold_the_write_lock(self):
        connection = self.store.create_source(self.alice, self.group, 'discord', 'Selected channel',
            {'guild': '10', 'channels': ['20'], 'start': '2024-01-01', 'end': '2030-12-31'})
        self.store.set_source(self.alice, connection, True, 'authorized')
        client = FakeDiscord()
        def authorize(guild, channel):
            if self.store.db.in_transaction:
                raise AssertionError('Discord permission check held the write lock')
            FakeDiscord.authorize(client, guild, channel)
        client.authorize = authorize
        self.store.discord_authorize = client.authorize
        self.store.discord_sources = {connection}
        poll_source(self.store, self.alice, connection, client)
        job = self.store.claim()
        prepared = self.store.prepare(job)
        self.store.complete(job, prepared)

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

    def test_channel_permissions_apply_everyone_role_then_member_overwrites(self):
        roles = [{'id': '10', 'permissions': str((1 << 10) | (1 << 11))}, {'id': '50', 'permissions': str(1 << 16)},
                 {'id': '60', 'permissions': str(1 << 3)}]
        overwrites = [{'id': '10', 'type': 0, 'allow': '0', 'deny': str(1 << 10)},
                      {'id': '50', 'type': 0, 'allow': str(1 << 10), 'deny': '0'},
                      {'id': '30', 'type': 1, 'allow': '0', 'deny': str(1 << 11)}]
        self.assertEqual(channel_permissions('10', ['50'], roles, overwrites, '30'), 66560)
        self.assertEqual(channel_permissions('10', [], roles, overwrites, '31'), 2048)
        self.assertEqual(channel_permissions('10', ['60'], roles, overwrites, '30'), 3080)

    def test_readable_channels_lists_only_bot_readable_text_channels_in_position_order(self):
        client = DiscordClient('synthetic-not-a-token')
        read = str((1 << 10) | (1 << 16))
        hidden = [{'id': '10', 'type': 0, 'allow': '0', 'deny': str(1 << 10)}]
        responses = {'/users/@me': {'id': '30'}, '/guilds/10/members/30': {'roles': []},
            '/guilds/10/roles': [{'id': '10', 'permissions': read}],
            '/guilds/10/channels': [
                {'id': '21', 'name': 'general', 'type': 0, 'position': 2, 'permission_overwrites': []},
                {'id': '22', 'name': 'private', 'type': 0, 'position': 0, 'permission_overwrites': hidden},
                {'id': '24', 'name': 'voice', 'type': 2, 'position': 1, 'permission_overwrites': []},
                {'id': '23', 'name': 'news', 'type': 5, 'position': 1}]}
        client.request = responses.__getitem__
        self.assertEqual(client.readable_channels('10'), [{'id': '23', 'name': 'news'}, {'id': '21', 'name': 'general'}])

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
        from mazi.identity.core import Conflict
        with self.assertRaises(Conflict): self.store.complete(stale,prepared)
        poll_source(self.store,self.alice,connection,client)
        self.assertEqual(client.reads,1)
        while self.store.work_once(): pass
        self.assertEqual(len(self.store.gallery(self.ben,self.group)),1)
        self.assertEqual(len(self.store.gallery(self.ben,self.group)[0]['origins']),1)
