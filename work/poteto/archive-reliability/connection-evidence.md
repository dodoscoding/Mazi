# Connection lifecycle evidence

Unit 1 fixes hosted SQL lifetime while preserving cached stores, worker inventory, SQLite, and existing domain transactions. Atlas and UI changes are outside this unit.

## Revisions and environment

The worktree is `/Users/altanesmer/.codex/worktrees/import-performance-release/Mazi` on `codex/archive-reliability`. The verified `origin` is `https://github.com/dodoscoding/Mazi.git`. Local verification uses the repository `.venv` on macOS. Fixtures and mocks are synthetic. This worker made no live database or configuration changes.

## Failing contract

Test commit `3389aa2` adds constructor, disconnect/reopen, request-finally and handler-eviction contracts. Before implementation, this command failed with four assertions and one missing-method error across four tests:

```sh
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m unittest tests.backend.test_persistence.LazyConnectionContracts tests.backend.test_vercel_bridge.ConnectionLeaseTests
```

The constructor opened a session, `disconnect` was absent, successful and failed requests omitted SQL cleanup, and handler eviction omitted store cleanup.

## Implementation

`PostgresConnection` opens lazily with `prepare_threshold=None`. Each transaction starts with one simple-query exchange containing BEGIN and transaction-local schema, lock timeout and float settings. Standalone statements commit. Explicit transactions retain the existing advisory writer lock and explicit commit-before-Conflict behavior. Native client cursors retain their existing buffering behavior.

The WSGI request and bounded worker drain disconnect under their respective locks in finally blocks. The handler exposes its owned store for eviction. A returning older drain cannot evict a replacement handler. Worker scan and archive resources remain cached across successful drains. SQL failures map to sanitized `ArchiveUnavailable` responses with HTTP 503. Schema mismatch remains a separate exception. No operation retries writes automatically.

The hosted restore-order and table-inventory helpers now use adapter execution so standalone calls initialize their transaction-local schema. Raw snapshot reads and writes remain within their existing explicit backup, restore and migration transactions.

## Passing checks

```sh
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m unittest tests.backend.test_persistence tests.backend.test_vercel_bridge tests.backend.test_hosted_recovery
```

Result: 46 tests passed before adding the cleanup-failure regression. These cover standalone commits, per-transaction settings, reconnect, schema mismatch, settings-failure cleanup, unfinished transaction disconnect, explicit commit-before-Conflict, original worker inventory reuse, request success/error/abandonment, drain cleanup lock ownership, safe eviction, and sanitized availability responses without session-cookie changes.

The expanded check passed 107 tests with seven hosted cases skipped because this worker did not enable hosted mutation tests:

```sh
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m unittest tests.backend.test_persistence tests.backend.test_vercel_bridge tests.backend.test_hosted_recovery tests.backend.test_postgres tests.backend.imports.test_engine tests.backend.imports.test_http tests.backend.identity.test_core
git diff --check
```

An earlier adjacent-test command referenced nonexistent `tests.backend.imports.test_scan` and failed on that import. The corrected expanded command above includes the existing engine and HTTP suites. Two SQLite resource warnings prompted test teardown to close the newly owned handler store explicitly.

Parent-reported hosted evidence: all nine enabled existing Postgres tests passed in 15.5 seconds against an isolated transaction-pool schema. Twenty concurrent stores could read groups repeatedly. Concurrent empty Atlas calls hit the existing exclusive lock timeout, which remains a separate projection-performance unit.

## Remaining acceptance

The parent owns isolated hosted transaction-pool tests, existing-archive inspection, real authenticated browser timings, deployment configuration and shipping. Local mocks do not prove transaction-pool compatibility or production availability. No linter is configured.
