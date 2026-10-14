# Phase 3 local operations and release boundary

Historical experiment record. The active application now runs with `python -m mazi`; source and test links below point to their consolidated locations. Original acceptance claims and evidence remain historical.

This runbook applies to the localhost review experiment. The production incident process, named on-call owner, provider alerts, support contact and rollback decision-maker must be assigned before the invite-only release. The technical lead owns that assignment in the two-developer plan.

## Supported local profile

The import engine accepts ZIPs up to 128 MiB compressed and 512 MiB expanded, with JPEG/PNG photos up to 25 MiB and 24 million decoded pixels. HEIC, video and other codecs receive explicit unsupported outcomes. Review and export cap visible assets at 1,000; export caps original bytes at 128 MiB. The selected release profile is 100,000 logical items and is not supported by this local implementation. The browser evidence covers desktop Chromium and Pixel 7 emulation, not the full Chrome/Firefox/physical Android matrix.

## Triage

1. Check `/health` for database reachability. It contains no group data.
2. Sign in as a group administrator and inspect `/api/review/metrics?group=GROUP_ID` for visible count, retained original bytes, item outcomes and oldest active import age. Use opaque IDs in incident notes; never copy filenames, messages, tokens or original bytes into logs.
3. If imports stop, stop the server, preserve the data directory, then restart the worker and inspect per-item reports. The Phase 2 lease and retry rules still apply. Do not delete objects to clear a queue.
4. If access or data-loss behavior is suspected, stop serving the affected archive. Keep the data directory and a read-only copy for analysis. Reproduce using synthetic actors before making a repair. Do not announce recovery until original hashes, source relationships and current withdrawal state are checked.

## Offline backup and isolated restore

Stop the local server and worker before creating a backup. Keep backups in a restricted directory outside the archive. The commands below refuse an existing destination and validate checksums and SQLite integrity. Restore into a new isolated directory; inspect withdrawn state before serving it.

```sh
.venv/bin/python -m mazi.archive.ops backup .mazi-imports /secure/new-backup
.venv/bin/python -m mazi.archive.ops verify /secure/new-backup
.venv/bin/python -m mazi.archive.ops restore /secure/new-backup /secure/new-restore
```

The local drill does not meet the release RPO/RTO targets. Backups copied before a later withdrawal can restore old access because cross-backup tombstone replay is not implemented. Do not restore an older backup into service until current deletion/withdrawal decisions are re-applied and checked. Withdrawn originals and source ZIPs remain on disk in this experiment; physical purge and backup expiry need a production retention job and provider-specific validation.

## Release hold

Do not invite the real group or claim production availability from these tests. Release still needs M1/M2 provider integration and beta acceptance, T01–T10/T14 against the release candidate, held-out suggestion evaluations, 100,000-item load measurements, object-aware hosted recovery and rollback drills, cost and region verification, supported-device accessibility, privacy/legal decisions, named incident and support owners, and product-owner signoff.
