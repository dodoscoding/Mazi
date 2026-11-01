# Mazi improvement feasibility

Investigated on 1 November 2026 against `origin/main` at `3e79ad79b7feb48bea99e8397a992f182d1e17a5` (PR #108). This document answers the owner's six improvement requests and the follow-up choice: a private group with shared memories, comments, reactions and events. SS means screenshots. [D25](DECISIONS.md#private-social-space-direction-1-november-2026) records the confirmed direction; the implementations below are proposals, not delivered behavior or release acceptance.

## Recommended groups and difficulty

Difficulty includes implementation, integration and relevant verification in the existing React/Python app: 1 is a local presentation change; 2 changes several UI surfaces; 3 crosses UI, API or metadata semantics; 4 adds a domain and lifecycle rules; 5 adds substantial model or live spatial infrastructure. Scores are engineering judgments, not measured delivery times. Dependencies matter more than adding the scores.

| Group | Owner request | Smallest useful implementation | Difficulty | Order |
| --- | --- | --- | --- | --- |
| Clarity | 1. Simplify Home | A calm group landing page with one featured memory, recent notes and a clear contribution action; make Atlas an explicit exploration view. | 2/5 | First |
| Clarity | 3. Confusing top tabs | Three primary destinations: Home, Explore, Our circle. Put Timeline, Map, People and Search inside Explore; give Add a visible action. | 2/5 | With Home |
| Clarity | 5. Features feel lost | A complete destination map, descriptive labels and contextual links to notes, stories, imports and correction tools. | 2/5 | With navigation |
| Trustworthy metadata | 2. Places and dates still missing | Expose date basis and place status everywhere; reconcile Search with sharing chronology; make correction easy and diagnose the deployed revision separately. | 3/5 | Before social activity relies on dates |
| Organization | 4. People, screenshots and AI labels/filters | Reuse confirmed People; add editable, independent content and provenance labels with Unknown states, combined filters and bounded backfill. | 3/5 | After metadata semantics |
| Social interaction | 6. Private social space | Reuse event notes, then add reactions, a recent-activity feed and lightweight future events with attendance. | 4/5 | Incrementally after clarity |

Automatic screenshot suggestions and validated AI-provenance extraction are optional 4/5 follow-ups. Face recognition is 5/5 and remains separately gated by M5. Live rooms and an avatar world are outside the owner's selected direction and are unnecessary for this plan.

## What already exists

The audit used current source, existing synthetic screenshots and focused executable contracts. It did not sign in to production or inspect a personal archive. Previous production counts in D21/D23 are historical receipts, not a measurement taken today.

| Finding | Evidence | Consequence |
| --- | --- | --- |
| Home combines a globe/flat-map toggle, places index, featured memory, memory list, Replay, year scrubber and unplaced tray. | [Home](../src/Home.tsx), [Atlas model](../src/atlas/model.ts), PR #108 [desktop](../work/poteto/notebook-discovery/after-home-desktop.png) and [phone](../work/poteto/notebook-discovery/after-home-phone.png) captures. | Simplification is mostly hierarchy and navigation work; it does not require rebuilding the archive. |
| Desktop has five main links plus Archive tools; phone has four tabs plus More. | [Shell](../src/Shell.tsx), [feature routes](../src/features/index.tsx). | Equivalent tasks have different entry points. The number and naming of destinations explain part of the reported confusion. |
| Search and Discover share a template but expose different modes and loading behavior. | [Discovery mount](../src/features/discovery/mount.js), [template](../src/features/discovery/template.html). | Consolidation should preserve deliberate deferred loading rather than load the entire archive on every visit. |
| Source and Shared by filters already exist. Confirmed Person filtering is separate; Person and search mode are not restored from the URL. | [D22](DECISIONS.md#search-filters-24-october-2026), [verification](../work/poteto/search-filters-20261024/VERIFICATION.md). | Extend these controls and restore all chosen filters. A sender name does not establish who appears in a picture. |
| Places support GPS-derived cities, a manual city tray and Review overrides. | [D21](DECISIONS.md#map-places-from-gps-and-review-23-october-2026), [Atlas projection](../mazi/atlas.py), [place controls](../src/atlas/PlaceMemories.tsx). | Missing GPS is an explicit state requiring correction, not a reason to invent coordinates. |
| Chat sharing chronology, raw Discord dates and ambiguous WhatsApp date order already have fixes. | [D23](DECISIONS.md#chat-photo-dates-24-october-2026), [chronology](../src/memory/chronology.ts). | A new investigation must distinguish capture date, sharing date, missing evidence and a stale deployment. |
| Collaborative event notes already have author ownership, revision checks and current-access reads. PR #108 added explicit View notes links. | [notebook](../src/memory/EventNotebook.tsx), [domain](../mazi/memories/memories.py), [discovery evidence](../work/poteto/notebook-discovery/VERIFICATION.md). | Reuse this social foundation. It is not yet a threaded conversation or a general activity feed. |
| No general screenshot/AI classification contract, native reaction system, social activity feed or future-event RSVP domain was found in the audited application paths. | [media types](../src/memories.ts), [discovery domain](../mazi/discovery/discovery.py), [advanced memories](../mazi/memories/memories.py). | These need explicit domain work, rather than another menu label. Imported reactions remain historical source evidence. |

## 1, 3 and 5: simplify Home and make every feature findable

Proposed information architecture, retaining the current Luminous night visual language:

```text
Home                         Explore                         Our circle
  Featured memory              Search                          Members
  Recent group contributions   Memories / Timeline             Events and attendance (new)
  Upcoming group event (new)   Map / People                    Group settings
  Open notes / Add             Stories / Recaps / Capsules     My visibility and processing

Always available: Add -> upload, import ZIP or manage connected sources
Contextual tools: memory -> notes and corrections; source -> connection controls
```

Home should answer what the group can enjoy or do together now. Start with existing memories and notes; show activity and upcoming events only when those domains ship. Keep globe interaction, Replay and date controls together inside Explore. Empty groups get an Add action and a brief explanation. Avoid an empty social dashboard before there is meaningful activity.

Use the same three labels on desktop and phone. A labelled Add action remains visible. Search is directly reachable from the shared shell and the Explore page. Keep readable place/date metadata on cards, rather than making the globe the only way to discover it. Show the archive's actual content and existing approved theme; this is an information architecture change, not a new brand.

| Existing destination | Proposed visible home | Compatibility requirement |
| --- | --- | --- |
| `/` Atlas | `/` social Home; Explore has an explicit Atlas view | Introduce one canonical Explore route during implementation and keep existing memory links and demo entry working. |
| `/timeline`, `/memories` | Explore, with distinct Timeline and Memories views | Preserve deep links, current-access behavior and Back. |
| `/search`, `/discover` | Explore Search / rediscovery controls | Retain old routes as supported entries; share filter state without eagerly loading every category. |
| `/places` | Explore Map; source management moves under Add | Preserve the Discord OAuth return path and its query parameters until an explicit compatible migration is proven. |
| `/ask`, `/answer-evidence` | Ask from Search and cited memory evidence | Keep cited deep links and optional-processing controls. |
| `/review` | Organize/correct from memory and Explore tools | Keep a complete review workspace reachable in two actions. |
| Stories, recaps, capsules in `/memories` | Named Explore views | Preserve author controls, exports and capsule unlock checks. |
| `/imports`, `/circle` | Add / Our circle | These currently share a mounted module; separate the presentation without duplicating state or source operations. |
| `/about`, `/introduction`, sign-out and sound | Profile/help controls | Keep introduction replay, session actions and sound preference reachable. |

Implement the navigation definition once for the shell, phone sheet and contextual links. Audit every registered route plus embedded workflows, not just header tabs. Replace broad labels such as Archive tools and Places & sources with task labels. Preserve D24's background state and clear private content on actual access loss.

Acceptance: a friend can find Add, Search, People, Map, event notes and corrections without coaching on desktop and phone. Primary tasks take one or two actions; every existing capability has a reachable destination. Verify keyboard/focus, current-section indication, Back, refresh, legacy links and the Discord callback. Reuse PR #108's notes tests instead of implementing another notebook.

## 2: make place and date evidence visible and consistent

There is one reproduced inconsistency, separate from the owner's unverified production symptom. On the audited revision, a synthetic Discord photograph has no capture date, has sharing date `2024-01-02`, appears in unfiltered Search, and disappears when Search is filtered to that day. The reproduction calls `AtlasTests._discord_card()` and `store.search(..., start='2024-01-02', end='2024-01-02')`; all data lives in a disposable temporary archive.

This follows the current contract: [Search document construction](../mazi/discovery/discovery.py) uses [capture-only date evidence](../mazi/archive/review.py), while [Atlas chronology](../src/memory/chronology.ts) can use sharing dates. Fixing the experience needs an explicit date-basis filter, such as Taken / Shared / Available chronology, and corresponding server filtering. Preserve D09's capture/share distinction and existing callers' capture-date semantics. Resolve ambiguous raw sharing assertions through the same evidence rules as Atlas, rather than copying presentation strings into Search.

Proposed bounded implementation:

1. Compare the affected deployment's commit with D21/D23/#108 and inspect an authorized example's Atlas response. Classify missing source evidence, import/backfill omission, date-order ambiguity, multi-place grouping, filtering and presentation separately. Do not rerun imports blindly.
2. Define reusable structured read metadata for date value/range, basis, precision, uncertainty and place status. Expose matching labels on Home, cards, Timeline, Search and detail. Avoid parsing human-readable labels as a long-term API contract.
3. Add Search's explicit date basis and carry it through filters and URL state. Add regression coverage for sharing-only photographs, mixed memories, conflicting capture dates, ambiguous locale dates and day boundaries. Decide group/local versus UTC display explicitly; D23 currently documents a UTC limitation.
4. Show Missing place, Conflicting places or Multiple places with a correction or view-details action. `_place()` deliberately returns no single pin for disagreeing cities or distant coordinates. A multi-city event can expose its existing per-photo places without forcing one city onto every photograph.
5. Surface existing Add/Change place near metadata. Group-wide location writes already affect every photograph in that memory; explain that scope before applying it, preserve corrections and offer an explicit clear action. Investigate the existing Review-place/export mismatch before promising export parity.

Dates or places absent from an export cannot be recovered by a UI change. Keep Unknown and ambiguous states visible; do not infer capture dates from chat dates or places from a conversation's name. Existing GPS pin removal, contribution withdrawal and personal hiding must survive all projections. Initial display and Search consistency can use read projections without rewriting origin fingerprints; new timezone preferences or persisted metadata would need a separate migration review.

Acceptance: known, unknown, sharing-only, approximate, conflicting, multi-place and manually corrected examples remain reachable and accurately labelled in all views. Existing date-filter callers retain their contract; the new sharing-date filter includes the reproduced example. Check revoked access and removed pins, not just successful map writes.

## 4: independent People, screenshot and AI filters

Use independent dimensions because one asset can be a screenshot containing a person and AI content:

| Dimension | Proposed states | Implementation boundary |
| --- | --- | --- |
| Person | Existing confirmed person IDs; untagged remains unknown | Reuse `discovery_people`, tags and suppression. Shared by remains a separate sender/importer facet. No automatic identity assignment. |
| People present | Yes / No / Unknown | Optional explicit content label; untagged never automatically means No people. |
| Screenshot | Yes / No / Unknown | Start with editable manual/bulk labels; filename/device metadata can later supply a reviewable suggestion. |
| AI provenance | Generated / Edited with AI / No AI declared / Unknown | Store the member assertion or validated provenance evidence and its origin. No AI declared is not a verified camera-original claim. |

Keep members' confirmed labels separate from optional suggestions: proposed assertion records need asset/group, dimension, value, evidence method, actor or model version, update revision and correction history. Define who can edit shared labels before implementation; a small-group default is any active member with audit history and conflict detection, matching place correction. Add migrations for both storage modes, API reads/writes, export and departure/deletion behavior. Labels and facet counts must derive only from currently visible assets; a filter is not an access-control rule.

Apply labels consistently in Memories, Search, Home recommendations and social activity. Preserve combinations and selected Person/mode in URL state; reset clearly, paginate results, and show active filters. The current Memories People filter uses source/contributor evidence from Atlas, whereas Search uses confirmed Person associations. Align the labels and identity semantics before presenting them as one People experience.

First release: manual and bulk labelling, existing confirmed People and Unknown defaults for older assets. Reversible background suggestions can follow with bounded, checkpointed processing and a representative evaluation set. Do not classify screenshots from aspect ratio alone or promise complete automatic AI detection.

[C2PA's FAQ](https://c2pa.org/faqs/) describes signed provenance and explains that credentials can be stripped from media. Engineering inference: validated AI-creation/edit assertions are useful evidence, while absent credentials must remain Unknown. Preserve provenance from originals; previews and chat exports may not carry it. No external image analysis is selected by this investigation.

Acceptance: a synthetic screenshot with confirmed People and an AI label matches all three filters; Unknown differs from an explicit negative label. Exercise corrections, bulk retry, revision conflicts, combined filters, authorized counts, export, deletion and member departure. Face recognition remains off under M5's existing conditions.

## 6: evolve into the private group's social space

The owner selected shared memories, comments, reactions and events. The archive supplies shared context; the new reason to return is interaction with friends. Keep the existing circle audience and responsive website. No public discovery, new audience model or immersive world is implied.

Deliver the social slice in small increments:

1. **Shared conversation entry, 2/5:** make existing event notes visible from Home and memory detail. The current story model has one contribution per author per story, so use it for recollections; it cannot silently become a multi-message comment thread.
2. **Reactions, 3/5:** introduce native member reactions on visible memories and notes. Give each member/target/reaction one durable identity, make toggles idempotent, and enforce current access on reads, writes and counts. Imported chat reactions keep their source attribution and remain distinct.
3. **Comments and activity, 4/5:** decide whether multiple short comments are required beyond recollections, then add a separate comment collection with author edit/delete, revisions and a bounded activity projection. Order by contribution time, keep the historical memory date separately, page with stable cursors, and recheck target visibility before showing text or thumbnails. Do not expose internal audit logs as a social feed.
4. **Future events and attendance, 4/5:** add lightweight plans with title, description, event timezone, start/end, optional place, organizer and RSVP. Upcoming plans are different from historical `review_events`; support cancellation, edits and member departure. Link an event to memories after it happens rather than changing archive timestamps. Calendar sync, push/email and recurring events are later choices.

New reactions, comments, events, RSVP and any durable activity projection require schema migrations, group isolation, export/deletion rules and recovery verification. Reuse existing membership checks, private media routes and note ownership. D17 profile names are not verified identities; preserve that known trust model and do not claim authenticated personal authorship beyond stored profiles.

A first social release can use ordinary API reads on navigation and after writes, with a manual refresh for other members' activity. Live presence is unnecessary for comments and RSVP. If demand later justifies it, [current Vercel WebSocket documentation](https://vercel.com/docs/functions/websockets) supports Python frameworks, requires Fluid compute and documents reconnects at function duration limits; [general availability was announced on 20 October 2026](https://vercel.com/changelog/websocket-support-is-now-generally-available). This does not prove the existing custom WSGI bridge supports upgrades. A measured transport spike, shared state, per-message authorization and revocation behavior would precede a live feature. No provider change or paid provisioning is selected here.

Acceptance: two members can open a shared memory, exchange the agreed note/comment form, toggle reactions and respond to an event. Refresh/retry does not duplicate a write; unauthorized or withdrawn targets disappear from activity and counts. Test cancellation, edits, author removal, offline failures and group/session changes. A short friend walkthrough should establish that these interactions create a reason to return before adding presence or notifications.

## Delivery sequence and roadmap relationship

| Increment | Deliverable | Existing roadmap relationship | Exit evidence |
| --- | --- | --- | --- |
| A. Clarity | Home hierarchy, shared navigation and a complete feature map | M1/M3 web experience; M4/M5/M7 destinations | Desktop/phone task walkthrough and legacy-route contracts. |
| B. Metadata | Date-basis consistency and visible place/date states | M3 corrections, M4 places, M5 filters | Synthetic regression of the reproduced Search mismatch plus an authorized deployed-example diagnosis. |
| C. Organization | Shared filter semantics and editable content/provenance labels | M5 extension | Migration, correction, export and visibility tests; mixed-label fixtures. |
| D. Social foundation | Notes entry, reactions, comments/activity and future events in separate changes | Reuses M7 stories; new social domains need explicit contracts | Two-member interaction, retry, ownership, revocation and deletion tests. |

Start A and the diagnostic part of B first. Define C's labels before any classifier. Add D in slices after navigation and activity timestamp semantics are clear. Existing M0-M7 acceptance stays open where already open; the new direction is not milestone completion. Implementation PRs must update the affected SPEC/CONTRACTS/PRIVACY/TEST_PLAN sections before changing behavior. Preserve the original plan and source brief.

## Verification and limits of this investigation

Environment: macOS, Node `v24.15.0`, existing project Python virtualenv with Pillow `12.3.0`. Backend checks used synthetic temporary archives from this worktree; the Python executable was reused from the default checkout without changing dependencies. No production storage, deployment or personal archive was changed.

- `python3 work/poteto/product-plan/verify_docs.py`: 17 documents, 224 local links, B01-B30, M0-M7 and T01-T15 passed after the update. `git diff --check` passed.
- `node --test tests/unit/chronology.test.ts tests/unit/atlas-model.test.ts`: 12 passed.
- `/Users/altanesmer/Desktop/Ales/Mazi/.venv/bin/python -m unittest tests.backend.test_atlas tests.backend.test_atlas_place tests.backend.archive.test_chronology tests.backend.discovery.test_shared_by tests.backend.memories.test_memories`: 63 passed.
- Disposable Discord fixture reproduction: `capture_date='Date not recorded'`, `share_day='2024-01-02'`, `in_unfiltered_search=True`, `in_date_filtered_search=False`.
- Visually inspected the committed PR #108 Home desktop and phone screenshots linked above and compared their controls with current source. These are existing synthetic captures, not new browser or physical-device acceptance.

Reproduce the date-filter observation from the repository root with the existing virtualenv:

```sh
/Users/altanesmer/Desktop/Ales/Mazi/.venv/bin/python - <<'PY'
from tests.backend.test_atlas import AtlasTests
case = AtlasTests('test_discord_bot_photo_has_a_resolved_share_date')
case.setUp()
try:
    card = case._discord_card()
    day = card['photos'][0]['provenance'][0]['sharedAt']['local'][:10]
    asset = card['id'].removeprefix('photo-')
    before = case.store.search(case.ben, case.group)
    after = case.store.search(case.ben, case.group, start=day, end=day)
    print(card['date'], day,
          asset in {item['id'] for item in before['items']},
          asset in {item['id'] for item in after['items']})
finally:
    case.tearDown()
PY
```

The production symptom's exact cause remains unverified until the deployed revision and an authorized affected example are checked. Full browser suites, physical devices, hosted migrations, classifier quality, social performance and cost were not exercised. No application code, schema or deployment change is included in this investigation.
