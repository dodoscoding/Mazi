"""Ephemeral synthetic archive for browser tests."""
import os
import tempfile

from phase3.server import main


if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="mazi-review-browser-") as root:
        os.environ["MAZI_IMPORT_DATA_DIR"] = root
        main()
