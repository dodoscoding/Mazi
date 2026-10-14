import subprocess, tempfile, unittest, sqlite3
from unittest.mock import patch
base = {}; head = {}
exec(compile(subprocess.check_output(['git','show','2a2f861:mazi/identity/core.py']), 'base.py','exec'),base)
exec(compile(subprocess.check_output(['git','show','2fd7ccf:mazi/identity/core.py']), 'head.py','exec'),head)
with tempfile.TemporaryDirectory() as root:
    old=base['Store'](root)
    admin=old.register('owner@example.test','synthetic-password')
    group=old.create_group(admin,'Legacy circle')
    guest=old.register('guest@example.test','synthetic-password')
    old.db.execute('INSERT INTO members VALUES(?,?,?)',(group,guest,'member'))
    old.db.execute("INSERT INTO media VALUES('media',?,?, 'synthetic','image/jpeg','old.jpg',1,'old caption',NULL,'published',1)",(group,admin))
    old.db.execute("INSERT INTO media_grants VALUES('media','caption','selected',?)",(guest,))
    old.db.execute("INSERT INTO memories VALUES('memory',?,?, 'old title',1,'published',1)",(group,admin))
    old.db.execute("INSERT INTO memory_media VALUES('memory','media')")
    old.db.execute("INSERT INTO memory_grants VALUES('memory','selected',?)",(guest,))
    old.db.commit()
    tables=['users','groups','members','media','media_grants','memories','memory_media','memory_grants']
    rows={t: [tuple(r) for r in old.db.execute('SELECT * FROM '+t)] for t in tables}
    old.close()
    store=head['Store'](root)
    code=store.setup_shared(admin_name='Owner',group_id=group,mappings={'Owner':admin,'Guest':guest})
    assert store.setup_shared(admin_name='Owner',group_id=group,mappings={'Owner':admin,'Guest':guest}) is None
    assert rows == {t: [tuple(r) for r in store.db.execute('SELECT * FROM '+t)] for t in tables}
    owner,token=store.enter_shared(code=code,name='Owner')
    with patch('time.time',return_value=1000):
        _, expiry_token=store.enter_shared(code=code,name='Guest')
    with patch('time.time',return_value=1000+2592000-1): store.shared_session(expiry_token)
    with patch('time.time',return_value=1000+2592000):
        try: store.shared_session(expiry_token)
        except head['Denied']: pass
        else: raise AssertionError('expiry boundary accepted')
    store.complete_introduction(token)
    guest_profile,_=store.enter_shared(code=code,name='Guest')
    assert owner['user_id'] == admin and not guest_profile['introduced']
    before={t: store.db.execute('SELECT count(*) FROM '+t).fetchone()[0] for t in ['users','members','shared_profiles','sessions']}
    store.db.execute("CREATE TRIGGER fail_sessions BEFORE INSERT ON sessions BEGIN SELECT RAISE(FAIL, 'synthetic failure'); END")
    store.db.commit()
    try: store.enter_shared(code=code,name='Rollback')
    except sqlite3.IntegrityError: pass
    else: raise AssertionError('trigger did not fail')
    after={t: store.db.execute('SELECT count(*) FROM '+t).fetchone()[0] for t in before}
    assert before == after
    store.close()
print('PASS actual base-schema migration preserves users/ownership/grants; repeat setup; 30-day expiry boundary; introduction isolation; atomic entry rollback')
with tempfile.TemporaryDirectory() as root:
    store=head['Store'](root)
    try: store.enter_shared(code='synthetic',name='Guest')
    except head['Denied']: pass
    else: raise AssertionError('unconfigured entry accepted')
    assert store.db.execute('SELECT count(*) FROM users').fetchone()[0] == 0
    store.close()
print('PASS unconfigured entry fails without account creation')
