# Phase 7 local verification

## Revision and environment

14 October 2026, local working changes based on `c501c444df4e1c243f65e2832978b58a923b36e2`. macOS, Python 3.11 in the repository `.venv`, bundled Node runtime, installed Google Chrome via Playwright's `chrome` channel. Fixtures are generated solid-color JPEGs and synthetic members; no personal archive is used.

## Evidence

- `.venv/bin/python -m unittest discover -s phase7/tests -v`: 13 tests pass; [raw output](evidence/python-tests.txt). Covers approved/date-filtered recaps, corrections, rejection/undo, hidden photos/memories, withdrawal, isolation, removed members, contribution ownership, stale revisions, persistence, creator departure, payload validation, origin rejection, and current-access export.
- `MAZI_CHROME_CHANNEL=chrome MAZI_PYTHON=.venv/bin/python node node_modules/@playwright/test/cli.js test --config phase7/playwright.config.ts`: 4 tests pass (desktop and Pixel 7 emulation). Exercises recap, story creation, contribution editing/removal, inert markup rendering, JSON download, and story deletion. Axe reports no violations and neither viewport overflows horizontally.
- [Desktop screenshot](evidence/desktop.png) and [phone screenshot](evidence/phone.png) capture the tested contribution flow. Phone screenshot visually inspected for layout and readable controls.

The default system Python lacks Pillow; the repository virtual environment supplies it. The sandbox prevented a loopback listener, so API/browser tests ran with approved elevated execution. The default Playwright Chromium binary was absent; installed Chrome was used successfully instead.

## Acceptance boundary

These checks validate the local M7 increments. They do not close T15, M7, or any production milestone. Production capsule enforcement, real-group usability, physical-device accessibility, deployment, distributed cache revocation, and production recovery remain unverified. Local capsule, slideshow, montage, and in-app notification behavior is implemented and tested below. Recaps are deterministic projections of approved memories, not generated narratives. No external provider receives data.

## Regression checks

- `.venv/bin/python -m unittest discover -s phase6/tests -v`: 12 passed.
- `.venv/bin/python -m unittest discover -s phase5/tests -v`: 33 run, 31 passed and 2 optional local-model tests skipped.
- `node node_modules/typescript/bin/tsc -b` and `node node_modules/vite/bin/vite.js build`: passed; existing Atlas chunk-size advisory remains.
- Prettier checks on Phase 7 HTML/JavaScript/Playwright files and package scripts: passed.
- `python3 work/poteto/product-plan/verify_docs.py` and `git diff --check`: passed.


## Continuation evidence

The 13 Python tests include locked direct capsule/photo/export denial for author and member; irrelevant client time headers/query parameters; before/after server-time unlock; removed membership and author-departure purge; default-off notices; capsule isolation from archive search, export, recap and Memory answers; sub-event revision and parent-subset checks; inaccessible slideshow/video denial; and revocation during generation. These are local T15 scenarios, not production T15 acceptance.

The 4 browser contracts additionally exercise ordered sub-events, manual slideshow navigation, AVI download, capsule sealing/deletion, opt-in notifications, and changing the browser clock to 2035 while a capsule remains locked. JPEG frames in generated AVI are independently decoded with Pillow and checked for 640×480 dimensions, frame count and container length. Actual AVI playback across external media players remains unverified; no MP4/browser-video compatibility is claimed.

Initial continuation checks caught a stale markup assertion (the new slideshow legitimately adds an image) and a test-module name collision with the earlier import suite. These were corrected; the final commands above pass. The direct asset denial test uses the actual inherited `/api/archive/{id}/original` route.
