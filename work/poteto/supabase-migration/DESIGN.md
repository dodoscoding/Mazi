# Hosted migration design

Select [candidate A](candidate-a.md), scored 21/25 by the independent same-family reviewer against candidate B's 18/25 in [the design review](design-review.md). Preserve existing domain methods through a bounded PostgreSQL connection adapter. Port SQLite-specific SQL explicitly at its owning call sites. Keep local mode available and do not execute schema DDL with the runtime role.

Apply Model the Domain to one validated local-or-hosted configuration and typed durable object receipts. Apply Foundational Thinking by verifying restricted connectivity and transaction contracts before cutover. Apply Separate Before Serializing Shared State by assigning one database/domain writer and one object-module writer. Apply Prove It Works by testing the API and separate worker on hosted records and objects with empty local scratch directories.

Graft candidate B's transfer generation and area namespace, arbitrary repeated-range comparison, durable object-delete retry queue, and full database-plus-object backup requirement. Keep D17 shared-code sessions in the private application schema. Supabase Auth signup remains disabled. The browser receives authorized bytes from Python and no backend credentials or signed Storage URLs.

Accept one archive-wide advisory transaction lock to preserve the current SQLite write-serialization contract. This is appropriate for the small friend-group archive; finer locks need measured contention and independent concurrency tests. PostgreSQL stores all 44 existing domain tables and privacy trigger effects. Object receipts and delete retries are infrastructure records, not a new product audience model.

The application schema is `mazi`, excluded from the Data API. The restricted role `mazi_app` has application DML and sequence privileges, with no schema ownership or role-administration privileges. RLS protects the private schema from other roles. The existing Python checks govern each profile's membership, ownership, withdrawal, consent, and capsule-unlock decisions.

The existing M0 configuration stays separate. Hosted migrations live under `infra/hosted/supabase/migrations`. Credentials live in ignored private local files. Durable Storage uses the private `mazi-private` bucket. All six retained byte paths must migrate, while capsule photos remain `bytea`. Existing archives require an explicit verified transfer command and are never copied by startup.
