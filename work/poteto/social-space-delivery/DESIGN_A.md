# Candidate A for the social-space delivery

## Problem and traced ownership

At `456c49c`, the source of truth is `archive_assets.id`, not a rendition URL. `mazi/archive/review.py::_timeline_items` reads current authorized origins and annotations but resolves only capture dates. `mazi/atlas.py::atlas_view` groups those rows into approved memories and loose photos, then separately joins sharing provenance and places. Its photos omit identity and their own chronology/place. `src/memory/chronology.ts` reconstructs sharing fallback in the browser. Search independently constructs capture-only documents in both `DiscoveryStore._document` and the streamed `_keyword_documents` path. Fixing only one produces inconsistent small/large or keyword/semantic behavior.

`MemoryStore` inherits `AnswerStore`, `DiscoveryStore`, `SourceStore`, and `ReviewStore`. `mazi/server.py` wraps the corresponding handler inheritance chain. `_visible_ids` applies active-origin ownership plus personal hidden photos. `_approved` additionally requires every original approved-event child to remain visible. Atlas adds hidden-event children to its exclusion set. These rules need one named target resolver for social features rather than route-specific checks.

`initialize_schema` executes SQLite DDL only. Hosted DDL is exclusively in `infra/hosted/supabase/migrations`. `PostgresConnection` serializes writes with the archive advisory lock and exposes shared read transactions. Existing export walks repeatable sorted rows through `ExportFingerprint`, then compares a second current metadata snapshot before delivery. New mutable records must participate in both export passes. Member deletion occurs in more than one application path, so lifecycle cleanup belongs in equivalent SQLite and PostgreSQL member-deletion triggers.

## Usage, before the types

Atlas and Search consume the same resolved photo record after each has selected permitted origins:

```python
photo = resolve_photo(asset_id, origins, annotation, shared_places, date_order)
card['photos'].append(photo.as_atlas_photo())
if matches_dates(photo, basis='chronology', start=start, through=end):
    search_page.append(photo.as_search_result())
```

Only the domain command writes a plan. The HTTP adapter validates JSON and maps domain exceptions:

```python
plan = store.create_plan(user, group, request_key, fields)
store.set_attendance(user, group, plan['id'], 'going')
thread = store.comments(user, group, Target('photo', asset_id), cursor=None)
```

Home asks for one bounded response. It does not fetch Atlas and then hide all but one item:

```typescript
const summary = await api.home(group, signal);
// summary has the next plan, at most three activity rows, and at most one fallback memory.
```

## Shape

### A1 and A2 share a photo metadata resolver

Add `mazi/archive/photo_metadata.py` for pure evidence interpretation. Use one loader in `ReviewStore` for authorized evidence batches. Atlas and Discovery retain responsibility for visibility and their existing metadata budgets. The resolver takes already-permitted records and does not query or mutate storage.

```python
@dataclass(frozen=True)
class PhotoDate:
    basis: Literal['capture', 'shared', 'unknown']
    status: Literal['exact', 'approximate', 'range', 'conflict', 'ambiguous', 'unknown']
    days: tuple[str, ...]
    start: str | None
    through: str | None
    timezone: str | None

@dataclass(frozen=True)
class PhotoPlace:
    status: Literal['known', 'unmapped', 'conflict', 'unknown']
    text: str | None
    pin: dict | None

@dataclass(frozen=True)
class PhotoMetadata:
    asset_id: str
    capture: PhotoDate
    shared: tuple[PhotoDate, ...]
    chronology: PhotoDate
    place: PhotoPlace

def resolve_photo(asset_id, origins, annotation, places, date_order) -> PhotoMetadata:
    raise NotImplementedError

def matches_dates(photo, basis, start, through) -> bool:
    raise NotImplementedError
```

Preserve the original `date`, `year`, `place`, `dateBasis`, and fingerprints for old consumers while adding photo metadata. An explicit `date_basis` selects capture, sharing, or chronology filtering. Omitted means the legacy capture behavior. Conflict matches actual evidence days rather than every day between extrema. Genuine approximate/range evidence matches its represented interval. Display and filtering never convert naive local days through the viewer's timezone. Discord UTC provenance retains that qualification.

The proposed additive wire contract is `Photo.assetId` plus `Photo.evidence`. Its exact types are:

```typescript
type DateEvidence = {
  basis: "capture" | "shared" | "unknown";
  status: "exact" | "approximate" | "range" | "conflict" | "ambiguous" | "unknown";
  days: string[];
  start: string | null;
  through: string | null;
  timezone: string | null;
};
type PhotoEvidence = {
  capture: DateEvidence;
  shared: DateEvidence[];
  chronology: DateEvidence;
  place: {
    status: "known" | "unmapped" | "conflict" | "unknown";
    text: string | null;
    pin: Place | null;
  };
};
```

An unknown date has `basis: "unknown"`, `status: "unknown"`, empty `days`, and null interval/zone fields. An exact capture has `days: ["2020-01-02"]` and equal start/through. Multiple contradictory exact capture assertions use `status: "conflict"`, sorted distinct actual `days`, and min/max interval for display only. Its chronology retains the capture conflict; it does not choose a source or replace it with sharing. A sharing-only Discord photo has unknown capture, shared exact evidence for `2024-01-02` qualified `timezone: "UTC"`, and that earliest reliable share as chronology. Unknown place has null text/pin; unmapped reviewed text stays visible with null pin. Keep `Photo.provenance` unchanged for sender/raw per-origin evidence.

A1 needs no new HTTP endpoint or schema. `/api/atlas` adds these fields to each photo and all consumers render them. A2 extends `/api/discovery/search` with optional `date_basis=capture|shared|chronology`, and adds `POST /api/atlas/photo` with `{group,asset,changes:{capture_date?,place?}}`; an optional explicit bounded `assets` selection is a subsequent batch refinement. The server rejects mixed single/batch targets and preserves every omitted annotation field. F1 later adds its separate label endpoints rather than growing this metadata correction command.

Chat date-order evidence must be scoped by import-run and conversation, as Atlas already does with `_export`. The resolver cannot infer day/month order from the selected photo alone. Prepare allowed conversation order evidence once per read, including context, then pass that context into pure resolution. Do not overwrite raw origin payloads or fingerprint inputs.

Reviewed place text outranks source place assertions even when it cannot map to a city. A mapped pin uses the existing canonical city centroid. Each photo owns its own place. Summary place becomes known only when every child has the same mapped city; mixed children produce multiple/unknown state without copying a sibling's location.

Add `PhotoMetadata` and a shared React `PhotoFacts` component. The legacy feature mounts in `src/features/memories/gallery.js` and `src/features/discovery/views.js` should use one formatting function from a small JS-compatible metadata module, rather than importing React or duplicating date rules. `Viewer`, `MemoryView`, Home, Atlas/list, Timeline, and both gallery layouts render explicit date basis and place status. Viewer uses its current photo index.

For A2, add `correct_photo(user, group, asset, changes)` with an allowlisted patch of date/place fields. Read the annotation inside the write transaction, preserve unspecified title/place/date/anniversary, and make any whole-memory action explicitly name its selected asset set. Existing `correct_asset` replaces every field, so calling it with defaults would erase unrelated values. Return updated metadata after commit and refresh the current card/search/place list. Add a bounded explicit asset-selection variant for place batches only after single-photo behavior passes.

### F1 and F2 use versioned independent declarations

Create `photo_labels(group_id, asset_id, dimension, value, method, actor_id, revision, updated_at)`, with primary key `(group_id,asset_id,dimension)`. Dimensions are `people_present`, `screenshot`, and `ai`. Enum tables in code validate values. No row means unknown revision zero. Clearing writes an unknown row with a new revision, preserving conflict detection. Approved person associations continue to live in Discovery. Visible associations derive `people_present=yes`; setting `no` when such a tag exists is rejected.

One transaction processes at most 50 unique asset targets. Validate every asset against current group and hidden-event access, then validate every expected dimension revision, then write all rows. An invalid target or stale revision rolls back everything. Store command receipts by `(group,actor,request_key)` with a canonical payload digest and result identity. Same key plus same payload returns the prior outcome after rechecking current access. Different payload conflicts. A receipt cannot recreate a row after deletion.

Add the labels to both search document paths. One `PhotoFilter` object holds person, label sets, source, sharer, and date basis. Each document is one asset, so AND across dimensions cannot accidentally match sibling photos. The gallery consumes the server's same permitted matching asset IDs and keeps only those children when an existing grouped card is displayed. Context or memory result types that cannot enforce the same-asset relation are explicitly excluded while photo filters are active. Facets remain a separate full-visible-set pass before active filters, and the filtered total remains separate.

### P1 and C1 deepen one social domain

Add `mazi/social/social.py::SocialStore(MemoryStore)` and `mazi/social/server.py::handler_for`, then use that store/handler in the unified app and Vercel entry point. Keep schema strings beside the domain and add matching hosted migrations. Avoid putting social writes into Atlas or `MemoryStore` itself.

