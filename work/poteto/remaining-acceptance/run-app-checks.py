"""Run the final application checks with synthetic stores and retained logs."""
import json
import os
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[3]
output = Path(__file__).resolve().parent
environment = {
    **os.environ,
    'MAZI_BACKEND': 'local',
    'MAZI_FIREFOX_EXECUTABLE': '/tmp/mazi-acceptance-firefox/firefox',
}
environment.pop('MAZI_EMBEDDING_MODEL_DIR', None)
checks = [
    ('browser-shell', ['npm', 'test', '--', '--workers=2'], {}),
    ('browser-unified', ['npm', 'run', 'test:app'], {}),
    ('browser-domains', ['npm', 'run', 'test:domains'], {
        'MAZI_PYTHON': '/tmp/mazi-acceptance-venv/bin/python',
        'MAZI_BROWSER_RESULTS_DIR': str(output / 'domain-browser-results'),
    }),
    ('browser-learned', ['npm', 'run', 'test:domains', '--', '--grep', 'learned model'], {
        'MAZI_PYTHON': '/tmp/mazi-acceptance-venv/bin/python',
        'MAZI_EMBEDDING_MODEL_DIR': str(root / '.models/clip-vit-base-patch32'),
        'MAZI_BROWSER_RESULTS_DIR': str(output / 'learned-browser-results'),
    }),
    ('dom-full', ['npm', 'run', 'test:dom'], {}),
    ('unit-full', ['npm', 'run', 'test:unit'], {}),
    ('lint', ['npm', 'run', 'lint'], {}),
    ('docs-final-initial', ['npm', 'run', 'check:docs'], {}),
]
results = []
for name, command, extra in checks:
    with (output / f'{name}.log').open('w') as log:
        result = subprocess.run(command, cwd=root, env={**environment, **extra}, stdout=log, stderr=subprocess.STDOUT)
    results.append({'check': name, 'command': command, 'exit_code': result.returncode})
    (output / 'app-checks.json').write_text(json.dumps(results, indent=2) + '\n')
    print(json.dumps(results[-1]), flush=True)
raise SystemExit(any(result['exit_code'] for result in results))
