# Mazi test and acceptance plan

T01-T15 define production acceptance and remain uncompleted. The local Atlas prototype has a separate [browser verification record](../work/design/atlas/VERIFICATION.md). The [Python memory-loop experiment](history/identity/README.md) has behavior tests for a different sharing policy. Neither synthetic test set satisfies production membership, ingestion or lifecycle scenarios. Documentation verification remains in [the planning evidence](../work/poteto/product-plan/VERIFICATION.md).

The [Phase 2 verification record](history/imports/VERIFICATION.md) maps local synthetic adapter, recovery, access and browser checks to the M2 scenarios. It includes 20,000-record replay/cancellation fixtures and current group-sharing behavior. These are local SQLite/HTTP checks; T03/T04/T06/T07/T09 production acceptance still requires provider integration, real representative exports, recovery evidence and the beta walkthrough.

## Evidence rules

Each implementation change records the exact commit, command, fixture version, environment, expected result, actual result, and artifact location. Tests use both allowed and denied cases. A build or a mocked success response is not proof that automatic group sharing, storage access, or recovery works.

The Atlas scaffold provides `npm run build` with typechecking, `npm test`, and `npm run check:docs`; no linter is configured. M0 separately establishes provider access-experiment commands. This document names behaviors instead of inventing package scripts. Database policies need real database tests. Browser journeys need a running app and actual private object delivery. Native behavior needs supported devices, including iCloud and permission changes.

## Acceptance scenarios

Use Alice, Ben, and Cara as active members of the same group, an active administrator, a removed member, an outsider, and a member of a separate synthetic group. Reuse these actors across API, database, object, search, and browser checks.

