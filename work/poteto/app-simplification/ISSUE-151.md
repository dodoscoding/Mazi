# Issue 151 — Add import and recovery acceptance

## Scope and revisions

Implements #151 and approved specification user stories 27–30, under decision D28. Worktree `/tmp/mazi-simplification-151`, branch `codex/simplification-151`, starts at integration baseline `485bcabe83f8da3a9bc635fe0c9646a45a1a43da` (ancestry verified). Git remote verified as `https://github.com/dodoscoding/Mazi.git` before commits.

- `78ad6e6`: integrated Add import/recovery contract.
- `a64394c`: expose the existing import workspace at `/add` and through the shell's Add menu.
- `fb46ede`: cancellation/history/session-loss coverage and fixture-independent identification of the imported photograph.
- `2f06068`: merge latest integration including Settings `00a7eeb`; resolve shared mode detection while preserving Add and Settings. The focused 8-test suite and lint pass again after this merge.

## Behavior

Add reuses the existing supported upload adapters, inventory confirmation, transfer/progress, import history, reports, cancellation, item retries, contribution withdrawal, and worker/session lifecycle. A successful item remains immediately available to the active circle; review adds no publish gate. No domain, storage format, schema, permission, or worker-continuation policy changes occur.

Legacy `/imports`, `/circle`, source management, and review remain available for the staged migration. The shell temporarily offers Add alongside the existing import link; final navigation consolidation belongs to #159. Source connections and focused correction queues are separate follow-up slices.

## Test seam and red evidence

The owner-approved seam is the existing integrated real-app Playwright boundary on desktop and Pixel 7 phone emulation, plus targeted existing HTTP/domain contracts. Fixtures contain synthetic JPEG bytes, an invalid JPEG item, and a separate inventory cancelled before ingestion. No personal archive is used.

`MAZI_UNIFIED_PORT=8121 npx playwright test --config playwright.unified.config.ts -g 'Add imports'` against baseline implementation: **2 failed**, with authenticated `/add` displaying “Sayfa bulunamadı” instead of Add. An earlier attempt encountered a missing Playwright browser; another used a new profile requiring introduction. Those were fixture/environment failures, excluded from behavior-red evidence. The corrected fixture uses the existing introduced Ben profile.

## Verification

- `MAZI_UNIFIED_PORT=8121 npx playwright test --config playwright.unified.config.ts -g 'Add imports|Add preserves|named profile imports|import report has one technical'`: **8 passed** (desktop and phone). This builds the actual app and starts the existing temporary-archive Python server. Covers upload → inventory → confirm → automatic availability, invalid-media retry, report download, exact imported photograph in Globe, persisted history, cancellation before processing, session-loss clearing, retained legacy import/logout behavior, and no publish gate.
- `.venv/bin/python -m unittest tests.backend.imports.test_http tests.backend.imports.test_engine tests.backend.identity.test_shared_entry`: **49 passed**. Includes upload replay/resume, retry/backoff, recovery, cancellation/withdrawal/departure fencing, report ownership, session validation, and denied media access.
- `npm run lint`: passed. `git diff --check`: passed.
- `python3 work/poteto/product-plan/verify_docs.py`: passed (19 authored documents, 350 local links).
- `npm run build`: passed through the integrated browser server startup; existing bundle-size warning remains.

The broader browser run initially found ambiguous unnamed-photo selectors. The final assertion identifies the asset through the public archive response and its displayed Globe photograph, preserving independence from fixture ordering.

## Evidence and limits

Screenshots: [desktop Add](add-desktop.png), [phone Add](add-phone.png). Screenshot animation is disabled to avoid capturing the retained entry fade midway.

This is local synthetic verification, not production milestone acceptance. Existing supported formats and continuation limits are unchanged. No push, deployment, data purge, migration, or individual PR was performed. Shared dependencies are symlinked read-only in practice from the source checkout; no dependency changes were made.
