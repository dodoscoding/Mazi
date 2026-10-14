# Database migration grounding

This is a read-only source investigation on 14 October 2026. No application code, database, or personal archive changed. The proposed adapter below is a design, not verified implementation.

## Current ownership

`mazi/identity/core.py:127` owns the only application connection factory. `Store.__init__` opens `mazi.sqlite3` with `check_same_thread=False`, selects `sqlite3.Row`, creates directories, and runs the identity schema at lines 143-146. Every application domain inherits that connection. The chain is `Store`, `ImportStore`, `ReviewStore`, `SourceStore`, `DiscoveryStore`, `AnswerStore`, then `MemoryStore`.

`mazi/server.py:60-63` opens one `MemoryStore` for the single-threaded `HTTPServer`. `mazi/sources/server.py:107-109` opens a separate `MemoryStore` for the background worker. `mazi/imports/server.py:99-100` opens an `ImportStore` in the older worker. Different worker processes therefore use separate database connections. Shared entry also has a per-store `RLock`, but `tests/backend/identity/test_shared_entry.py:41` exercises competing independent stores. Database locking protects that case.

`mazi/archive/ops.py:42` opens two additional SQLite connections to create a database snapshot. Line 74 opens a read-only connection to verify a backup. These are operational paths, not application connection factories.

## Counted schema and call inventory

AST inspection of `mazi/**/*.py` found eight `SCHEMA` constants, 44 tables, and 12 triggers. These counts include the old manual-upload experiment because its methods remain callable and its records belong to the compatible archive format.

| Schema owner | Tables | Triggers | Evidence |
| --- | ---: | ---: | --- |
| Identity | 15 | 0 | `mazi/identity/core.py:31` |
| Imports | 4 | 0 | `mazi/imports/engine.py:30` |
| Archive review | 4 | 0 | `mazi/archive/review.py:20` |
| Sources | 5 | 0 | `mazi/sources/sources.py:19` |
| Discovery | 9 | 7 | `mazi/discovery/discovery.py:18` |
| Answers | 2 | 3 | `mazi/answers/answers.py:16` |
| Memories | 2 | 1 | `mazi/memories/memories.py:9` |
| Advanced memories | 3 | 1 | `mazi/memories/advanced.py:13` |

AST inspection counted 304 calls to an object's `.db.execute`, eight `.db.executescript`, four `.db.commit`, two `.db.rollback`, and one `.db.close` under `mazi/`. The backend tests contain 51 `.db.execute` calls and ten `.db.commit` calls. There are 136 declared `test_*` methods under `tests/backend`; inheritance means this is not the unittest execution count.

Of the runtime execute calls, 284 have a complete literal SQL string with qmark placeholders. Dynamically concatenated queries also contain placeholders. Preserve parameter binding rather than substituting values into SQL. Row consumers require all of `row['column']`, `row[0]`, row iteration over values, `dict(row)`, `tuple(row)`, cursor iteration, `fetchone`, `fetchall`, and `rowcount`. `mazi/imports/engine.py:523` iterates row values to collect object keys. A plain dict row factory would break that operation and integer indexing.

Reproduce the counts with Python AST traversal of `ast.Call` nodes whose `func` is an attribute and whose receiver is an attribute named `db`. Count schema strings by `ast.Assign` to `SCHEMA`, then match `CREATE TABLE IF NOT EXISTS` and `CREATE TRIGGER IF NOT EXISTS`. The source searches used `rg -n 'sqlite3|PRAGMA|rowid|lastrowid|INSERT OR|datetime\(' mazi tests/backend`.

## SQLite dependencies to replace

