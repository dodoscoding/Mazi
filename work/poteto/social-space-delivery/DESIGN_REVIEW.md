# Independent design comparison

Verdict: choose Candidate B for route-owned reads and social module composition, with Candidate A's pure photo-evidence resolver and explicit wire record. Both candidates were read in full. The choice below is a design contract, not evidence that the features work.

## Scores

Scores are 1 to 5. A higher score better satisfies the stated criterion.

| Criterion | Candidate A | Candidate B | Evidence and decision |
| --- | --- | --- | --- |
| Complete plan semantics | 5 | 4 | A defines exact/range/conflict date evidence and source date-order preparation more precisely. B must add interval fields and must resolve date evidence before date filtering, not only when enriching the returned page. |
| Current visibility, export and lifecycle reuse | 5 | 5 | Both identify `_visible_ids`, `_approved`, hidden-event children, dual export admission passes and membership-delete triggers. These match current source. Neither may substitute membership-only checks. |
| H1 bounded loading | 4 | 5 | Both reject an Atlas-fed Home, but B gives bounded Home and selected-memory reads their own route owners and makes the no-Atlas requirement structural. |
| Transactional replay, CAS and hosted parity | 5 | 5 | Both require durable command receipts, no resurrection, in-transaction attendance/cancellation, expected revisions and equivalent hosted migration/cleanup behavior. |
| Smallest maintainable interface | 4 | 5 | B avoids another Store inheritance layer and keeps social rules behind module functions. A's pure evidence resolver is preferable to a public metadata service that requires callers to understand store internals. |

B wins the overall module and loading structure. A supplies the stronger evidence model. This is a targeted combination of complementary boundaries. It does not require adopting both candidates' endpoint inventories.

## Chosen photo contract

Use additive `Photo.assetId` and `Photo.evidence`. The durable ID is `archive_assets.id`.

```typescript
type DateEvidence = {
  basis: 'capture' | 'shared' | 'unknown';
  status: 'exact' | 'approximate' | 'range' | 'conflict' | 'ambiguous' | 'unknown';
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
    status: 'known' | 'unmapped' | 'conflict' | 'unknown';
    text: string | null;
    pin: Place | null;
  };
};
```

The summary of multiple children separately represents multiple places and incomplete dates. Do not add `multiple` to a single-photo place merely to encode sibling disagreement. Preserve legacy fields and provenance. Do not store formatted UI labels as evidence. A shared formatter owns Turkish display text.

A pure resolver accepts permitted origins, the existing review annotation, permitted place evidence and settled conversation date order. It returns PhotoEvidence. Callers remain responsible for selecting authorized inputs. Resolve evidence before date matching and ranking on every Search document path. Enriching only an already-filtered page cannot repair chronology filtering. Keep Search's existing byte/time/count bounds. Conversation date-order evidence must be scoped by import run and conversation; it cannot be inferred from the selected photo alone.

Legacy Search with no `date_basis` retains capture filtering. New UI sends `date_basis=chronology`. `shared` matches any valid share in the interval. Conflicts match proven days, not the gap between them. Genuine ranges match their evidenced interval. No uploaded-at capture fallback or viewer-timezone day conversion is allowed.

For A1, enrich existing Atlas photos and implement one common presentation formatter. A dedicated fact endpoint is unnecessary until an editor needs it. For A2, expose one selected-photo patch command with an allowlisted change object. It preserves every omitted review field and requires explicit asset IDs for any batch. Never call the replacement `correct_asset` API with default-empty fields.

## Chosen social boundary

Implement functions in `mazi/social/social.py` against the existing concrete store. Put DDL in `mazi/social/schema.py`, initialize it once from MemoryStore, and keep the authenticated HTTP adapter in `mazi/social/server.py`. Avoid adding SocialStore inheritance. No generic entity JSON table, event bus, materialized activity table or generic cache is justified.

Use an internal typed target with `kind='photo'` and `id=archive_assets.id`, or `kind='memory'` and `id=review_events.id`. A reaction may also target a comment ID, whose original photo/memory target is reauthorized. Notebook contribution keys are not social comment IDs. Choose the word `photo` consistently on the wire rather than alternating between `asset` and `photo`.

