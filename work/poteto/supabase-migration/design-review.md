# Supabase migration design review

Reviewed on 14 October 2026. This independent review read [candidate A](candidate-a.md), [candidate B](candidate-b.md), [database grounding](db-ground.md), and [storage grounding](storage-ground.md) in full. It evaluates proposed designs, not implemented correctness. The author and reviewers use the same model family. No cloud state or application code changed during this review.

## Decision

Use candidate A as the base. Its bounded connection interface preserves existing domain methods and the local archive while explicit portable SQL edits remove the known SQLite dialect differences. Graft candidate B's transfer generation, object descriptors, durable deletion queue, and explicit ownership of transfer state. Do not implement a generic SQL dialect emulator.

Laziness Protocol shaped the choice to retain the existing domain interfaces and local regression suite instead of rewriting every query and replacing the test backend. Prove It Works shaped the requirement for a real hosted API and separate worker, with disposable scratch directories and fault/recovery checks before completion.

## Scores

Scores range from 1 to 5. A design's verification score reflects the proposed acceptance contract, not passing implementation evidence.

| Criterion | A | B | Evidence and implication |
| --- | ---: | ---: | --- |
| Complete hosted records and bytes for API and worker | 4 | 4 | Both include all durable byte classes, independent connections, remote chunks, temporary ZIP materialization, and capsule bytea. Backup consistency and object collection remain implementation obligations. |
| D17 and all 44 domain tables | 4 | 4 | Both preserve Python sessions and identity UUIDs, and require the 12 trigger side effects. A preserves row/context behavior behind one boundary. B explicitly ports those semantics but broadens the changes. |
| Concurrency, privacy, and closed schema | 4 | 4 | A retains archive-wide serialization with a transaction advisory lock. B proposes narrower locks but must inventory every write invariant and lock order. Both keep the schema private and bytes mediated. Neither design is runtime proof. |
| Smallest understandable change and local compatibility | 5 | 2 | A retains SQLite and existing domain callers. B's stated tradeoff keeps SQLite only as an offline migration source, contrary to the requested local compatibility criterion, and changes query/row usage throughout the hierarchy. |
| Runnable restart and recovery validation | 4 | 4 | Both require separate clean API/worker directories, synthetic transfer, withdrawal, concurrency, migration, and database-plus-object restore. Both still need executable harnesses and failure injection. |
| Total | 21 | 18 | A wins on bounded scope and local compatibility. |

## Required grafts

1. Use a transfer identity containing area, transfer UUID, and generation. Receipt uniqueness and remote chunk keys must include that generation. Resetting a checksum failure must advance generation atomically, so replacement bytes at offset zero cannot conflict with the prior attempt. Manual uploads, ZIP imports, and source resources use the same protocol with distinct namespaces.
2. Compare any already accepted retry range, including a range crossing several receipts or splitting an earlier chunk. Preserve the current identical retry behavior. A single exact-offset receipt comparison is insufficient. Store length and digest and verify reconstruction against declared size and checksum.
3. Record remote deletion work durably after the visibility tombstone. A failed Storage delete must remain retryable after process restart. Preserve archive bytes with independent live origins. Garbage collection must consider every durable prefix and committed transfer receipt, rather than only archive variants.
4. Keep domain authorization before every private byte read and preserve server-mediated responses with `Cache-Control: no-store`. Do not expose the Storage credential or persistent signed object URLs to the browser. Capsule bytes remain in the unlock-protected table.

## Correctness conditions for implementation

- Advisory locking must cover every transaction that reads before deciding a write, including identity connection contexts and explicit import transactions. Acquire the lock inside an actual transaction on both API and worker connections. Use a bounded lock timeout. Avoid implicit read transactions persisting across requests. Direct operational writes must participate in the lock or run during maintenance.
- Prove connection context behavior before using the adapter broadly. `with self.db` must not close a psycopg connection. Preserve inherited departure commit ownership and the checksum reset that commits before raising `Conflict`, documented in database grounding. Rollback after an ordinary failure must leave the connection reusable.
- Translate parameter markers with quote-aware handling and escape literal percent signs for psycopg. Never substitute parameter values into SQL. Keep conversion limited to binding; replace SQLite-specific upserts, timestamps, identifiers, and ordering explicitly at callers.
- Preserve mapping and positional row access, value iteration, `dict(row)`, cursor iteration, rowcount, and bytea-to-bytes behavior. Use suitable integer widths for quotas and counters and double precision for epoch timestamps.
- Port all 44 tables and 12 triggers. Validate departure cleanup and generation increments through the older Store entry points too. The runtime role must not create schemas or execute startup DDL. Fail closed on incomplete hosted configuration or schema-version mismatch.
- Preserve insertion order for the five rowid-dependent tables and source-outcome replacement behavior. Hide the internal ordering column from API dictionaries and transfer all IDs and sequence positions explicitly.
- Publish availability only after both original and preview are verified remotely and the final lease, membership, cancellation, quota, and consent fences pass. A database failure after an object write leaves an orphan, not an available item. Immutable object conflict must compare bytes or digest rather than overwrite.
- Explicit archive transfer must refuse unrelated nonempty destinations and verify resumable source identity. Define trigger behavior during bulk import so imported records are neither silently deleted nor transformed by generation side effects. Ordinary startup must never upload an existing personal archive.
- A consistent backup needs the database and its matching object payloads. Stop or serialize writers and deletion/collection while capturing the snapshot and copying referenced objects. Restoring only PostgreSQL cannot prove recovery.
- Verify TLS with a trusted certificate chain on the actual session-pooler connection. Confirm private schema grants and absence from Data API exposure, private bucket state, and browser bundle credential absence. Existing Free-tier capacity must be reconciled with advertised archive quotas without paid provisioning.

## Required acceptance evidence

Retain the complete local backend baseline and build/typecheck checks. Add focused adapter contracts plus a real PostgreSQL run covering D17 concurrent first entry, rollback on failed session creation, expiry/logout/departure, all trigger side effects, portable row semantics, and output ordering.

The hosted journey must accept a synthetic ZIP through HTTP, process it on a separate connection, clear both actors' scratch directories, reopen them, and read original, preview, rendition, Atlas, export, and unsupported source bytes. Resume an interrupted upload after the same scratch deletion. Exercise checksum reset and identical/conflicting retry ranges.

Run simultaneous worker claims and quota admissions, stale completion after cancellation/withdrawal, consent changes during inference, Storage failure, database commit failure after upload, and deletion failure followed by restart. Assert unchanged checkpoints on failure and convergence without duplicate origins on retry.

Verify anonymous and cross-group denial through actual endpoints. Perform an explicit synthetic SQLite migration and full database-plus-object restore to an isolated target. Compare IDs, counts, order, digests, introduction state, partial-transfer recovery, and privacy behavior. Record commands, fixture identity, exact revision, results, and limitations. Connectivity alone does not satisfy these checks.

## Review limits

This review inspected the four requested design artifacts and their cited architectural contracts. It did not run hosted tests or inspect credentials. The parent reports a local baseline of 151 tests with two optional-model skips and successful restricted-role connectivity; those are parent-reported results, not independent reruns. The no-comments workflow was read and skipped because this assignment contains design prose only and expressly forbids new agents or application edits.
