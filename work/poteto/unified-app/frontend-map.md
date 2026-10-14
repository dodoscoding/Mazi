# Unified app frontend map and candidate B

## Grounding and recommendation

Read-only inventory on 14 October 2026. Sources: `src/App.tsx`, `src/Atlas.tsx`, `src/memories.ts`, `src/useRoute.ts`; Phase 2–7 HTML/JS and Phase 7 server, README and browser contracts. No implementation or test execution occurred in this investigation.

Keep React and the Atlas as the single interface; keep the existing Python `MemoryStore` and Phase 7 handler chain as the application backend. Serve built Vite files from that server, with a Vite `/api` proxy for development. One public app entry, one cookie/session origin, one data directory, one import worker. Replace phase HTML navigation with integrated React routes. Merely applying Atlas CSS to legacy pages or embedding them in iframes would leave multiple applications and independent group/state lifecycles.

The inherited backend is already one capability set: Phase 7 extends Phase 6, which retains earlier import, review, source and discovery routes. UI duplication, static fixture ownership, and runtime entry points are the immediate integration problems. Consolidation need not rewrite image ingestion, privacy, or authorization.

## Candidate B: a fully TypeScript application

A structurally distinct alternative is React plus a TypeScript HTTP backend and database layer, replacing Phase 1–7 Python stores and workers. This gives one language and can simplify eventual shared type generation, but it is a behavioral migration: SQLite transactional writes, import resume/outcome contracts, image normalization and metadata handling, deduplication, visibility reconciliation, consent-aware search, optional local CLIP processing, evidence answering, immutable capsules, per-frame authorization and AVI export all need equivalents. Browser tests alone cannot prove equivalence; existing Python tests would need to remain an oracle or be ported with fixture parity. Apple Photos companion and Discord collector protocols also must stay compatible.

This alternative is feasible only as a separate substantial backend migration. Dropping CLIP, source transfer states, capsule sealing or revocation semantics to fit a short rewrite would lose current functionality. It adds dependencies and migration risk without improving the requested Atlas user experience. Recommend React plus existing Python for this consolidation; revisit TypeScript only after a dedicated migration contract and benchmarks.

## Existing Atlas fixture boundary

`src/memories.ts` owns three synthetic memories: `last-ferry` (2024, three photos and three fictional messages), `lake-days` (2023, one photo, no conversation), `birthday` (2022, one photo and one fictional message). Every date is approximate. Images are public `/media/*.webp` assets. The fixtures must never masquerade as authenticated archive records.

`Atlas.tsx` imports the static array directly; photo positions use three hardcoded longitude/latitude values and rotation depends on fixture array index. Refactor it to accept authorized memory cards as props. Retain the globe/procedural aesthetic, pause/resume and reduced-motion/fallback contracts, but use deterministic visual placement for undated/unlocated cards and real shared coordinates only where authorized. Current placements are decorative, not geographical evidence. Avoid loading every private photograph into a Three texture cache; bound visible cards and dispose textures on access invalidation.

`App.tsx` has functioning home selection, memory gallery, conversation disclosure, timeline, local substring search, hash history and focus/scroll restoration. Imports and Circle are explicit placeholders. The detail model requires nonempty photos, a year and contributor label; real data can be missing or conflicting. Adapt rendering instead of fabricating dates, stories, authors or conversations. Do not append fictional conversations to imported memories.

## Route and ownership sketch

Retain hash routing for straightforward static fallback, expand `useRoute` to parse route-specific query fields, and keep server-compatible aliases for old links. Suggested routes:

