# Supabase migration review follow-up

Independent same-family follow-up on 14 October 2026. Base remains `39841e8a2697c6e8ca57cc6f4866665218c0ea84`; implementation remains an uncommitted shared working tree. Reviewed the current fixes, focused contracts, busy-archive handling, hosted journey test, implementation evidence, and `recovery-evidence/live.json`. No application code, SQL, cloud state, credentials, or personal source archive was changed or read. No additional agents were spawned.

## Verdict

No remaining must-fix was found in the four originally reported paths. The explicit transfer of the parent-inspected archive containing two profiles and no media is not blocked by this code review. Use a stopped explicit source, the intended empty destination, and retain the original local archive. The source inventory is parent-reported; this reviewer deliberately did not inspect it.

## Original finding disposition

| Finding | Disposition and evidence |
| --- | --- |
| Local retained-object interruption | Fixed. `LocalObjects.retain` writes and fsyncs a private temporary file, installs it atomically with a non-overwriting hard link, verifies collisions, and fsyncs its directory. The focused fault test passes before installation. An independent injected directory-fsync failure after installation leaves complete bytes and permits identical retry. |
| Missing live migration payloads | Fixed. `validate_source_payloads` runs before any Storage operation, requires nondeleted manual originals and previews, verifies original checksums, requires active imported previews, and validates retained transfers/resources. Missing-byte and before-remote-write rejection tests pass. |
| Restore stranded after failure | Fixed. An exact-snapshot receipt includes destination schema and bucket; retries reject unrelated keys/digests/rows and accept exact data. Tests pass for interrupted object upload, database insertion failure, different snapshots, and unrelated objects. Completed restore requires exact row and remote-key inventories. |
| Backup versus remote deletion | Fixed. Queue revalidation, remote deletion, and receipt cleanup now run within the same database transaction/advisory lock as backup. Independent fake transport asserts deletion runs under the connection context; failure/retry tests pass. Live two-connection interleaving remains a coverage gap rather than an observed unresolved ordering defect. |

The notification bool/BIGINT mismatch is corrected with explicit integer conversion. The hosted test now round-trips both values. The implementation document reports a passing live run; the reviewer verified the code and local advanced-memory contracts but did not access hosted credentials.

## Additional changes checked

`ArchiveBusy` is an `OSError`/`TimeoutError`, allowing the existing worker retry loop to survive a bounded PostgreSQL lock wait. HTTP handlers return generic retryable 503 responses. Connection rollback leaves the adapter reusable. Per-schema lock keys are stable signed 64-bit hashes, so distinct test/recovery schemas do not block the production archive. All actors writing one archive still share the same lock. `extra_float_digits=3` preserves exact double-precision epochs, and the hosted test asserts a large fractional timestamp. These fixes have focused contracts and producer-recorded live results.

## Independent checks

- `.venv/bin/python -m unittest tests.backend.test_persistence tests.backend.test_storage tests.backend.test_hosted_recovery` passed all 29 tests in 0.076 seconds.
- `.venv/bin/python -m unittest tests.backend.test_archive_busy tests.backend.memories.test_advanced` passed all 8 tests in 1.187 seconds.
- An independent local probe required the remote deletion callback to run under the connection transaction context. It passed.
- An independent local probe failed the directory fsync after atomic final installation, then verified complete bytes and successful identical retry. It passed.
- `git diff --check` passed.

The parent/implementation document reports 189 local backend tests with nine skips, live PostgreSQL notification/float/lock recovery checks, and a real Storage journey. This reviewer did not rerun hosted operations or the full backend suite. The focused checks above are independently observed.

## Acceptance evidence and its limits

`recovery-evidence/live.json` records a synthetic transfer of 44 domain tables and five logical files, an exact-source repeat, backup/restore of 47 tables and six remote objects, an exact restore repeat, full row/binary equality, preserved introduction, fresh-scratch byte reads, resumed partial transfer, and a departure-trigger write. It identifies distinct test schemas and buckets. This is inspected producer evidence, not an independently rerun live experiment. The JSON does not include its command, revision fingerprints, execution time, or executable driver. Add those to the final recovery evidence to make the run auditable and repeatable.

`tests/backend/test_hosted_journey.py` exercises actual hosted domain methods and a separate running worker. It destroys caller scratch directories between stages, checks original/preview/rendition/export/manual/unsupported-resource bytes, rejects an outsider, and withdraws its run. It does not submit chunks or reads through HTTP, and its withdrawal assertion checks database origin visibility rather than a subsequent endpoint denial. Therefore describe its passing result as a hosted domain/Storage journey. Do not describe it as a full hosted HTTP journey. The parent's ongoing browser entry/introduction/home check should be recorded separately, including the exact tested revision and screenshots where relevant.

Remaining acceptance coverage gaps include real HTTP import/read/restart/withdrawal behavior, live interleaved backup/deletion, an all-trigger boundary matrix, and confirmation of final provider advisers/private-schema/private-bucket settings. These do not invalidate the corrected explicit profile-only transfer. They limit a broader claim that every planned production safeguard and fault scenario has been accepted.

## Operational limitations

Unreferenced hosted-object collection remains disabled and reported as a maintenance obligation. This avoids deleting prepared bytes during an active import, but failed/rejected work can accumulate objects. A stopped maintenance collector is future work, not a failed implementation of the four fixes above. Reconcile the 20 GiB application group quota with the hosted project's Free-tier Storage capacity in the user-facing limits. This is a capacity/operational limit, not evidence that the tested synthetic import lost data.

## Comment and decision-trail follow-up

The two accepted narration comments in `migrate.py` were removed. At inspection, `mazi/storage.py:265` and the first line of `20261014172936_application_archive.sql` still contain the other two accepted narration comments. The parent was notified to have their owners remove them. This reviewer made no application or SQL edits. Comment deletion count by this reviewer is zero; no application reshape is requested solely for style. Public API contract and provider constraint comments remain accepted.

The updated storage evidence correctly attributes the initial failure to an incomplete retrieved secret prefix and records the later successful apikey-only modern-secret run. Earlier review limitations remain a historical snapshot. Final documentation should cite this follow-up and current evidence rather than implying live Storage is still blocked. The decision log/checklist remain incomplete at inspection and must be reconciled with final verified results. Same-family independent review should stay explicit.

Reviewed fingerprints:

| File | SHA-256 |
| --- | --- |
| `mazi/storage.py` | `59a6cb9888b92e17b98634444844c69d048db6068cdf0141cba89fab00da60ac` |
| `mazi/archive/migrate.py` | `fcaba322b24c3469320997719ef297d492792e88a4b44fbe012f5d205be8d4ac` |
| `mazi/archive/hosted_ops.py` | `cc7b619c2d6da3b5aeb1949fe173b3c6db2312a4cb71989cf5bdfed8b6c6bed0` |
| `mazi/persistence.py` | `29c95245d1ab8702b10219d5d6194d51b9810c9d0cb8a89229e441b0b943149e` |
| `tests/backend/test_hosted_journey.py` | `d9f7b3dc7e0370fc00681867d3be06b40773e8fc197e2ac1ff3c8ca9a8d11a78` |
| `recovery-evidence/live.json` | `2e7ebb8dd7fdbbe90a594a940029fe87127aee4bb9f70ab1f7d10940b7488ade` |
