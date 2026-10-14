# Hosted Supabase setup

D18 runs the existing Atlas app with hosted PostgreSQL and private Storage while retaining D17 shared-code profiles and Python sessions. The application remains a loopback React/Python app; this is not a public production deployment or milestone acceptance. [The decision](DECISIONS.md#hosted-archive-decision-14-october-2026) and [implementation evidence](../work/poteto/supabase-migration/database-implementation.md) define this boundary.

## Current project

The **Mazi** project belongs to **Altan Esmer**, uses **Frankfurt (EU)**, and remains on the Free plan. Project reference: `elgwhwkqutmmbdjthubl`. No paid upgrade was provisioned. The dedicated hosted configuration is in `infra/hosted/supabase`; the root `supabase` directory remains the separate M0 experiment.

The private `mazi` schema contains all 44 domain tables and 12 privacy triggers, plus runtime-version and object-receipt/deletion tables. All tables have RLS. The server uses restricted `mazi_app` access, verified TLS and a provider CA; it cannot perform startup DDL. The schema is outside the Data API, and `anon`/`authenticated` have no application table access. The `mazi-private` bucket is private. Downloads pass through current Python authorization; browsers receive neither Storage secrets nor permanent object URLs. Supabase Auth does not replace D17 sessions.

## Server configuration and startup

Install dependencies with `npm ci` and `npm run setup`. Copy [.env.supabase.example](../.env.supabase.example) to `.env.supabase` and supply the complete session-pooler credentials and server Storage secret. Keep the file private (`chmod 600 .env.supabase`) and untracked. A masked dashboard key prefix is insufficient. Do not put secrets in `VITE_` variables, browser code or screenshots.

The database URL requires `sslmode=verify-full` and the readable provider CA at `infra/hosted/prod-ca-2021.crt`. `MAZI_DATABASE_SCHEMA` selects the initialized private schema; `MAZI_STORAGE_BUCKET` selects its matching bucket. `MAZI_IMPORT_DATA_DIR=.mazi-hosted` selects disposable scratch, separate from the preserved `.mazi-imports` source. Hosted startup validates database, TLS and Storage settings before connecting and fails closed if they are incomplete.

```sh
npm run dev
npm start
```

Normal startup selects hosted mode when `.env.supabase` exists and `MAZI_BACKEND` has no explicit override. `npm run dev:supabase` and `npm run start:supabase` require hosted configuration explicitly. `npm run dev:local` and `npm run start:local` select SQLite/files; `MAZI_BACKEND=local` also prevents automatic environment-file loading. A fresh checkout without the ignored file retains local mode. API and worker inherit the same backend configuration.

Starting the app never copies a local archive. An existing D17 policy supplies its current code and profiles; a new hosted archive requires explicit setup. For a new archive, run the setup module with the same hosted environment; for an existing one, use the transfer below to preserve its IDs, shared-code digest, sessions and introduction state.

## Explicit archive transfer

Stop the source API/worker and destination app first. Review the destination project/schema/bucket before running the command. Transfer accepts an empty destination or an exact-source completed/interrupted receipt; unrelated rows or objects block it. The source is opened read-only. Record IDs, binary fields, ordering and sequences are preserved; object inventories and bytes are verified. Keep the local source after transfer.

```sh
npm run archive:migrate -- --source /absolute/path/to/stopped/archive
```

The existing `.mazi-imports` archive was transferred on 14 October 2026. All 44 domain tables match the preserved local source and its restricted backup, including two profiles, shared-code policy, sessions, and introduction state. There were no media files to transfer. [Cutover verification](../work/poteto/supabase-migration/cutover.json) records the comparisons; the original archive remains available for explicit local mode.

## Database and object recovery

A hosted backup captures database rows and matching private objects under the same archive lock. The output contains private archive contents; keep it in restricted storage. Backup verification checks snapshot structure and digests. Restore requires a separately prepared private schema and matching empty bucket, configured explicitly in `.env.supabase`; use an isolated destination, not the live archive. An exact-snapshot receipt permits safe retry, while unrelated destination state is rejected.

```sh
npm run archive:hosted -- backup /restricted/path/mazi-snapshot.json
.venv/bin/python -m mazi.archive.hosted_ops verify /restricted/path/mazi-snapshot.json
npm run archive:hosted -- restore /restricted/path/mazi-snapshot.json --isolated
```

Read-only CLI help is available with `npm run archive:migrate -- --help` and `npm run archive:hosted -- --help`. The existing SQLite backup drill remains local-only; copying `mazi.sqlite3` cannot restore hosted objects.

## Verification and operating limits

Synthetic hosted verification covers concurrent D17 entry, rollback, privacy triggers, simultaneous claims and quota admissions, private byte reads, scratch-directory loss, unsupported-resource retention and database-plus-object recovery. Local regression tests remain available with `npm run test:backend`; `test:postgres` requires a separately provisioned isolated schema whose name ends in `_test`; its pre-mutation guard rejects the live `mazi` schema. Prepare that schema with the application migrations and restricted-role grants, then explicitly override the target:

```sh
MAZI_DATABASE_SCHEMA=mazi_contract_test npm run test:postgres
```

This override selects an existing test schema; it does not create one. The ignored `.env.supabase` supplies server credentials while the explicit schema override takes precedence. Never run synthetic mutation suites against an archive with real users. The opt-in hosted byte/HTTP journey also requires a trusted synthetic fixture belonging to the selected disposable archive; its old setup fixture is invalid after real cutover. Do not reuse it against the live archive. [Database evidence](../work/poteto/supabase-migration/database-implementation.md) and [design review](../work/poteto/supabase-migration/design-review.md) distinguish verified behavior from remaining acceptance work.

The application's accepted 20 GiB group/5 GiB contributor caps do not establish Free-plan capacity. [Supabase pricing](https://supabase.com/pricing), checked on 14 October 2026, includes 1 GB file storage, a 500 MB database, and 5 GB egress on Free. This project cannot promise the 20 GiB pilot allocation. No paid upgrade was provisioned. The local API and worker must remain running to process jobs; no cloud app/worker deployment is implied.

Explicit removals and checksum resets queue durable Storage deletions for retry. Arbitrary orphan collection is deferred until a quiescent maintenance boundary can prevent racing prepared assets. Backups preserve the matching object inventory, including such objects; disk exports and downloaded copies cannot be recalled by later revocation.
