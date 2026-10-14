import hashlib
import time


def configure_shared(store, group, mappings):
    store.setup_shared(admin_name='Alice', group_id=group, mappings=mappings)
    store.db.execute('UPDATE shared_policy SET code_digest=?',
                     (hashlib.sha256(b'synthetic-shared-code').digest(),))
    store.db.execute('UPDATE shared_profiles SET introduced_at=1')
    outsider = store.db.execute("SELECT id FROM users WHERE email='outsider@example.test'").fetchone()
    if outsider:
        store.db.execute('INSERT INTO sessions VALUES(?,?,?)',
                         (hashlib.sha256(b'synthetic-unmapped-session').digest(), outsider['id'], int(time.time()) + 2592000))
    store.db.commit()
