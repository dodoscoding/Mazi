# Database implementation evidence

14 October 2026, shared working tree; not yet committed. Implementation follows candidate A with the design review's storage receipts and deletion queue. This worker owns persistence, domain SQL/storage wiring, full application migration, launcher scripts, and database contracts. Provider settings/secrets and migration application belong to the parent.

## Changes

- `mazi/persistence.py` selects SQLite or restricted PostgreSQL explicitly. PostgreSQL validates runtime schema version, keeps connection contexts open, translates only bound qmarks, supports SQLite row consumers, normalizes bytea, translates integrity errors, and serializes write decisions with a stable signed 64-bit SHA256 advisory transaction lock per private archive schema. Lock failures roll back. Reads outside write transactions use autocommit.
- Domain SQL now uses explicit upserts, quoted reserved identifiers, qualified conflict counters, UTC timestamp parameters, and backend-selected durable insertion ordering. Internal `_mazi_order` never appears in row dictionaries. Source outcome replacement deletes/reinserts to preserve replacement ordering.
- CLI generated `infra/hosted/supabase/migrations/20261014172936_application_archive.sql` contains 44 domain tables, 12 privacy trigger functions/triggers, schema version, five insertion-order identities, and three storage receipt/deletion tables. Every table has RLS; only `mazi_app` receives runtime privileges. The private schema does not belong to the Data API. Sequence UPDATE enables explicit recovery sequence resets.
- Manual uploads, ZIP imports, retained variants, and unsupported source resources use the shared `open_objects` boundary. Receipt/checkpoint updates occur in the same database transaction. Checksum reset advances storage generation before its intentional commit/Conflict. ZIP parsing materializes temporary private files. Hosted reconciliation retries committed deletion work; arbitrary orphan deletion is intentionally disabled because prepared variants can precede asset availability.
- `dev:supabase` and `start:supabase` explicitly load ignored `.env.supabase`; children inherit configuration. No automatic local-archive transfer or error fallback occurs.

## Verification

- Initial `tests.backend.test_persistence` red: missing `mazi.persistence` import.
- Focused compatible rows, quote/comment binding, connection context lifetime, commit-before-error, and lock-failure recovery: 5/5 pass.
- Complete local backend after storage integration: 176 tests pass, 5 skips (2 optional models + 3 hosted cases at that revision). The fourth hosted case was added afterward. Existing unclosed SQLite ResourceWarnings remain.
- Real TLS restricted-role hosted query run: identity/group, generation triggers, uniqueness-to-Conflict rollback, and truly simultaneous independent claims pass.
- `npm run test:postgres`: 4/4 pass against hosted PostgreSQL (33.505 seconds); covers row/parameter semantics, 4 consent generation increments, duplicate rollback/reuse, simultaneous worker claims, privacy cleanup through the older identity Store, and true parallel quota admissions (17 GiB synthetic metadata seed + two 2 GiB admissions admits one, rejects one; final 19 GiB, no large byte upload).
- Separate D17 synthetic run: normalized simultaneous first entry returns one user; injected session insertion failure rolls back the new profile; introduction survives access. Fixture is retained for parent browser validation; restricted metadata is `/tmp/mazi-hosted-synthetic.json`.
- Private Storage initial attempt failed HTTP400 with an incomplete dashboard key prefix. Its receipt/received transaction rolled back. The user supplied the complete modern secret; apikey-only Storage works. Tracked `tests.backend.test_hosted_journey` then passed in 55.821 seconds with remote bytes and an independent running hosted worker.

## Remaining acceptance

Parent owns final HTTP/browser proof, full transfer/recovery, provider settings, independent review, and final build checks. The runtime keeps D17/Python identity rather than silently replacing it with Supabase Auth. Orphan collection requires a quiescent maintenance boundary; queued explicit deletions remain durable and retryable.

## Follow-up review fixes

- CLI generated `20261014173956_hosted_privileges_and_indexes.sql` revokes public/anonymous/authenticated execution of the provider's `public.rls_auto_enable()` SECURITY DEFINER event-trigger function without removing the event trigger. Future postgres-created functions in public no longer receive default PUBLIC execution. Eighteen targeted FK indexes cover missing leading member/session/group/origin/run and cascade lookups.
- Hosted startup validates all database, schema, TLS certificate, Storage origin, bucket, and complete secret inputs before connecting. Masked/incomplete 15-character dashboard prefixes fail closed. Database connection/schema failures are replaced with a generic startup error that does not expose DSN or SQL details.
- Reviewer notification-opt-in bool/BIGINT mismatch corrected with `int(enabled)`, with hosted on/off/read regression added.
- Focused follow-up local verification: 7 persistence/configuration contracts plus 6 advanced-memory contracts pass (13 total).

## Final worker verification

Base revision `39841e8a2697c6e8ca57cc6f4866665218c0ea84`, uncommitted shared working tree.

- Full local backend: 189 tests pass, 9 skips (2 optional models, 6 opt-in PostgreSQL contracts, 1 opt-in hosted Storage journey), 27.619 seconds.
- Real hosted notification on/off round-trip: pass, 8.398 seconds. Exact large fractional timestamp, row semantics, consent triggers, duplicate rollback, and notification rerun: 2/2 pass, 15.662 seconds.
- Per-schema lock replaces the original archive-wide constant so independent recovery schemas do not block the base archive. Exact PostgreSQL LockNotAvailable becomes ArchiveBusy/TimeoutError. HTTP returns generic 503; the worker's existing OSError retry wait keeps it alive. Focused worker retry and HTTP recovery: 2/2 pass. Actual held same-schema lock timeout, rollback/reuse, and subsequent notification: pass, 6.528 seconds.
- `extra_float_digits=3` restores exact double-precision epoch round trips through the session pooler (provider default was zero).
- Tracked hosted Storage journey: resume ZIP after destroying scratch, process on parent independent worker, reopen original/preview/rendition/export after scratch destruction, retain/read unsupported source bytes and manual original, deny outsider access, withdraw only the fixture's run. Pass, 55.821 seconds. Task-created records remain for parent browser evidence and explicit fixture cleanup.
- Cloud credentials remain ignored; no token/password values appear in this evidence. Initial prefix failure was incomplete input, not modern-key incompatibility.
