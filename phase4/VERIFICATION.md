# Phase 4 verification

Verified 13 October 2026 in the local `mazi-implementation` checkout. Python suites, Phase 4 browser tests and the document checker were rerun at `ba5ca79` after merging upstream main `acecf93`; native build and other frontend checks below were performed before that merge, which only changed Phase 1 and an Atlas regression test. No remote deployment, account connection or GitHub CI run is claimed.

## Executed checks

| Check | Result |
| --- | --- |
| `.venv/bin/python -m unittest discover -s phase4/tests -v` | 26 passed, including inherited import-engine regressions. [Raw output](evidence/python-tests.txt). |
| Phase 3 Python suite | 9 passed, including offline restore and withdrawal. |
| Phase 2 Python suite | 26 passed, including HTTP and 20,000-record cases. |
| Phase 1 Python suite in this checkout | 13 passed, including the additional upstream pilot regressions. |
| `MAZI_CHROME_CHANNEL=chrome MAZI_PYTHON="$PWD/.venv/bin/python" node node_modules/@playwright/test/cli.js test --config phase4/playwright.config.ts` | 2 passed: installed Chrome desktop and Pixel 7 emulation, not physical Android. |
| Browser accessibility | Axe reported no violations in either tested layout; no horizontal overflow or page errors. |
| Native `sh phase4/macos/build.sh` | Passed with Swift 6.4, arm64 macOS, macOS 13 deployment target. Ad-hoc signature created. Does not demonstrate Photos permission, iCloud or device behavior. |
| TypeScript / Vite | `node node_modules/typescript/bin/tsc -b` and `node node_modules/vite/bin/vite.js build` passed. Existing Atlas large-chunk warning remains. |
| Prettier | All added web code, browser configuration, browser test and package scripts pass formatting. |
| Document structure | 16 authored documents, 152 local links, 30 requirement mappings, 8 milestones and 15 acceptance scenarios passed. |
| Python compilation | New modules and changed backup module compile. |

The bundled Node executable was added to PATH. This runtime does not ship the `npm` executable, so equivalent Node entrypoints were used for local build and formatting. Browser tests used installed Chrome because Playwright's matching Chromium binary was absent. CI installs bundled Chromium and runs the checked-in scripts; that new CI job has not run remotely. Initial tests failed before implementation; later failures exposed a missing transaction commit and an SVG accessibility issue, both corrected before the final run.

The native app was also launched and its startup controls visually inspected. It starts with an empty selection and disabled Transfer/Stop controls. Library observation now begins only after the explicit Photos access action; no media bytes were transferred during this inspection.

## Behavior demonstrated

- Persistent transfer offsets across store restart; chunk replay, checksum restart, distinct edited and Live Photo component identities, opaque original downloads.
- Paused/revoked sources and changed generations fence queued completion; Discord re-enabling resumes already-checkpointed pending jobs without refetching or duplicates; removed members and outsiders cannot read. Departure tombstones continue denying retained resources after rejoining.
- Discord off-switch, effective permission overwrites, channel scoping, late permission revocation, hostile CDN URL rejection and a 205-message paginated backlog with no skipped records. Discord network replies were synthetic doubles, not a live guild.
- Map excludes unshared coordinates, respects country/city filters and active origin ownership, removes withdrawn locations, and defaults paths off. Coordinates reject NaN and out-of-range values.
- Native HTTP protocol upload/resume/revoke, authentication failures, invalid metadata and refusal of client-supplied Discord uploads. Same-origin and no-store protections remain enabled.
- Group export includes opaque resources and explicit places; offline backup/restore preserves source resources, partial transfers and access tombstones.
- Browser workflow covers map/filter/path controls, source creation/pause, original-download links, source-text escaping, cross-origin denial and removal of displayed private results after authorization fails.

## Visual evidence

[Desktop](evidence/desktop.png) and [phone](evidence/phone.png) screenshots were inspected after the final browser run. The hostile source label in these fixtures is intentional XSS evidence and is rendered as text. The offline basemap is documented in [map data](MAP_DATA.md); SHA-256 of `land.geojson`: `9e0729ee253ca7d7a5c4ae9395fb1902264c5377c52e224d13dd85010e2835d9`.

## Acceptance still required

M4 is not closed. Run T12 on an actual consented Photos library: initial denial, limited/revoked authorization mid-download, iCloud retrieval, app restart during a partial upload, original/edited and Live Photo parts, library changes, and repeated resume without appearances multiplying. Test supported macOS versions and native accessibility; sign/notarize only for a separately approved distribution.

Use a separately authorized Discord test guild to validate installation, message-content availability, permission changes, attachment expiration and HTTP 429 behavior. The local operator must approve source IDs for members entitled to those channels; bot access alone is not the member's authorization. Historical edits/deletions behind the cursor are not synchronized.

Production Next.js/PostgreSQL/Supabase integration, real-source compatibility, retention, real-device/browser matrix, M3 release gates, iOS and production launch remain open. The local UI, build and synthetic evidence do not replace those gates.