| ID | Scenario | Passing evidence | Gate |
| --- | --- | --- | --- |
| T01 | Create, expire, replay, revoke, and concurrently accept invitations; remove membership; attempt direct database/API writes into another group. | A single acceptance succeeds, invalid invitations fail, cross-group access and owner/group reassignment are denied. All active members, including administrators, can read available group content; removed members and outsiders cannot. | M1 onward |
| T02 | Alice imports media with GPS and source context. Exercise original, thumbnail, filename, source badges/dates, captions, counts, search, map, export, AI, and cache paths as each actor. Add a sub-event and a new member. | Each successfully ingested item and its available context/metadata appear automatically for every active group member, including the administrator and later members, without a Publish action. Outsiders, removed members, and other groups receive no bytes, metadata, counts, or child existence. Processing failures are explicit; no human or batch-wide gate delays successful items. | M1 and each new read path |
| T03 | Resume an interrupted upload; repeat the same manifest and stable source occurrence; import identical bytes shared on two dates; import a partial overlap containing only the second of two indistinguishable same-time messages. | Exact manifest/stable-ID replay adds no origin/job/contribution. Distinct known occurrences remain distinct. Ambiguous cross-export records remain retained with unresolved correspondence and are never silently collapsed. Counts and hashes match the fixture. | M1, extended M2 |
| T04 | Kill a worker before and after storage writes and database commit; expire a lease; race retries; cancel a 20,000-item run containing corrupt files. | No lost successful items or repeated side effects. Every discovered item has one current outcome. Only unreferenced temporary objects are collected. | M1 recovery, M2 full suite |
| T05 | Ben imports a compressed copy. Alice imports a better original into the same group; a separate synthetic group has matching bytes. Merge and split a wrong near-duplicate. | As Alice's item becomes available, rendition, origins, and counts update for the group automatically. Other-group data is never revealed or selected. Undo restores variants, contribution ownership, availability, and memory links. | M1 isolation, M3 similarity |
| T06 | Use capture time years before share time, date-only values, missing timezone, DST overlap, invalid EXIF, edited dates, ambiguous locales, and user corrections. | Raw assertions survive. Timeline uses the selected capture estimate with its label. Unknown dates stay undated. Sharing time stays separate. | M1, archive cases M2 |
| T07 | Run all declared adapter fixtures, malformed archives, path traversal, expansion bombs, repeated names, expired URLs, and forbidden remote addresses. | Inventory equals expected available/missing/unsupported counts. No path escape, unbounded expansion, arbitrary fetch, or invented source content. | M2, extensions M4 |
| T08 | Complete keyboard and screen-reader invite, upload, retry, automatic sharing, post-import correction, Home, Timeline, and media detail flows on supported narrow/wide layouts. Exercise 3D and conventional controls. | Focus remains usable, controls are named, progress is announced, and contrast meets the selected standard. Reduced motion and equivalent conventional controls preserve access. Scene complexity adapts by device. A ten-photo memory is usable without a mouse or camera manipulation. | Prototype, M1, full M3 |
| T09 | Withdraw a contribution or processing consent during processing and an in-flight answer; remove a member; delete one of two independent contributions; withdraw the last available child of a derived Memory; restore a backup after deletion. | New affected access stops after policy commit. Pending output is rejected when stale. URLs expire within policy. Derived fields are recomputed or omitted; derived-only empty Memories disappear. Independent eligible copies remain. Restore reapplies tombstones. Cancellation preserves already available items unless explicitly withdrawn. | M1 lifecycle, full M3, AI M5/M6 |
| T10 | Review an event candidate containing neighboring trips, different locations, conflicting dates, and withdrawn or cross-group evidence; reject, split, and accept it. Test On This Day. | Imported items are already group-visible. Suggested event grouping requires review; reasons are inspectable and rejection durable. Suggestions exclude inaccessible evidence. Anniversary items use accepted sufficiently precise dates. | M3 |
| T11 | Query combined place/person/object filters with hidden lookalikes; turn AI off; personally hide media; remove a manual tag applied by another contributor; retry import/tagging; withdraw recognition consent. | Retrieval remains permission-filtered. Personally hidden items do not resurface for that member. Subject disassociation removes People/search/summary links and prevents silent retagging without deleting independent media. Hidden clusters are absent. Manual archiving still works. Withdrawn embeddings cannot affect output. | M5 |
| T12 | Sync selected Apple resources with iCloud delays, limited/denied permission, edits, Live Photos, network loss, and app restart. Backfill only selected Discord channels. | No unselected upload or channel import. Resume preserves occurrence identity. Changed permissions halt new reads. Source deletions do not silently delete retained Mazi data. | M4 |
| T13 | Ask answerable, unanswerable, earliest-ever, conflicting-date, hidden-context, and prompt-injected questions; revoke evidence mid-answer. | Every factual claim cites accessible support; incomplete history is labeled; unsupported answers abstain; source instructions do not alter authorization or trigger actions. | M6 |
| T14 | Load the release profile; restore database and objects; deploy and roll back; exercise quota limits, provider outage, monitoring, and redacted logs. | Budgets below pass, originals recover, no sensitive log payloads appear, optional model outage does not block core imports, alert/support owners respond in a drill. | M3 |
| T15 | Open a capsule using a changed client clock, direct URL, search, thumbnails, AI, export, notifications, and a removed member before/after unlock. | Server time and current group policy decide access on every path. Locked bytes and metadata never enter an accessible derivative. | M7 |

## Local shared-code entry acceptance

