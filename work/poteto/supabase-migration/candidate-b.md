# Candidate B. Explicit PostgreSQL domain operations

## Problem

The current application has a working Python authorization model, D17 shared-code entry, and many domain contracts. Its domain methods embed SQLite SQL, and its file methods assume one persistent filesystem. Migrate those operations directly to native PostgreSQL and private Supabase Storage. Keep the HTTP endpoints, profile UUIDs, ownership, introduction state, and React UI. The grounding is [Storage and shared-entry grounding](storage-ground.md). This candidate deliberately replaces SQLite-specific operations in their owning domain modules instead of translating SQL at runtime.

## Usage

Operators configure a private backend database connection, project URL, private bucket, and server-only Storage key. They start the existing app command. A missing credential fails startup clearly. Runtime startup never creates a local SQLite fallback.

The request server and worker use the same validated configuration but separate connections. Their callers continue to ask for domain operations.

```python
config = BackendConfig.from_environment()
with open_archive(config, scratch_dir) as store:
    profile, token = store.enter_shared(code=body['code'], name=body['name'])
    data = store.asset_bytes(profile['user_id'], asset_id, original=True)
```

```python
with open_archive(config, worker_scratch_dir) as store:
    while not stop.is_set():
        if not store.work_once():
            stop.wait(0.2)
```

```python
with open_archive(config, scratch_dir) as store:
    received = store.write_chunk(user_id, run_id, offset, decoded_bytes)
    store.finish_transfer(user_id, run_id)
```

These are design snippets, not code ready to execute. The usage keeps `enter_shared`, `asset_bytes`, `work_once`, `write_chunk`, and `finish_transfer` as complete domain operations. Callers never orchestrate Storage writes with SQL commits.

## Shape

The load-bearing data structures are explicit domain records.

```python
@dataclass(frozen=True)
class BackendConfig:
    database_url: str
    project_url: str
    storage_key: str
    bucket: str

@dataclass(frozen=True)
class StoredObject:
    key: str
    sha256: str
    size: int

@dataclass(frozen=True)
class TransferReceipt:
    transfer_id: str
    generation: int
    offset: int
    length: int
    object: StoredObject

@dataclass(frozen=True)
class WorkerLease:
    item_id: str
    token: str
    expires_at: float
```

The bucket hides one durable byte protocol.

```python
class PrivateObjects:
    def put_verified(self, key: str, data: bytes) -> StoredObject:
        raise NotImplementedError

    def read(self, object: StoredObject) -> bytes:
        raise NotImplementedError

    def remove(self, key: str) -> None:
        raise NotImplementedError

    def export(self, objects: list[StoredObject], destination: Path) -> None:
        raise NotImplementedError
```

`put_verified` means create-if-absent, compare digest on conflict, and never replace different bytes. `read` validates returned length and checksum where a stored descriptor is available. Neither method authorizes a person. Domain methods decide authorization before requesting bytes. This follows the read `principle-boundary-discipline` skill. External HTTP errors and JSON are parsed behind this interface rather than exposed to API handlers.

Transfer acceptance lives with `ImportStore`, `SourceStore`, and `Store` because those classes own transfer authorization and state. The implementation uses one shared transfer component with a small typed interface, rather than copying three remote file facades.

```python
class Transfers:
    def accept(self, transfer: TransferState, offset: int, data: bytes) -> int:
        raise NotImplementedError

    def materialize(self, transfer: TransferState, destination: Path) -> None:
        raise NotImplementedError

    def reset(self, transfer: TransferState) -> None:
        raise NotImplementedError
```

`TransferState` is resolved and locked by the owning domain method. `accept` stores the immutable remote chunk, records the receipt, and updates `received` within that domain transaction. It compares repeated accepted ranges using the receipts. `materialize` reconstructs only committed receipts, verifies size and digest, and writes a restricted temporary file. `reset` advances generation and clears accepted receipts. The old remote chunks become collectible. The interface hides transport and byte assembly, while the domain keeps ownership and legal transitions. This follows the read `principle-model-the-domain` skill.

Use native psycopg transactions and parameter syntax in the existing domain modules. Define the PostgreSQL schema once in a migration. Constructors open the private schema and validate its version. They do not execute a runtime-generated translation of SQLite DDL. Replace `INSERT OR IGNORE`, `INSERT OR REPLACE`, `rowid`, SQLite triggers, `BLOB`, `PRAGMA`, and `BEGIN IMMEDIATE` deliberately at their call sites. Every ordered table gets an explicit identity or timestamp-plus-ID ordering matching existing behavior. Every trigger gets a reviewed PostgreSQL counterpart or explicit domain operation. Convert positional row consumption to named typed results at those locations.

A restricted database role owns only the application grants needed for this app. The private schema is excluded from the Data API. Deny `anon` and `authenticated` application grants, enable RLS for defense in depth, and keep the Storage bucket private without browser policies. The server-only Storage key is the privileged byte credential. The frontend keeps the existing same-origin opaque cookie. Supabase Auth public signup and anonymous signin remain disabled. Record that this task migrates persistence, while the D17 identity provider stays the backend application session table.

