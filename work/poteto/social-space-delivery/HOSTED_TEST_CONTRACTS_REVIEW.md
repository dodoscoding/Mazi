# Hosted test contracts independent review

Latest verdict is PASS+NOTES at `d9bf0dff2801b72862b04f1feb48d1f493c3e919`. The warm-up resolves the finding below. All four corrected paths have passing evidence at that head across two runs. Intermittent pooler availability and cold-connection delays remain. The initial failed review is retained below.

## Initial review at be67c8a

FAIL for completed hosted validation. The test-only index and named-column corrections are sound, and all three corrected social cases pass. The generic policy-reader contract still fails before its locking assertions because cold connection acquisition exceeds its future timeout.

## Reviewed revision

- Worktree `/Users/altanesmer/Desktop/Ales/Mazi-wt/hosted-verification-contracts`.
- Base `d203ba7080547c8cf6511ecd2d434fd3a7cd9a64`.
- Head `be67c8ac42b0e1b3b88fdb9de3a470d54247675c`.
- Stable patch ID `04fab251b89a38fbccb6e2df44e69fd88913a600`.
- Reviewer did not author the patch or edit its source.

## Standards

PASS. The complete patch changes four Python test files with 14 additions and five removals. It changes no runtime code, dependencies, schema, migrations, or DDL. All prior RLS checks, anonymous/authenticated denial, ledger grant checks, uniqueness, and group foreign-key checks remain intact. The three index assertions accept only their existing target index or the named reviewed H1 replacement. They also require an actual index condition and the relevant group/time or group/photo fields in EXPLAIN output.

The generic archive fixture now names both asset and origin columns, leaving native `_mazi_order` defaults intact. The reader-overlap, writer-fence, rollback, and eventual-withdrawal assertions remain unchanged. No new comment or suppression was added.

Committed-branch whitespace passed with `git diff --check d203ba7...HEAD`. The docs checker passed with 19 authored documents and 348 local links. The reviewed worktree remained clean. Its `mazi/` and migration trees match the earlier frozen backend revision `921670ea1cfbbaf219baa4bc2af9c1bd719d0b7b`.

## Spec and actionable finding

FAIL. `tests/backend/test_postgres.py:202` starts the reader's first hosted operation inside a future with a ten-second watchdog. `MemoryStore` opens its PostgreSQL connection lazily. The configured connection timeout is 15 seconds per address, so a valid connection can complete after the future has already timed out.

The independent serial retry measured a successful reader `psycopg.connect` call at **15.235 seconds** on `ThreadPoolExecutor-0_0`. The same test then raised `TimeoutError` at `Future.result(timeout=10)`. The fixture's primary connection took 15.253 seconds. The reactions fixture opened its connection in 30.309 seconds and passed. The policy test failed at the same future boundary on both correction runs.

This is an actionable validation gap. Open the reader and writer connections with a harmless guarded query before the shared-lock and future window. Retain the ten-second worker watchdog and 50 ms database lock timeout for the actual overlap and withdrawal contract. The current evidence does not show a policy-lock regression, but it does not validate that contract either.

## Executed hosted cases

All children used the original Python 3.14.7 environment through Node 24.15.0. Credentials loaded through the original ignored env-file. The runner explicitly supplied and asserted `MAZI_DATABASE_SCHEMA=mazi_social_20261104_test`, `MAZI_STORAGE_BUCKET=mazi-social-test`, `MAZI_BACKEND=supabase`, and `MAZI_TEST_POSTGRES=1`. Existing schema guards and synthetic fixture teardown remained intact. No other metadata transaction or hosted suite ran concurrently.

| Case | First corrected serial run | Targeted serial retry |
| --- | --- | --- |
| Plans private schema and group/time index | PASS | Not repeated |
| Comments group foreign keys, privileges, and keyset index | PASS | Not repeated |
| Reactions uniqueness, group foreign keys, and private indexed storage | Connection timeout during fixture registration | PASS |
| Policy-reader overlap and withdrawal fence | Future timeout before assertions | Same future timeout; reader connect measured at 15.235 s |

The first four-case run took 72.091 seconds and ended with two errors. Its custom result preserved an underlying `psycopg.errors.ConnectionTimeout`, SQLSTATE `None`, with connection timeouts for all three pooler addresses. This establishes the cause of that reactions attempt only. It does not recover the earlier frozen run's masked causes.

