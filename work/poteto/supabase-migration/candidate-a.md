# Candidate A. Preserve domain methods behind Postgres and private storage

## Problem

Mazi users keep the D17 shared code, visible names, sessions, import reports, and contribution ownership. The API and worker move durable records and retained bytes to Supabase. [Database grounding](db-ground.md) found 44 application tables, 12 privacy-related triggers, and one connection factory. Existing methods rely on SQLite rows and global write serialization. The chosen boundary must preserve those contracts while local mode remains available.

## Usage

Normal startup chooses the backend once from validated server configuration. Credentials remain server-only. Setting hosted configuration starts a fresh hosted archive or reopens its existing records. It never transfers the local archive implicitly.

```python
store = MemoryStore(root)
profile, token = store.enter_shared(code=code, name="Alice")
store.complete_introduction(token)
run = store.begin_import(profile["user_id"], profile["group_id"],
    source, namespace, size, checksum, options)
```

The worker opens its own store against the same configured backend. Existing worker behavior does not receive connection strings or object URLs through job payloads.

```python
worker_store = MemoryStore(worker_scratch_root)
job = worker_store.claim()
if job:
    worker_store.complete(job)
```

Domain transaction usage remains compact. Advisory locking and driver adaptation live inside the connection boundary.

```python
with store.transaction():
    store._member(user, group)
    store.db.execute("UPDATE import_runs SET state=? WHERE id=?", (state, run))
```

A separate migration command accepts the source archive and hosted destination. It supports a plan that reports counts without changing either backend. Applying the command preserves source IDs, verifies remote objects, and records a resumable receipt. The command refuses a nonempty destination unless the receipt proves an interrupted copy of the same source.

## Shape

The data model distinguishes local configuration from hosted configuration. An incomplete hosted configuration fails startup. Local mode does not activate as an error fallback. This applies Model the Domain by replacing scattered backend flags with one validated configuration value.

```python
@dataclass(frozen=True)
class LocalArchive:
    root: Path

@dataclass(frozen=True)
class HostedArchive:
    database_url: Secret
    storage_url: str
    storage_key: Secret
    bucket: str
    schema: str
    scratch_root: Path

ArchiveConfig = LocalArchive | HostedArchive

def open_archive(config: ArchiveConfig) -> tuple[Connection, ArchiveObjects]:
    raise NotImplementedError

class Connection:
    def execute(self, sql: str, params: tuple = ()) -> Cursor: ...
    def __enter__(self) -> Connection: ...
    def __exit__(self, kind, error, trace) -> None: ...
    def begin(self) -> None: ...
    def commit(self) -> None: ...
    def rollback(self) -> None: ...
    def close(self) -> None: ...

class Cursor:
    rowcount: int
    def fetchone(self) -> Row | None: ...
    def fetchall(self) -> list[Row]: ...
    def __iter__(self) -> Iterator[Row]: ...

class Row:
    def __getitem__(self, key: str | int): ...
    def __iter__(self) -> Iterator[object]: ...
    def keys(self) -> Sequence[str]: ...

class ArchiveObjects:
    def read(self, area: str, key: str) -> bytes: ...
    def retain(self, area: str, key: str, data: bytes) -> None: ...
    def remove(self, area: str, key: str) -> None: ...
    def append(self, upload: str, offset: int, data: bytes) -> int: ...
    def reset(self, upload: str) -> None: ...
    @contextmanager
    def archive_file(self, upload: str) -> Iterator[Path]: ...
```

These are sketches, not implementations. `retain` writes immutable bytes and verifies an existing object's checksum before accepting replay. `read` returns bytes only to the server. `append` hides chunk representation and replay checks. `archive_file` supplies a private temporary path because ZIP parsing needs seekable input. The caller does not learn Supabase wire responses, signed URLs, or bucket layout.

The public methods preserve capability while hiding driver, transaction, object durability, and recovery rules. This applies Laziness Protocol by keeping existing domain behavior and avoiding a repository class for every table. The connection interface deliberately mirrors only the methods already used by the application. SQLite `executescript` stays in local schema initialization rather than becoming a hosted compatibility API.

### Modules

- `mazi/persistence.py` owns configuration parsing, connection selection, qmark binding, compatible rows, error translation, and transaction locking.
- `mazi/storage.py` owns local files or private Supabase objects, checksums, chunk replay, and temporary ZIP materialization.
- `supabase/migrations/<generated-name>.sql` owns the private Postgres application schema, grants, indexes, identities, and trigger functions.
- `mazi/archive/migrate.py` owns an explicit SQLite-to-hosted transfer and its durable receipt.
- `mazi/archive/ops.py` retains the existing offline local backup format and routes hosted backup to a complete database-and-object snapshot operation.
- Existing domain modules retain authorization, quotas, lease fencing, visibility, search consent, and D17 identity behavior.

### Database adaptation

Use one pinned psycopg driver connection per Store. Hosted startup verifies the application schema version. It does not execute unreviewed DDL under the runtime role.

Convert qmark parameters into bound driver parameters with quote-aware tokenization. Preserve values and handle literal SQL percent characters correctly. Return rows with both mapping and tuple behavior. Normalize `bytea` results to bytes. Translate expected integrity failures without exposing SQL or credentials to clients.

Edit caller SQL into a portable subset. Replace twelve `INSERT OR` calls with explicit conflict targets. Bind UTC timestamp strings instead of three `datetime('now')` calls. Quote the `user` column consistently. Qualify conflict-counter references. Use explicit columns for inserts whose tables gain insertion-order metadata.

