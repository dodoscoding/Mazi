# Candidate B: durable inventory and bulk persistence

## Problem

The import worker re-materializes, hashes, opens and parses the whole ZIP for every 500 inventory records (`work_once` → `scan` → `HostedObjects.materialize` → `Archive` → `inventory`). It inserts each record through a synchronous PostgreSQL execute. A 7,500-record archive therefore causes about 15 full archive downloads/parses and 7,500 SQL request round trips, plus one extra pass to observe exhaustion when the record count exactly fills the batch. PostgreSQL transactions hold a schema-wide advisory lock; hosted object writes perform PUT and verification GET while that lock is held. These costs can dominate JPEG processing. Existing immutable receipt storage, consent before processing, lease fencing, quotas and withdrawn-origin behavior are constraints, not optimization targets to bypass.

## Usage (caller's view)

The API stays stable. A caller uploads chunks, calls `finish_transfer`, polls `report`, and explicitly calls `confirm` after inventory. The worker retains the existing `work_once()` interface. Internally:

```python
# Worker scanning; restart skips all previously committed inventory pages.
page = inventory_reader.next_page(run, checkpoint, limit=500)
store.persist_inventory_page(run, checkpoint, page)

# Startup recovery or another worker; no ZIP parse if the durable inventory exists.
page = inventory_reader.next_page(run, checkpoint, limit=500)

# PostgreSQL and SQLite share a bounded bulk-insert seam.
insert_rows(db, 'import_items', ITEM_COLUMNS, rows, max_parameters=900)
```

## Shape

Keep `import_runs`/`import_items` as the sole authoritative progress/outcome state. Introduce a rebuildable, versioned, immutable inventory sidecar under the existing private `archives` storage area, using a validated key such as `<run>.inventory-v1`. Its records contain ordinal plus the exact normalized item payload, including occurrence, initial availability and reason. Header contains format version, archive SHA-256, source, namespace, options fingerprint and adapter version. No user-facing wire type changes. The sidecar is published only after complete adapter traversal succeeds; a failed traversal cannot create a valid partial index. Read pages sequentially from a locally materialized sidecar, retained for that worker's scan session. A restarted worker materializes the much smaller sidecar instead of the ZIP.

```python
@dataclass(frozen=True)
class InventoryPage:
    rows: tuple[InventoryRecord, ...]
    next_ordinal: int
    exhausted: bool

class InventoryReader:
    def next_page(self, run, checkpoint: int, limit: int) -> InventoryPage:
        # Validate run identity against sidecar header; build if absent.
        raise NotImplementedError

def insert_rows(db, table, columns, rows, *, max_parameters=900):
    # Only internal trusted identifiers. Bound every row value.
    # Chunk rows into multi-VALUES statements; caller owns transaction.
    raise NotImplementedError

def persist_inventory_page(self, run, expected_checkpoint, page):
    # One transaction rechecks membership, state and checkpoint.
    # Bulk insert, update checkpoint/state, commit together.
    raise NotImplementedError
```

Module map: `imports/adapters.py` still owns normalization; `imports/engine.py` owns authorized state changes and reading inventory pages; `persistence.py` owns portable bounded multi-value insertion. The inventory sidecar is an optimization artifact, never authority for availability or authorization. Unique `(run_id,ordinal)` plus transactional checkpoint fencing prevent competing workers from publishing duplicate inventory pages. Local `.mazi-imports` files keep their existing names and tables; sidecars are additive and deletable/rebuildable. Hosted object generations and verification continue unchanged.

Dominant reads: inventory page uses sequential sidecar traversal with one session-held file; restart replays sidecar to checkpoint (cheap JSON, no metadata adapter or full archive download). Processing reads existing persisted item payloads and reuses the existing archive session. Reports continue grouped SQL aggregates with existing `(run_id,outcome)` index; add a summary-only response mode so frequent polling does not deserialize 100 payloads when no item list is shown. Bulk insertion removes per-message database RTTs without changing initial outcomes or payloads.

## Evidence and expected gains