- Three pragmas configure foreign keys, WAL, and a five-second busy timeout. Evidence is `mazi/identity/core.py:32` and `mazi/imports/engine.py:73-74`.
- Four `BEGIN IMMEDIATE` calls start explicit write transactions. Evidence is `mazi/identity/core.py:174`, `:218`, and `mazi/imports/engine.py:83`, `:444`.
- Six `INSERT OR IGNORE` statements cover membership, asset deduplication, hidden assets, tags, suppressions, and hidden events. Six `INSERT OR REPLACE` statements cover shared policy, source outcomes, discovery tags, suppressions, and vectors. The source searches enumerate each call. Replace them with explicit conflict targets and `DO NOTHING` or `DO UPDATE`.
- Six runtime query expressions order by SQLite `rowid`. They target five tables, `archive_assets`, `archive_origins`, `continuous_sources`, `source_resources`, and `source_outcomes`. Evidence is `mazi/imports/engine.py:498`, `:514`, `mazi/archive/review.py:133`, and `mazi/sources/sources.py:111`, `:305`, `:307`. One backend fixture also orders `archive_origins` by `rowid` at `tests/backend/archive/test_review.py:109`.
- Three review upserts use `datetime('now')` as text. Evidence is `mazi/archive/review.py:108`, `:307`, `:361`. Bind a UTC timestamp string from Python to preserve the current text shape.
- `audit.id` uses `INTEGER PRIMARY KEY AUTOINCREMENT` at `mazi/identity/core.py:100`. Postgres needs an identity column and the migration must reset its sequence after copying IDs.
- Six binary columns use `BLOB`, including password material, token digests, and sealed capsule photos. Postgres needs `bytea` with returned values normalized to bytes. Evidence is `mazi/identity/core.py:34-59` and `mazi/memories/advanced.py:16`.
- `REAL` stores Unix timestamps and elapsed seconds. Use Postgres `double precision`, not Postgres `real`, so epoch values retain useful precision. Evidence is `mazi/imports/engine.py:38-46`, `mazi/memories/advanced.py:16`, and the measurements tables.
- A column named `user` occurs in discovery hiding, answer usage, and memory notifications. Quote or rename it consistently for Postgres. Evidence is `mazi/discovery/discovery.py:32-35`, `mazi/answers/answers.py:21`, and `mazi/memories/advanced.py:18`.
- Existing conflict-counter updates use unqualified `revision`, `requests`, `embeddings`, and `seconds`. Qualify target-table references in Postgres conflict clauses. Evidence is `mazi/discovery/discovery.py:52-61`, `:357`, `mazi/answers/answers.py:28-31`, and `:130`.
- SQLite trigger bodies use `BEGIN ... END` without a trigger function. Translate all 12 into Postgres trigger functions and explicit triggers. Their side effects remove departed contributors' content, purge search derivatives, and increment consent generations. Omitting them changes privacy behavior even if gallery reads pass.
- `sqlite3.IntegrityError` maps duplicate registration to `Conflict` at `mazi/identity/core.py:267`. Preserve domain exception behavior with a driver-neutral integrity exception or a targeted Postgres uniqueness translation.
- `sqlite3.Row` and SQLite context managers are behavioral dependencies. A psycopg connection's context manager cannot replace this interface without checking close and nesting behavior. The outer Store must retain one open connection across many `with self.db` blocks.
- There are zero `lastrowid` references and zero SQL `json_extract`, `json_each`, `json_object`, or `json_array` calls under `mazi/`. JSON payloads and vectors currently remain text decoded by Python.

## Transactions and concurrency

There are 65 `with self.transaction()` blocks and 22 identity connection-context blocks. `ImportStore.transaction` at lines 81-89 owns explicit begin, commit, and rollback. The global SQLite write lock protects claim-then-update, quota-then-insert, deduplication, membership withdrawal, and consent snapshots.

`claim` at `mazi/imports/engine.py:220-235` selects the oldest eligible item and then updates its lease. Plain Postgres `BEGIN` permits concurrent claimers to select the same row. `_fence` at line 237 checks the lease and membership. `complete` at line 325 repeats that check inside the availability transaction, then checks quotas and inserts the asset and origin.

`remove_member` at `mazi/imports/engine.py:440-453` deliberately starts a transaction before calling the inherited identity method. The inherited `with self.db` commits the complete departure operation. An adapter must handle this shared commit ownership. Adding nested savepoints without understanding the existing flow can change when the operation commits.