Tables:

- `social_plans(id,group_id,organizer_id,title,starts_at,ends_at,timezone,local_start,local_end,start_offset,end_offset,place,description,status,revision,created_at,updated_at)`. UTC instants order plans; IANA zone and selected wall-time offsets preserve editing intent. Optional event linkage uses a nullable event ID and is resolved for current access at read time.
- `social_attendance(plan_id,member_id,response,updated_at)` with primary key `(plan_id,member_id)`. Setting the current response is idempotent; clearing deletes it.
- `social_comments(id,group_id,target_kind,target_id,author_id,text,revision,created_at,updated_at,deleted)` with immutable ID and creation timestamp. Updates and tombstone deletes require expected revision. Multiple rows per author are allowed.
- `social_reactions(group_id,target_kind,target_id,member_id,emoji,created_at)` with a unique key covering all fields except time. The request specifies desired enabled state, not toggle.
- `social_commands(group_id,actor_id,request_key,payload_hash,result_kind,result_id,created_at)` with a composite primary key. Persist receipts after content deletion so retries cannot resurrect content.

Use a closed `Target(kind,id)` model with kinds `photo`, `memory`, and `comment`. Photo targets use the asset ID, memory targets use the `review_events.id`, and comment targets resolve their underlying original target recursively once. Do not use `advanced_stories.id` or rendition IDs. Do not permit reactions on notebook contribution composite keys.

Public methods are `plans`, `plan`, `create_plan`, `update_plan`, `cancel_plan`, `set_attendance`, `comments`, `create_comment`, `update_comment`, `delete_comment`, `set_reaction`, `activity`, and `home`. Transport is `/api/social/<operation>`. An internal `_target(user,group,target)` centralizes active membership, target group, personal hides, hidden-event children, complete event-child visibility, and author membership. Return no text, count, thumbnail, or reaction when it fails.

Use current server-generated UTC timestamps with microsecond precision plus stable IDs for keyset cursors. Activity is a query over current plans, comments, and reactions; no copied text, thumbnails, or independent cached counters. Read filtering precedes limits. A bounded SQL candidate query can need several chunks to fill a page after target permission checks. Cursor advances over examined rows, and `(created_at,id)` strictly orders equal timestamps. Home caps returned activity at three and deduplicates the highlighted object.

Plan wall-clock validation uses `zoneinfo.ZoneInfo` round trips through UTC. A nonexistent wall time is invalid; an ambiguous wall time requires one of the valid offsets. Reject ends at or before start. Plan update/cancel and attendance validate status in the same `store.transaction()` as the write. Both SQLite `BEGIN IMMEDIATE` and hosted exclusive archive locks already serialize cancellation versus attendance.

### N1 and H1 own navigation and loading state

Turn `src/navigation.ts` destinations into a registry with task group, owning main section, path/query, heading, and focus target. Explore groups are Find, Browse, and Remember together, with Turkish visible labels. Source management points to `/places?section=sources` and belongs to Circle; place review belongs to Explore. Alias normalization replaces history entries for `/people` and `/settings` before route matching. Preserve real Discord `code/state` processing before section selection.

Use Home's own abortable bounded summary loader, keyed by group. Change `useArchive` so Home is not an Atlas-requiring path. Detail can load a single card through an explicit authorized endpoint when entered directly; returning from Atlas can retain its current loaded data. Social draft state is scoped to `(group,user,target)` in mounted memory only, remains on retryable failures, and clears on session/group/access loss. Every async completion compares its request generation before committing UI state.

## Proposed verifiable PR units

1. A1 read model and photo facts, with old fields/fingerprints retained. Red fixture has capture date and İstanbul; Discord fixture has sharing fallback and unknown place. Unit, backend, DOM, and desktop/phone screenshot coverage.
2. A2 date-basis search and selected-photo correction. Cover keyword/semantic and streamed small/large paths, ambiguity, exact evidence-day conflict filtering, sibling preservation, removed-pin non-resurrection, and export.
3. N1 destination registry, broken aliases, grouped Explore, and simple Home. Can develop independently after the plan merge, but coordinate Home metadata edits after A1.
4. F1 labels domain plus single/bulk editor, migration, deletion/export/idempotency/CAS. Do not split schema/lifecycle away from its writer.
5. F2 same-photo filter integration across gallery and search, with URL and facet contracts.
6. P1 plans and attendance domain/UI, migration, timezone cases, ownership/export/departure. Does not wait for labels.
7. C1 comments domain/UI plus visibility, migration, ownership/export/departure.
8. C1 reactions as a smaller follow-up, with repeated desired state and deleted-comment cleanup tests.
9. H1 bounded summary/activity endpoint plus social Home and Circle activity. Prove zero Atlas and notebook requests at initial Home load.
10. Integration/release evidence only after the full two-member journey and all gates pass. Physical-phone and five-friend pilot evidence remain separate human acceptance, never fabricated.

