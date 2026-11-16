# Final isolated hosted verification

FAIL at the frozen revision. Representative hosted behavior passes after serial reruns, but four stale test contracts still require correction. This record does not approve deployment.

## Source and isolation

The independent reviewer used a fresh detached worktree at `/Users/altanesmer/Desktop/Ales/Mazi-wt/final-hosted-validation`, revision `921670ea1cfbbaf219baa4bc2af9c1bd719d0b7b`. Its `mazi/` tree matches keyword correction `b017d69`. No source, dependency, build artifact, or migration changed during validation. Node was 24.15.0 and Python was from the original checkout's existing virtual environment.

Every hosted child explicitly used `MAZI_DATABASE_SCHEMA=mazi_social_20261104_test`, `MAZI_STORAGE_BUCKET=mazi-social-test`, `MAZI_BACKEND=supabase`, and `MAZI_TEST_POSTGRES=1`. Credentials were loaded through `node --env-file=/Users/altanesmer/Desktop/Ales/Mazi/.env.supabase` and were never printed. The runner asserted the exact schema and bucket before loading the tests. The repository's `require_synthetic_schema()` guard remained unchanged. No live archive access, DDL, production mutation, or deployment ran.

The discovered social hosted modules were plans, comments, reactions, labels, Home, and reaction batch performance. Their UUID-scoped synthetic fixtures own their groups, users, and object keys. Completed fixture teardown had no reported errors. The three connection failures during initial registration occurred before fixture writes. The later labels connection failure still ran its existing teardown successfully. No global cleanup was used.

## Exact initial command

This ran from the detached validation worktree.

```sh
node --env-file=/Users/altanesmer/Desktop/Ales/Mazi/.env.supabase - <<'JS'
const {spawnSync}=require('node:child_process');
const env={...process.env,MAZI_DATABASE_SCHEMA:'mazi_social_20261104_test',MAZI_STORAGE_BUCKET:'mazi-social-test',MAZI_BACKEND:'supabase',MAZI_TEST_POSTGRES:'1'};
const script=`import os,unittest
assert os.environ['MAZI_DATABASE_SCHEMA']=='mazi_social_20261104_test'
assert os.environ['MAZI_STORAGE_BUCKET']=='mazi-social-test'
assert os.environ['MAZI_BACKEND']=='supabase'
assert os.environ['MAZI_TEST_POSTGRES']=='1'
from tests.backend.test_postgres import require_synthetic_schema
assert require_synthetic_schema()=='mazi_social_20261104_test'
names=[
 'tests.backend.social.test_plans_postgres',
 'tests.backend.social.test_comments_postgres',
 'tests.backend.social.test_reactions_postgres',
 'tests.backend.social.test_labels_postgres',
 'tests.backend.social.test_home_postgres',
 'tests.backend.social.test_reaction_batch_postgres',
 'tests.backend.test_postgres.PostgresGuardContracts',
 'tests.backend.test_postgres.PostgresContracts.test_trigger_generation_uniqueness_and_reusable_connection',
 'tests.backend.test_postgres.PostgresContracts.test_departure_triggers_run_through_identity_store',
 'tests.backend.test_postgres.PostgresContracts.test_export_people_and_hidden_memories_use_native_event_columns',
 'tests.backend.test_postgres.PostgresContracts.test_policy_readers_overlap_and_fence_withdrawal_until_commit',
 'tests.backend.test_postgres.PostgresContracts.test_held_lock_timeout_rolls_back_and_recovers',
]
suite=unittest.defaultTestLoader.loadTestsFromNames(names)
result=unittest.TextTestRunner(verbosity=2).run(suite)
raise SystemExit(not result.wasSuccessful())
`;
process.exit(spawnSync('/Users/altanesmer/Desktop/Ales/Mazi/.venv/bin/python',['-c',script],{stdio:'inherit',env}).status??1);
JS
```

The run executed 23 tests in 507.383 seconds. Fifteen passed, three failed assertions, and five errored. The [complete failure traces and exact EXPLAIN output](FINAL_HOSTED_FAILURES.txt) preserve the initial results.

## Standards

PASS for isolation and source preservation. All mutation fixtures retain the hosted opt-in and isolated-schema guard. The validation source remains frozen. No assertion was relaxed, runtime code edited, or migration applied.

## Spec and failures

FAIL for the current hosted test gate. Three legacy exact-index assumptions conflict with the final H1 indexes.

| Test and source line | Actual final plan | Required correction boundary |
| --- | --- | --- |
| `HostedPlansTests.test_private_schema_and_group_time_query_index`, `test_plans_postgres.py:101` | `Index Only Scan using social_plans_upcoming`. Indexed conditions include group, active status, and minimum start time. | Preserve the real group/time access contract and allow the reviewed new upcoming index. |
| `HostedCommentsTests.test_database_group_foreign_keys_runtime_privileges_and_keyset_query_index`, `test_comments_postgres.py:93` | `Index Scan using social_comments_activity`. Indexed condition is group, photo is a filter, and a sort orders creation time and ID. | Preserve the target-specific index definition and real group/photo/order contract. This tiny fixture does not prove scale. |
| `HostedReactionsTests.test_uniqueness_group_foreign_keys_and_private_indexed_storage`, `test_reactions_postgres.py:86` | `Index Scan using social_reactions_activity`. Indexed condition is group and photo is a filter. | Preserve target uniqueness, group foreign keys, suitable named indexes, and private storage checks. |

