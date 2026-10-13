"""Ephemeral synthetic browser server; never opens an existing personal store."""
import os
import tempfile

from phase2.server import main

if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="mazi-browser-") as root:
        os.environ["MAZI_IMPORT_DATA_DIR"] = root
        main()
