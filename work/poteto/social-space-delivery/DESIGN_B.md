# Candidate B. Route-owned reads and a separate social domain

This candidate keeps the existing Atlas payload as the compatibility representation. It adds explicit, bounded reads for Home and selected metadata rather than making every page depend on a complete Atlas projection. The same domain projection enriches Atlas and Search where those APIs already return photographs.

## Grounded current behavior

- `src/App.tsx` owns entry/session state, route selection, shared group selection, Home, Atlas, Timeline, memory detail and the shell. It calls `useArchive(route.path, ...)` before choosing the view. `src/useArchive.ts` fetches groups, then fetches all `/api/atlas` for every non-feature path except `/explore`. Consequently Home requires the full Atlas. A direct memory link also resolves by finding the memory in that full array.
- `src/featureRoutes.ts` marks `/circle`, `/imports`, `/review`, `/places`, `/discover`, `/ask`, `/answer-evidence`, `/memories`, and signed-in `/search` as feature paths. `src/features/index.tsx` mounts imperative JS modules into React-owned sections. `/circle` currently uses the import template and import mount. There is no separate group-home component.
- `src/features/lifecycle.ts` already provides request aborts, group capture, access-loss clearing, timer disposal and response-disposal checks for imperative modules. `FeaturePage` remounts on group changes and on route query changes. New group JS must use this lifecycle rather than inventing a second polling mechanism.
- `src/navigation.ts` has a useful initial destination registry, but `sectionFor` takes only a pathname. `/places` therefore always selects Explore even when entered as source management from Circle. Explore renders twelve equally ranked links. Home title links sometimes open the notebook while the photo and primary button open detail.
- `src/useRoute.ts` handles direct and hash URLs and preserves history depth. It recognizes legacy Atlas query parameters but does not canonicalize `/people` or `/settings`. Both paths are already served as app documents by `mazi/server.py` and `vercel.json`. Their defect is client routing, not missing HTTP rewrites.
- `src/memories.ts` has photo `src`, `alt`, `caption`, and optional provenance. It lacks an asset ID or selected-photo facts. `src/memory/facts.ts` and `chronology.ts` derive dates and places from a memory summary. The latter derives sharing chronology by reading photo provenance only if the memory has no capture year.
- `src/features/memories/gallery.js` loads Atlas, then applies `src/browse/model` filters client-side. Its tiles render only an image and approximate badge. The existing People filter means sharers/chat participants, not approved depicted people. Signed-in Search is the imperative discovery module and has its own API result shape and URL state.
- `mazi/atlas.py:atlas_view` builds visible cards from `_timeline_items`, `_approved`, hidden-event assets, active owners and source provenance. It currently computes a single card place from every source row. It keeps each photo's sharing evidence but does not attach its own capture or place projection.
- `mazi/archive/review.py:correct_asset` is a full replacement of title, capture date, place and anniversary. A detail date-only edit must read/patch safely instead of sending empty sibling fields. Existing `place_memory` changes all children and has a more surgical SQL update.
- `mazi/server.py` extends the existing HTTP handler chain and dispatches Atlas itself. `MemoryStore` is the concrete app store. `initialize_schema` executes SQLite schema only; hosted schema changes must be shipped separately under `infra/hosted/supabase/migrations/`.
- `MemoryStore._approved` rejects an entire approved memory when any original child is unavailable. This is the right precedent for memory comment visibility. `_visible_ids` and `_asset` alone do not cover per-reader hidden approved events, so new social authorization cannot stop at membership or a raw archive row.
- `ReviewStore.export_archive_file` fingerprints export metadata, builds a ZIP, then rechecks the metadata before delivery. New contribution files must participate in both build and admission fingerprint paths. A separate unguarded download would regress this guarantee.
- Existing departure cleanup relies on SQLite and PostgreSQL membership-delete triggers. `tests/backend/test_postgres.py:test_departure_triggers_run_through_identity_store` proves why cleanup must work when a lower-level identity Store removes a member, not only through a new social method.

