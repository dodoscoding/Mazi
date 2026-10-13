# Historical import engine

Phase 2 implements a runnable local import engine and browser workflow. It reuses `phase1` accounts, sessions, invitations and memberships, with new group-visible archive tables and authorized media endpoints. It does not change the older experiment's staging policy or migrate its media. Next.js/PostgreSQL/Supabase integration and the real closed beta remain roadmap gates.

## Run

From the repository root, using Python 3.11 or newer:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r phase1/requirements.txt
.venv/bin/python -m phase2.server
```

Open http://127.0.0.1:8002. Create an account and group, invite a second synthetic member, choose a source and stable account label, then select an export ZIP. Review the inventory and select **Start importing to group**. Each validated photo, original and source context becomes readable by active group members immediately. This confirmation starts ingestion; there is no post-ingestion publication gate.

The server starts one worker with its own database connection. Progress survives restarts. Re-selecting the same ZIP, source, account label and date options resumes the same run. Cancellation preserves successes. Withdrawal removes this run's successful contributions from group access; independent contributions remain. Removing a member cancels their unfinished jobs and withdraws their contributions permanently, including after they rejoin.

`MAZI_IMPORT_DATA_DIR` defaults to `.mazi-imports`; `MAZI_IMPORT_PORT` defaults to `8002`. The server binds to localhost only. Use synthetic data. The local database and original archives have no production backup, retention scheduler or remote access policy. Withdrawal revokes access; it does not promise physical erasure of retained source ZIPs or backup bytes.

## Fixture scope and format matrix

All fixtures are generated synthetic records in [adapter tests](tests/test_adapters.py), [engine tests](tests/test_engine.py) and [browser tests](tests/browser.spec.ts). Fixture version 1 was verified on 6 October 2026. No real exporter version or consented personal archive has been verified.

| Adapter | Implemented fixture shape | Explicit limits |
| --- | --- | --- |
| Manual | ZIP containing JPEG/PNG files, using the same normalized item and worker as chat exports. | 100 files/run. This harness does not replace the legacy single-file upload UI. |
| WhatsApp | UTF-8 Android-style `date, time - sender: text` and iOS-style `[date, time] sender: text`; multiline Unicode; `<attached: filename>` and `filename (file attached)`; `<Media omitted>`. | Numeric slash/dot dates; English AM/PM and attachment markers. Ambiguous day/month stays unresolved unless explicitly selected. Two-digit years use 2000-2099. Labels do not establish account identity. Text that mimics an export header remains a format ambiguity. |
| Messenger | `message_N.json` files with `messages`, participant labels, millisecond timestamps, photo/video/audio/file/GIF/sticker URI fields and supplied reactions. | JSON only; HTML and encrypted-history formats not verified. Media URIs resolve relative to the ZIP root. Original JSON survives in the retained ZIP. Text uses reversible UTF-8/Latin-1 repair where applicable. |
| Discord user package | `messages.csv` with `ID,Timestamp,Contents,Attachments` and optional adjacent `channel.json`. | Requester's sent messages only. URLs stay missing and are never fetched. Locally supplied relative paths can resolve inside the ZIP. Whitespace separates multiple attachment references. No bot or server integration. |

| Media | Outcome |
| --- | --- |
| JPEG/PNG matching extension and signature | Decode, validate size/pixels, preserve immutable original, create an orientation-correct metadata-stripped JPEG preview. |
| Invalid JPEG/PNG bytes | Failed item with a reason; no available media. |
| HEIC, WebP, GIF, animated PNG, MP4/MOV/WebM and other codecs | Unsupported, never presented as playable. No video support claim. |
| Absent file or remote attachment | Missing media. No URL fetching, credentials, redirects or network requests. |
| Message without attachment | Skipped/no media; may provide bounded context to a nearby photo. |
| Unreferenced export files | Explicit unsupported outcome. No implicit guessing by basename. |

Limits for this local archive experiment: 128 MiB compressed, 512 MiB expanded, 50,000 ZIP entries, 50,000 message attachments, 32 MiB per metadata entry, 25 MiB per photo, 24 million pixels, 200:1 maximum ZIP expansion ratio. ZIP storage/deflate only. Reject unsafe/duplicate paths, symlinks, encryption and nested archive payloads. Files are read in place, never extracted. At most 2 GiB of source ZIPs per group; retained media budgets are 20 GiB/group and 5 GiB/contributor. These archive limits do not revise the production M0 limits or authorize real archives.

## Contracts and recovery

`NormalizedImportItem` is versioned and shared by all adapters. It carries source/account/conversation/attachment identity, local or external references, original filenames, separate capture/share assertions, context, reactions, raw-source locators, warnings and partial coverage. The authenticated run supplies group/owner; adapters cannot choose either.

Source IDs are scoped to contributor, group, source account and conversation. Without stable IDs, manifest digest plus source locator and attachment position defines the retained record. Overlapping ambiguous exports remain separate records marked `UNCERTAIN_CROSS_EXPORT_IDENTITY`. Byte-identical images share one group-local asset while distinct appearances keep their own origins. Replayed stable IDs with conflicting evidence fail explicitly. Preview bytes never include source EXIF; capture assertions and raw GPS evidence remain separately attached to the origin. Unknown timezones never become UTC. Source labels never become membership or attendance assertions.

Uploads use durable byte offsets and checksum verification. Scans persist item/checkpoint batches; after restart they reparse bounded source metadata and skip committed locators. This is checkpointed persistence, not streaming JSON parsing. The local default worker scans 500 outcomes per batch. No jobs run until inventory confirmation.

Each pending item is one version-1 ingestion stage. A database transaction claims a random lease for 60 seconds, with three attempts and exponential retry backoff. There is no automatic lease renewal: a stage that exceeds the lease must be retried. Completion rechecks current lease, run state, contribution withdrawal and current membership. Successful output and its origin commit with the item outcome. Original/preview objects are written and flushed first using immutable group-scoped keys. A crash before commit can safely repeat that write. A second completion cannot repeat its effects. A reconciler deletes only hour-old unreferenced objects while no worker item is processing. It never collects a retained asset.

Reports reconcile discovered items into pending, active and terminal outcomes, show separate unique-photo counts, and page 100 rows at a time. Scan cancellation can leave an incomplete inventory: `scan_complete=false` distinguishes the discovered prefix from the unknown remainder. Downloaded reports reflect a live run and should be downloaded after completion for a stable receipt. Original ZIPs preserve raw evidence for later parser work. Parser upgrades need explicit reconciliation; replacing source data behind a run is unsupported.

## Verify

```sh
.venv/bin/python -m unittest discover -s phase2/tests -v
.venv/bin/python -m unittest discover -s phase1/tests -v
npm ci
npx playwright install chromium
MAZI_PYTHON="$PWD/.venv/bin/python" npm run test:imports:browser
npm run lint
npm run build
npm run check:docs
git diff --check
```

The browser suite uses an ephemeral store and real HTTP/media endpoints on desktop Chromium and Pixel 7 emulation. It checks inventory before ingestion, per-item success/missing/unsupported outcomes, safe rendering of imported markup, report download, replay, withdrawal and automated accessibility. [Verification](VERIFICATION.md) records results and outstanding gates. CI also runs the Python engine and browser suites.

## Remaining release gates

- M1's accepted production stack, provider authorization, object retention/recovery and group lifecycle must precede real archive use. Local SQLite checks are not database RLS proof.
- Acquire and hand-review consented iOS/Android WhatsApp, Messenger and Discord fixtures in restricted storage before advertising exporter compatibility. Broader locales and codecs require their own fixtures.
- Connect imports to the production Atlas, Timeline, Search, correction and export routes. The local import gallery is separate from the older prototype and memory UI.
- Validate actual worker memory, interrupted large-media runs, physical Android Chrome/Firefox, and the database/object restore drill. No measured hosted cost or availability claim is made.
- Complete the one confirmed friend-group beta and group-access walkthrough with the product owner. No invitations or messages were sent to real people by this implementation.