| Route | Workflow | API ownership |
| --- | --- | --- |
| `/` | Atlas and selected authorized memory | accepted events plus visible timeline/place data |
| `/memory/:event` | approved memory gallery, provenance, associated story | review events and archive/rendition reads; memories story |
| `/photo/:asset` | individual photograph without forcing an event | review timeline/origins and archive reads |
| `/timeline` | paged photographs, corrections, On this day | `/api/review/*` |
| `/search` | discovery filters, similar images, people | `/api/discovery/*` |
| `/imports` | resumable ingestion, reports and sources | `/api/imports/*`, `/api/sources/*` |
| `/review` | duplicate/event proposals and reversible decisions | `/api/review/*` |
| `/places` | shared locations, paths and location editing | `/api/places` |
| `/ask` and `/answer-evidence` | grounded answers and authorized evidence | `/api/answers/*` |
| `/memories` | annual recap, stories, capsules and notifications | `/api/memories/*` |
| `/circle` | account, groups, invitation/membership, privacy preferences | session/groups/members plus processing APIs |

Main nav can remain Home, Timeline, Search, My Imports and Our Circle. Put Review, Places, Answers and Recaps & Stories in a visible secondary archive navigation. Every capability needs a findable control; do not bury admin functions in an inaccessible route. Signed-out shell offers register/login; authenticated users with no groups can create or join. Home handles no approved events without crashing and links to Imports/Review. Single photos remain available in Timeline even when no event exists.

Shared context owns session, current group, role, request generation and invalidation. Screen components own drafts, pagination and loading/error states. A small API module handles JSON requests, binary downloads, error status and generation checks. Backend methods retain authorization; frontend capability visibility is presentation only. Route selection and year/filter state may live in the URL, but invitation tokens, recollection drafts and capsule contents should not.

## Forms and actions that must survive

| Area | Preserve all actions/fields |
| --- | --- |
| Account/circle | Register and login email/password; logout; create group name; accept invitation token; select group; generate privately shared 24-hour invite; list members and admin removal; member leave group. |
| Imports | Choose source (manual/WhatsApp/Messenger/Discord export), stable archive namespace and WhatsApp date order; select ZIP within 128 MiB; hash/start/chunk/resume/finish upload; inspect inventory before confirm; cancel remaining work; withdraw import; retry supported failed items; previous/next report pages; export complete report across pages; refresh/more gallery; preview/download original; inspect paged origins and source text/provenance. |
| Timeline/review | Search and load next page; correct photo title/capture date/place/anniversary approval; download original and group metadata export; On this day; duplicate merge/dismiss/undo/split and preferred first/second rendition; proposed event title/photo subset (minimum two)/accept/reject/undo; list own contributions and remove source record. |
| Places | Country/city filters; toggle chronological paths; world/fit controls; open mapped photo; select own origin, country/city/latitude/longitude/optional date; save or remove location. Undated/unlocated photos remain in archive. |
| Sources | New Apple or Discord connection label/date scope; Apple albums/types; Discord guild/channel scope; source IDs and companion instructions; enable/pause subject to permission; transfer statuses/progress; original resource download; withdraw resource. Native authorization and collector transfer remain external protocols, not fake browser buttons. |
| Discovery | Query, keyword/semantic mode, country, person, place, object text, date range, source; pagination; similar-image/color search and clear; optional learned-index build/progress/stop; create person; manually confirmed photo tag; untag/remove own association/restore; hide and restore individual photos or memories; personal processing consent and admin group processing; admin propose account/person mapping plus member confirmation; privately verified nonmember removal/restoration request. Preserve model-status help and baseline versus learned labels. |
| Answers | Question (500 characters), evidence-backed answer/coverage/uncertainty/matching counts/usage; open each supporting record; personal and admin group permission; disabled/unavailable and insufficient-evidence states. |
| Recaps/stories | Select year; show explicit coverage/omissions; start story only from approved event; refresh; show live title and member-statement notice; edit own recollection (2,000 characters), remove own recollection; creator delete; JSON export; ordered sub-events title/distinct photo subset/add/clear with revision checks; manual slideshow show/previous/next/close; silent AVI video download and format/limit notice. |
| Capsules | Title (200), note (4,000), local opening datetime converted to server UTC, optional JPEG/PNG ≤2 MiB; seal; locked receipt without title/body/photo; author delete; open after server unlock; photo read; explicit JSON export; per-member/per-group notification opt-in and unlocked counts. No edit after sealing. |