The domain's public operations are bounded plan list/get, create/update/cancel plan, set attendance state, bounded comment list, create/update/delete comment, set reaction state, bounded activity and bounded Home summary. HTTP routes under `/api/social/` adapt these operations without duplicating membership, revision or retry logic.

Every read, write, count, activity row and export contribution resolves current target visibility. Photo checks include reader-hidden photos and hidden-event children. Memory checks require every original child to remain visible. Failed resolution returns no text, count, thumbnail or reaction. Departed authors do not remain visible merely because cleanup has not run.

Persist receipts under `(group_id, actor_id, request_key)` with canonical payload hash, operation, result identity and deleted-result state. Exact replay rechecks access and returns the same surviving result or explicit deleted-result response. Different payload conflicts. A receipt never recreates deleted content. Keep validation, receipt lookup/write and mutation inside one write transaction. Update and clear operations increment versions; use `UPDATE ... WHERE revision=?` and inspect rowcount. SQLite and hosted behavior must match.

Keep independent relational tables for labels, plans, attendance, comments, reactions and receipts. Label bulk writes accept at most 50 unique targets and validate every target/revision before any mutation in the transaction. Member-delete cleanup must run through identity.Store, with SQLite and hosted triggers in the same feature slice. Export adds contributions to both ZIP assembly and final admission fingerprints.

## Chosen H1 and client ownership

Home owns an abortable group-scoped `GET /api/social/home` request. It returns at most one highlighted plan/conversation, three visible activity items, and one fallback memory. It does not call Atlas or notebook endpoints. A direct memory route uses a bounded authorized memory endpoint and its own request owner. Returning from Atlas may reuse the loaded selected card for display, but every later action still authorizes on the server.

A result limit is not enough to prove bounded work. Candidate selection and projection must use indexed queries and bounded chunks rather than calling `atlas_view` and slicing afterward. Shared code may project a selected bounded asset set. The existing `atlas_view` first builds all timeline items and all approved memories, so adding a selected-ID argument only after those reads would fail H1's cost contract.

Use existing lifecycle disposal for imperative feature mounts and group/request epochs for React loaders. Scope drafts to user, group and target in tab memory. Preserve drafts on retryable failures and clear them on access/session/group loss. Navigation uses one destination registry with query-aware section ownership and history-replacing aliases.

## Required implementation gates

1. A1 must first fail the known date/place and sharing-only fixtures, then pass backend, formatter, DOM and browser checks across selected-photo changes.
2. A2 must prove legacy capture default, explicit chronology/shared semantics, annotation-field preservation, sibling isolation, withdrawal and export behavior.
3. New mutable domains cannot ship with schema-only or UI-only lifecycle coverage. Hosted migrations, isolated-schema parity, identity-trigger cleanup and export admission are part of their feature acceptance.
4. P1 must exercise nonexistent and ambiguous wall times, cancellation versus attendance, replay after lost response and replay after deletion.
5. C1 must exercise hidden/withdrawn targets, multiple comments per author, stale revisions, desired reaction state and deleted-comment reaction cleanup.
6. H1 must assert zero initial Atlas/notebook requests and verify current-access pagination when actions share timestamps or are filtered away.

## Specific rejected details

- A's new SocialStore subclass adds runtime composition without hiding more domain knowledge than B's functions. Existing MemoryStore initialization already provides a narrow schema integration point.
- B's server-side `label` fields are presentation duplication. Use evidence plus one formatter.
- B's page-only Search enrichment is acceptable for optional display fields, but insufficient for date or label predicates. Those facts must be available before matching.
- A's suggestion that the Atlas centroid average might explain PR112's GPS CI failure is unsupported. The reproduced CI failure is directly in `gps_degrees` under Python 3.11, before Atlas is involved. Keep that baseline fix separate.

Review used GPT-6.1 Sol with high reasoning. It is independent review within one model family, not cross-family validation.