## Caller usage first

A Home view calls `GET /api/social/home?group=G`. It receives one featured plan or conversation, up to three visible actions, and at most one fallback memory. It does not fetch Atlas or per-card notebooks. Opening a memory from that response can use the supplied single memory immediately and resolves a direct refresh through a dedicated memory read.

A member on `/memory/M?photo=1` edits labels for `memory.photos[1].assetId`, not a URL suffix and not every child. The editor calls `GET /api/photo/facts?group=G&asset=A` and submits a patch with expected version and request key. A separate explicit bulk operation accepts a maximum of fifty targets and expected versions. The summary response invalidates or refreshes the current card and Search query.

A Circle Plans panel calls `/api/social/plans`, creates a plan with its stable request key, and sends an attendance state. The comment panel calls the same domain with a typed target `{kind: 'asset', id: A}` or `{kind: 'memory', id: M}`. A subsequent activity read resolves target visibility again instead of trusting a stored thumbnail or excerpt.

## Data sketch

```ts
type Target = { kind: 'asset' | 'memory'; id: string };
type DateEvidence = {
  status: 'precise' | 'approximate' | 'range' | 'conflict' | 'ambiguous' | 'unknown';
  days: string[];
  label: string;
  basis: 'capture' | 'shared' | 'unknown';
  timezone?: 'UTC';
};
type PlaceEvidence = {
  status: 'matched' | 'text' | 'multiple' | 'conflict' | 'unknown';
  label: string;
  pin: Place | null;
};
type PhotoFacts = {
  assetId: string;
  capture: DateEvidence;
  shared: PhotoProvenance[];
  chronology: DateEvidence;
  location: PlaceEvidence;
};
type LabelValue = 'yes' | 'no' | 'unknown';
type Labels = {
  peoplePresent: LabelValue;
  screenshot: LabelValue;
  ai: 'generated' | 'edited' | 'none-declared' | 'unknown';
  revisions: Record<'people_present' | 'screenshot' | 'ai', number>;
  people: { id: string; name: string }[];
};
type Plan = {
  id: string;
  revision: number;
  title: string;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  status: 'active' | 'cancelled';
  attendance: { yes: number; maybe: number; no: number; mine: string | null };
};
type SocialItem = {
  id: string;
  occurredAt: number;
  kind: 'plan' | 'comment' | 'reaction';
  target: Target | { kind: 'plan'; id: string };
};
```

Server date records should carry evidence days, not only the formatted label. A conflict matches only its proven dates in chronology filtering, whereas a genuine evidenced interval may match its full interval. Do not turn two conflicting days into an implied continuous interval. A grouped summary has its own incomplete-child flag and never substitutes for selected-photo facts.

## Module map and signatures