Entry locks the singleton shared policy row, verifies the code, resolves the unique normalized name, and creates profile, membership, and session atomically. That is a real cross-process lock, replacing the local `RLock` and SQLite write lock. Removed members cannot resume an old profile and every request rechecks membership.

Claiming jobs uses a transaction and PostgreSQL row locking. Completion checks the lease before processing and again before attaching variants. Transfer writes lock their transfer row. Group quota changes lock the group row. Immutable variant and chunk keys avoid multiple writers replacing one byte object. These choices follow the read `principle-separate-before-serializing-shared-state` skill.

The smallest complete byte path is `domain authorization -> private bucket read -> existing byte response`. ZIP parsing materializes temporary input from remote committed receipts. Preview and original writes finish before database availability is committed. Capsule photos remain PostgreSQL `bytea`, keeping unlock rules intact. Manual tombstones immediately deny reads, and a database cleanup queue retries Storage deletes. Archive withdrawal preserves referenced bytes and denies access when the final active origin disappears. This follows the read `principle-make-operations-idempotent` skill.

The module map is compact.

| Module | Responsibility |
| --- | --- |
| `mazi/backend.py` | Validate configuration, open native PostgreSQL connections, and compose the existing store with private bytes. |
| `mazi/storage.py` | Private object HTTP protocol and immutable chunks, including retry comparison and temporary reconstruction. |
| Existing domain modules | Explicit PostgreSQL queries, authorization, legal transitions, leases, and visibility. |
| `supabase/migrations/<CLI-generated migration>` | Private app schema, identities, constraints, indexes, triggers, role grants, and RLS. |
| `mazi/archive/migrate.py` | Offline SQLite source importer and verified six-prefix object copy. |
| `mazi/archive/ops.py` | Offline hosted snapshot and object export/restore. |

The public store interface is already large because the product exposes many domain behaviors. This candidate adds no repository per table, generic SQL RPC, or pass-through domain service. Complexity stays in the module that can complete each operation. Byte consumers gain one complete remote read seam. That is greater interface depth than asking every feature to coordinate a cloud client, a cache, and database records.

## Synthesis decision

Pending independent cross-judgment. Candidate B is structurally distinct from a generic SQL compatibility adapter because the PostgreSQL query and transaction semantics are visible in the owning domain operation, with no runtime SQL rewrite.

## Tradeoffs accepted

- We accept more edits to existing SQL in exchange for auditable PostgreSQL behavior and removal of the SQLite dialect at runtime.
- We accept preserving Python sessions instead of activating Supabase Auth in exchange for honoring D17 and all existing profile ownership IDs.
- We accept private backend mediation instead of browser Storage access in exchange for immediate membership and withdrawal checks.
- We accept temporary local ZIP materialization in exchange for reusing the tested ZIP parser without treating local bytes as durable state.
- We accept a receipt table and cleanup queue in exchange for durable uploads, safe crashes, and physical deletion retries.
- We accept requiring local Supabase or a dedicated hosted integration target for domain tests in exchange for testing the database actually used by the app. SQLite remains only an offline migration source.

## Alternatives considered

A generic SQL connection shim hides placeholders and common statements but exposes SQLite semantics throughout the domain code. It needs special handling for schema scripts, replacement inserts, row ordering, errors, nested transactions, and triggers. Its interface is superficially small, but callers still need to know which SQLite behavior is actually implemented. This candidate makes each replacement explicit and rejects the shim for long-term maintainability.

A complete rewrite to browser Supabase clients and Supabase Auth would move authorization into RLS and change shared-name resume, cookies, worker privileges, and endpoint contracts. It can be a deep provider-native design, but it solves a broader product migration than the owner requested and abandons proven D17 behavior. It loses on scope and immediate completeness.

A filesystem mirror with periodic Supabase upload hides very little. Domain operations still require one machine's files and have unclear recovery after a remote copy fails. It cannot satisfy the remote source-of-truth contract.

## Open questions and risks

Can the implementation port every query and trigger before cutover, given 319 matching database or SQLite references and 183 method declarations in the traced domain set? Those counts are an investigation sizing signal, not a complexity score. A partial port must not enable the hosted runtime.

Can a clean-machine API and separate worker complete a partial upload and render all existing features from hosted data? This is the mandatory validation gate, not a user approval checkpoint.

Can an offline restore reconstruct a working archive from the database snapshot and exported Storage bytes? Supabase database backups do not include object payloads, so a passing database-only restore is insufficient. [Database backups](https://supabase.com/docs/guides/platform/backups).

Are the configured Free-tier limits compatible with the existing local quota messages? Before declaring completion, reconcile provider limits and documented guarantees without enabling paid provisioning.

## Next implementation step

Build one PostgreSQL-backed D17 entry/session contract and one end-to-end ZIP transfer with immutable remote chunks, then run it with separate clean request and worker directories before porting the remaining domain SQL.

The acceptance matrix is in [Storage and shared-entry grounding](storage-ground.md#validation-contract). The local baseline passed 24 shared-entry and import-engine tests. Hosted verification remains outstanding. This reflects the read `principle-prove-it-works` skill.
