# Chat photo dates verification, 24 October 2026

Branch `fix/chat-photo-dates`, cut from `origin/main` 548ba3f. Decision [D23](../../../docs/DECISIONS.md#chat-photo-dates-24-october-2026).

## Measured

Each bug has a failing test committed before its fix.

| Bug | Failing test (before) | Fix |
| --- | --- | --- |
| Discord bot photos undated | `test_atlas` Discord tests: `sharedAt.local` was `None` for new and old-shape rows | `atlas.py` resolves raw-only assertions on read. `sources.py` keeps the raw-only stored shape so re-syncs keep the same fingerprint (review change, see below) |
| WhatsApp 04/05 judged per message | `test_atlas` WhatsApp tests: `local` `None`, `ambiguous` `True` although 23/05 was in the chat | `adapters.date_orders` and `settle_date_order`; Atlas settles the order once per uploaded chat |
| One undated or conflicting photo blanks a memory | `test_atlas` range tests: `('2020-01-02 · some dates unknown', None)` and `('Date not recorded', None)`; `chronology.test.ts` partial memory `unknown` | Server card date and year come from dated photos; client sharing range ignores undated photos |
| EXIF parsed in one format | `test_engine` EXIF tests: `local` `None` for `2010-02-03 04:05:06.250` with OffsetTimeOriginal | `engine.exif_capture` |
| Timeline "in undefined." | `tests/dom/timeline-dates.test.mjs`: subtitle `1 moment in undefined.` | Subtitle reads `1 moment, none dated yet.` |

The first full backend run after the fixes failed six tests. Four expected the old rule; they now expect D23 ranges and the additive timeline `dates` field. Two exposed a real regression: settling date order held every origin in memory, 36,608,540 bytes against a 4 MiB budget. Atlas now streams two passes and keeps only the proven orders per chat. That budget test now passes.

Gates on the final head, run one at a time:

| Command | Result |
| --- | --- |
| `npm run build` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run check:docs` | PASS, 16 documents, 182 links |
| `npm run test:dom` | 133 pass, 0 fail |
| `npm run test:backend` | 532 tests OK, 12 skipped, 356 s |
| `npm run test:unit` | exit 0 (not in CI) |
| `git diff --check origin/main...HEAD` | clean |

Browser evidence. `evidence/seed_serve.py` seeds a local archive with production's shape: chat photos only, no EXIF. It includes a WhatsApp chat whose photo lines are all ambiguous (04/05, 05/04) with a later 23/05 text line. Two Discord bot photos are imported through `poll_source`; one is rewritten to the old `{raw, source}` assertion that production rows have. A memory groups a dated chat photo with an undated manual photo. `evidence/drive.mjs` drove the built app in headless Chromium at 1440×1000. Output is in `evidence/drive-output.json`; there were no page errors and no HTTP errors.

- Home (`evidence/home.png`). Both Discord photos read "Shared on Jan 2, 2024", including the old-shape row. WhatsApp photos read "Shared on Apr 5, 2024" and "Shared on May 4, 2024".
- Timeline (`evidence/timeline.png`). "4 moments in 2024." All four rows sit under 2024, including the memory with an undated photo.
- Memory (`evidence/memory.png`). "Lake evening" reads "Shared on May 4, 2024 · Capture date unknown" with "Some photos have no capture date."

## Not verified

- Production data. Nothing was read from or written to production. The claim that the 153 production Discord photos gain dates rests on the read-path test against the old assertion shape, not on production rows.
- How many production WhatsApp photos are ambiguous, and whether their chats contain a deciding day. Settlement uses only timestamps the archive kept (photo messages and up to two neighbours each side), not every line of the original export.
- Discord times are UTC. A photo shared just after local midnight east of UTC shows the previous day. Not measured against real users' timezones.
- Hosted Postgres. Backend tests ran on SQLite; the two-pass Atlas read was not timed on Supabase.
- Before screenshots were not captured; the committed failing tests are the before evidence.
- Phone layout and Firefox were not driven.

## Review change

Review reverted the import-time change in `mazi/sources/sources.py`. The stored `shared_at_assertion` feeds the origin fingerprint, so storing the resolved shape would make re-syncing an already-imported Discord channel fail with `IDENTITY_CONFLICT` for its existing photos. The read-path fix covers both shapes. `test_discord_bot_photo_has_a_resolved_share_date` now asserts the stored shape stays `{raw, source}`. After the change: `tests.backend.test_atlas`, `sources.test_discord`, `sources.test_api`, `imports.test_engine`, `imports.test_adapters` pass, and the full backend suite was rerun (result below).
- Full backend after the review change: Ran 532 tests in 353.075s, OK (12 skipped).