[D17](DECISIONS.md#shared-code-entry-decision-14-october-2026) replaces invitation entry for the local Atlas app. Extend T01 with wrong-code denial, atomic normalized-name creation, immediate existing-name resumption on another browser, session persistence/expiry/logout, current configured-group membership, and stable legacy user ownership. Preserve the production invitation scenarios separately. Test introduction completion once per profile across browser changes and About revisits. Signed-out direct routes, hash routes, and sample mode must show only entry. Run desktop and phone checks against temporary synthetic archives. Accepted code-holder impersonation is a product constraint, not a failed check.

## Local interface clarity acceptance

[D26](DECISIONS.md#interface-clarity-1-november-2026) extends the local T08 journey. On desktop and phone, verify exactly Ana sayfa, Keşfet and Grubumuz in one visible main navigation, with Ekle outside it. Home has one featured memory with matching photo, title and primary-action destinations, plus secondary event notes and one directory link; it has no Atlas control stack or unsupported activity claims. Cover populated, empty, loading and retry states. Verify the Bul, Gez and Birlikte hatırla groups. Open direct and hash `/people` and `/settings` links from Keşfet, assert the canonical target heading has focus, and use Back to return without an alias history entry. Open Kaynak bağlantıları from Grubumuz and assert its source heading and parent section. Refresh in the background without replacing a source draft or stealing focus. Repeat at 320 pixels and with reduced motion. [N1 evidence](../work/poteto/social-navigation/VERIFICATION.md) records synthetic results.

Follow named links to Search, Atlas/map, Timeline, People, stories, annual recap, capsules, questions, corrections, imports, sources, membership and help. Stories, recap, capsules and People must focus their actual controls rather than the top of a long gallery. Check current parent indication, keyboard focus, 320px overflow, touch targets, reduced motion and settled-page accessibility.

Exercise canonical `/atlas` and legacy root selection/portal links, direct memory/photo/notebook refresh, Back/Forward and return focus. Reuse background-retention, access-loss and group-switching contracts. Run direct `/places` Discord callback tests with the new shell. Record exact commands, environments and captures in [the clarity verification](../work/poteto/interface-clarity/VERIFICATION.md). Synthetic browser evidence does not satisfy physical-device or production milestone gates.

## Local photo-facts acceptance

A1 extends the synthetic T08 reading journey. A reviewed photo shows its capture day and Istanbul beneath the thumbnail in both gallery modes. A sharing-only Discord photo shows its sharing day, UTC qualification and unknown place. Switching the Viewer photo changes both facts. Home, Atlas/list, Timeline and detail show consistent summaries, including conflicts and missing children. Two-city and partially located groups never acquire a borrowed pin. Ambiguous WhatsApp days stay explicit, and EXIF offsets do not shift the calendar day. Hidden photos, source withdrawal and removed membership retain the existing read restrictions.

Run `tests/backend/test_atlas.py`, `test_atlas_place.py`, `test_atlas_projection.py` and `archive/test_chronology.py`; the chronology unit and photo-evidence DOM contracts; and the photo-facts case in `tests/memory-detail.spec.ts` on desktop and phone. Exact legacy-projection assertions remove only the two additive photo fields before their byte comparison. Dedicated assertions cover the new evidence values. The projection query-count and memory budgets remain enforced. [A1 evidence](../work/poteto/photo-evidence/VERIFICATION.md) records revisions, commands and synthetic screenshots. Physical-phone and five-friend discovery acceptance remain separate from these synthetic checks.

## Local Search date-basis acceptance

A2-read extends T08 with a sharing-only Discord photo. A legacy dated bookmark returns no capture match, while explicit sharing and chronology return the photo on its displayed sharing day. Cover both endpoints of the range, UTC/local midnight, any later sharing origin, conflicting capture days without invented gap matches, and ambiguous WhatsApp day order resolved only by permitted evidence in the same import/conversation. Repeat keyword and related modes and the streamed path above 1,000 photos. Keep byte, time and origin-count failures atomic. Hidden-memory children and unavailable origins cannot enter results or facets.

The Search DOM contracts verify the fresh chronology default, old bookmark behavior, explicit basis changes, pagination, URL restore and per-photo text without an Atlas request. The unified browser contract imports a synthetic Discord ZIP through the real API and checks desktop/phone UI filtering and refresh. [A2 evidence](../work/poteto/photo-search-corrections/VERIFICATION.md) records commands and synthetic captures. Selected-photo correction writes and reviewed-place export acceptance belong to the following A2-write delivery.

## First design experiment

D15 confirms a concept image followed by a working Home-to-memory/photos/context prototype using synthetic content. On 5 October 2026 the owner reported positive feedback from 2-3 friends; no raw study record or precise device inventory was supplied. Record what they can discover unaided, confusion with controls, enjoyment, and willingness to return. This experiment tests the proposed experience; it does not demonstrate retention or production readiness.

Inspect actual 3D interactions, loading/failure fallback, phone input, conventional navigation, and reduced motion. Set measurable rendering budgets against representative devices before claiming smoothness. Static concept images establish visual direction only; motion and usability require the browser prototype. Atlas and synthetic local assets are selected for the D16 experiment; production assets and device acceptance remain open.

## Proposed performance and reliability budgets

These numbers are M3 acceptance targets. M0 records delegated M1 limits and the owner-confirmed €75 operating ceiling in [M0 acceptance](M0_ACCEPTANCE.md); hardware, hosting performance, and cost feasibility still need measurements. M2 measures a baseline. A budget change requires a recorded decision before release, not a post-failure claim that the target passed.

The M3 launch profile is 100,000 logical media items in one group, 20 concurrent active sessions, and one 20,000-item import manifest. Browser checks use a documented mid-range laptop and phone on a 20 Mbps connection with 100 ms simulated round-trip latency. Server checks record region, worker size, database tier, cache state, and codec mix.

| Metric | Proposed budget | Measurement |
| --- | --- | --- |
| First usable timeline page | p95 within 2 seconds with 100 thumbnails. | 30 cold/warm browser runs after sign-in under the agreed network profile. |
| Timeline/filter API | p95 under 500 ms, error rate below 1% at profile load. | 15-minute run with access policies enabled; exclude neither denied requests nor joins silently. |
| Keyword search | p95 under 1 second. | Fixed query set over the 100,000-item profile. |
| Semantic retrieval at M5 | p95 under 2 seconds before answer generation. | Fixed authorized/hidden candidate mix and combined filters. |
| Ready preview | p95 within 30 seconds after a supported image finishes upload under the agreed load. | Record upload completion, queue delay, and preview availability separately. Video is unsupported in M1 and needs a fixture-backed codec budget before later enablement. |
| Import memory | Less than 1 GiB peak RSS per worker for the agreed image/archive profile. | Sample the worker across a streamed 20,000-item manifest; bounded archive expansion remains enforced. |
| Worker recovery | Eligible interrupted jobs resume within 5 minutes of worker restoration. | Kill/restart drill with recorded lease expiry and item counts. |
| Pilot production availability objective | 99.5% per month for authenticated browsing and ingestion. | Synthetic authenticated checks; external source outage is reported separately. Not a contractual SLA. |
| Recovery objectives | RPO at most 24 hours, RTO at most 8 hours. | Restore database and retained objects into isolation, reapply deletions, compare hashes and relationships. |

Compare baseline and changed revisions using the same fixtures and environment, interleaving runs where practical. For a new feature with no baseline, use its absolute budget and state that comparative performance is unavailable. Do not claim a speedup between unlike scenarios.

## M0 and manual pilot evidence

M0 database and storage denial evidence must use actual provider boundaries. Test another active member, administrator, outsider, removed member, and a separate synthetic group. Cover owner/group reassignment, per-item availability with a pending neighbor, and withdrawal with an independent eligible copy. The [provider suite](../tests/m0/access.test.mjs) passes 9/9 checks after fresh migration replay. [M0 verification](../work/poteto/m0-acceptance/VERIFICATION.md) records the run and its production limits.

The M1 profile is at most 10 active members, 10,000 items, 20 GiB group originals/previews, 5 GiB/member, 100 JPEG/PNG files/run, 25 MiB/file, and a 24-million-pixel decoded-image target. Enforce the hard caps and explicit UNSUPPORTED outcomes in the M1 ingestion pipeline. Archive bytes and video duration are 0 supported. M0 fixtures do not prove a complete media worker.

Selected browser targets are stable Chrome and Firefox on desktop and Android phones. Record versions and physical hardware separately from emulation. iOS is deferred. Existing Chromium desktop and iPhone emulation tests establish only their recorded synthetic environments. M0 can close its browser gate with recorded desktop Chrome/Firefox and phone-emulation runs plus the declared Android matrix. Physical Android validation is required before the M1 pilot. Live reduced-motion changes, keyboard equivalents, loading/error recovery, and the ten-photo M1 journey still require their applicable evidence.

## Quality evaluations

Perceptual dedupe uses a labeled set containing recompression, crops, edits, burst frames, screenshots, and unrelated lookalikes. M3's suggested-pair precision target is at least 95% on a held-out set of at least 200 labeled pairs. Human review remains mandatory. Report recall separately so high precision is not achieved by silently suggesting nothing.

Event suggestions use at least 50 reviewed event boundaries from the launch group and synthetic fixtures; test isolation with a separate synthetic group. The proposed useful-suggestion target is 80% accepted with only title/date edits. Record split/merge rates and where inaccessible evidence would change a candidate. No score accepts a suggested grouping automatically; this is separate from immediate sharing of imported items.

Semantic search uses at least 100 held-out questions with authorized relevant results. Target recall@10 of at least 85%. Keep privacy-denial cases separate and require zero leaks. Face recognition needs a separately approved consented evaluation set and thresholds before enablement; search may launch without it.

Memory AI uses at least 100 answerable and 50 unanswerable/adversarial questions. Proposed targets are at least 95% supported factual claims and at least 95% correct abstention on unanswerable cases, with zero access leaks. Any observed unsupported historical assertion must be fixed or narrowed before release. These sample targets are release tests, not proof that hallucinations are impossible.

## Release receipts

Each milestone stores fixture inventories, automated results, real-flow screenshots or native recordings, performance samples, cost measurements, and review findings alongside its implementation work. Personal evidence stays in restricted storage with safe references in Git. All open exceptions name an owner, impact, and expiry. Access leaks, missing originals, and unaccounted import items cannot be waived as cosmetic defects.

## P1 backend regression contracts

The independent plans backend extends T01, T02, T06, T09, T11 and T14 through [domain tests](../tests/backend/social/test_plans.py), [HTTP tests](../tests/backend/social/test_plans_http.py) and [isolated hosted tests](../tests/backend/social/test_plans_postgres.py). Fixtures use two current members, an outsider and a separate group. No personal archive is required for plan creation or attendance.

Verify request replay after a lost response, different-payload key conflict, stale plan revision, repeated desired attendance, clearing a response and replaying an older attendance command. Removing a plan or its organizer must make an earlier create retry return an explicit deleted result. Concurrent create retries produce one plan. Concurrent attendance and cancellation serialize. Exact UTC instants and fractional epoch timestamps must survive hosted storage without float32 truncation.

Exercise nonexistent and repeated Copenhagen wall times, explicit offsets, invalid timezone and end-before-start. Page equal-start plans by stable ID without duplicates, and move the server clock past a start to exclude it from Upcoming. Read active participant names without account emails. Remove an organizer through the lower-level identity store and confirm plans and attendance disappear. An approved-memory link becomes absent after hiding or withdrawing a child without changing the remaining archive annotations.

Export only the member's authored plans and attendance. Edit a plan between ZIP construction and admission and require a conflict. Hosted mutation tests require an isolated schema ending `_test`; never run them against the live archive. Verify RLS/grants and the group/time query index. These automated backend checks leave the desktop-create/phone-join journey, UI focus, five-friend task tour and physical-phone pilot for the frontend and final acceptance slices.

## C1 comments backend regression contracts

The comments backend extends T01, T02, T06, T09, T11 and T14 with [domain tests](../tests/backend/social/test_comments.py), [HTTP tests](../tests/backend/social/test_comments_http.py) and [isolated hosted tests](../tests/backend/social/test_comments_postgres.py). Use permanent photo and approved-memory targets, multiple messages per author and separate conversations for a photo and its later grouping.

Require author-only editing/removal, immutable creation time, stale-revision conflicts, exact retry identity and conflicting-key rejection. Page equal-timestamp comments with one row per page after membership and tombstone filtering. Hidden photos, overlapping hidden-event children, other groups and a withdrawn last source must deny list text, totals, writes, replay and authored export. An independent eligible source must preserve access after one withdrawal. Test composite target foreign keys with an author who belongs to both groups, so membership alone cannot explain the denial.

Remove an author through the lower-level identity store and verify cascade cleanup and a text-free deletion ledger. Reinsert a stale row with the current ledger and require it to remain absent, including after rejoining. Copy a latest SQLite database snapshot and prove the deletion ledger survives that roundtrip. These checks do not model a complete backup from before deletion; current-ledger reconciliation remains required before restored data can serve traffic. Hosted tests use only an isolated `_test` schema and synthetic private bucket.

Export only authored comments with current target access and reject metadata changes between ZIP assembly and admission. Exercise origin/session denial and plain-text JSON handling over the real HTTP adapter. The comments UI, retryable in-memory drafts, reactions, desktop/phone journey and physical pilot remain separate gates.

## C1 reactions backend regression contracts

The native reactions backend extends T01, T02, T06, T09, T11 and T14 through [domain tests](../tests/backend/social/test_reactions.py), [HTTP tests](../tests/backend/social/test_reactions_http.py) and [isolated hosted tests](../tests/backend/social/test_reactions_postgres.py).

Enable the same emoji repeatedly, disable it and replay the older enable key. Require the current disabled aggregate without another write. Different content under the same key conflicts. Concurrent exact retries create one reaction. Test independent photo, approved-memory and native-comment targets. Reject notebook composite keys, unknown emoji and nonboolean desired states. Preserve imported chat evidence.

Check current member names, exact counts and the fixed 50-name limit with 51 synthetic reactors. Batch reads accept at most 50 unique targets, match single-target aggregates and reject the whole read if any target is hidden or denied. Hidden photos, overlapping hidden-event children, withdrawn sources and other groups cannot expose counts or permit writes. SQL must filter active members and tombstones before aggregate projection.

Remove a reactor through the identity store and verify cascade tombstones. Rejoin and reinsert a stale row while retaining the current ledger. Require it to remain absent and require an old receipt to leave it absent. A fresh action may create a new identity. Delete a native comment and verify reaction cascade; reintroducing both stale rows must still deny the target through the comment ledger. These checks require current deletion-ledger reconciliation and do not establish a future-deletion guarantee for an old full snapshot.

Verify partial-index uniqueness and composite group foreign keys, hosted double-precision timestamps, private RLS/grants and target-index query plans. Export only the member's active visible reactions and reject a desired-state change between ZIP assembly and final admission. Hosted tests use only the isolated `_test` schema and synthetic private bucket. UI reaction controls, drafts, browser journeys and physical-phone acceptance remain separate gates.

## Local selected-photo correction regression

A2 write uses synthetic archives: `tests/backend/test_photo_corrections.py` verifies selected-child patches, unchanged sibling/title/anniversary fields, stale annotation/origin snapshots, field allowlists, hidden/cross-group access, HTTP origin checking, reviewed/free-text/cleared export projections. `tests/dom/photo-correction.test.mjs` verifies conflict draft retention and cancellation of late responses. The unified `selected child corrections` desktop/phone scenario edits date and place, changes the selected child and clears the review while checking sibling annotations. Evidence is recorded under `work/poteto/photo-corrections-ui/`; this is local regression evidence, not physical-device or friend-study acceptance.
