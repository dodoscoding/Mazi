# Supabase migration code review

Independent same-family review on 14 October 2026 against base `39841e8a2697c6e8ca57cc6f4866665218c0ea84` and the shared uncommitted working tree. Last inspected at 17:41:36 UTC. The tree changed during review. No application code, cloud state, secrets, or personal archive was changed or read. This report is the only authored artifact.

Read the Poteto wrapper, Codex adapter, upstream mode, no-comments skill, comment-review prompt, selected design, design review, migration SQL, connected persistence/domain/storage code, launcher, and new tests. No additional agents were spawned under the assigned budget.

## Actionable findings

1. **P1. Local retained imports lose atomic publication after an interrupted write.** `mazi/storage.py:73` writes directly to the final immutable path. Before this migration, `ImportStore._write_object` wrote a private temporary file, fsynced it, and renamed it into place. A process interruption or disk error can now leave a partial `<group-digest>.original` or `.preview`. On every retry, `retain` sees the file and raises `StorageConflict`; `prepare` turns that `ValueError` into `INVALID_MEDIA`. Thus a valid import cannot recover. A synthetic truncated final object containing `b'prefix'`, followed by `retain(..., b'prefix suffix')`, reproduces `Immutable object differs`. Restore atomic final publication and prove interruption followed by successful retry.

2. **P1. Explicit migration accepts missing live payloads and reports success.** `mazi/archive/migrate.py:92` checks active archive originals and source-transfer bytes, but never checks nondeleted `media` originals/previews or active archive previews. The final inventory comparison only compares files that were present in the damaged source. A fresh synthetic `MemoryStore` with one manually uploaded JPEG, followed by deletion of its original, returns `{'migrated': True, 'tables': 44, 'files': 1}`. The destination retains an available media record with no original. This was reproduced with real local schema/domain creation and fake destination persistence/transport; no hosted destination was used. Validate all required domain payloads before remote writes or the success receipt, including both manual variants and active imported previews. Add missing/corrupt-payload rejection contracts.

3. **P2. A failed restore strands its isolated destination and cannot retry.** `mazi/archive/hosted_ops.py:190` uploads objects before table insertion. If the second object upload or database insertion fails, PostgreSQL rolls back, but already uploaded objects remain. At `:189`, the next identical restore calls `require_empty` and rejects those objects. A synthetic valid one-object snapshot, an injected `insert_tables` failure, and an immediate identical retry reproduce `Hosted destination must be empty; no automatic merge or reset is permitted`. Unlike `migrate_archive`, restore has no exact-snapshot receipt or resumable ownership. Make identical restore retries converge while unrelated destinations still fail closed. Verify failures during both object upload and database insertion.

4. **P2. Backup lock does not serialize remote deletion.** `create_backup` holds the archive lock at `mazi/archive/hosted_ops.py:175`, but `HostedObjects.retry_deletions` deletes the remote payload at `mazi/storage.py:309` before acquiring that lock at `:312`. A deletion worker can remove a listed receipt payload while backup copies it. The export then fails, despite claiming a locked database-plus-object operation. Moreover, the deletion can finish remotely while its database receipt cleanup waits behind the backup lock. Move deletion and receipt cleanup into the same maintenance synchronization boundary as backup, and add an interleaved two-connection backup/delete contract. This is statically proven ordering; no live concurrency test was run by this reviewer.

## Finding fixed during review

`AdvancedMixin.notification_opt_in` originally passed a Python `bool` to the hosted `BIGINT enabled` column at `mazi/memories/advanced.py:137`. Psycopg sends a PostgreSQL boolean rather than SQLite's integer conversion. This fails for either opt-in value. The parent was notified and the last inspected version uses `int(enabled)`. The remaining acceptance item is a hosted true/false notification round trip. This reviewer did not use hosted credentials to rerun it.

## Verification and limits