- `engine.py:scan` has one `db.execute(INSERT...)` per inventory record. Multi-value inserts bounded below SQLite's conservative 999-parameter limit turn 7,500 requests into about 59 at 128 records/statement (7 values each). At an illustrative 20 ms SQL RTT the avoided latency is roughly 149 seconds; this is an estimate, not a measured result.
- `HostedObjects.materialize` issues one verified GET per receipt, sequentially. Every current scan batch repeats these downloads; the durable sidecar removes repeated raw ZIP downloads even across worker restart. Same-process session caching alone removes repeated downloads during uninterrupted scanning but not after restarts.
- `prepare` hashes after preview generation and writes original and preview before `complete` checks existing origins/assets. A group-scoped checksum lookup before encoding/writing can eliminate repeated JPEG work and remote writes for duplicate photos. Preserve validation and occurrence fingerprint checks; never reuse across groups. This gain is independent of the durable inventory design.
- Upload chunks are limited to 512 KiB and each new hosted chunk performs PUT plus verification GET, then a receipt INSERT while holding the advisory lock. Do not claim bulk inventory alone speeds transfer. Increasing chunk size requires coordinated request limits/client changes; transport concurrency requires a separate storage concurrency contract.
- Each photo completion performs two fences plus membership checks, origin/asset/quota queries, writes and reconciliation. Combine independent quota/existence reads into one bounded SQL statement before considering more workers: more workers currently serialize on the same archive advisory lock.

## Synthesis decision

Pending parent comparison. Candidate B favors restart-durable normalized inventory and SQL batching over worker-local raw archive/iterator cache.

## Tradeoffs accepted

- We accept a private sidecar, its receipts and cleanup obligations in exchange for avoiding whole-ZIP reparsing after restarts.
- We accept an initial full inventory traversal before publishing pages in exchange for a valid immutable durable index; this delays first progress and needs an explicit scanning indicator.
- We accept conservative bulk parameter limits in exchange for one portable implementation on SQLite and PostgreSQL.
- We accept existing writer serialization for now in exchange for preserving quota and cancellation invariants.

## Alternatives considered

- Worker-local archive plus iterator session: smaller implementation, earlier progress, and no new persisted artifact. It hides repeated parse/download within a worker but loses optimization on restart. This is likely the better near-term base if normal uninterrupted imports are the acceptance target; graft bulk SQL into it.
- Persist entire normalized inventory into `import_items` in one transaction: minimal reader interface but holds the archive-wide writer lock across all inserts, reducing cancellation responsiveness; bounded commit pages are preferable.
- Parallel photo workers alone: hides CPU scheduling but exposes shared ZIP sessions and increases database/storage contention while advisory lock remains global. It does not address dominant record insertion/download work.

## Open questions and risks

- Does measured worker restart frequency justify the sidecar complexity compared with a worker-local scan session?
- Should inventory sidecars count toward group workspace quota and migration/export retained-byte checks, or can they be excluded as safely rebuildable caches?
- Can progress feedback tolerate an initial complete inventory traversal, or must the durable representation support independently published pages?
- Do any adapters use non-deterministic normalization requiring a version marker before a rebuilt sidecar can be trusted against existing ordinal checkpoints?

## Verification contract

1. Synthetic WhatsApp ZIP with 7,500 messages and 223 valid JPEG candidates: exact outcomes/payloads match the baseline, 7,500 records retained, no available photos before confirm.
2. Count SQL execute calls and archive materializations: bulk row inserts scale by pages, repeated scan pages do not redownload the raw archive, and restarted scans read the sidecar.
3. Crash after sidecar publication, after bulk insertion but before checkpoint commit, and after commit: restart yields exactly one item per ordinal with unchanged occurrence identities.
4. Cancel/remove membership between read and commit: no new inventory items committed; withdrawal stays fenced for processing.
5. Hosted transport test with synthetic latency and operation counters: assert unchanged upload verification, object receipt generation and immutable conflict handling.
6. Benchmark 7,500 and 30,000 message fixtures with equal photo count on SQLite and a latency-injected PostgreSQL-compatible transport, separating upload, scan, processing and polling time. Record wall clock, SQL operations, Storage GET/PUT calls, bytes downloaded and peak RSS. Do not benchmark private archives.

## Next implementation step

First add operation-count regression coverage and the portable bulk insert seam; benchmark that independently before deciding whether durable sidecars are worth adding.

Workflow note: parent owns full how/architect orchestration and synthesis; this runner read the adapter, architect, how, runner prompt and rationale template, traced its assigned storage/SQL slice directly, and created no nested agents due to the bounded shared agent budget.
