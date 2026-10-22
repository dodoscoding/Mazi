# Candidate A: bounded worker sessions

## Problem

The durable queue is sound, but scanning repeats expensive input work. `ImportStore.work_once` calls `scan(...,500)`; each `scan` materializes the complete archive, `Archive.__init__` hashes and validates its directory, and `inventory` reparses metadata before discarding the prefix below the durable checkpoint. With hosted storage, materialization downloads every receipt each batch. Processing already retains one archive per worker (`_processing_archive`); extend that ownership pattern to scanning while preserving persisted checkpoints, explicit sharing confirmation, cancellation, membership checks, and fenced completion.

## Usage (caller's view)

Existing callers stay unchanged:

```python
store.scan(run, batch_size=500)  # one bounded durable checkpoint
while store.work_once():        # same connection owns the iterator between ticks
    pass
store.close()                   # closes generator, ZIP, and materialized workspace
```

A restarted worker reconstructs its iterator and skips the committed prefix once. A second worker can race the checkpoint, but cannot commit stale work. HTTP reporting remains independently authorized.

## Grounded flow and hotspots

- Upload: browser sends bounded base64 chunks; `write_chunk` appends under a transaction. `HostedObjects.append` verifies each remote object after PUT and inserts receipts. Keep this integrity contract; transport changes need separate measured evidence.
- Finish: `finish_transfer` currently reads the entire materialized object into bytes to hash it. Hash a materialized file with `hashlib.file_digest`, avoiding an archive-sized extra allocation while retaining checksum failure/reset behavior.
- Scan: `scan` repeatedly opens/downloads/hash-checks/parses the ZIP; it commits at most 500 rows and uses checkpoint compare-and-swap. This is the primary root cause. Use one worker-local iterator and materialized archive, bounded persistence batches, `executemany` where the database adapter supports it.
- Prepare: `_processing_archive` already amortizes archive opening. `prepare` decodes/validates and generates the same preview again for repeated bytes, before group-scoped deduplication in `complete`. A bounded per-worker prepared-result LRU keyed by `(group_id, sha256)` can avoid repeated PIL work, but only immutable image-derived fields belong there; occurrence metadata and EXIF provenance must remain per-item, and all normal fences and quota checks still run.
- Commit/report: `complete` serializes availability and group/contributor quotas. Do not cache these mutable decisions. `report` recomputes counts and parses up to 100 payloads on every poll. Offer a summary-only report mode while preserving full report pagination; one aggregate query can produce outcome counts and media/nonmedia totals. UI polling can request details only when viewing/exporting the report.

## Shape

```python
@dataclass
class ScanSession:
    identity: tuple[str, str, str, str, str]  # run, group, manifest, source, options
    checkpoint: int                        # next expected committed ordinal
    resources: ExitStack                   # owns materialization and Archive
    items: Iterator[NormalizedImportItem]  # inventory parser state retained here

class ImportStore:
    _scan_session: ScanSession | None
    def _release_scan(self) -> None: ...
    def _scan_inventory(self, row) -> ScanSession: ...
    def scan(self, run, batch_size=50_000) -> bool: ...
    def report(self, user, run, offset=0, limit=100, *, summary=False) -> dict: ...
```

Keep one scanning session per store, not a global cache. `_scan_inventory` validates membership/state before reuse, checks identity plus checkpoint, and reconstructs/advances once when mismatched. `scan` pulls at most its batch size outside the transaction; inside the existing transaction it rechecks membership, `SCANNING`, withdrawal, and exact checkpoint before inserting. Only after a successful commit does it advance the session checkpoint. A failed commit or lost checkpoint race invalidates and closes the session because the generator has already advanced. Cancel, withdrawal, departure, terminal/error transitions, and `close()` close both processing and scanning resources. Cross-connection cancellation is observed at the next tick and at the transaction fence; cached data never authorizes a write.

No new persistence schema is needed. The public interface hides iterator lifetime, archive integrity validation, and replay recovery behind existing `scan`; durable truth remains the database. A generator may retain one parsed metadata file, already required by current adapters' context construction; do not eagerly cache all normalized records. Scanning remains before explicit consent; no item becomes shared until confirm and fenced completion.

## Synthesis decision

Pending parent comparison with the independently scoped candidate.

## Tradeoffs accepted

- We accept one active materialized scan archive and parsed metadata file per worker in exchange for eliminating repeated reads and parsing.
- We accept a one-time prefix replay after process restart in exchange for no new durable spool format or migration.
- We accept a final empty tick for exact batch multiples unless a one-item lookahead is carefully retained; this is cheap after reuse and avoids losing a boundary item.
- We accept bounded cache memory for repeated image preparation only if benchmark data justifies that second change.

## Alternatives considered

- Persist a normalized inventory spool: better restart speed but adds a new stored private artifact, integrity/cleanup/versioning contracts, and publication coordination. The interface can be deep, but its lifecycle cost exceeds the observed single-worker use case.
- Increase batch size or scan everything in one call: hides less complexity and retains long cancellation/access response intervals; it removes repeated parsing only by sacrificing bounded work.
- Parallel image workers: expands connection, lease, and memory pressure before measuring decoding as a bottleneck. Existing SQL commit serialization remains necessary, so concurrency alone cannot address the repeated scanning root cause.

## Verification and baseline

Synthetic baseline run on 2026-10-22 in this worktree using the main checkout's `.venv/bin/python` (worktree has no venv): 7,500 WhatsApp plain text messages, ZIP_STORED fixture 374,005 bytes, 500 records per scan, 16 calls, **0.7892 seconds** scanning; checkpoint 7,500. No personal data used. This is a local small-input baseline, not a hosted throughput prediction. Each call reparses the complete message file and computes each skipped normalized item.

Commands: `python -m unittest tests.backend.imports.test_engine tests.backend.imports.test_adapters tests.backend.imports.test_http`; `npm run test:backend`; `npm run build`; `npm run test:app`; `git diff --check`. Use the configured venv Python.

Required regression contracts: one materialization and parser pass over many scan ticks; bounded rows per tick; restart after checkpoint; competing store checkpoint race; exception after iterator advance; exact batch multiple; close/cancel/withdraw/departure releases; remote cancellation prevents next commit; malformed/nested archives still fail; consent remains mandatory; duplicate origin identity conflicts remain intact. Add a synthetic benchmark comparing 7,500 and 30,000 messages at batch size 500, recording elapsed time, parser invocations, archive materializations, peak memory, and hosted GET counts with a fake storage transport. Assert structural work counts rather than fragile elapsed-time thresholds.

## Open questions and risks

Could adapters yield before validating later archive members? Yes, as today; preserve terminal scan failure handling for earlier PENDING items. Could resource cleanup exceptions hide the original failure? Keep close paths exception-safe. Could source ingestion share this session? Source imports must retain their existing source-resource checksum exception and cannot reuse a different identity.

## Next implementation step

Add the failing multi-batch one-materialization/parser contract using the existing `tracked_archives` helper, then implement the worker-local session and lifecycle invalidation.
