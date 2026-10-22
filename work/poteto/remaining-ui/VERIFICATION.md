# Remaining UI verification

## Revision and scope

Verified `d9b04db` on `codex/remaining-ui`, based on draft PR #81 at `f6bad67a`. This completes the rendered contracts for issues #39 and #80 with synthetic local data. No backend, schema, deployment, or privacy lifecycle change was made.

The browser exposed one product defect. At phone widths, the transfer progress element inherited `flex: 1` in a column and collapsed to zero height. The scoped Imports rule now gives it its native 8 px height. Commit `40d468a` exposes the failure. Commit `d9b04db` fixes it. Commit `c400ce0` adds responsive and phone browsing contracts and disambiguates the original heading selector.

## Reproduce

Environment was macOS, Node 24.15.0, Python 3.14.7, Playwright 1.63.0, bundled Chromium, desktop Chrome and Pixel 7 emulation. Dependencies came from `npm ci`; this worktree uses the primary checkout's installed `.venv`. The Playwright server creates a disposable synthetic archive.

- `MAZI_UNIFIED_PORT=8027 npx playwright test --config playwright.imports.config.ts` passed 11 tests in 53.2 seconds. One desktop instance of the phone-only contract was intentionally skipped.
- `node --test tests/dom/imports.test.mjs tests/dom/memories-mobile.test.mjs tests/dom/workspace-design.test.mjs` passed 13 tests.
- `npm run typecheck`, `npm run lint`, and `git diff --check` passed.
- The focused browser command ran the production build successfully. The existing large Globe bundle warning remains.

The complete suite and independent review belong to the parent workstream.

## Acceptance evidence

Desktop and phone runs exercised upload, inventory, confirmation, decoded shared photograph, reload, replay deduplication, delayed report-selection race, and keyboard workspace retry with restored heading focus. A second journey held a transfer request to check the disabled submit button, visible progress, and transfer notice. It then failed the second chunk, reloaded, selected the same ZIP and account, and resumed the same run at the acknowledged 262144-byte offset.

The route matrix checked Imports, Memories, Review, Places, Ask, Discover, and Circle in day and night. It checked 320 and 390 CSS px on phone, and 720 and 1440 CSS px on desktop. Every document fit its viewport and had zero axe violations. The 720 px desktop case provides the reflow space of a 1440 px window at 200% zoom. It does not automate the browser's native zoom menu.

Phone Memories buttons retain native selected states, keyboard focus, and at least 44 by 44 px hit areas. Touch switches between By moment and All photos. Keyboard activation changes ordering and retains that order across view switches.

Reduced motion was active for the matrix. Checks wait for finite fade animations to settle before evaluating contrast. Full-page screenshots also contain the empty Stories and Capsules states. Workspace failure and interrupted-transfer screenshots record recovery states. Synthetic JPEGs are solid colors by design.

Representative screenshots were inspected and retained here:

- [Desktop night Imports](evidence/imports-desktop-night.png).
- [Phone day Imports](evidence/imports-phone-day.png).
- [320 px day Memories, Stories, and Capsules](evidence/memories-phone-320-day.png).
- [Phone interrupted transfer with visible progress and recovery notice](evidence/imports-phone-interrupted.png).

The full 56-image route matrix and journey screenshots remain local in `test-results/import-workspace/`. These are synthetic browser contracts, not production milestone acceptance. Real device testing, native browser zoom, and whole-app postmerge journeys remain with the parent workstream. No broad UI defect was observed beyond the fixed phone progress collapse. Independent comment and code review are deferred to the parent reviewer because this worker had no spare agent slot.