- `mazi/photo_facts.py` owns current authorized facts and minimal fact patches. It accepts store/user/group at the domain boundary. Its internal resolver consumes authorized source rows, review annotation and settled chat date order. `photo_facts(store, user, group, asset_ids)` returns a dictionary keyed by stable asset IDs. `patch_photo_facts(..., expected_revision, patch, request_key)` preserves omitted fields. Keep source fingerprints unchanged.
- Atlas attaches `PhotoFacts` directly to each photo. Search enriches only the bounded page it returns. The dedicated fact endpoint serves editing or a selected item and does not force a full Atlas query. Avoid requesting facts once per visible tile.
- `mazi/social/social.py` owns commands and queries as module functions against the existing concrete store. `plans`, `save_plan`, `set_attendance`, `comments`, `save_comment`, `delete_comment`, `set_reaction`, `activity`, and `home` keep transaction and authorization rules inside the domain. `mazi/social/server.py` owns the thin authenticated HTTP adapter.
- A small `authorized_target(store, user, group, target)` function is private to the social module. It reuses asset and approved-memory visibility, including hidden-event children. It returns canonical target information or raises Denied. Every social query and mutation calls it, including export enumeration. Do not expose a boolean `include_hidden` parameter.
- New social schema initializes from `MemoryStore.__init__`, like Advanced schema, without adding another inherited Store layer. Add the handler to the existing app chain once. This minimizes coupling to answers/discovery ownership.
- `src/social/api.ts` parses social HTTP values and handles status mapping. `src/social/Plans.tsx` and `src/social/Conversation.tsx` are React islands owned by the shell/detail, not new top-level navigation. Circle can render a native React `CircleSocial` above or next to its existing management feature until a later dedicated management rewrite is justified.
- `src/useHome.ts` owns Home's bounded request, cancellation and group epoch. `useArchive` only loads full Atlas for Atlas, Timeline, legacy sample Search and views that actually require it. Add `GET /api/atlas/memory?group=G&memory=M` plus `useMemory` for direct memory routes, using the same projection function with a bounded asset set. A Home response can seed the current memory view but cannot become an authorization cache.
- Expand `Destination` with `section`, `taskGroup` and `heading` fields. `sectionFor(path, search)` derives current section from path/query. Canonical aliases replace the current history entry before route publication. Shortcut focus happens on route entry only, not every data refresh.

## Storage invariants

Use separate tables for plans, attendance, comments, reactions, label dimensions and command keys. All include a group key and applicable owner key. Avoid one generic JSON entity table whose authorization depends on a kind switch everywhere.

The command-key primary key is `(group_id, actor_id, request_key)`. Persist the command fingerprint and result identity, including tombstones after record deletion. Exact replay returns the original surviving result or a deleted-result response, never resurrects data. Different payload on a used key is Conflict. Versioned edits and clear operations increment versions; deleting a label cannot reset its next version to zero.

Attendance and cancellation use one write transaction. CAS updates use `UPDATE ... WHERE revision=?`, then verify rowcount. Label bulk edits validate all visibility and versions before any update inside the same transaction. PostgreSQL must use the app's existing transaction/advisory-lock contract or explicit row locking; a preflight read outside that transaction is insufficient.

Use native PostgreSQL migration functions/triggers alongside equivalent SQLite triggers. Membership deletion clears authored labels, comments, reactions, attendance and owned plans with dependent attendance. Reads independently join current members so an interrupted or older cleanup path does not reveal departed authors. Restore verification must explicitly prove that a removed command-key tombstone cannot recreate content.

Plan wall time is parsed server-side with ZoneInfo. Compare the supplied local time against UTC round trips. Zero valid offsets means nonexistent time, two offsets requires an explicit offset/fold, and one is accepted. Store UTC instant plus the IANA zone and the chosen local time/offset; use server time for upcoming status.

## Why this differs from an Atlas-centered design

| Choice | Current-payload enrichment everywhere | Route-owned bounded reads, this candidate |
| --- | --- | --- |
| Metadata | Convenient for all current Atlas views, but first-time detail still downloads all cards | Enrich existing payloads where needed and fetch one selected fact/detail explicitly |
| Home | Can reuse Atlas immediately, but violates the H1 network acceptance gate | One bounded summary response and no notebook fan-out |
| Social | Adding methods to MemoryStore inheritance is familiar | Domain functions keep plans/comments independent of existing notebook ownership |
| Client | One huge archive state is simple initially | Separate Home and selected-memory request states isolate races and reduce transferred data |
| Cost | Fewer new endpoints | Two bounded reads and explicit route data ownership require new cancellation tests |

Choose this candidate if meeting the H1 no-Atlas gate and limiting coupling outweigh the small endpoint cost. Do not introduce a generic client cache, graph query layer, event bus or feed materialization.

## Safe delivery sequence

