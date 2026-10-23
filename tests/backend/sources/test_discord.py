import hashlib
import json
import time
import unittest
from unittest.mock import patch
from tests.backend.sources import test_sources
from mazi.identity.core import Conflict, Denied
from mazi.sources.discord import DiscordClient, channel_permissions, discord_from_env, poll_source, RateLimited, snowflake


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


def message(offset, content='', attachments=(), **fields):
    return {'id': str(int(snowflake('2024-01-02')) + offset), 'channel_id': '20', 'timestamp': f'2024-01-02T10:00:{offset:02d}+00:00',
            'content': content, 'author': {'id': '30', 'username': 'ayse'},
            'attachments': [{'id': f'4{offset}', 'filename': f'photo{offset}.jpg', 'content_type': 'image/jpeg'} for _ in attachments[:1]],
            **fields}


def paged(messages):
    return lambda channel, before: sorted([m for m in messages if int(m['id']) < int(before)], key=lambda m: int(m['id']), reverse=True)[:100]


def link(store, user, group, guild='10'):
    return store.link_discord(user, store.begin_discord_link(user, group), lambda: {'id': guild, 'name': 'Synthetic server'})


class DiscordTests(unittest.TestCase):
    tearDown = test_sources.SourceTests.tearDown

    def setUp(self):
        test_sources.SourceTests.setUp(self)
        link(self.store, self.alice, self.group)

    def test_switch_scope_replay_and_permission_change_before_worker_commit(self):
        connection = self.store.create_source(self.alice, self.group, 'discord', 'Selected channel',
            {'guild': '10', 'channels': ['20'], 'start': '2024-01-01', 'end': '2030-12-31'})
        client = FakeDiscord()
        self.store.discord_authorize = client.authorize
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

    def test_discord_source_requires_its_server_linked_to_the_same_circle(self):
        scope = {'guild': '11', 'channels': ['20'], 'start': '2024-01-01', 'end': '2024-12-31'}
        with self.assertRaises(Denied) as refused:
            self.store.create_source(self.alice, self.group, 'discord', 'Other server', scope)
        self.assertEqual(str(refused.exception), 'Connect this Discord server first')
        other = self.store.create_group(self.alice, 'Other circle')
        link(self.store, self.alice, other, '11')
        with self.assertRaises(Denied):
            self.store.create_source(self.alice, self.group, 'discord', 'Other server', scope)
        link(self.store, self.ben, self.group, '11')
        self.store.create_source(self.alice, self.group, 'discord', 'Other server', scope)
        self.assertEqual(self.store.discord_guilds(self.alice, self.group),
                         [{'id': '10', 'name': 'Synthetic server'}, {'id': '11', 'name': 'Synthetic server'}])
        with self.assertRaises(Denied):
            self.store.discord_guilds(self.outsider, self.group)

    def test_link_request_is_single_use_bound_to_its_member_and_expires(self):
        exchanges = []
        def exchange():
            exchanges.append(1)
            return {'id': '12', 'name': 'Lake house'}
        state = self.store.begin_discord_link(self.alice, self.group)
        with self.assertRaises(Conflict):
            self.store.link_discord(self.ben, state, exchange)
        with self.assertRaises(Conflict):
            self.store.link_discord(self.alice, state, exchange)
        state = self.store.begin_discord_link(self.alice, self.group)
        self.assertEqual(self.store.link_discord(self.alice, state, exchange), {'id': '12', 'name': 'Lake house'})
        with self.assertRaises(Conflict):
            self.store.link_discord(self.alice, state, exchange)
        with patch('mazi.sources.sources.time.time', return_value=time.time() - 601):
            state = self.store.begin_discord_link(self.alice, self.group)
        with self.assertRaises(Conflict):
            self.store.link_discord(self.alice, state, exchange)
        state = self.store.begin_discord_link(self.ben, self.group)
        self.store.remove_member(self.alice, self.group, self.ben)
        with self.assertRaises(Denied):
            self.store.link_discord(self.ben, state, exchange)
        with self.assertRaises(Denied):
            self.store.begin_discord_link(self.outsider, self.group)
        self.assertEqual(exchanges, [1])
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM discord_link_requests').fetchone()[0], 0)

    def test_discord_is_configured_only_with_bot_token_client_id_and_secret(self):
        env = {'MAZI_DISCORD_BOT_TOKEN': 'synthetic-bot', 'MAZI_DISCORD_CLIENT_ID': '123'}
        with patch.dict('os.environ', env, clear=True):
            self.assertIsNone(discord_from_env())
        with patch.dict('os.environ', {**env, 'MAZI_DISCORD_CLIENT_SECRET': 'synthetic-secret'}, clear=True):
            client = discord_from_env()
        self.assertEqual((client.token, client.client_id, client.client_secret), ('synthetic-bot', '123', 'synthetic-secret'))

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

    def enabled(self):
        connection = self.store.create_source(self.alice, self.group, 'discord', 'Lake', {'guild': '10', 'channels': ['20'], 'start': '2024-01-01', 'end': '2030-01-01'})
        self.store.set_source(self.alice, connection, True, 'authorized')
        return connection

    def test_poll_budget_resumes_below_the_last_handled_message_without_duplicates(self):
        connection = self.enabled()
        client = FakeDiscord()
        messages = [message(i, attachments=[1]) for i in (1, 2, 3)]
        client.messages = paged(messages)
        cursor = lambda: json.loads(self.store.db.execute('SELECT cursor FROM discord_cursors WHERE connection=?', (connection,)).fetchone()[0])['before']
        poll_source(self.store, self.alice, connection, client, deadline=0)
        self.assertEqual((client.reads, cursor()), (1, int(messages[2]['id'])))
        poll_source(self.store, self.alice, connection, client, deadline=0)
        self.assertEqual((client.reads, cursor()), (2, int(messages[1]['id'])))
        for _ in range(3):
            poll_source(self.store, self.alice, connection, client)
        self.assertEqual(client.reads, 3)
        self.assertEqual(sorted(r['metadata']['item'] for r in self.store.resources(self.alice, connection)), sorted(m['id'] for m in messages))

    def test_text_messages_become_context_with_sender_names_not_outcomes(self):
        connection = self.enabled()
        client = FakeDiscord()
        client.messages = paged([
            message(1, 'Göle vardık', author={'id': '31', 'global_name': 'Ayşe', 'username': 'ayse'}),
            message(2, 'Look at this', attachments=[1], author={'id': '32', 'username': 'mehmet'}),
            message(3, 'Beautiful', author={'id': '33', 'username': 'can'}, member={'nick': 'Can Bey'}),
            message(4)])
        poll_source(self.store, self.alice, connection, client)
        resources = self.store.resources(self.alice, connection)
        self.assertEqual([r['state'] for r in resources], ['PENDING', 'NO_MEDIA_OR_CONTENT_UNAVAILABLE'])
        payload = json.loads(self.store.db.execute('SELECT payload FROM import_items WHERE id=?', (resources[0]['id'],)).fetchone()[0])
        self.assertEqual(payload['sender'], {'id': '32', 'label': 'mehmet'})
        self.assertEqual([(c['sender']['label'], c['text']) for c in payload['context']],
                         [('Ayşe', 'Göle vardık'), ('mehmet', 'Look at this'), ('Can Bey', 'Beautiful')])

    def test_long_turkish_caption_fits_resource_metadata(self):
        connection = self.enabled()
        client = FakeDiscord()
        client.messages = paged([message(1, 'Çok güzel bir gün ' * 20), message(2, 'ş' * 2000, attachments=[1]), message(3, 'Görüşürüz ' * 50)])
        poll_source(self.store, self.alice, connection, client)
        [resource] = self.store.resources(self.alice, connection)
        self.assertEqual(resource['state'], 'PENDING')
        self.assertEqual([c['text'] for c in resource['metadata']['context']], ['ş' * 2000])

    def test_replay_with_different_neighbours_keeps_the_stored_resource(self):
        connection = self.enabled()
        client = FakeDiscord()
        messages = [message(1, 'Before'), message(2, 'Photo', attachments=[1])]
        client.messages = paged(messages)
        poll_source(self.store, self.alice, connection, client)
        self.store.db.execute('DELETE FROM discord_cursors')
        self.store.db.commit()
        messages[0]['content'] = 'Edited neighbour'
        poll_source(self.store, self.alice, connection, client)
        [resource] = self.store.resources(self.alice, connection)
        self.assertEqual([c['text'] for c in resource['metadata']['context']], ['Before', 'Photo'])
        self.assertEqual(client.reads, 2)

    def test_replay_after_partial_poll_accepts_renamed_sender_and_legacy_caption(self):
        for legacy in (False, True):
            with self.subTest(legacy=legacy):
                connection = self.enabled()
                client = FakeDiscord()
                messages = [message(1, 'First', attachments=[1]), message(2, 'Second', attachments=[1])]
                client.messages = paged(messages)
                original_attachment = client.attachment
                def interrupted(attachment):
                    if attachment['id'] == '41':
                        raise OSError('Synthetic interrupted poll')
                    return original_attachment(attachment)
                client.attachment = interrupted
                with self.assertRaises(OSError):
                    poll_source(self.store, self.alice, connection, client)
                [resource] = self.store.resources(self.alice, connection)
                stored = resource['metadata']
                if legacy:
                    stored.pop('sender_label')
                    stored.pop('context')
                    stored['text'] = 'Second'
                    self.store.db.execute('UPDATE source_resources SET metadata=? WHERE id=?',
                                          (json.dumps(stored), resource['id']))
                    self.store.db.commit()
                messages[1]['author']['username'] = 'renamed'
                client.attachment = original_attachment
                poll_source(self.store, self.alice, connection, client)
                resources = self.store.resources(self.alice, connection)
                self.assertEqual(len(resources), 2)
                replayed = next(r for r in resources if r['id'] == resource['id'])
                self.assertEqual(replayed['metadata'], stored)
                self.assertIsNotNone(self.store.db.execute(
                    'SELECT cursor FROM discord_cursors WHERE connection=?', (connection,)).fetchone())
                checksum = hashlib.sha256(original_attachment(messages[1]['attachments'][0])).hexdigest()
                current = dict(stored, sender_label='renamed', context=[])
                current.pop('text', None)
                for field, changed in (('filename', 'other.jpg'), ('sender', '99'), ('shared_at', '2024-01-02T11:00:00Z')):
                    with self.subTest(field=field), self.assertRaises(Conflict):
                        self.store.begin_resource(self.alice, connection, dict(current, **{field: changed}), resource['size'], checksum)