The two-case retry took 68.929 seconds. Timing instrumentation wrapped `psycopg.connect` in the runner only and preserved return values and exceptions. No source or timeout changed. Full errors and timing output are preserved in [the correction failure artifact](HOSTED_TEST_CONTRACTS_FAILURES.txt).

## Acceptance limits

Three corrected cases pass and the revised privacy assertions execute successfully. Across the original 23 paths, its serial connection reruns, and these correction runs, 22 distinct paths now have passing evidence. The generic policy-reader path still lacks a successful final-schema run. This is not a fresh green monolithic 23-test run.

Fresh pooler connection delays are a material environment and latency limitation. These isolated tests do not establish production latency, physical-phone acceptance, milestone acceptance, or hosted concurrency at scale. No production access, migration, merge, publication, or deployment ran. The coordinator must resolve the remaining test boundary and obtain a passing independent run before treating hosted validation as complete.

Poteto Prove It Works determined the direct hosted execution and connection timing. Shipping review records the exact immutable base, head, and patch ID. The original frozen failure record remains unchanged.

## Warm-up correction at d9bf0df

PASS+NOTES. Exact head is `d9bf0dff2801b72862b04f1feb48d1f493c3e919`. The original base remains `d203ba7080547c8cf6511ecd2d434fd3a7cd9a64`. The full patch ID is `c2d135bbe61e02f374ba0befbf3600a77c245b4a`. The three-line delta from reviewed head `be67c8ac42b0e1b3b88fdb9de3a470d54247675c` has patch ID `6e5612985d12854c1d4df988e7378d92764e2a35`.

The delta opens reader and writer connections with `SELECT 1` in completed read transactions before the existing shared policy transaction and worker future. It changes no runtime code or DDL. The ten-second future watchdog, 50 ms lock timeout, shared-reader assertion, blocked withdrawal, rollback check, eventual withdrawal, and final hidden projection remain intact. Committed-branch whitespace passes and the source worktree is clean. No actionable source findings remain.

The standalone policy-reader case passed in 35.125 seconds. Connections took 0.275, 30.246, and 0.274 seconds, all on the main thread before the future. The completed test exercised the original locking and withdrawal assertions. [Standalone output](HOSTED_POLICY_WARMUP.log) preserves this result.

The subsequent serial four-case run passed plans, comments, and reactions. Their successful connections took 30.219, 0.215, and 15.271 seconds. The policy fixture connected in 0.203 seconds, then its warm-up connection failed after 45.006 seconds. The runner retained `psycopg.errors.ConnectionTimeout`, SQLSTATE `None`, after all three pooler addresses timed out. That error occurred before the lock/future window at `test_postgres.py:201`. The four-case run took 105.126 seconds and ended with three passes and one connection error. [Four-case output](HOSTED_CORRECTED_FOUR.log) preserves the full trace and underlying cause.

All four distinct corrected paths have now passed at this exact head across these two commands. Together with the original run and serial reruns, all 23 original test paths have passing evidence against unchanged runtime code. No fresh monolithic 23-case suite or fully green four-case batch was run. This patch verdict does not resolve the observed hosted pooler availability and cold-connection latency risk.

## Reproduction commands

The [audit runner](hosted_verification_runner.mjs) fixes the exact synthetic child environment, asserts the repository guard, preserves redacted underlying exception causes, and times connection acquisition without changing behavior. Run these commands from the reviewed source worktree. No other hosted transaction ran concurrently.

```sh
node --env-file=/Users/altanesmer/Desktop/Ales/Mazi/.env.supabase /Users/altanesmer/Desktop/Ales/Mazi-wt/social-space-delivery/work/poteto/social-space-delivery/hosted_verification_runner.mjs tests.backend.test_postgres.PostgresContracts.test_policy_readers_overlap_and_fence_withdrawal_until_commit

node --env-file=/Users/altanesmer/Desktop/Ales/Mazi/.env.supabase /Users/altanesmer/Desktop/Ales/Mazi-wt/social-space-delivery/work/poteto/social-space-delivery/hosted_verification_runner.mjs tests.backend.social.test_plans_postgres.HostedPlansTests.test_private_schema_and_group_time_query_index tests.backend.social.test_comments_postgres.HostedCommentsTests.test_database_group_foreign_keys_runtime_privileges_and_keyset_query_index tests.backend.social.test_reactions_postgres.HostedReactionsTests.test_uniqueness_group_foreign_keys_and_private_indexed_storage tests.backend.test_postgres.PostgresContracts.test_policy_readers_overlap_and_fence_withdrawal_until_commit
```