1. Merge the documentation PR after its own independent verdict. Fix any unrelated baseline CI failure separately if reproducible; do not weaken the feature acceptance tests.
2. A1 read model and display. Add stable photo IDs and shared evidence projection; render selected-photo metadata on both gallery modes, Viewer, detail, Home, Atlas/list and Timeline. Preserve old fields. Gate with existing Atlas and chronology tests plus synthetic browser comparisons.
3. N1 route registry and simpler Home. Canonicalize aliases, group Explore tasks, distinguish source-management query, make Home photo/title/button consistent, remove extra archive cards/contribution prompts. Update D26 with the visible Ana sayfa label and exact accessibility contracts. This unit can proceed independently of social writes.
4. A2 date basis and surgical fact edits. Make Search send chronology explicitly while omitted basis retains capture behavior. Add selected-photo edit and explicit full-memory scope. Include source withdrawal, source fingerprint and export regression in this same unit.
5. F1 labels domain/schema/read/write/export/cleanup, then UI editor. Deliver an internally usable API only after SQLite and hosted contracts pass. Commit no automatic inference or backfill job.
6. F2 shared same-photo filtering. The server computes matched asset IDs for Gallery and Search. Retain original photo indices in result links. Show only matched children when a filtered grouped card opens its gallery, or explicitly mark the match; never pretend a sibling matched. Add URL/Back/pagination semantics and documented counter denominator.
7. P1 plans/read/create/edit/cancel/attendance plus Circle and Add entries. No archive dependency. Include membership cleanup, zone ambiguity, replay and CAS tests, then desktop-create/phone-join browser evidence.
8. C1 comments for assets and approved memories. Keep notebook notes unchanged. Land reactions as a separate small PR with desired-state writes and restricted emoji set. Both include current target visibility, ownership export and departure cleanup.
9. H1 bounded Home summary and activity. Introduce route-owned Home/detail reads, remove Home's Atlas load, and use stable `(occurred_at, id)` cursor. No stored target excerpts or thumbnail duplication. Run two-session Ece/Deniz workflow and no-Atlas network contract.
10. Final integrated validation and deployment. Apply backward-compatible hosted migrations before the new reader/writer deployment. Keep new entries closed if the backend capability is unavailable. Verify production health and the signed-in authorized journey separately from M0-M7 acceptance. Five-friend findability and physical-phone pilot remain human evidence and must not be claimed by synthetic tests.

## Exact verification seams

Existing focused commands at the root:

```sh
.venv/bin/python -m unittest tests.backend.test_atlas tests.backend.test_atlas_projection tests.backend.test_atlas_place
.venv/bin/python -m unittest tests.backend.sources.test_places_export tests.backend.discovery.test_shared_by
node --test tests/unit/chronology.test.ts
node --test tests/dom/timeline-dates.test.mjs tests/dom/search-filters.test.mjs tests/dom/search-startup.test.mjs tests/dom/route-history.test.mjs
npx playwright test tests/interface-clarity.spec.ts tests/clarity-workspaces.spec.ts
npm run typecheck
npm run build
npm run lint
npm run check:budgets
npm run check:docs
git diff --check
```

New focused files should be `tests/backend/social/test_plans.py`, `test_conversations.py`, `test_labels.py`, `test_visibility.py`, `test_export.py`, and HTTP counterparts. Adapt the existing backend fixture structure instead of introducing a second app runner. Add deterministic same-second activity pagination fixtures, not wall-clock sleeps. Add DOM tests for request disposal and drafts, and `tests/social-space.spec.ts` for the two-profile desktop/phone journey.

Hosted mutation contracts must target an isolated schema ending `_test`, as required by `require_synthetic_schema`. Never run `npm run test:postgres` against the live schema. Extend PostgreSQL cleanup tests so removal through `identity.Store` also removes all new contributions. Check representative `EXPLAIN` plans for group/target comment pagination and group/time activity reads.

At the end run `npm run test:backend`, `npm run test:unit`, `npm run test:dom`, `npm test`, `npm run test:app` and the required build/lint/docs/budget checks once against the integrated head. Record environment, exact revision and evidence paths. No runtime behavior was changed or tested by this read-only design task.
