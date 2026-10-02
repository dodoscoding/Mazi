# Mazi test and acceptance plan

These tests define future acceptance. None has run against an application because the repository currently has no application. Documentation verification is recorded separately in [the planning evidence](../work/poteto/product-plan/VERIFICATION.md).

## Evidence rules

Each implementation change records the exact commit, command, fixture version, environment, expected result, actual result, and artifact location. Tests use both allowed and denied cases. A build or a mocked success response is not proof that publication, storage access, or recovery works.

M0 establishes runnable commands after choosing and scaffolding the application. This document names behaviors instead of inventing package scripts. Database policies need real database tests. Browser journeys need a running app and actual private object delivery. Native behavior needs supported devices, including iCloud and permission changes.

## Acceptance scenarios

Use Alice and Ben as active group members, Cara as a selected recipient, an administrator who is not a recipient, a removed member, and an outsider. Reuse these actors across API, database, object, search, and browser checks.

| ID | Scenario | Passing evidence | Gate |
| --- | --- | --- | --- |
| T01 | Create, expire, replay, revoke, and concurrently accept invitations; remove membership; attempt direct database/API writes into another group. | A single acceptance succeeds, invalid invitations fail, cross-group access and owner/group reassignment are denied. Admins cannot read private staging. | M1 onward |
| T02 | Alice stages media with hidden GPS/context. Publish preview only to Ben, then to the group. Exercise original, thumbnail, filename, source badges/dates, captions, counts, search, map, export, AI, and cache paths as each actor. Place a private sub-event under a shared Memory. | Only granted components appear. Captions derived from hidden context stay hidden or are recomputed. Memory metadata has independent authorization; parent access exposes no private child title or existence. Sanitized previews contain no hidden embedded metadata. Future group members receive group grants but not selected-member grants. | M1 and each new read path |
| T03 | Resume an interrupted upload; repeat the same manifest and stable source occurrence; import identical bytes shared on two dates; import a partial overlap containing only the second of two indistinguishable same-time messages. | Exact manifest/stable-ID replay adds no origin/job/grant. Distinct known occurrences remain distinct. Ambiguous cross-export records remain retained with unresolved correspondence and are never silently collapsed. Counts and hashes match the fixture. | M1, extended M2 |
| T04 | Kill a worker before and after storage writes and database commit; expire a lease; race retries; cancel a 20,000-item run containing corrupt files. | No lost successful items or repeated side effects. Every discovered item has one current outcome. Only unreferenced temporary objects are collected. | M1 recovery, M2 full suite |
| T05 | Ben has a shared compressed copy. Alice imports a private original, then publishes it. Merge and split a wrong near-duplicate with differing audiences. | Private import changes no shared rendition, origin badge, or count. Published quality improves only for eligible viewers. Undo restores variants, grants, and memory links. | M1 isolation, M3 similarity |
| T06 | Use capture time years before share time, date-only values, missing timezone, DST overlap, invalid EXIF, edited dates, ambiguous locales, and user corrections. | Raw assertions survive. Timeline uses the selected capture estimate with its label. Unknown dates stay undated. Sharing time stays separate. | M1, archive cases M2 |
| T07 | Run all declared adapter fixtures, malformed archives, path traversal, expansion bombs, repeated names, expired URLs, and forbidden remote addresses. | Inventory equals expected available/missing/unsupported counts. No path escape, unbounded expansion, arbitrary fetch, or invented source content. | M2, extensions M4 |
| T08 | Complete keyboard and screen-reader invite, upload, retry, review, publish, timeline, and media detail flows on supported narrow/wide layouts. | Focus remains usable, controls are named, progress is announced, contrast meets the selected accessibility standard, reduced motion works. A ten-photo memory is usable without a mouse. | M1, full M3 |
| T09 | Revoke sharing or consent during processing and an in-flight answer; remove a member; delete one of two independent contributions; revoke the last visible child of a derived Memory; restore a backup after deletion. | New access stops after policy commit. Pending output is rejected when stale. URLs expire within policy. Derived titles/places are recomputed or hidden, and derived-only empty Memories disappear. Only eligible independent copies remain. Restores reapply tombstones. | M1 lifecycle, full M3, AI M5/M6 |
| T10 | Review an event candidate containing neighboring trips, different locations, conflicting dates, and private evidence; reject, split, and accept it. Test On This Day. | No automatic publication. Reasons are inspectable. Rejection is durable. Shared suggestions use shared evidence only. Anniversary items use approved sufficiently precise dates. | M3 |
| T11 | Query combined place/person/object filters with hidden lookalikes; turn AI off; personally hide media; remove a manual tag applied by another contributor; retry import/tagging; withdraw recognition consent. | Retrieval remains permission-filtered. Personally hidden items do not resurface for that member. Subject disassociation removes People/search/summary links and prevents silent retagging without deleting independent media. Hidden clusters are absent. Manual archiving still works. Withdrawn embeddings cannot affect output. | M5 |
| T12 | Sync selected Apple resources with iCloud delays, limited/denied permission, edits, Live Photos, network loss, and app restart. Backfill only selected Discord channels. | No unselected upload or channel import. Resume preserves occurrence identity. Changed permissions halt new reads. Source deletions do not silently delete retained Mazi data. | M4 |
| T13 | Ask answerable, unanswerable, earliest-ever, conflicting-date, hidden-context, and prompt-injected questions; revoke evidence mid-answer. | Every factual claim cites accessible support; incomplete history is labeled; unsupported answers abstain; source instructions do not alter authorization or trigger actions. | M6 |
| T14 | Load the release profile; restore database and objects; deploy and roll back; exercise quota limits, provider outage, monitoring, and redacted logs. | Budgets below pass, originals recover, no sensitive log payloads appear, optional model outage does not block core imports, alert/support owners respond in a drill. | M3 |
| T15 | Open a capsule using a changed client clock, direct URL, search, thumbnails, AI, export, notifications, and a removed member before/after unlock. | Server time and current grants decide access on every path. Locked bytes and metadata never enter an accessible derivative. | M7 |

