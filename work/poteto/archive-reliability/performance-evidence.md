# Atlas and preview performance evidence

## Revisions and scope

Verified in `/Users/altanesmer/.codex/worktrees/import-performance-release/Mazi`, branch `codex/archive-reliability`, on macOS with the repository `.venv` and Node tooling. Remote inspected: `https://github.com/dodoscoding/Mazi.git`. Baseline is deployed `cf26a7d`. Unit 2 contracts are `de0f937`, implementation `01a098e`; preview contracts are `7fdf6f9`, implementation `573c3aa`. This worker used synthetic local fixtures only and made no live mutations. Parent-reported hosted observations below are separate evidence.

## Red and green contracts

Before Unit 2 implementation:

```sh
.venv/bin/python -m unittest tests.backend.test_atlas_projection.AtlasProjectionTests.test_projection_query_count_is_constant_for_1_300_and_1001_photos tests.backend.test_persistence.TransactionContracts.test_policy_read_context_uses_shared_lock_and_rolls_back_failures
node --test tests/dom/archive-hook.test.mjs
```

The direct Atlas query counts were 21 / 918 / 3,021 for 1 / 300 / 1,001 photographs; the shared-read API was absent. Three DOM contracts failed: feature navigation issued nine groups requests, Atlas navigation issued three Atlas requests, and superseded visibility work was not aborted.

After implementation:

```sh
.venv/bin/python -m unittest tests.backend.test_atlas_projection tests.backend.test_persistence tests.backend.archive.test_capacity tests.backend.test_postgres
node --test tests/dom/archive-hook.test.mjs
npm run typecheck
npm run build
npx prettier --check src/useArchive.ts tests/dom/archive-hook.test.mjs
git diff --check
```

Result: 39 backend tests ran successfully, including eight explicitly skipped hosted cases; all six hook DOM tests passed. Typecheck, build, formatting and whitespace checks passed. The build retained its existing large-chunk warning. Direct synthetic projections now use exactly 20 statements / 18 SELECTs at all three archive sizes. The exact 1,001-photo HTTP contract uses 31 statements including authentication/session work; its ceiling is 35, while the direct constant-query contract has a ceiling of 24. No per-photo SQL remains in Atlas enrichment.

The original 300-photo reproduction can be rerun with:

```sh
PYTHONPATH=. .venv/bin/python /tmp/mazi-load-investigation/count.py
```

At `01a098e` it returned 300 cards, 20 statements and 18 SELECTs, compared with 918 statements / 916 SELECTs at baseline. SQLite elapsed time is not a production latency measurement. The helper's `per_photo_queries` counter matches SQL text substrings and reports three even after batching; it is not an accurate classification of repeated per-photo queries. Fixed counts across archive sizes establish the relevant bound.

Atlas now streams group-scoped origins/profiles and places, retaining deduplicated message content rather than an archive-wide decoded payload map. Existing byte-exact card contracts, reversed/overlapping event order, source context ordering, independent-origin withdrawal, hidden assets/events, departed owners and reader removal all pass. The existing 1,000-photo repeated-16-KiB-context contract remains below its 4 MiB traced Python-allocation ceiling, for both grouped and hidden cards. This ceiling does not measure PostgreSQL native client buffers or browser memory.

Hosted Atlas uses the same schema advisory key with a shared transaction lock; writers retain the exclusive lock. SQLite retains BEGIN IMMEDIATE. The added hosted contract allows a second Atlas reader while the first policy transaction remains open, rejects a withdrawal writer on its bounded lock timeout, and permits withdrawal after reader commit. Navigation retains the existing hook state within Atlas routes through a derived route-category dependency; crossing between feature and Atlas routes reloads. There is no added persistent cache. Visibility, pagehide and access-loss invalidation clear private state, and superseded loads abort their own controllers.

## Preview regression and correction

