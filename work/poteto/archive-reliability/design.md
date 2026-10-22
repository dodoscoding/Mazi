# Archive reliability design

Keep the existing cached application and importer, but release their SQL clients in request/drain finally blocks under the same owning lock. Reconnect lazily. Configure every database transaction locally and disable prepared statements before using Supabase transaction pooling. Keep domain transaction and commit semantics. No eager duplicate Python row buffer. This follows candidate B, corrected by independent review.

Batch Atlas origin/place/profile reads using streamed compact aggregation from candidate A. Preserve the existing large-context memory bound and authorization transaction. Avoid changing lock strength until there is measured need and an independent policy-concurrency test. Reduce navigation reloads without keeping private data through visibility/session/access invalidation.

Emit source sender and normalized or raw uncertain shared-date evidence separately from capture chronology. Render labeled Shared by/Shared on values and a provenance-based heading for untitled photos. No inferred dates, archive rewrites or reimport.

Data shapes are existing Postgres adapter lifecycle, compact per-asset aggregation, and optional typed photo source evidence. User-facing captured dates/year remain unchanged.

Compared designs use the same model family. Candidate A's fresh stores require transferring scan ownership and still hit the session-mode active cap. Candidate B preserves scan optimization and transaction-pool capacity; reject its unnecessary eager Row copies and general nested transaction rewrite. Exact implementation needs red-green tests and real transaction-pool verification.