The checksum-recovery paths deliberately commit a reset before raising `Conflict`. Evidence is `mazi/imports/engine.py:159-163` and `mazi/sources/sources.py:229-231`. A context wrapper that blindly rolls back an exception must not undo that already committed reset.

Discovery inference releases the transaction while it computes vectors, then checks consent generation and the document fingerprint before saving. Evidence is `mazi/discovery/discovery.py:378-410`. Answers use separate transactions at dispatch and delivery checkpoints, `mazi/answers/answers.py:125-173`. Preserve those checks and the trigger increments.

For the first hosted increment, use one stable transaction-scoped Postgres advisory lock for this archive. Acquire it in both explicit transactions and identity connection contexts before reads that decide a write. All participating API and worker connections must use the same key. This preserves the current serialization contract while retaining existing domain methods. Measure latency before designing finer locks. Set a bounded lock timeout and surface unavailable storage safely.

## Smallest complete adapter design

Add one backend-selected connection boundary at `Store.__init__`. Local mode retains SQLite. Hosted mode opens a pinned psycopg driver connection to a private application schema with a restricted runtime role. Keep the existing domain methods and HTTP handlers.

The boundary owns qmark binding conversion, cursor and row compatibility, connection-context lifecycle, explicit transaction ownership, integrity error translation, and advisory locking. It does not parse or emulate arbitrary SQLite SQL. Make caller SQL portable with explicit upserts, bound timestamp strings, quoted reserved identifiers, qualified counters, and explicit insertion ordering.

Use a versioned Postgres migration for all 44 tables and 12 triggers. Hosted startup verifies its version instead of executing the eight SQLite schema strings as DDL. The existing M0 migration creates a different two-table experiment in `public`; it is not the application schema. Evidence is `supabase/migrations/20261005111409_m0_access_experiment.sql`.

Replace `rowid` with a durable insertion-order column on the five affected tables. Preserve old ordering during data transfer, including both assets and origins. Explicit caller column lists avoid coupling inserts to that added column. Avoid leaking internal ordering fields through the current `dict(row)` API results. Account for `source_outcomes` replacement ordering if preserving its current listing order is required.

## Unavoidable boundaries and validation

`mazi/archive/ops.py` is explicitly a local SQLite backup drill. Preserve it for local mode. Hosted backup and restore need a Postgres snapshot plus the matching private storage objects; copying `mazi.sqlite3` cannot prove hosted recovery.

The transfer command must be explicit and separate from normal startup. Read the old archive without mutation, preserve all record IDs and bytes, copy tables in foreign-key order, reset audit and ordering sequences, and verify row counts plus checksums. Existing personal archives must not upload merely because hosted environment variables are present.

Keep the existing backend suite on SQLite and run selected identical domain contracts against an isolated Postgres schema. SQLite-only fixtures need separate versions for their synthetic triggers and old-schema construction.

Required contracts already have concrete local counterparts:

- Concurrent same-name D17 entry and rollback of a failed session insert, `tests/backend/identity/test_shared_entry.py:41` and `:117`.
- Worker claims, expired leases, cancellation, late completion, and replay, `tests/backend/imports/test_engine.py:91`, `:108`, `:178`, and `:195`.
- Object-write crash recovery after reopening, `tests/backend/imports/test_engine.py:121`.
- Independent contributions after withdrawal and departure, `tests/backend/imports/test_engine.py:136` and `tests/backend/archive/test_review.py:183`.
- Consent withdrawal during learned inference, `tests/backend/discovery/test_learned.py:92`.
- Member-departure triggers called through older Store classes, `tests/backend/discovery/test_discovery.py:267`.
- Backup restore with suppression and opaque resources, `tests/backend/discovery/test_discovery.py:165` and `tests/backend/sources/test_sources.py:122`.
- Reopened HTTP identity and cross-origin denial, `tests/backend/test_server.py:74`.

Add true simultaneous Postgres claims and parallel quota admissions. The existing two-worker test runs claims sequentially, so it cannot alone prove Postgres concurrency correctness. Hosted acceptance must exercise the real API and separate worker with synthetic login, import, read, withdrawal, restart, and denied-access journeys.