Independent parent review found the newly explicit standalone transaction model amplified the old preview's 11 separate SQL calls into approximately 33 database exchanges before Storage. Red commit `7fdf6f9` exposed missing policy transaction boundaries, an archive-wide visibility scan and repeated authorization. Five new focused cases failed before implementation; the shared-group-policy fixture was then corrected to enable shared mode explicitly.

The red selection was:

```sh
.venv/bin/python -m unittest tests.backend.archive.test_review.ReviewTests.test_preview_locator_finishes_policy_transaction_before_storage tests.backend.discovery.test_discovery.DiscoveryTests.test_preview_authorization_queries_are_bounded_before_storage tests.backend.discovery.test_discovery.DiscoveryTests.test_withdrawn_selected_preview_falls_back_without_archive_scan tests.backend.discovery.test_discovery.DiscoveryTests.test_removed_selected_owner_preview_falls_back_without_archive_scan tests.backend.discovery.test_discovery.DiscoveryTests.test_denied_preview_never_reads_storage_and_keeps_shared_group_policy
```

Final green verification at `573c3aa`:

```sh
.venv/bin/python -m unittest tests.backend.archive.test_review tests.backend.discovery.test_discovery tests.backend.test_atlas_projection
git diff --check
```

All 45 tests passed in 14.559 seconds. Broader existing fixtures emitted SQLite ResourceWarnings, without test failures.

Review resolves the requested authorized locator once, checks a selected rendition and its approved merge, and falls back when selected authorization fails. Discovery preserves `_member` shared-group policy and checks only the requested/resolved IDs against personal hiding. Normal discovery previews now execute five SELECTs inside one policy transaction for both 1-photo and 1,001-photo fixtures; SQLite records seven total statements including BEGIN/COMMIT. Direct Review previews use three SELECTs. Storage is called after transaction completion. Hosted configuration/lock/commit overhead remains; five SELECTs is not five total network exchanges. Storage metadata SQL and private object download costs are outside the fake-Storage query-budget measurement.

Contracts cover denied requests making no Storage read, hidden selected fallback, withdrawn selected import, removed selected owner, absent/undone merge approval, original withdrawal, shared-group policy and unchanged hidden-event preview behavior. General `asset_bytes` behavior is unchanged.

## Parent-reported real checks and limits

Parent reported all 10 enabled hosted contracts passing in 19.836 seconds against an isolated transaction-pool test schema, including the new shared-reader/withdrawal test. The parent concurrency harness `/tmp/mazi-load-investigation/pool-concurrency.py`, with `CHECK_ATLAS=1`, passed 20 concurrent cached stores and Atlas reads in 2.161 seconds; its checks include repeated queries, valid cursors after disconnect and 20 closed clients. Credentials and full launch environment are intentionally not copied here.

For the existing production archive's 300-photo projection, the parent measured 22.028 seconds before and 1.143 seconds after in one paired local-client sample. This is evidence for that projection sample, not a complete browser load or production percentile claim. Authentication, image downloads, browser rendering, deployment cold starts and network variation remain separate. Parent owns authenticated browser verification, release acceptance, configuration, merge and deployment.

## Main backport recommendation

Backport shared application changes and their shared tests from the reliability range, resolving against main rather than copying the release tree wholesale: `mazi/persistence.py`, `mazi/archive/hosted_ops.py`, `mazi/atlas.py`, `mazi/archive/review.py`, `mazi/discovery/discovery.py`, `src/useArchive.ts`, and the affected persistence/recovery/Postgres/Atlas/review/discovery/archive-hook tests. Main may require contextual adaptation for earlier import work; run its full applicable suites.

Keep these release-only additions out of the main backport unless main explicitly adopts native Vercel hosting: `api/index.py`, `vercel.json`, `tests/backend/test_vercel_bridge.py`, and `docs/DEPLOYMENT.md`. These four paths are absent from inspected `origin/main` and were added on the release line. Carry shared design/evidence documentation as appropriate, but avoid introducing deployment-specific claims or the release branch's unrelated historical import changes through a blanket merge.