These tests must not be reduced to accepting an arbitrary index. The final plans are recorded verbatim in the failure artifact. The initial checks before each failed index assertion passed. Independent catalog checks below cover the later RLS and grant assertions that the early assertion prevented from running.

The generic `PostgresContracts.test_policy_readers_overlap_and_fence_withdrawal_until_commit` errors at `tests/backend/test_postgres.py:192`. Its positional `INSERT INTO archive_assets VALUES(...)` sends a synthetic UUID into the hosted `_mazi_order` bigint column. This is a stale fixture shape. The fixture must name the intended columns before its policy-lock behavior can be validated on the final schema.

Four other initial errors were `ArchiveUnavailable` from `_start()` while starting hosted connections. They occurred in plans registration, comments registration, the labels test's separate identity-store connection, and generic export registration. None was an export assertion failure or an `ArchiveBusy` error. The initial standard runner printed the wrapper exception because `_start()` raises it with `from None`. Its underlying psycopg context was not captured before process exit and cannot be recovered from that completed process. The transport cause remains unknown. An early interference hypothesis was not supported by the final traces and is withdrawn.

## Serial rerun results

All four connection-failed tests passed in a single serial rerun, without concurrent catalog checks or another hosted suite. The runner used the same explicit child environment and the existing test guards.

```sh
node --env-file=/Users/altanesmer/Desktop/Ales/Mazi/.env.supabase - <<'JS'
const {spawnSync}=require('node:child_process');
const env={...process.env,MAZI_DATABASE_SCHEMA:'mazi_social_20261104_test',MAZI_STORAGE_BUCKET:'mazi-social-test',MAZI_BACKEND:'supabase',MAZI_TEST_POSTGRES:'1'};
process.exit(spawnSync('/Users/altanesmer/Desktop/Ales/Mazi/.venv/bin/python',['-m','unittest','-v',
 'tests.backend.social.test_plans_postgres.HostedPlansTests.test_replay_cas_departure_and_export_match_sqlite',
 'tests.backend.social.test_comments_postgres.HostedCommentsTests.test_replay_cas_immutable_fractional_creation_and_export_visibility',
 'tests.backend.social.test_labels_postgres.HostedLabelsTests.test_identity_departure_preserves_monotonic_version_and_stale_rows_stay_unknown',
 'tests.backend.test_postgres.PostgresContracts.test_export_people_and_hidden_memories_use_native_event_columns'
],{stdio:'inherit',env}).status??1);
JS
```

```text
test_replay_cas_departure_and_export_match_sqlite ... ok
test_replay_cas_immutable_fractional_creation_and_export_visibility ... ok
test_identity_departure_preserves_monotonic_version_and_stale_rows_stay_unknown ... ok
test_export_people_and_hidden_memories_use_native_event_columns ... ok
Ran 4 tests in 153.071s
OK
```

An earlier focused plans replay/export rerun also passed in 62.031 seconds. A focused plans-index rerun reproduced the exact assertion failure in 2.326 seconds. Neither result replaces the initial failure record.

Across the initial run and serial rerun, 19 distinct tests passed. The three index tests and generic positional-insert fixture remain unresolved at the frozen revision. Home's three hosted contracts and the 21-target reaction query-count contract passed initially. Covered behavior includes current visibility, departed actions, fractional timestamps, same-time pagination, bounded Home projections, replay, CAS, cancellation/attendance concurrency, authored export, hidden-target export suppression, tombstones, monotonic labels, approved-person suppression, transaction recovery, and native hosted event export columns.

## Catalog and security parity

A separate guarded read-only pass queried only the isolated schema through `PostgresConnection`. It confirmed the exact `current_schema()` before assertions. All nine social tables have RLS enabled. All 126 checked `anon` and `authenticated` privileges were denied across SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, and TRIGGER. Runtime DELETE remains denied for comment deletion ledgers, reaction deletion ledgers, and label versions.

All six H1 indexes exist with final definitions.

| Index | Indexed keys and predicate |
| --- | --- |
| `social_comments_activity` | `(group_id, updated_at, id)` |
| `social_reactions_activity` | `(group_id, updated_at, id) WHERE active = 1` |
| `social_plans_activity` | `(group_id, updated_at, id)` |
| `social_plans_upcoming` | `(group_id, status, starts_at, id)` |
| `archive_origins_selected` | `(asset_id, id)` |
| `archive_origins_run_page` | `(group_id, run_id, id)` |

The catalog pass briefly overlapped the initial test run. Its shared archive transaction was unnecessary, so later reruns were serial. No initial trace shows a resulting lock timeout. The four transport errors cannot be attributed to that overlap.

## Acceptance limits and next gate

This is representative hosted parity on synthetic fixtures. No demonstrated privacy failure emerged. Fresh hosted connections failed intermittently in the initial run, then passed the serial rerun. Their masked underlying cause remains a reliability limitation. Total suite duration includes fixture creation, storage, and repeated SQL round trips and is not a hosted latency measurement.

