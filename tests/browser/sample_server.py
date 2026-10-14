import hashlib
import os
import tempfile
from mazi.identity.core import Store
from mazi.server import main

with tempfile.TemporaryDirectory(prefix='mazi-sample-browser-') as root:
    store = Store(root)
    store.setup_shared(admin_name='Sample')
    store.db.execute('UPDATE shared_policy SET code_digest=?', (hashlib.sha256(b'synthetic-shared-code').digest(),))
    store.db.execute('UPDATE shared_profiles SET introduced_at=1')
    store.db.commit()
    store.close()
    os.environ['MAZI_IMPORT_DATA_DIR'] = root
    main()
