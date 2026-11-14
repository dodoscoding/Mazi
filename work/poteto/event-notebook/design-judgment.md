# Event notebook design judgment

Choose **Candidate B**, with the small client-state grafts below. Its event capability earns the extra routes by owning selection, creation, authorization and writing together. Candidate A is viable, but its create-then-write protocol makes the browser recover an operation the existing database transaction can complete atomically.

This is an independent review of [A](sketch-a.md) and [B](sketch-b.md) against [the brief](BRIEF.md), using one model family. It is not cross-family validation. No application code changed and no behavior tests were run for this design review.

## Rubric

Scores are 1–5; 5 best satisfies the criterion as written.

| Criterion | A | B | Evidence and implication |
| --- | ---: | ---: | --- |
| Preserves every legacy note, visibility and ownership | 5 | 5 | Both retain all stories and exact story/author targets, reuse full-event authorization, and mutate only the authenticated member's contribution. Neither collapses notes by author. |
| Reliable first save and conflict semantics | 3 | 5 | A acknowledges non-idempotent creation and tolerates empty duplicates. B can select/create/write inside the existing exclusive transaction and reject repeated first saves once a contribution exists. Saved targets retain story revision checks. |
| Small understandable client API and implementation | 4 | 4 | A changes less backend code but makes the client own storage topology and ambiguous create recovery. B hides that protocol, but needs a defined conflict result/state and should avoid its unnecessary multiple-draft machinery. |
| Responsive title-to-text experience | 3 | 5 | A links titles but does not specify arrival past the photo viewer. B explicitly focuses and reveals the notebook for title navigation while preserving photo navigation. |
| Verifiable with the existing harness | 5 | 4 | A mostly extends established endpoint contracts. B fits the same backend/HTTP/DOM/browser harnesses but adds an essential concurrent-first-save and rollback test seam. Both specify real persistence and privacy lifecycle checks. |
| **Total** | **20** | **23** | **B is the base; its remaining interface gaps are bounded.** |

## Grounding that determines the choice

The current data model permits many stories per event and one contribution per `(story, author)`; it does not enforce one note per event. `_approved` suppresses an entire event when any original asset is unavailable, `_story` applies that policy, and `_story_view` computes ownership from the authenticated user. Preserve these decisions rather than introducing notebook-specific visibility or author selection. See [memory domain](../../../mazi/memories/memories.py), lines 12–17 and 36–90.

`create_story` commits an empty story independently of `write_story`; creation consumes one of the group's 100 story slots. A lost create response, crash or competing browser can therefore leave a persisted empty story. A's reload-before-retry helps recovery but cannot make the two requests atomic. This is a real tradeoff, not evidence that A loses existing content. See the same file, lines 92–117.

B's atomicity assumption is supported by the actual adapters. [ImportStore.transaction](../../../mazi/imports/engine.py), lines 181–189, starts `BEGIN IMMEDIATE` and rolls back on failure. [PostgresDB](../../../mazi/persistence.py), lines 132–150 and 167–171, translates that begin into an exclusive archive advisory transaction lock. The selection and insert therefore can serialize under the current archive transaction boundary. No new event lock or unique schema constraint is needed for this notebook command. This is static evidence; a two-connection race test must still prove the implementation.

Do not call public `create_story` or `write_story` inside the new outer transaction: they already own transactions. Extract only the shared private mutation behavior needed by both entry points, or perform the small mutation directly while sharing the existing authorization/revision helpers. Keep one transaction owner for the notebook write, including its returned notebook snapshot and audit records.

The current [MemoryView](../../../src/MemoryView.tsx), lines 169–194, renders `Viewer` before the title, description and conversation. The viewer stage has a 360–600px height in [memory.css](../../../src/styles/memory.css), line 182. B addresses a concrete title-click UX gap by revealing the text section rather than merely changing the route.

## Grafts and required clarifications

1. **Graft A's one active editor and tagged lifecycle into B's event capability.** Keep exact saved targets and one local draft, with editing/saving/conflict states. Every legacy note retains its Edit action. Multiple simultaneous drafts are unnecessary for this brief and multiply recovery state.
2. **Make conflict recovery representable.** B's sketched `save(): Promise<void>` and coarse loading status do not tell the UI whether a failed save requires refresh or permits retry. Add a small domain save result or editor conflict state behind the notebook module; keep HTTP responses/status parsing private. After conflict, retain the draft, require an explicit refresh, and require an explicit subsequent Save. Never derive a saved note's revision from a refreshed notebook silently while leaving Save immediately available.
3. **Graft A's explicit null-event guard and generation discipline.** Sample mode and standalone photos make no notebook requests. Group/event identity is explicit. Clear both response and draft on hidden/pagehide/access loss/scope changes, abort pending work, and check generation after every await. An aborted request may still commit server-side; foreground reload must discover that result.
4. **Keep B's title arrival contract.** Use canonical event IDs with the notebook flag for event titles, including Home/Portal/gallery/review/recap/story surfaces. Focus a stable notebook heading without stealing focus when an async response arrives. Verify first readable text is visible on phone and desktop. Photo controls retain their established viewer behavior.
5. **Specify first-save and deletion boundaries.** Validate text before creating; an empty new note creates nothing. Under the transaction, conflict if any current-user contribution already exists for that event, rather than choosing one to overwrite. A saved target must match the requested event and an owned contribution; deletion removes only that contribution. Preserve the established story revision contract and the 100-story limit. Returning the complete notebook must retain unrelated local draft text.

## Rejected ideas

- Do not graft A's browser create-then-write sequence or ambiguous-create state into B. The atomic capability removes that client protocol.
- Do not add a unique event-note store, migration, per-event lock, or new persistence model. Existing stories and archive transactions suffice.
- Do not treat B's first-note policy as a new global invariant. Existing story endpoints preserve historical semantics; the notebook command must tolerate all legacy notes and coexist with those writers.
- Do not put all contributions in Atlas cards or use a first-story/first-author projection. That expands private loading or hides data without simplifying this event editor.
- Do not add service chains, transport-type exports, or independent drafts for every card. Keep the server capability in `MemoryStore` and the client lifecycle in one notebook module.

## Implementation acceptance gates

Start with synthetic backend tests covering two stories, repeated authors, owner-only edits, cross-event target denial, full-event withdrawal/departure denial, story revision conflicts, empty-first-save no-op, limit rollback, and response-loss replay. Add a real two-connection first-save race: one contribution survives, the competing request conflicts, no extra empty story remains, and a failed write rolls back creation. Do not claim hosted adapter concurrency was executed unless an actual Postgres fixture was used.

Reuse [memory tests](../../../tests/backend/memories/test_memories.py) and its HTTP counterpart for domain/transport evidence; [feature harness](../../../tests/dom/feature-harness.mjs) and [archive lifecycle tests](../../../tests/dom/archive-hook.test.mjs) provide deferred-request and privacy-transition patterns. Assert retained draft through 409/5xx, explicit refresh-before-save, blocked duplicate submits, and no late private-text resurrection. Browser evidence must show title click → readable text → save → reload persistence, another member's read-only view, and independent editing of each legacy note. Cover desktop/phone, day/night, keyboard, reduced motion, axe and overflow.

Run the brief's build, formatting, documentation and final repository suites after focused contracts pass. These gates are requirements for implementation, not results of this review.

The **Laziness Protocol** changed the recommendation toward one existing transactional capability, one editor, and no new schema or lock. The architect red-flag screen favors B because the server boundary hides a complete operation instead of forwarding the same write arguments through another layer.
