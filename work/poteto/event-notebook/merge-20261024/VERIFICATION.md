# Notebook conflict resolution, 24 October 2026

## Merge and primary sources

Merge `origin/main` at `2eccda3e207c08e7a705547fcb274a811b5d979e` into PR #102 at `3a532835c754d59e626cfb8b0a616328c4a8a525`. Keep the existing PR branch and commit history; use a normal merge and push. No PR landing or deployment is requested.

Literal conflicts were limited to `src/Home.tsx` and `src/MemoryView.tsx`. Primary sources were the original event notebook contract, PR #106 and D24's background/history changes, and PR #107 and D21's map placement additions. The automatic App and route merges were also inspected.

## Resolution

- Combine the notebook hooks and main's MouseEvent type import in MemoryView. Keep main's in-app Back and Escape handling.
- Keep main's replacement navigation for the portal photo action. Give the notebook title the same replacement behavior, retaining its notebook query flag. New desktop/phone tests exercise both the Back pill and Escape without reopening the portal.
- Preserve main's placement controls, placed-memory projection, history tracking, and once-per-circle Atlas loading.
- Reconcile semantic drift against newer D24. Remove the notebook's hide/pagehide/show clearing and refetch hooks. Keep saved notes, newer drafts and pending saves in memory; the shared session gate revalidates on return. Denied access, changed group/identity and unmount still clear private content and suppress late responses. Update the current decision, brief and architecture accordingly.
- Make the existing logout/late-Atlas-response integration test start a cold page load before holding the authenticated response. Returning Home no longer guarantees a new Atlas fetch under main's caching policy. The held response, logout and no-private-UI assertions remain intact.

No new schema, storage format, public endpoint, styling or feature is introduced by this merge resolution. Main's already-landed database migration remains included unchanged.

## Throughput and ownership

Blocking work pinned both parents and traced each conflicting intent before edits. The parent owned navigation/import conflicts, docs and integration checks; one implementation worker owned notebook lifecycle and its tests. They used disjoint files. Browser harness runs were serialized. A fresh reviewer assessed the combined result. Architecture alternatives were unnecessary because the merged approved contracts prescribe the behavior.

## Verification

- Typecheck, built application, formatting, document checker, bundle budgets and whitespace checks pass.
- Focused notebook desktop/phone contracts pass, 26 cases. The new background-retention case failed before the lifecycle resolution. Foreground session 401 and 403 still clear private content and ignore a delayed save response.
- Navigation/browser regression run passes 77 cases with 9 opt-in captures skipped. Covers memory detail, journey, resilience, atlas and the new portal-title Back/Escape cases on desktop and phone.
- Domain/HTTP checks pass 71 cases covering memories, Atlas, placement, chronology and import adapters.
- Unit tests pass 20 cases. Full DOM suite passes 151 cases with `node --test --test-concurrency=1 tests/dom/*.test.mjs`. The default concurrent run stalled in the unchanged Atlas test harness; its task-owned processes were stopped, then the same complete suite passed serially.
- Independent review found no actionable integration issues. Its 7 entry/history DOM checks also pass. See [REVIEW.md](REVIEW.md).
- Full integrated desktop/phone run passes all 60 cases in 1.3 minutes with a fresh synthetic server.

An initial integrated run exposed the obsolete route-refetch assumption. Its timeout left a temporary story behind and caused a later strict-selector failure. The corrected test is rerun from a fresh synthetic server. No production archive is used.

Firefox, physical phones and hosted PostgreSQL are not exercised by this conflict-resolution pass. Earlier Firefox launch limitations remain recorded in the feature verification. Logs stay local and ignored; existing tracked test screenshots and generated reports are restored before the merge commit.
