"""Compare every completed ZIP member against a base package on one fixture."""
import json
from pathlib import Path
import subprocess
import sys

from measure import ExportCapacityTests, seed_metadata

count, mode, base = int(sys.argv[1]), sys.argv[2], sys.argv[3]
current = str(Path(__file__).resolve().parents[3])
fixture = ExportCapacityTests()
fixture.setUp()
try:
    fixture.seed(count)
    seed_metadata(fixture, mode)
    code = '''
import hashlib, json, sys, zipfile
sys.path.insert(0, sys.argv[1])
from mazi.memories.memories import MemoryStore
store = MemoryStore(sys.argv[2])
try:
    members = []
    with store.export_archive_file(sys.argv[3], sys.argv[4]) as output:
        with zipfile.ZipFile(output) as archive:
            for name in archive.namelist():
                checksum = hashlib.sha256()
                with archive.open(name) as member:
                    while chunk := member.read(256 * 1024):
                        checksum.update(chunk)
                members.append([name, checksum.hexdigest()])
    print(json.dumps(members))
finally:
    store.close()
'''
    results = []
    for source in (base, current):
        result = subprocess.run([sys.executable, '-c', code, source, fixture.temp.name, fixture.ben, fixture.group],
                                check=True, capture_output=True, text=True)
        results.append(json.loads(result.stdout))
    assert results[0] == results[1], 'ZIP member contents or order differ'
    print(json.dumps(dict(photos=count, mode=mode, identical_members=len(results[0]))))
finally:
    fixture.tearDown()
