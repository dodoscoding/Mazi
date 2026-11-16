# Issue 157: Past creations and writing retirement

## Scope and revisions

Started `/tmp/mazi-simplification-157`, branch `codex/simplification-157`, from
integration `0499ff3`; verified ancestry before changes. Implemented the approved
Past creations contract, APP_SIMPLIFICATION_SPEC and D28. Merged Photos/Add queue
integration at `e220070`, then viewer contribution controls/CSS scope correction
through `5d2aff1` at `7fe7edd`. Shared `gallery.js` remains untouched by this ticket.

Environment: Darwin arm64, Node v24.15.0, Python 3.14.7, Playwright Chromium v1243,
`MAZI_UNIFIED_PORT=8127`. Fixtures contain synthetic photographs and historical
stories/capsules seeded through offline domain calls before the server starts.
Normal unified fixtures remain free of creations to verify conditional omission.
The confirmed seams are actual integrated desktop/phone journeys plus existing
HTTP/domain ownership, timing, access and retirement contracts.

## Implemented behavior

- Settings shows Past creations only when current authorized reads return eligible
  content. The standalone reader preserves stored story recollections, sub-event
  descriptions, original photographs and story JSON exports. It shows eligible
  capsule metadata, opened content/photo/export and authorized deletion. Members can
  also withdraw only their own existing recollection from another creator’s story;
  this deletion-only action accepts no replacement text or author target.
- Canonical record URLs are `/past-creations?story=<id>` and
  `/past-creations?capsule=<id>`. Historical Stories/Capsules links replace their
  history entry and preserve the record parameter. A selected unavailable record
  does not fall back to unrelated content or a blank duplicate photo gallery.
- Sealed capsules expose no title, text, photograph or export before the existing
  server opening time, including to the author. Author deletion remains available.
  Original photographs use existing authorized archive preview/original paths.
- Requests abort on disposal; denied reads clear the authenticated UI. Scoped media
  URLs are revoked. Concurrent refreshes fence late response bodies. Successful
  deletion returns focus to the page heading; failures offer explicit refresh.
- Extracted the retained reader before replacing the old combined Memories mount
  with photo gallery and retained recap reads. Removed story forms, capsule forms,
  generated slideshow/video tools, sub-event editing and creation prompts. The
  existing event notebook still reads historical contributions but no longer writes
  stories. Independent live conversation/comment APIs and UI remain intact.

## HTTP retirement boundary

After existing origin/JSON/session checks, authenticated POST requests to
`/api/memories/create`, `/write`, `/note`, `/seal`, `/subevents` and `/video` return
410. GET `/api/memories/frame` also returns 410. Read/export, authorized deletion,
notification preferences and capsule opening-time checks remain unchanged.
POST `/api/memories/delete-recollection` is a narrow retained deletion boundary:
only group/story/revision fields are accepted; membership, current-user ownership,
existing contribution and revision are checked. Missing contributions do not create
blank records or increment revision. Other members’ text remains unchanged.

Offline domain methods remain available for legacy-storage tests and historical
fixture seeding; there is no application authoring or generated-media endpoint.
No schema, storage layout, personal archive or persisted content was migrated.

## Red and green

1. `a86081d` changed the existing HTTP contract to seed historical data through the
   domain and require retired writes to fail while reads/ownership remain valid.
   `.venv/bin/python -m unittest tests.backend.memories.test_memories_http.ApiTests.test_retired_writes_preserve_reads_ownership_and_export`
   failed with `200 != 410 : create`; `9f00136` made both HTTP tests pass.
2. `6dc073a` added real seeded desktop/phone acceptance. Before the reader existed,
   `MAZI_UNIFIED_PORT=8127 npx playwright test -c playwright.past-creations.config.ts`
   failed because the Settings Past creations link was absent. Reader extraction
   `94a73e3` made it pass 2/2 before removal of the old combined presentation.
3. `2182d6d` replaced obsolete authoring/draft tests with retained notebook
   read/retry/denial, retired-write, gallery/recap and old-link contracts.
   `7eb2923` removed the combined authoring presentation. Later regression commits
   cover ordinary original-media paths, exports, late response fencing, cleanup,
   missing content and focus after deletion.
4. `1832a0e` exposed deletion-only own-recollection withdrawal: its HTTP contract
   failed at the missing endpoint (404 instead of revision conflict 409).
   `cadfbdf` exposed the absent removal action in desktop/phone historical reads.
   `848c54b` preserves this existing deletion right without reopening authoring.
   The HTTP contract checks stale revision, forbidden text/other-author fields,
   missing contribution, no blank creation, foreign membership and other-text preservation.

## Verification and evidence

- Final seeded command:
  `MAZI_UNIFIED_PORT=8127 npx playwright test -c playwright.past-creations.config.ts --reporter=json`:
  **2/2 pass**, no skipped/flaky tests, after merging `5d2aff1`. Includes build and
  typecheck. Covers historical literal/XSS-safe text, original photographs, opened
  capsule/photo, both JSON exports, own-recollection withdrawal/cancellation, sealed author read/export/photo denial despite
  client-time tampering, foreign deletion denial, own story/capsule deletion, old
  selected-story navigation, no duplicate gallery, and denied-read cleanup.
- `MAZI_UNIFIED_PORT=8127 npx playwright test -c playwright.unified.config.ts tests/event-notebook.spec.ts -g 'event title links|standalone'`: **4/4 pass** after Photos merge. Retained notebook and sample/standalone viewer boundaries.
- `MAZI_UNIFIED_PORT=8127 npx playwright test -c playwright.unified.config.ts tests/entry.spec.ts tests/clarity-workspaces.spec.ts -g 'Settings|settings opens'`: **20/20 pass** after Photos merge. Includes empty eligibility, real Settings navigation, membership, export, departure and source withdrawal.
- Earlier full unified run: **93/104 pass**. Its 11 failures were stale pre-155
  Settings aliases, the removed viewer composition, an old recap navigation
  assertion and mutable cross-project import fixture assumptions. These assertions
  were corrected without weakening access/content contracts; the failed paths are
  covered by the green focused commands above. A full final unified rerun was not
  repeated after those focused checks.
- `npm run test:dom`: **222/222 pass** after merging the independent Add CSS scope
  fix. The earlier 221/222 result failed only that unrelated selector contract.
- `.venv/bin/python -m unittest tests.backend.memories.test_memories_http tests.backend.memories.test_memories tests.backend.memories.test_advanced tests.backend.social.test_comments_http`: **21/21 pass**. Capsule timing/read/export/photo/revocation and independent conversation writes remain covered.
- `npm run test:unit`: **23/23 pass**.
- `npm run lint`, build/typecheck and `git diff --check`: pass.
- `npm run check:budgets`: aggregate scripts **422.2 KiB gzip / 420 KiB**, with
  other caps passing. Ceiling unchanged; final obsolete-feature removal remains.
  This slice reduced combined script size before the newer Photos/viewer additions.

[Final browser results](issue-157-browser-results.json),
[desktop reader](past-creations-desktop.png),
[phone reader](past-creations-phone.png).
Screenshots were visually inspected. Historical generated artifacts were restored.

## Limits

Synthetic local acceptance only; no deployment, purge or production milestone
acceptance. Existing database authorization and time policies remain authoritative.
The final two-primary-view navigation and retirement of remaining independent
legacy surfaces belong to later tickets. The aggregate bundle ceiling is still
exceeded by 2.2 KiB and requires the planned final deletion work.