The five tables currently ordered by `rowid` gain a durable integer insertion order. Local SQLite upgrades populate that order from existing `rowid` before new records use it. Hosted transfer copies those values. API dictionaries omit the internal order column. Replacing a source-outcome row explicitly defines whether its current listing position changes.

The Postgres migration creates all 44 application tables. `BLOB` becomes `bytea`; `REAL` becomes `double precision`; integer counters and byte sizes use suitable integer widths. JSON remains text for this increment. Audit identity and insertion-order sequences advance past imported values. Postgres trigger functions preserve all 12 existing side effects, including cascaded member-departure cleanup and consent-generation increments.

The application schema is private and absent from the exposed Data API schemas. Revoke `PUBLIC`, `anon`, and `authenticated` schema and table access. The server connects as a dedicated runtime role with only application DML, sequence use, and required function access. It has no schema ownership, role creation, or broad Supabase administration rights. Private-schema RLS policies grant that role only the application access it needs. Mazi's shared-code users remain domain profiles. Supabase Auth stays closed to public signup because D17 does not require email accounts or a new browser login.

### Transaction ownership

All hosted mutating transactions acquire the same stable transaction-scoped advisory lock. This preserves the current archive-wide `BEGIN IMMEDIATE` serialization. Normal reads use short driver transactions or autocommit so they do not leave a connection idle in a transaction.

Connection contexts never close the connection. Explicit begin and inherited identity contexts share commit ownership. A checksum-recovery branch that commits and then raises retains its committed reset. On an uncommitted exception, rollback releases the advisory lock. Tests must prove these cases before production callers use the boundary.

This first increment deliberately accepts one serialized writer for one small friend group. Future finer locks need measured contention and separate concurrency contracts. Direct dashboard SQL does not share the application lock, so operational writes that affect live leases or permissions must stop the app or use the same lock.

### Storage durability

Use a private bucket for originals, previews, supplied ZIPs, source resources, and resumable upload bytes. Browsers continue receiving authorized bytes through the Python API. Do not return public or long-lived signed object URLs.

The authoritative upload checkpoint must survive deletion of local scratch files. Immutable remote chunk objects plus transactional chunk metadata provide this guarantee without rewriting the whole accumulated archive for every 512 KiB chunk. This adds one infrastructure table, such as `archive_upload_chunks`, to the 44 existing application tables. Its key includes upload ID and offset; its row records the object key, length, and digest. The received counter and chunk receipt commit together after the immutable remote object is verified. A crash before commit leaves an unreferenced object that a bounded cleanup can collect.

`append` checks current domain ownership and the authoritative received offset inside the application transaction. A repeated offset accepts identical bytes and rejects different bytes. `archive_file` reconstructs the verified ordered chunks into a private temporary file. Finishing a supplied transfer retains its verified immutable ZIP or source object before the database advances to scanning or processing. API and worker scratch directories may differ.

The local storage implementation uses the current private directory layout. Explicit object keys keep `.mazi-imports` data compatible. Sealed capsule photos remain `bytea` in their private Postgres table for the first increment; they are not gallery objects.

## Synthesis decision

Pending the parent agent's comparison with candidate B. This candidate is not an approved or implemented synthesis.

## Tradeoffs accepted

- We accept a small compatibility boundary in exchange for preserving the tested domain and HTTP methods.
- We accept serialized hosted writes in exchange for preserving existing lease, quota, and consent invariants in the first increment.
- We accept one upload-receipt table in exchange for durable resumable uploads across independent API and worker scratch directories.
- We accept server-mediated private object reads in exchange for immediate enforcement of withdrawal and departure rules.
- We accept JSON stored as text in exchange for avoiding simultaneous domain and database representation changes.

## Alternatives considered

A rewrite around Supabase REST table calls hides the database driver, but exposes transaction coordination to every domain method. Claim, fence, quota, and departure operations would need new RPCs with duplicated domain logic. The small client interface does not hide those larger application obligations.

An ORM rewrite adds model and query interfaces for all 44 tables. It hides row conversion but forces broad changes to the existing SQL, trigger ownership, and domain call sites. That scope is larger than the requested provider migration.

Keeping uploads authoritative on one local disk hides remote chunk management. It also makes server replacement lose upload checkpoints and prevents an independent worker from processing an accepted transfer. It does not satisfy hosted restart acceptance.

## Open questions and risks

Can the available hosted connection route support the chosen driver, SSL verification, and transaction-scoped advisory locks under the actual pooler mode? Verify with the restricted runtime role before integration.

Do global transactions remain short enough when remote chunk verification occurs inside the lock? Measure the synthetic journey and record the cost. Move expensive image processing outside the lock as the current worker already does.

Can hosted backup and restore prove a matching database snapshot and private object set? Database backup alone does not satisfy the existing archive recovery contract.

Does the local SQLite upgrade preserve source-outcome replacement order and every exported API shape? Treat any intentional ordering change as a documented contract change.

## Next implementation step

Expose driver-neutral row and transaction contracts with synthetic tests, then build the restricted Postgres schema and connection boundary against those contracts.

## Acceptance evidence required

Run the existing SQLite backend suite and focused Postgres contracts. Prove real simultaneous shared-name entry, worker claim, quota admission, cancellation, stale completion, and consent withdrawal. Exercise D17 login, introduction persistence, ZIP transfer, worker import, Atlas read, withdrawal, and denied bytes through the running API with the actual hosted project. Delete scratch files and reopen API and worker to prove durable recovery. Perform an explicit synthetic archive migration and verify IDs, table counts, original-byte checksums, trigger side effects, ordering, and a hosted restore. Record private-schema grants and anonymous REST denial. Do not transfer an existing personal archive during these tests.
