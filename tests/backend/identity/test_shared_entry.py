import concurrent.futures
import io
import sqlite3
import tempfile
import unittest
from PIL import Image

from mazi.identity.core import Store, Denied


class SharedEntryTests(unittest.TestCase):

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(self.temp.name)
        self.code = self.store.setup_shared(admin_name='Owner')

    def tearDown(self):
        self.store.close()
        self.temp.cleanup()

    def test_normalized_resume_and_introduction_survive_restart(self):
        profile, token = self.store.enter_shared(code=self.code, name=' Straße ')
        self.assertFalse(profile['introduced'])
        self.store.complete_introduction(token)
        other = Store(self.temp.name)
        try:
            resumed, _ = other.enter_shared(code=self.code, name='STRASSE')
            self.assertEqual(profile['user_id'], resumed['user_id'])
            self.assertTrue(resumed['introduced'])
            self.assertEqual(resumed, other.shared_session(token))
        finally:
            other.close()

    def test_wrong_code_and_invalid_names_create_nothing(self):
        for code, name in [('wrong', 'New'), (self.code, ''), (self.code, 'x\nname'), (self.code, 'a'*81)]:
            with self.assertRaises(Denied):
                self.store.enter_shared(code=code, name=name)
        self.assertEqual(1, self.store.db.execute('SELECT count(*) FROM users').fetchone()[0])

    def test_concurrent_entry_is_one_identity(self):
        def enter(name):
            store = Store(self.temp.name)
            try:
                return store.enter_shared(code=self.code, name=name)[0]['user_id']
            finally:
                store.close()
        with concurrent.futures.ThreadPoolExecutor() as pool:
            ids = list(pool.map(enter, ['Alice', ' ALICE ']))
        self.assertEqual(ids[0], ids[1])

    def test_removed_member_cannot_resume_or_use_session(self):
        owner, _ = self.store.enter_shared(code=self.code, name='Owner')
        member, token = self.store.enter_shared(code=self.code, name='Guest')
        self.store.remove_member(owner['user_id'], owner['group_id'], member['user_id'])
        with self.assertRaises(Denied):
            self.store.shared_session(token)
        with self.assertRaises(Denied):
            self.store.enter_shared(code=self.code, name='Guest')

    def test_existing_mapping_preserves_credentials_and_id(self):
        with tempfile.TemporaryDirectory() as root:
            store = Store(root)
            try:
                user = store.register('legacy@example.test', 'synthetic-password')
                group = store.create_group(user, 'Old circle')
                before = tuple(store.db.execute('SELECT * FROM users').fetchone())
                code = store.setup_shared(admin_name='Legacy', group_id=group, mappings={'Legacy': user})
                profile, _ = store.enter_shared(code=code, name=' LEGACY ')
                self.assertEqual(user, profile['user_id'])
                self.assertEqual(before, tuple(store.db.execute('SELECT * FROM users').fetchone()))
                self.assertEqual(user, store.user_for_token(store.login('legacy@example.test', 'synthetic-password')))
                self.assertIsNone(store.setup_shared(admin_name='Legacy', group_id=group, mappings={'Legacy': user}))
            finally:
                store.close()

    def test_expired_revoked_and_unmapped_sessions_denied(self):
        _, token = self.store.enter_shared(code=self.code, name='Guest')
        self.store.db.execute('UPDATE sessions SET expires_at=0')
        self.store.db.commit()
        with self.assertRaises(Denied):
            self.store.shared_session(token)
        _, token = self.store.enter_shared(code=self.code, name='Guest')
        self.store.logout(token)
        with self.assertRaises(Denied):
            self.store.shared_session(token)
        self.store.register('unmapped@example.test', 'synthetic-password')
        with self.assertRaises(Denied):
            self.store.shared_session(self.store.login('unmapped@example.test', 'synthetic-password'))


    def test_old_schema_mapping_preserves_owned_media_and_selected_grant(self):
        with tempfile.TemporaryDirectory() as root:
            db = sqlite3.connect(root + '/mazi.sqlite3')
            db.execute('CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, salt BLOB NOT NULL, password_hash BLOB NOT NULL)')
            db.commit()
            db.close()
            store = Store(root)
            try:
                owner = store.register('owner@example.test', 'synthetic-password')
                recipient = store.register('friend@example.test', 'synthetic-password')
                group = store.create_group(owner, 'Original')
                store.accept(recipient, store.invite(owner, group))
                image = io.BytesIO()
                Image.new('RGB', (8, 8), 'red').save(image, 'JPEG')
                media = store.upload_image(owner, group, 'synthetic.jpg', image.getvalue())
                store.publish_media(owner, media, ['preview'], 'selected', [recipient])
                before = tuple(store.db.execute('SELECT * FROM media').fetchone())
                grants = [tuple(row) for row in store.db.execute('SELECT * FROM media_grants')]
                store.setup_shared(admin_name='Owner', group_id=group, mappings={'Owner': owner, 'Friend': recipient})
                self.assertEqual(before, tuple(store.db.execute('SELECT * FROM media').fetchone()))
                self.assertEqual(grants, [tuple(row) for row in store.db.execute('SELECT * FROM media_grants')])
                self.assertTrue(store.media_bytes(recipient, media))
            finally:
                store.close()


    def test_session_insert_failure_rolls_back_new_profile(self):
        self.store.db.execute("CREATE TRIGGER fail_session BEFORE INSERT ON sessions BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END")
        self.store.db.commit()
        with self.assertRaises(sqlite3.IntegrityError):
            self.store.enter_shared(code=self.code, name='Never committed')
        self.assertEqual(1, self.store.db.execute('SELECT count(*) FROM users').fetchone()[0])
        self.assertEqual(1, self.store.db.execute('SELECT count(*) FROM shared_profiles').fetchone()[0])


    def test_missing_policy_fails_closed(self):
        with tempfile.TemporaryDirectory() as root:
            store = Store(root)
            try:
                with self.assertRaises(Denied):
                    store.enter_shared(code='any', name='Anyone')
            finally:
                store.close()