## Proposed performance and reliability budgets

These numbers are initial acceptance targets. M0 confirms their test hardware, hosting tier, and cost feasibility. M2 measures a baseline. A budget change requires a recorded decision before release, not a post-failure claim that the target passed.

The launch profile is 100,000 logical media items in one group, 20 concurrent active sessions, and one 20,000-item import manifest. Browser checks use a documented mid-range laptop and phone on a 20 Mbps connection with 100 ms simulated round-trip latency. Server checks record region, worker size, database tier, cache state, and codec mix.

| Metric | Proposed budget | Measurement |
| --- | --- | --- |
| First usable timeline page | p95 within 2 seconds with 100 thumbnails. | 30 cold/warm browser runs after sign-in under the agreed network profile. |
| Timeline/filter API | p95 under 500 ms, error rate below 1% at profile load. | 15-minute run with access policies enabled; exclude neither denied requests nor joins silently. |
| Keyword search | p95 under 1 second. | Fixed query set over the 100,000-item profile. |
| Semantic retrieval at M5 | p95 under 2 seconds before answer generation. | Fixed authorized/hidden candidate mix and combined filters. |
| Ready preview | p95 within 30 seconds after a supported image finishes upload under the agreed load. | Record upload completion, queue delay, and preview availability separately. Video has a codec-specific budget set after M0. |
| Import memory | Less than 1 GiB peak RSS per worker for the agreed image/archive profile. | Sample the worker across a streamed 20,000-item manifest; bounded archive expansion remains enforced. |
| Worker recovery | Eligible interrupted jobs resume within 5 minutes of worker restoration. | Kill/restart drill with recorded lease expiry and item counts. |
| Pilot production availability objective | 99.5% per month for authenticated browsing and publication. | Synthetic authenticated checks; external source outage is reported separately. Not a contractual SLA. |
| Recovery objectives | RPO at most 24 hours, RTO at most 8 hours. | Restore database and retained objects into isolation, reapply deletions, compare hashes and relationships. |

Compare baseline and changed revisions using the same fixtures and environment, interleaving runs where practical. For a new feature with no baseline, use its absolute budget and state that comparative performance is unavailable. Do not claim a speedup between unlike scenarios.

## Quality evaluations

Perceptual dedupe uses a labeled set containing recompression, crops, edits, burst frames, screenshots, and unrelated lookalikes. M3's suggested-pair precision target is at least 95% on a held-out set of at least 200 labeled pairs. Human review remains mandatory. Report recall separately so high precision is not achieved by silently suggesting nothing.

Event suggestions use at least 50 reviewed event boundaries across multiple groups. The proposed useful-suggestion target is 80% accepted with only title/date edits. Record split/merge rates and where private evidence would change a candidate. No score makes an event publish automatically.

Semantic search uses at least 100 held-out questions with authorized relevant results. Target recall@10 of at least 85%. Keep privacy-denial cases separate and require zero leaks. Face recognition needs a separately approved consented evaluation set and thresholds before enablement; search may launch without it.

Memory AI uses at least 100 answerable and 50 unanswerable/adversarial questions. Proposed targets are at least 95% supported factual claims and at least 95% correct abstention on unanswerable cases, with zero access leaks. Any observed unsupported historical assertion must be fixed or narrowed before release. These sample targets are release tests, not proof that hallucinations are impossible.

## Release receipts

Each milestone stores fixture inventories, automated results, real-flow screenshots or native recordings, performance samples, cost measurements, and review findings alongside its implementation work. Personal evidence stays in restricted storage with safe references in Git. All open exceptions name an owner, impact, and expiry. Access leaks, missing originals, and unaccounted import items cannot be waived as cosmetic defects.
