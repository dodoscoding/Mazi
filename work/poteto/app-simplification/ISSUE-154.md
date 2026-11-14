# Issue 154 — Focused suggestions in Add

## Scope and revisions

Implements #154, specification stories 31–32, and decision D28. Branch `codex/simplification-154` in `/tmp/mazi-simplification-154` starts at integration `e0ebefc` (ancestry verified). Remote verified as `https://github.com/dodoscoding/Mazi.git` before commits.

- `d3efefa`: integrated duplicate/event decision and undo contract.
- `38977d7`: focused Add suggestion composition.
- `b0c13aa`: loading, failed-read recovery, and access-loss contract.
- `864c216`: queue loading and retry implementation.
- `623e12d`: honest empty-state regression.
- `196fba8`: merge integration `0499ff3`, preserving Settings controls alongside Add sources and suggestions.
- `a02dcf6`: explicit outsider denial for retained queue reads and decision actions.

## Behavior and stable interface

`/add?section=suggestions` is the third Add-local destination beside imports and source connections. The existing archive review mount receives `root.dataset.surface = "add"` and presents only duplicate/event suggestions and reviewed decisions. Existing originals/evidence links, merge/split, preferred rendition controls, keep separate/undo, event selection, acceptance, rejection, and event undo remain available.

The Add presentation hides the review rail, timeline, individual editing, On this day, contribution lists, export, and departure controls. Their data requests are skipped, including timeline reloads after duplicate decisions. The current-circle lifecycle context remains shared with imports and sources; Add has no per-surface circle selector. Existing `/review` is preserved during staged migration.

Queues provide independent loading statuses, per-queue failed-read retry, full refresh, existing suggestion-limit explanations, and explicit empty states. Access loss uses the retained lifecycle to clear scoped data and return to shared-code entry. Successful imports are already visible before reviewing suggestions; review adds no publication stage. No schema, storage, access policy, or domain decision semantics change.

## TDD and verification

Owner-confirmed seams: integrated real-app desktop and Pixel 7 Playwright journeys, plus focused existing HTTP/domain boundaries. `playwright.add-queues.config.ts` extends unified configuration with the existing `tests.browser.archive_server` temporary archive. It is included in `npm run test:app`. Synthetic JPEG files are uploaded through Add; public correction APIs establish the evidenced day/city precondition for event suggestions. No personal archive or component mock harness is used.

Red evidence:

- `MAZI_UNIFIED_PORT=8124 npx playwright test --config playwright.add-queues.config.ts` before implementation: **2 failed**, absent Suggestions link after successful automatically shared imports.
- `MAZI_UNIFIED_PORT=8124 npx playwright test --config playwright.add-queues.config.ts -g 'explain loading'` before recovery implementation: **2 failed**, absent duplicate loading status while the actual duplicate HTTP request is held.

Final verification after integration merge:

- `MAZI_UNIFIED_PORT=8124 npx playwright test --config playwright.add-queues.config.ts`: **6 passed**. Covers duplicate evidence/originals, merge/split, keep separate/undo, event acceptance, persisted rejection and undo, empty states, loading, synthetic HTTP 503 recovery, access-loss clearing, and absence of broad review controls or a publish step.
- `MAZI_UNIFIED_PORT=8124 npx playwright test --config playwright.add-sources.config.ts`: **6 passed**, preserving shared Add navigation and source/Discord workflows.
- `.venv/bin/python -m unittest tests.backend.archive.test_http tests.backend.archive.test_review`: **14 passed**, including explicit outsider denial for duplicate/event/reviewed reads, pair merge/dismiss/undo, and event accept/reject/undo; retained domain decision and withdrawal contracts pass.
- `node --test tests/dom/review.test.mjs`: **4 passed**. `node --test tests/dom/archive*.test.mjs`: **11 passed**. These retain existing review and archive lifecycle regressions.
- `npm run lint`, `git diff --check`: passed. Both integrated configurations run `npm run build`, which passed with the existing bundle-size warning.

## Evidence and cleanup seam

Screenshots: [desktop queues](queues-desktop.png), [phone queues](queues-phone.png). Desktop screenshot inspected: Add-local navigation, evidence and decision controls are present; broad archive review is absent.

After #159 translates legacy `/review` links to their retained tasks, the broad timeline/today/contribution/export compositions and handlers in the shared archive module/template can be removed if no caller remains. Preserve the duplicate/event mount, reviewed decisions, evidence, preference controls, and available undo. Settings owns export/departure and the shared viewer owns applicable individual corrections.

This is local synthetic verification, not production milestone acceptance. Existing suggestion limits and processing constraints remain. No push, deployment, individual PR, archive purge, or migration occurred.