## Exact test seams and verification

Baseline and focused checks use the shared existing `.venv` if the worktree lacks one, without copying credentials:

```sh
python3 work/poteto/product-plan/verify_docs.py
npm run typecheck
npm run test:unit
node --test tests/unit/chronology.test.ts
node --test tests/dom/timeline-dates.test.mjs tests/dom/search-filters.test.mjs tests/dom/search-startup.test.mjs
.venv/bin/python -m unittest tests.backend.test_atlas tests.backend.test_atlas_projection tests.backend.test_atlas_place tests.backend.archive.test_chronology
.venv/bin/python -m unittest tests.backend.discovery.test_shared_by tests.backend.discovery.test_keyword_scaling tests.backend.discovery.test_keyword_budgets tests.backend.discovery.test_api
.venv/bin/python -m unittest tests.backend.sources.test_places_export tests.backend.discovery.test_people_export tests.backend.test_export_admission tests.backend.test_export_postgres_order
npx playwright test tests/interface-clarity.spec.ts tests/clarity-workspaces.spec.ts
```

Add `tests/backend/social/` for domain and HTTP contracts using temporary archives and synthetic users/groups. Add migration inventory, trigger, privilege, and query-plan assertions to `tests/backend/test_postgres.py` and the hosted suite. Run `npm run test:postgres` only against the configured test schema, never mutate the production schema as a test. For release run `npm run build`, `npm run lint`, `npm run check:budgets`, `npm run check:docs`, `npm run test:backend`, `npm run test:unit`, `npm run test:dom`, `npm test`, and `npm run test:app`, plus `git diff --check`.

## Tradeoffs accepted

- Retain legacy capture-only fields and default search semantics while adding explicit evidence fields. This keeps old clients/bookmarks stable while new UI chooses chronology explicitly.
- Compute authorized activity from source social tables instead of materializing a second feed. This simplifies deletion and privacy, while indexed candidate scans need careful keyset pagination.
- Store command receipts separately from mutable content. This adds one table but prevents lost-response duplicates and resurrection after deletion.
- Use a new `SocialStore` at the outer application composition boundary. This follows the current runtime shape without entangling existing notebook semantics.

## Alternatives considered

A materialized `photo_projection` plus `social_activity` table would reduce read computation but require correctness across every import, source withdrawal, member departure, correction, hidden state, and restore. Per-user visibility would still need current target resolution. It moves more consistency work into every writer and does not justify the extra state for the current archive size.

Adding more frontend chronology fallbacks and per-screen labels is smaller initially but exposes raw evidence interpretation to every caller, leaves Search inconsistent, and cannot support server-authoritative date filters. Extending Atlas with social data would force Home to load the entire archive and violate H1's network contract.

## Synthesis decision

Pending parent comparison with candidate B. The invariants above are design suggestions, not implemented behavior.

## Open risks

- The current `_place` averages equal canonical source coordinates and can produce a tiny float discrepancy. Use the canonical matched centroid rather than averaging repeated identical canonical values when implementing A1, and verify whether this explains PR112's existing CI failure.
- A2 must preserve the legacy annotation fields and re-check export admission after concurrent changes. Correcting date via the old replacement endpoint with omitted fields is unsafe.
- Streaming Search has strict per-origin, per-asset, total-byte, count, and elapsed-time budgets. The metadata integration must not reintroduce a full Atlas read or unbounded origin materialization.
- Member-deletion triggers must clean labels, comments, plans, attendance, and reactions even for admin removal. Reads additionally require current actor membership so stale restored records stay inaccessible.
- Deploy schema migrations before deploying code that accesses new tables. New-table grants, RLS enablement, and revocation of public/anon/authenticated privileges are part of each migration.
- A group pilot involving five real friends and physical-phone verification cannot be replaced by synthetic browser evidence. Keep those acceptance rows explicitly unverified until observed.

## Next implementation step

Expose the missing per-photo metadata with an A1 backend regression in `tests/backend/test_atlas.py`, then add the pure evidence resolver and the shared photo facts renderer.
