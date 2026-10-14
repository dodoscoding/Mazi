"""Ephemeral synthetic archive for browser tests."""
import os
import tempfile

from mazi.server import main
from mazi.identity.core import Store
from .shared_fixture import configure_shared


if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="mazi-review-browser-") as root:
        store = Store(root)
        alice = store.register("alice@example.test", "synthetic-password")
        group = store.create_group(alice, "Synthetic circle")
        configure_shared(store, group, {"Alice": alice})
        store.close()
        os.environ["MAZI_IMPORT_DATA_DIR"] = root
        main()