The coordinator must independently review the separate test-only corrections and rerun the four remaining contracts. The policy-reader overlap contract has not reached its assertions on the final schema. Production migration and deployment remain pending. This does not establish production milestone acceptance, physical-phone acceptance, cold-start behavior, or concurrency at archive scale.

Poteto Prove It Works determined the use of actual hosted PostgreSQL and Storage with guarded synthetic fixtures. The read-only review scope kept the frozen source unchanged. No publication, merge, or deployment was performed by this reviewer.

## Test-only correction review at be67c8a

The independent reviewer inspected `be67c8ac42b0e1b3b88fdb9de3a470d54247675c` against `d203ba7080547c8cf6511ecd2d434fd3a7cd9a64`. Stable patch ID is `04fab251b89a38fbccb6e2df44e69fd88913a600`. The patch changes four test files only. It preserves the original privacy, grant, uniqueness, and foreign-key assertions, bounds accepted index names to the reviewed original/H1 alternatives, and names fixture columns to retain hosted ordering defaults. Source and DDL remain unchanged. The [independent review](HOSTED_TEST_CONTRACTS_REVIEW.md) records the diff and evidence.

The four corrected cases ran serially against the same explicit test schema and bucket with no concurrent metadata transaction. Plans and comments passed initially. Reactions failed on a fresh connection, then passed its targeted serial retry. A diagnostic result retained the reactions attempt's underlying `psycopg.errors.ConnectionTimeout`, SQLSTATE `None`, after all three pooler addresses timed out. This newly observed cause does not recover or establish the causes of the original frozen failures.

The policy-reader contract failed on both attempts at `Future.result(timeout=10)`. Timing the second attempt showed its reader connection opening successfully in 15.235 seconds, exceeding the future watchdog before lock assertions could run. The primary fixture connection took 15.253 seconds. The reactions retry connected in 30.309 seconds and passed. The fixture must open its lazy reader/writer connections before the timed lock/overlap window while retaining the ten-second watchdog and 50 ms lock timeout for the intended policy contract.

The first corrected four-case run took 72.091 seconds with two passes and two errors. The targeted two-case retry took 68.929 seconds with reactions passing and the policy-reader test timing out. [Full correction traces and timing](HOSTED_TEST_CONTRACTS_FAILURES.txt) preserve these attempts. The runner kept the same original Python 3.14.7, Node 24.15.0, exact child environment, repository schema guard, and synthetic teardown. No application or test source was edited by the reviewer.

Current aggregate evidence covers **22 of the original 23 distinct test paths** across the original run, its serial transport reruns, and these correction runs. It is not a fresh green monolithic 23-test run. The policy-reader overlap and withdrawal fence remain unverified on the final schema. Hosted validation remains FAIL until that remaining boundary has passing independent evidence. Slow and intermittently failing pooler connection acquisition is a separate environment and latency limitation. Production migration and deployment remain pending.

## Warm-up resolution at d9bf0df

The latest test-patch verdict is **PASS+NOTES** at `d9bf0dff2801b72862b04f1feb48d1f493c3e919`. The full patch against `d203ba7080547c8cf6511ecd2d434fd3a7cd9a64` has stable ID `c2d135bbe61e02f374ba0befbf3600a77c245b4a`. Its three-line warm-up delta has stable ID `6e5612985d12854c1d4df988e7378d92764e2a35`. The reviewer confirmed that it opens both lazy connections before the timed policy window, retains all concurrency and privacy assertions, and changes no runtime code, timeout, migration, or DDL.

The policy-reader case passed independently in 35.125 seconds. One successful connection took 30.246 seconds during warm-up, outside the unchanged ten-second future watchdog. The original overlap, withdrawal-fence, rollback, and eventual-hidden-projection assertions all completed. The [standalone output](HOSTED_POLICY_WARMUP.log) and [runner](hosted_verification_runner.mjs) preserve the actual command path and diagnostic behavior.

A subsequent serial four-case run passed the corrected plans, comments, and reactions cases. The policy-reader fixture then failed in warm-up after a 45.006-second connection timeout across all three pooler addresses. The underlying cause was captured as `psycopg.errors.ConnectionTimeout`, SQLSTATE `None`. This was not a future watchdog or policy assertion failure. The run took 105.126 seconds with three passes and one transport error. [Complete output](HOSTED_CORRECTED_FOUR.log) preserves that failed attempt as well.

All four corrected paths have passing evidence at the latest head across these two runs. Combined with earlier execution against identical runtime code, **all 23 original test paths have passing evidence across runs**. This is neither a fresh green monolithic 23-test suite nor a fully green four-case batch. The test-boundary finding is resolved, while intermittent pooler availability and 15–45-second connection acquisition remain material reliability and latency limitations. No production access, migration, or deployment ran. Physical-phone and production milestone acceptance remain separate. The [latest independent review](HOSTED_TEST_CONTRACTS_REVIEW.md#warm-up-correction-at-d9bf0df) records the precise scope of the passing verdict.