Independently ran `.venv/bin/python -m unittest tests.backend.test_persistence tests.backend.test_storage tests.backend.test_hosted_recovery`. All 23 focused tests passed in 0.018 seconds. Existing unclosed SQLite ResourceWarnings appeared. `git diff --check` passed. The synthetic migration/restore/interrupted-object reproductions above ran separately and expose behavior absent from those passing tests.

The SQL has 44 domain tables, the runtime version table, three infrastructure tables, and all 12 privacy triggers. Trigger bodies retain the original cleanup/generation effects. The adapter limits conversion to bindings, uses autocommit for ordinary reads, and locks explicit transactions. The launcher propagates configuration into Python; that server creates a separate worker store using the same environment. No new browser credential or signed-URL path was found. Current hosted configuration validation requires verified TLS and fails closed. These are code inspection results, not provider or live Storage proof.

Do not treat four hosted database cases as validation of all original domain behavior. At review time, there is no passing real Storage HTTP upload/restart/withdrawal/restore journey, no real SQLite-to-hosted full transfer/restore comparison, no all-trigger boundary matrix, and no interleaved byte read/delete evidence. Local focused fakes cannot close those gates. The parent reports that Storage credential recovery is pending. The claimed 20 GiB group quota must also be reconciled with the project's Free-tier Storage capacity before acceptance.

Hosted orphan deletion is explicitly disabled in `ImportStore.reconcile`; `unreferenced()` only reports keys. Failed database transactions and rejected/stale prepared objects therefore have no bounded collection procedure in the current delivered code. The implementation document calls that a remaining maintenance obligation. Treat it as an explicit operational limitation, especially for the Free plan, rather than claiming durable orphan collection is implemented.

## Comment audit

Report-only review; deletion count is zero. No scoped TypeScript/lint suppression was introduced. No application-code reshape is accepted solely for style.

Accept removal of four comments that narrate the surrounding code: `mazi/archive/migrate.py:47`, `mazi/archive/migrate.py:58`, `mazi/storage.py:252`, and the first line of `20261014172936_application_archive.sql`. Keep public API contract docstrings. Keep the HTTP error-payload comment at `mazi/storage.py:135`, which explains why provider payloads must not enter client-visible errors. Keep the new `rls_auto_enable` privilege migration's comment because it documents the external provider event trigger constraint. The restore generation-order comment explains deliberate ordering with a focused behavioral contract; no additional reshape is justified by this review. No `MUST KILL` code flag is accepted. Separate comment delegation was skipped because this assignment explicitly forbids further agents.

## Decision trail audit

The design `VERIFIED` row is supported by the independently authored design review, which clearly describes a design judgment and not runtime acceptance. Restricted role and verified TLS rows are supported by schema/code artifacts and parent-reported connectivity, but this reviewer did not inspect provider settings or credential files. The implementation/storage documents clearly label the live Storage failure and pending acceptance. Preserve those limitations in the final delivery. The checklist remains largely unchecked and must be reconciled with actual final evidence rather than marked complete based on design scores or database connectivity.

Reviewed implementation fingerprints at 17:41:36 UTC:

| File | SHA-256 |
| --- | --- |
| `mazi/storage.py` | `3cfc790f7d7f4e55677ab5f7b2b0834699188e68165f61cbdbbc2289d320c79f` |
| `mazi/archive/migrate.py` | `5d56f6611c834926c6a226c8a852fb525c084f22658f5a98a0ea5e0cecedc5dc` |
| `mazi/archive/hosted_ops.py` | `5e6a788621261943593e398ed5daf4c9ff95292e69d1ec1ffcbad50df205774b` |
| `mazi/persistence.py` | `065028414b4153f35f92ef95d0691662f70e8d1b91b6b074cc6269ae811559e1` |
| `mazi/memories/advanced.py` | `627b98c9303e5829e7d304d67c08cd88a48f228e2bcb417968ff2f7ebae73f80` |
