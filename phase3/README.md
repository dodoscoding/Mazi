# Phase 3 local archive review

Phase 3 adds a runnable local review screen to the Phase 2 importer. Start it from the repository root with `.venv/bin/python -m phase3.server`, then open `http://127.0.0.1:8002/review`. Sign in and import on `/`; the two screens share one local archive. The server binds only to localhost. Use synthetic data: this is not a hosted production service.

The screen provides a paged Timeline with keyword search across titles, places, filenames and supplied message context; reviewed date/place/title corrections; approved On This Day items; perceptual duplicate suggestions with explicit merge, split, dismiss and rendition selection; deterministic event suggestions with acceptance, rejection and undo; individual source-record removal, member departure; and a ZIP export containing currently visible originals, source records and corrections. Group membership and current contribution availability are checked on every read and mutation. Withdrawn content is omitted from Timeline, suggestions, events and export. Original source records are not changed by a review decision.

Suggestions are conservative hints, not automatic merges. The duplicate filter compares grayscale structure, average color and aspect ratio. The event filter groups only records with one consistent evidenced day and place; conflicting evidence needs a reviewed correction. These heuristics have synthetic behavior tests, but not the held-out M3 precision and usefulness evaluations. A review action is audited in the local database. Approved anniversaries require an exact reviewed calendar date.

Run checks with `.venv/bin/python -m unittest discover -s phase3/tests -v` and `MAZI_PYTHON="$PWD/.venv/bin/python" npm run test:archive:browser`. The browser suite uses an ephemeral archive on desktop Chromium and Pixel 7 emulation, runs an accessibility scan, and exercises actual import and private media endpoints. The offline backup functions in `ops.py` copy the SQLite snapshot and retained files to a new directory, verify checksums and database integrity, and restore into an isolated directory. Stop the server and worker before taking an offline backup. The test suite drills restore after withdrawal and detects a corrupted object.

## Limits and remaining release gates

- Review and export are bounded to 1,000 visible assets per group; export is further bounded to 128 MiB of originals. The 100,000-item M3 profile is not met. The UI renders paged cards but has not been validated at that release profile.
- On This Day uses the local server's calendar day. A production group timezone and clock policy are not yet configured.
- Review runs on local SQLite and files. The agreed Next.js/PostgreSQL/Supabase production integration, real provider access tests for these new routes, region and provider-term verification, monitoring and alerts, cost measurements, and real-group acceptance are open.
- Individual removal and withdrawal deny new access immediately. Source ZIPs, withdrawn object bytes and backup copies are retained locally. Physical purge scheduling, group/account closure policy, and tombstone replay across older backups are open. Do not use this local store for personal archives.
- The offline restore drill is not an offsite backup, availability measurement, rollback drill, or an RPO/RTO demonstration. No production incident owner or release decision-maker has been assigned by this implementation.
- The roadmap's T01–T10/T14 release-candidate checks, 200-pair duplicate evaluation, 50-boundary event evaluation, supported-device matrix and product-owner approval remain open. M3 and production-gate checkboxes stay unchecked until those gates pass.

See [verification](VERIFICATION.md) for exact local evidence and the [operations guide](OPERATIONS.md) for health checks, offline backup and incident steps.