## API shape pointers

Do not create a second authorization implementation. Existing JSON request payloads are the migration contract; retain binary endpoints and cookie behavior. `phase7/server.py` exposes GET recap/stories/story/export/capsules/capsule/capsule-export/capsule-photo/notifications/frame and POST create/write/delete/seal/delete-capsule/notifications/subevents/video. Story write/delete/subevent calls require current `revision`; HTTP 409 presents a refresh action rather than retrying an old draft silently. GET query parameters carry `group`, and relevant `year`, `story`, `capsule`, `asset`. Video POST returns `video/x-msvideo`; frame/photo GET returns JPEG.

Suggested client concepts: `ArchiveContext {groupId, role, generation}`, `MemoryCard {id, title, dateLabel?, year?, photos, provenance}`, `Story {id, revision, event, contributions, subevents, can_delete}`, and `CapsuleReceipt {id, unlock_at, locked, can_delete}`. Derive exact response types from store return values before coding; these sketches are not backend schemas. Approved event IDs differ from asset IDs and story IDs.

If existing read routes cannot supply a complete authorized memory detail (asset titles, dates, preferred rendition, original origin context) add a small backend read projection using existing store authorization, or compose existing reads in a bounded client loader. Do not derive private memory access from an unfiltered event list or assume recap covers cross-year/undated events. Home needs eligible accepted memories beyond a single annual recap.

Private lifecycle must clear data, drafts containing archive text, selected previews, slideshow/capsule object URLs and GPU textures on logout, group change, access loss and backgrounding. Abort requests and ignore responses from older generations. Returning to foreground reloads authorization. Preserve no-store responses and explicit user downloads; no localStorage private cache. Newly applied hide/withdraw/member removal invalidates every affected view, not only the screen that submitted it.

## Integration proof plan

1. Keep existing Python unit/HTTP suites Phase 1–7 as backend behavioral evidence. The UI consolidation must not alter capsule server-clock checks, story all-original visibility gates, contributor consent or import state transitions.
2. Adapt browser fixture servers to run the unified server with built React assets. Existing phase browser contracts should reach the new route equivalents and retain their actions; run desktop and phone projects, including learned search where its pinned local model is available.
3. Add one cross-feature journey: register/login, group/invite, import fixture with preview/confirm/report, correction/place, event approval, Atlas selection/detail, search/person tag, evidence answer, story/subevent/slideshow/export, capsule receipt and logout. Verify imports or corrections appear on Atlas without switching applications.
4. Add cross-screen regression: delayed group-A results cannot render after group-B switch; hide/withdraw/member revocation suppresses memory detail, story prose/frame and export; background clears private DOM/media and foreground reauthorizes; 409 retains a clear recoverable conflict state; forged client clock cannot open capsule.
5. Preserve Atlas navigation/focus, keyboard gallery, reduced motion, WebGL fallback, offline/error/loading/photo failure behavior from `tests/journey.spec.ts`, `tests/resilience.spec.ts`, `tests/evidence.spec.ts`; update fixture tests explicitly if demo moves to a separate opt-in demo route.
6. Run build/typecheck, configured Prettier lint, targeted browser/API suites, document verifier and `git diff --check`. Capture unified desktop/phone screenshots plus commands/revisions/fixtures in verification notes. No production acceptance claim follows from local synthetic results.

## Acceptance boundary

Complete means one launch command, one app origin and shared group state; Atlas reads actual authorized archive data; every listed workflow has a working React control and preserved server contract; no placeholder Imports/Circle, iframe integration, or normal-navigation phase prototype links remain. Old phase scripts may remain regression references, but cannot be the primary UI. Production auth/deployment and physical-device acceptance remain separate from this local consolidation.
