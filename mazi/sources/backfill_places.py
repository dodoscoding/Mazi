"""Pin already imported photographs from their EXIF GPS. Safe to rerun; removed pins stay removed.

python -m mazi.sources.backfill_places   (npm run places:backfill for the hosted archive)
"""
import json
import os
from collections import Counter
from pathlib import Path

from mazi.sources.sources import SourceStore


def backfill(store, batch=200):
    totals, after = Counter(), ''
    while after is not None:
        counts, after = store.backfill_places(after, batch)
        totals.update(counts)
    return {key: totals[key] for key in ('pinned', 'existing', 'removed', 'no_fix', 'no_city')}


def main():
    store = SourceStore(Path(os.environ.get('MAZI_IMPORT_DATA_DIR', '.mazi-imports')))
    try:
        print(json.dumps(backfill(store)))
    finally:
        store.close()


if __name__ == '__main__':
    main()
