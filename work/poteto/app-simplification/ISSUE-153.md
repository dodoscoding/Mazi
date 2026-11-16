# Issue 153 — Viewer corrections and owned contributions

## Scope and revisions

Implements #153, specification stories 20 and 53, and decision D28. Branch `codex/simplification-153` in `/tmp/mazi-simplification-153` starts at integration `6fb57f5` (ancestry verified). Remote verified as `https://github.com/dodoscoding/Mazi.git` before commits.

- `18c6a5f`, `f7ba14d`: selected-photograph owned-contribution HTTP contract and server filter.
- `5a27e50`, `ec57daa`: integrated viewer contract and contribution management.
- `6820093`, `3cdbd6b`: failed removal/read recovery, current ownership/session denial, and Photos refresh regressions.
- `25dc35c`: merge integration `b062483`, including Photos; final verification below ran after this merge.
- `142dc6c`: keep contribution details below the photo controls, verified in the refreshed screenshot.
- `2202bee`: separate fix for the previously introduced Add navigation CSS scope defect, described below.

## Behavior

The shared viewer retains the existing selected-photo date/place editor and its evidence/snapshot handling. A failed save preserves the draft; corrections update through `mazi:archive-changed`. Original imported assertions remain unchanged. Unmatched free-text places remain visibly unpinned; the example source's ambiguous date order stays explicit after a capture-date correction. The invalid-date message no longer sends a member to the retiring Archive review destination.

A discoverable Katkımı yönet control opens a lazy selected-photo contribution panel. It reads only the current member's active source records for that photograph, offers confirmation before removal, preserves the confirmation and record after a failed removal, and supports failed-read retry. Removing a contribution refreshes normal archive/viewer reads. Other members' independent contributions remain visible, and only the withdrawn owner's context disappears. Removing the last eligible contribution yields the existing unavailable-record state and removes the photograph from Photos on the next read.

`GET /api/review/my-contributions?group=…&asset=…` adds an optional selected-asset filter to the existing public API. Membership is checked before validation/filtering; unfiltered clients retain their existing response. This avoids the archive-wide first-1,000-record limit hiding an applicable selected-photo action. The retained limit is still 1,000 active owned source records within the requested scope; no new pagination guarantee is introduced. Removal uses the existing owner-enforced `/api/review/delete-contribution` operation. No schema, storage, ownership, or withdrawal-policy change occurs.

## TDD and verification

Owner-confirmed seams: existing real-app unified Playwright desktop/Pixel 7 journeys and targeted HTTP/domain contracts. Two synthetic WhatsApp exports contain identical JPEG bytes but distinct Alice/Ben conversation context. Public import/correction APIs establish the fixture; assertions use the viewer, Photos, and public archive reads. The secondary member uses a separate authenticated browser context. Both contributions are withdrawn during cleanup. No personal archive or component mock harness is introduced.

Red evidence:

- `.venv/bin/python -m unittest tests.backend.archive.test_http.ReviewHttpTests.test_selected_photo_contributions_are_scoped_and_owner_only`: **1 failed** before filtering, returning unrelated owned records for an unavailable selected asset.
- `MAZI_UNIFIED_PORT=8123 npx playwright test --config playwright.unified.config.ts -g 'viewer corrects one photograph'`: authenticated desktop reached the missing Katkımı yönet control after successful corrections and failed-write recovery. Both final corrected fixture runs exercise the same new contract on desktop and phone. An early phone fixture reused already-corrected bytes; the fixture now derives identical-per-owner but unique-per-test image bytes, preventing cross-test metadata reuse.

Final green evidence after Photos integration:

- `MAZI_UNIFIED_PORT=8123 npx playwright test --config playwright.unified.config.ts -g 'viewer corrects one photograph|viewer contribution controls|selected child corrections'`: **6 passed**. Covers selected date/place edits, sibling isolation, failed-write draft preservation, unchanged original assertions, corrected Photos capture-year placement, failed removal retry, owned withdrawal with independent eligible copy/context, last-copy unavailability and absence from Photos, failed contribution-read recovery, and session-loss clearing.
- After the final contribution-panel layout adjustment, `MAZI_UNIFIED_PORT=8123 npx playwright test --config playwright.unified.config.ts -g 'viewer corrects one photograph|viewer contribution controls'`: **4 passed**; screenshots refreshed.
- `.venv/bin/python -m unittest tests.backend.archive.test_http tests.backend.test_photo_corrections tests.backend.imports.test_engine.EngineTests.test_withdraw_independent_contributions_and_owner_only_report`: **12 passed**. Includes selected scoping, unchanged unfiltered reads, invalid query handling after access checks, same-circle non-owner and outsider denial, withdrawn-media denial, optimistic conflicts, preservation of other fields, and independent-contribution ownership rules.
- `node --test tests/dom/photo-correction.test.mjs tests/dom/photo-evidence.test.mjs tests/dom/workspace-design.test.mjs`: **8 passed**. Retains selected-draft conflict handling, access-loss aborts, per-photo evidence, and shared styling contracts.
- `npm run lint`, `git diff --check`: passed. Integrated server startup runs `npm run build`, which passed with the existing bundle-size warning.

## Separate Add styling regression

The parent full-DOM run found the #152 `.add-sections` selectors violated the existing feature-style scoping contract. Reproduced with `node --test tests/dom/workspace-design.test.mjs`: **2 passed, 1 failed**, identifying the unscoped `.add-sections` selector. Commit `2202bee` prefixes both selectors with `.feature-content`; the unchanged contract then reports **3 passed**. No test was weakened.

## Evidence and limits

Screenshots: [desktop viewer after owned withdrawal](contribution-desktop.png), [phone viewer after owned withdrawal](contribution-phone.png). Desktop screenshot inspected: remaining Ben context, explicit source-date uncertainty, unpinned corrected place, and the empty owned-contribution panel are visible.

These are local synthetic checks, not production milestone acceptance. Later search/recap surfaces inherit the existing domain visibility/correction rules. Legacy review remains until #159 translates its retained tasks. No push, deployment, individual PR, archive purge, or migration occurred.
