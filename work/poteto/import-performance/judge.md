# Import design cross-judgment

Reviewed both candidates in full against the import engine, persistence adapter, object storage, archive adapter, and release handler. This is an independent review on the same model family, not cross-family validation. No implementation changed.

## Scores

Scores use 1 for poor and 5 for strong. Throughput scores assess evidence and the proposed mechanism, not an observed hosted speedup.

| Criterion | Candidate A | Candidate B | Evidence |
| --- | ---: | ---: | --- |
| Measurable hosted throughput | 4 | 4 | A removes repeated downloads and parsing during a worker lifetime. B also removes per-row SQL round trips. Neither includes measured hosted timings. A's suggestion of `executemany` is unsupported by the current PostgreSQL adapter and is not sufficient evidence of reduced round trips. |
| Durable recovery and fencing | 4 | 4 | A retains durable checkpoints and requires replay after restart. B avoids replay of raw input but introduces sidecar identity, publication, integrity, and cleanup contracts that are not implemented or tested. Both preserve transactional checkpoint fencing. |
| Bounded resource use | 4 | 3 | A retains one archive session and bounded pending rows. B additionally materializes a complete normalized inventory whose size and quota policy remain unspecified. Both still parse adapter metadata. |
| Simplicity and API depth | 5 | 2 | A extends an existing processing-session pattern without a new persistence format. B adds a reader, sidecar format, publishing lifecycle, and generic insertion abstraction. |
| Progress responsiveness | 4 | 2 | A commits bounded pages as normalization proceeds. B publishes only after a full traversal and therefore delays first inventory progress. Initial archive materialization remains a potentially long operation in both. |
| Total | 21 | 15 | Select A and graft B's targeted SQL batching. |

## Recommendation

Use A's worker-local scan session with durable checkpoint fencing. Graft B's bounded multi-value `INSERT` directly into inventory persistence. Seven values per row permit 128 rows per statement under a conservative 900-parameter limit. Keep the existing transaction and exact checkpoint check around all statements. Do not add a generic bulk-insert API for one caller.

Also accept streamed transfer checksum calculation and 512 KiB browser chunks. The engine already accepts 512 KiB, and its base64 JSON representation fits the existing 768 KiB request limit. These changes reduce redundant allocation and transfer request count while retaining object verification and receipt writes.

Reject the durable sidecar for this change. Restart frequency and replay cost have not been measured, and the new private artifact requires additional lifecycle contracts. Reject prepared-image caches, speculative combined queries, and parallel photo workers until measurements identify those costs as material.

The Laziness Protocol shaped the choice of the existing session pattern and a local SQL statement over new durable formats and generic APIs. Prove It Works shaped the requirement for request-lifecycle and hosted-operation evidence below. Both principle leaf files were read for this review.

## Deployment evidence and integration requirements

The release worktree at commit `40478a2` already has a persistent worker. `api/index.py:21` sets a 20-second cooperative drain budget. Lines 41-44 create `Worker(MemoryStore(...))` once in `_state['work']` and reuse it. The worker uses a separate connection, and `_drain_lock` prevents simultaneous access within one instance. No per-request store close occurs. The earlier proposed eight-second, per-request lifecycle is not present in this revision.

The performance worktree has no `api/index.py`. Integration must therefore preserve the release handler's worker reuse explicitly. A passing test that calls `work_once` repeatedly on one local store does not prove request-to-request reuse in the deployed wrapper.

Worker reuse is opportunistic across serverless instances and cold starts. A's correctness must remain independent of that reuse. Measure and describe warm-instance savings separately from cold-start replay.

The drain budget only checks time between work steps. It cannot interrupt a slow initial materialization, adapter parse, or database batch. Do not claim that 500 rows impose a 20-second latency ceiling. Measure the largest individual step and cancellation response under injected storage and database latency.

`api/index.py:54-57` currently evicts a cached worker on some exceptions without explicitly closing its store. Retaining scan resources makes deterministic cleanup on eviction relevant. Ensure the owner closes sessions when dropping a worker, or document and test a safe cleanup mechanism. Keep eviction separate from reuse during normal requests.

## Required validation before shipping

1. Count parser invocations, archive materializations, verified Storage GETs, SQL statements, and final outcomes across 7,500 and 30,000 synthetic records. Compare the same fixture and worker lifecycle before and after. Include a photo-bearing fixture and preserve the explicit sharing confirmation gate.
2. Exercise two sequential HTTP drain requests through the release wrapper and prove the scan iterator survives the boundary. Then create a fresh worker at a committed checkpoint and prove exactly-once ordinal persistence by replay.
3. Inject a commit failure after advancing the iterator and a competing checkpoint commit. Both must invalidate the local session before retry, without gaps or duplicate ordinals.
4. Cancel, withdraw, or remove membership through a second connection between page preparation and persistence. No stale page or photo completion may commit. Verify same-store close, terminal transitions, and cached-worker eviction release materialized resources.
5. Check exact batch multiples, zero-item archives, late invalid metadata, malformed ZIP entries, retained upload integrity, and existing occurrence conflict behavior.
6. For 512 KiB upload chunks, verify a full chunk, a final short chunk, and replay of an acknowledged chunk through the HTTP size validator and hosted receipt verification. Report transfer requests and bytes alongside scan and processing metrics.
7. Measure polling latency independently from worker drain latency. A summary response must retain authorization, exact counts, and full report compatibility. Present scanned messages and photo candidates separately.

These checks support structural work reduction and correctness. A hosted wall-clock speedup remains unproven until the actual request and storage path is exercised.
