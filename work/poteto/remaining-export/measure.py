"""Measure synthetic completed-file copies in a fresh Python process."""
import json
from pathlib import Path
import resource
import sys
import time
import tracemalloc

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
if __name__ == '__main__' and len(sys.argv) > 3:
    sys.path.insert(0, sys.argv[3])
from tests.backend.archive.test_export_capacity import ExportCapacityTests

def seed_metadata(fixture, mode):
    if mode == 'dense':
        assets = fixture.store._visible_ids(fixture.ben, fixture.group)
        for number in range(50):
            person = f'person-{number:03d}'
            fixture.store.db.execute('INSERT INTO discovery_people VALUES(?,?,?,?,?,?)',
                                     (person, fixture.group, person, fixture.alice, None, None))
            fixture.store.db.executemany('INSERT INTO discovery_tags VALUES(?,?,?)',
                                         [(person, asset, fixture.alice) for asset in assets])
        for number in range(200):
            fixture.store.db.execute('INSERT INTO review_events VALUES(?,?,?,?,?,?,?)',
                                     (f'event-{number:03d}', fixture.group,
                                      json.dumps([assets[(number + offset) % len(assets)] for offset in range(20)]),
                                      f'Memory {number:03d}', 'accepted', fixture.alice, '2026-10-22 12:00:00'))
        fixture.store.db.commit()
    if mode == 'personal':
        assets = fixture.store._visible_ids(fixture.ben, fixture.group)
        for number, decision in enumerate(('reject', 'accept', 'reject', 'accept')):
            event = fixture.store.review_event(fixture.alice, fixture.group, assets[number:number + 2], f'Memory {number}', decision)
            fixture.store.hide_event(fixture.ben, fixture.group, event, True)
        fixture.store.db.execute("UPDATE review_events SET updated_at='2026-10-22 12:00:00'")
        fixture.store.db.commit()
        person = fixture.store.create_person(fixture.alice, fixture.group, 'Ben')
        fixture.store.propose_identity(fixture.alice, person, fixture.ben)
        fixture.store.confirm_identity(fixture.ben, person)
        for asset in reversed(assets):
            fixture.store.tag(fixture.alice, person, asset, True)
            fixture.store.disassociate(fixture.ben, person, asset)
        for asset in reversed(assets[5:]):
            fixture.store.hide(fixture.ben, asset, True)
    if mode == 'origins':
        origin = dict(fixture.store.db.execute('SELECT * FROM archive_origins LIMIT 1').fetchone())
        for number in range(10000):
            values = dict(origin, id=f'dense-origin-{number:05d}', occurrence=f'dense-{number:05d}',
                          payload=json.dumps(dict(original_filename=f'photo-{number:05d}.jpg', context=[dict(text='x' * 4096)])))
            fixture.store.db.execute('INSERT INTO archive_origins VALUES(?,?,?,?,?,?,?,?,?)', tuple(values.values()))
        fixture.store.db.commit()


if __name__ == '__main__':
    case = sys.argv[1]
    mode = sys.argv[2] if len(sys.argv) > 2 else 'plain'
    fixture = ExportCapacityTests()
    fixture.setUp()
    try:
        fixture.seed(int(case))
        seed_metadata(fixture, mode)
        tracemalloc.start()
        started = time.perf_counter()
        with fixture.store.export_archive_file(fixture.ben, fixture.group) as output:
            size = output.seek(0, 2)
        _, peak = tracemalloc.get_traced_memory()
        print(json.dumps(dict(photos=int(case), mode=sys.argv[2] if len(sys.argv) > 2 else 'plain', zip_bytes=size, seconds=time.perf_counter() - started,
                             traced_peak_bytes=peak, process_max_rss_bytes=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)))
    finally:
        fixture.tearDown()
