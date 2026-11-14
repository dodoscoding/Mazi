# Issue 156: Archive control and discovery preferences in Settings

## Scope and revisions

Started branch `codex/simplification-156` in `/tmp/mazi-simplification-156` from
integration `00a7eeb`; verified it was an ancestor before edits. Approved contract:
APP_SIMPLIFICATION_SPEC and D28. Merged current integration through `445d3da`
(viewer and Add), producing `c1b6222` without conflicts. Merged source-connections integration
`e0ebefc` next, producing `786ac4a`; resolved the registry selection conflict by
keeping Settings controls first and preserving Add source routing. Source checkout and issue
155 worktree remain untouched.

Applied the TDD skill at the already confirmed seams: integrated desktop/phone
real-app journeys and targeted existing HTTP/domain contracts. Environment:
Darwin arm64, Node v24.15.0, Python 3.14.7, Chromium v1243; isolated port 8126.
Synthetic circle, photographs, named profiles and import ZIP only.

## Implemented behavior

- Settings explicitly downloads the current circle’s archive through the retained
  export endpoint. It displays preparation, failure/retry, cancellation and success;
  disposal aborts pending reads and revokes scoped download URLs.
- Own active source records appear with withdrawal confirmation. Cancellation keeps
  sharing; confirmation withdraws only that source record. Non-admin departure
  retains the existing confirmation and withdrawal endpoint; admin departure stays
  unavailable, matching existing rules.
- Discovery visibility controls retain memory hiding/restoration, hidden photograph
  restoration, suppressed association restoration, and private identity confirmation.
  Admin-only identity proposals and verified nonmember removal review remain scoped
  by existing server authorization. No additional group selector was introduced.
- Personal and admin local related-search processing consent reflect persisted state
  and change only after explicit action. Loading Settings does not index, enable
  recognition, call an external provider, or write consent.
- Failures hide unavailable control data and offer retry. Existing feature lifecycle
  aborts requests and clears authenticated content after a denied operation or
  session/context loss. Mutations serialize while busy.

The existing discovery processing store (`discovery_processing`) gates surviving
local related-search capabilities. `answers/processing` is a separate consent store
for answer generation and additionally depends on discovery group consent. Per
scope clarification, answer-generation-specific controls were not promoted to
Settings; their persisted consent remains unchanged. Existing legacy surfaces
remain available until final navigation retirement.

## Red and green evidence

1. `f2d8366` added the export/failure contract before implementation.
   `MAZI_UNIFIED_PORT=8126 npx playwright test -c playwright.unified.config.ts tests/entry.spec.ts -g 'Settings explicitly exports'`
   failed desktop/phone at the absent Archive and contributions heading.
   `8004ee4` made the same command pass 2/2.
2. `e4caaac` added new-profile default consent and departure behavior.
   `MAZI_UNIFIED_PORT=8126 npx playwright test -c playwright.unified.config.ts tests/entry.spec.ts -g 'Settings retains personal'`
   failed desktop/phone at the absent personal processing checkbox.
   `ce22b91` made the export plus consent/departure slices pass 4/4.
3. `9a1c589` added identity proposal/confirmation, own-source withdrawal and cancel,
   exported ZIP members/originals, cancelled/denied export, and post-loss cleanup
   regression coverage. `8b347fa` spaces the controls for phone use.

## Verification

- `MAZI_UNIFIED_PORT=8126 npx playwright test -c playwright.unified.config.ts tests/entry.spec.ts`: 24/24 desktop/phone pass after integration merge at `c1b6222` (31.2 seconds), recorded in the accompanying browser report. Includes build/typecheck.
- `MAZI_UNIFIED_PORT=8126 npx playwright test -c playwright.unified.config.ts tests/entry.spec.ts -g Settings`: 14/14 desktop/phone pass at final merge `786ac4a` (19.4 seconds), including build/typecheck.
- ZIP inspection verifies three eligible originals plus manifest, resources, people
  and personal discovery metadata through the downloaded artifact.
- `npm run lint`: pass after integration merge.
- `.venv/bin/python -m unittest tests.backend.archive.test_review tests.backend.discovery.test_discovery tests.backend.discovery.test_people_export tests.backend.test_export_file tests.backend.identity.test_shared_entry`: 92/92 pass. Includes independent-copy withdrawal, member departure, visibility exclusion, export admission/limits, errors, and privacy identity rules. Python emitted existing unclosed SQLite connection ResourceWarnings; no test failed.
- `git diff --check`: pass.
- `npm run check:budgets`: total scripts **420.8 KiB gzip / 420 KiB**, 0.8 KiB over after integration merge. Other limits pass. Limit unchanged; parent notified for final retirement of obsolete answer/story compositions.

[Full entry browser results](issue-156-browser-results.json),
[final Settings results](issue-156-final-settings-results.json),
[desktop controls](screenshots/settings-controls-desktop.png),
[phone controls](screenshots/settings-controls-phone.png).
Screenshots were visually inspected. Unrelated historical screenshots and reports
were restored after browser runs.

## Limits and risk

Local synthetic acceptance, no deployment or production acceptance. No backend,
schema, storage layout or persisted defaults changed. Existing export size and
access admission remain server-owned; the browser materializes the bounded export
as a Blob for explicit download/cancellation. Legacy compositions remain until
later tickets, accounting for the temporary aggregate bundle overage. Multiple
circle management reuses the existing selected-circle lifecycle; the fixture has
one circle. Past creations is owned by issue 157 and untouched here.
