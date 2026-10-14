# Supabase migration verification

Verified on 14 October 2026 from base `39841e8a2697c6e8ca57cc6f4866665218c0ea84`. This directory records implementation acceptance for the hosted persistence change, not completion of every production milestone. Implementation revision: `4bc8663` defines contracts; the implementation commit is recorded under Delivery. Source fingerprints identify the exact tested files.

## Delivered behavior

Mazi uses PostgreSQL 17 and private Supabase Storage in Frankfurt. The API and independent worker inherit the ignored hosted configuration. The private `mazi` schema has 48 RLS-enabled tables and 12 privacy triggers; anonymous/authenticated Data API roles have no table privileges. Runtime `mazi_app` has no superuser, role creation, database creation, or RLS bypass authority. Pooler TLS verifies the provider CA. Public Supabase signup and anonymous sign-in are disabled; existing D17 shared-code profiles and opaque sessions remain the application identity system.

The explicit owner cutover preserved all 44 domain tables, two profiles, one group, shared-code policy, sessions, and introduction state. There were no media files to transfer. The stopped source and restricted local backup remain available. Comparison used all table values from source, backup, and target: a database-file hash changed around SQLite backup/checkpoint, so file-byte identity is not claimed. See [cutover evidence](cutover.json). Disposable synthetic records, buckets, objects, and validation schemas were subsequently removed; see [cleanup](cleanup.json).

## Verification results

| Check | Command or evidence | Result |
| --- | --- | --- |
| Full local backend | `MAZI_BACKEND=local npm run test:backend` | 192 tests run, OK, 10 skips; 24.565 seconds in the primary checkout and 24.110 seconds in the PR worktree. Two optional model tests and eight explicit hosted opt-ins skipped. |
| Integrated desktop and phone emulation | `npm run test:app` | 14 passed, 18.3 seconds. |
| Build and formatting | `npm run build`, `npm run lint`, `git diff --check` | Passed. No semantic Python linter or coverage threshold is configured. |
| Documentation | `npm run check:docs` | Passed; structural/link/traceability checks only. |
| Hosted PostgreSQL | Opt-in `tests.backend.test_postgres` against disposable synthetic state before cutover | Four initial cases passed in 33.505 seconds: binding, privacy triggers, independent concurrent claims, and quota admission. Follow-up notification/float checks passed (2 cases, 15.662 seconds); held-lock timeout/reuse passed (6.528 seconds). |
| Hosted test guard | `tests.backend.test_postgres.PostgresGuardContracts` | Two cases passed: only an explicit `_test` schema can initialize destructive PostgreSQL fixtures. Never run the suite against the live `mazi` schema. |
| Private Storage | [Storage evidence](storage-evidence.md) | Modern server key works with apikey-only requests; immutable bytes, replay, independent materialization, checksums, reset, and scoped deletion passed. |
| Hosted domain and Storage | `MAZI_TEST_HOSTED=1` with `tests.backend.test_hosted_journey` before cutover | Passed in 55.821 seconds, with independent worker and destroyed caller scratch. This is a domain-method journey, not an HTTP test. |
| Real hosted HTTP | [Exact commands and results](http-evidence.md) | Preparation passed in 52.697 seconds; fresh-scratch API/worker restart verification passed in 39.899 seconds. Imports, private reads, denied access, notification booleans, resume, rendition/export, withdrawal, and logout verified. |
| Synthetic recovery | [Live result](recovery-evidence/live.json) and historical drivers below | Migrated 44 domain tables/5 logical files; exact retry; backup and isolated restore of 47 tables/6 raw objects; exact restore retry; row/binary equality, introduction, fresh-scratch reads, partial resume, and departure verified. |
| Actual archive transfer | `npm run archive:migrate -- --source /Users/altanesmer/Desktop/Ales/Mazi/.mazi-imports` | Migrated 44 domain tables, zero files. All source/backup/target table values equal. |
| Actual hosted backup | `npm run archive:hosted -- backup` and `verify` with private output | Verified 47 tables and one migration receipt object; backup is restricted and ignored. |
| Provider final read-only check | Supabase `get_project` and `get_advisors(type=security)` | `ACTIVE_HEALTHY`; zero security lints. [Project screenshot](project-configured.png). |
| Provider HTTP access | [HTTP observations](provider-http.json) | Signup disabled; private-schema anonymous REST rejected; private/public bucket reads rejected. |
| Secret boundary | Built asset scan and Git ignored-path checks | No real server key or database DSN in built assets or tracked files. Credentials and personal backups remain ignored. |

The guarded hosted tests require explicitly provisioned disposable schemas and buckets; the original validation schemas have been removed. The historical recovery drivers are retained as text for audit, not a turnkey command against the live archive: [preparation](recovery-evidence/preparation.py.txt), [resume](recovery-evidence/resume.py.txt). They were invoked as `.venv/bin/python /tmp/mazi_recovery_live.py` and `.venv/bin/python /tmp/mazi_recovery_resume.py` from the repository root. Preparation stopped after migration when an introduced-profile assertion used the wrong session shape; the resume driver used the preserved synthetic fixture and completed the recorded proof. The run was observed on 14 October 2026; an exact duration was not captured. Final source fingerprints are in [source manifest](source-fingerprints.json).

## Review and operational limits

Independent review used `gpt-6.1-sol` with high reasoning, within the same model family as implementation. It is not cross-family review. The [original review](code-review.md) found four durability/recovery defects; the [follow-up](review-followup.md) verified their fixes with 37 focused tests and two independent fault probes. Producer-recorded hosted evidence was inspected rather than independently rerun by that reviewer. Subsequent HTTP evidence closes the HTTP coverage gap noted in the historical review.

Queued explicit deletion is durable and retried. Arbitrary orphan collection is deferred until a stopped maintenance boundary exists, preventing deletion of prepared bytes during active imports. Backup/restore currently holds payloads in memory; large archives need streaming work. Live interleaved backup/deletion and the complete privacy-trigger fault matrix remain coverage gaps. Desktop/phone emulation does not establish physical-device acceptance.

The project remains Free: 1 GB Storage and 500 MB database capacity, as checked against [Supabase pricing](https://supabase.com/pricing). The application's planned 20 GiB group cap does not increase that service capacity. No paid upgrade was selected. The API/worker still run on this computer; this is not a public web deployment. `npm run dev` or `npm start` selects the ignored hosted configuration here; explicit `dev:local`/`start:local` preserves local use. A checkout without hosted credentials defaults to local.

Model the Domain preserved D17 identity and privacy semantics. Prove It Works required real hosted HTTP restart and isolated recovery evidence. Separate Before Serializing Shared State kept independent schemas isolated while serializing each archive's mutations. See [D18](../../../docs/DECISIONS.md) and [operating instructions](../../../docs/SUPABASE_SETUP.md).

## Delivery

Delivery uses the verified GitHub remote `https://github.com/dodoscoding/Mazi.git`; Origin could not resolve that repository. [Ready pull request #28](https://github.com/dodoscoding/Mazi/pull/28) contains coherent contract, implementation, and evidence commits. No merge or deployment is implied by PR creation.

- Contracts: `4bc8663` — hosted archive/recovery tests (initial missing-module red recorded in implementation evidence).
- Implementation: `d091d6793d42a87651eb26079647bbdc7d0a981c` — hosted persistence, private bytes, restricted schema, and explicit transfer/recovery.
- Evidence: `a270e23` — cutover verification, operating limits, fingerprints, and screenshots. A subsequent documentation commit records the PR link and completes the delivery log.
