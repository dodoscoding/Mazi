from pathlib import Path
import re

root = Path(__file__).resolve().parents[3]
names = ['SPEC', 'ROADMAP', 'TWO_DEVELOPER_PLAN', 'ARCHITECTURE', 'CONTRACTS', 'PRIVACY', 'IMPORTS', 'TEST_PLAN', 'DECISIONS', 'SOURCES', 'DESIGN_PROPOSAL', 'HOME_MEMORY_INTERACTIONS', 'PROTOTYPE_STACK', 'M0_ACCEPTANCE', 'PRODUCT_EVOLUTION_INVESTIGATION']
files = [root / 'README.md', root / 'PRODUCT.md', *(root / 'docs' / f'{name}.md' for name in names)]
links = 0
for path in files:
    body = path.read_text()
    assert len(re.findall(r'^# ', body, re.M)) == 1, f'Expected one title: {path}'
    assert '\u2014' not in body and '\u2013' not in body, f'Long dash: {path}'
    assert body.count('```') % 2 == 0, f'Unclosed code block: {path}'
    assert all(line == line.rstrip() for line in body.splitlines()), f'Trailing whitespace: {path}'
    assert not re.search(r'<(?:TODO|TBD|placeholder)>', body, re.I), f'Placeholder: {path}'
    for target in re.findall(r'\]\(([^)]+)\)', body):
        if re.match(r'^[a-z]+:', target) or target.startswith('#'):
            continue
        relative = target.split('#', 1)[0]
        assert (path.parent / relative).resolve().exists(), f'Broken link: {path}: {target}'
        links += 1
spec = (root / 'docs/SPEC.md').read_text()
assert re.findall(r'^\| (B\d{2}) ', spec, re.M) == [f'B{i:02}' for i in range(1, 31)], 'Brief traceability must cover B01-B30 once in order'
roadmap = (root / 'docs/ROADMAP.md').read_text()
assert re.findall(r'^### (M\d)\.', roadmap, re.M) == [f'M{i}' for i in range(8)], 'Roadmap must cover M0-M7'
tests = (root / 'docs/TEST_PLAN.md').read_text()
assert re.findall(r'^\| (T\d{2}) ', tests, re.M) == [f'T{i:02}' for i in range(1, 16)], 'Acceptance IDs must cover T01-T15'
source = root / 'docs/source/PRODUCT_BRIEF.md'
assert len(re.findall(r'^#{1,2} \d+\. ', source.read_text(), re.M)) == 30, 'Original brief must contain 30 sections'
print(f'PASS: {len(files)} authored documents, {links} local links, 30 requirement mappings, 8 milestones, 15 acceptance scenarios.')
print('This verifies document structure, not application behavior or completeness of design.')
