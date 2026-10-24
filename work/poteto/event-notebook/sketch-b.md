# Candidate B: event notebook capability

## Problem

An approved event is the canonical navigation object, while member recollections live in many advanced stories per event. The event page must show every eligible contribution, permit only its author to edit it, and preserve the existing full-event visibility boundary. `MemoryStore._approved`, `_story_view`, `create_story`, and `write_story` already own those rules and persistence. Letting React coordinate story enumeration, creation, and writing exposes storage organization and makes the first-save race a UI concern. This candidate puts that coordination behind an event notebook capability without new tables.

Scope: design only at base c9b5804. Ground and sketch complete; synthesis belongs to the parent. Implementation and scrap phases are deferred to that choice.

## Usage (caller's view)

Open an event title through `#/memory/<event-id>?notebook=1`. MemoryView continues displaying atlas context and mounts a notebook for approved events only. Extend readRoute with a notebook flag; when the approved event notebook heading is present, focus it with preventScroll then scroll its containing section into view. This exposes text immediately despite the existing full-height Viewer above it. Do not perform a long smooth scroll under reduced motion. Existing photo links and direct routes retain their viewer-first behavior. Home featured h2 and Portal h2 should become title links with this flag, along with gallery moment headings, accepted review titles, recap and story headings. Preserve surrounding cards and avoid nested anchors.

```tsx
const notebook = useEventNotebook({ groupId, eventId: memory.id });
<EventNotes notebook={notebook} />
// Existing note: the hook retains each editor draft independently.
await notebook.save({ target: note.target, text: draft });
// First contribution: the server chooses or creates an eligible story atomically.
await notebook.save({ target: notebook.newNoteTarget, text: draft });
```

A failed save keeps the input and enables retry. A conflict keeps the draft, offers “Refresh saved notes,” and requires another explicit Save after refreshed context. The UI receives the changed notebook from a successful mutation, without reloading unrelated photos or discarding neighboring drafts.

## Shape

```ts
type SavedNoteTarget = Readonly<{
  kind: "saved";
  storyId: string;
  revision: number;
}>;
type NewNoteTarget = Readonly<{ kind: "new" }>;
type Note = Readonly<{
  id: string; // stable story+author identity; no array-index keys
  authorName: string;
  text: string;
  ownership:
    | { kind: "other" }
    | { kind: "mine"; target: SavedNoteTarget };
}>;
type Notebook = Readonly<{
  eventId: string;
  sections: readonly {
    id: string; // existing story ID
    notes: readonly Note[];
  }[];
  newNoteTarget: NewNoteTarget;
}>;
// Public component surface; fetch Response and status-code parsing stay private.
function useEventNotebook(scope: { groupId: string; eventId: string }): {
  status: "loading" | "ready" | "unavailable" | "error";
  value: Notebook | null;
  save(change: { target: SavedNoteTarget | NewNoteTarget; text: string }): Promise<void>;
  refresh(): Promise<void>;
}; // not implemented
```

```python
# Methods remain on MemoryStore, next to existing story authorization/write logic.
def event_notebook(self, user, group, event):
    """Return all stories and contributions for this fully visible approved event."""
    raise NotImplementedError

def write_event_note(self, user, group, event, target, content):
    """Atomically choose/create a story or update caller's existing contribution.

    Saved targets validate event/story association and existing story revision.
    No author parameter is accepted. Return the complete current notebook.
    """
    raise NotImplementedError
```

Transport is a GET `/api/memories/notebook?group=…&event=…` and POST `/api/memories/note` with group, event, target and text. The handler parses input; domain methods authorize and mutate inside the existing transaction mechanism. Existing story endpoints stay supported.

For a saved target, require the story to belong to the requested event, call the existing revision-aware write behavior, and touch only `(story, current_user)`. For a new target, re-evaluate under the transaction: select an existing current-user contribution for this event if one exists and return a conflict rather than overwrite it; otherwise select a stable existing event story, or create one if none exists, and write only the caller's contribution. Concurrent first saves must serialize the selection and insert together; verify the actual transaction implementation supports this before implementation. A repeated first-save request after a lost response must return conflict plus refresh recovery, never silently overwrite or create a duplicate. Empty new notes should create nothing. Removing a saved note deletes its contribution, never the story or someone else's content.

All stories are returned, including empty stories and multiple existing notes by the same author in different stories. Stable sections preserve that structure; the UI can visually combine reading while retaining separate edit targets. New-note action is hidden when the current member already has a note anywhere in the event; existing multiple notes remain individually editable. The server enforces this default first-note policy, while old story endpoints retain their historical semantics.

Resolve author display names on the server from group-linked shared profiles with a safe “Group member” fallback; never invent an identity or infer membership from names. Do not introduce a second visibility implementation: reuse `_approved`/`_story` and active-source atlas context. Keep imported excerpts in existing `Memory.messages`; the notebook handles member recollections only. Do not expand notes into every atlas card: separate event-scoped loading bounds private text and avoids loading all story content on the globe.

Module map: `mazi/memories/memories.py` owns notebook composition and writes; `mazi/memories/server.py` exposes its two routes; `src/memory/EventNotes.tsx` owns hook/editor presentation (split hook only if size warrants); `MemoryView.tsx` mounts it; `memory.css` owns token styling. This hides story selection and first-save coordination behind two capabilities, rather than adding pass-through service layers.

## Presentation

Under the existing event title and description, give imported content a clearly labelled “From the conversation” section with source context, sender, date and readable bubbles/quote rhythm. Say “Imported excerpts” where appropriate; do not imply a full transcript. Follow with “The circle remembers”: saved notes appear as substantial reading cards with warm, quiet author accents, Geist body text and preserved whitespace. Each owned note has Edit; other members' notes have no edit controls. The small composer opens inline beneath saved content, with one primary Save action and secondary Cancel/Remove actions. Empty copy invites the first recollection. Keep imported and member-written origins distinct.

Use current Instrument Serif headings, Geist body, Mono dates, surface/line tokens, 44px targets and existing reduced-motion behavior. Stack on phones, avoid nested scrolling, retain focus and selection during saves. A cancelled edit restores saved text only by explicit action. Keep each draft separate by stable note identity. On hidden/pagehide, access loss, scope changes or unmount, clear private response and draft state, abort pending fetches and suppress late mutations; foreground fetches fresh context. Pass group identity explicitly from App rather than rereading session storage inside the component.

## Synthesis decision

Pending independent comparison. Candidate B favors server-owned event semantics; no claim of cross-model validation is made.

## Tradeoffs accepted

- Accept two event-oriented endpoints in exchange for keeping storage coordination and authorization together.
- Accept story-level conflicts between different members in exchange for preserving existing revisions and avoiding schema changes.
- Accept an event-scoped fetch alongside atlas loading in exchange for bounded private-note payloads and independent editor refresh.
- Accept a server first-note policy in exchange for a simple single composer; preserve every historical story and contribution.

## Alternatives considered

**Direct existing API client:** React fetches `/stories`, filters `story.event.id`, creates with `/create`, then writes via `/write`. Fewer backend routes, but clients must understand many-story topology, race recovery and selection policy. A client adapter can conceal call sequencing from JSX, but cannot make create+write atomic. Viable if that tradeoff and a recoverable empty-story outcome are accepted.

**Atlas projection only:** Add all recollections to `Memory` in `/api/atlas` and keep existing write endpoints. Fast initial reading, but expands private content into every globe/list fetch and leaves write coordination exposed. It also couples editor refresh to the full archive. Reject as this candidate's base.

Red-flag screen: no separate validate/load/save service chain, no public transport types, no author chosen by the client, and no wrapper that simply forwards write_story arguments. Two methods earn their boundary by owning event association, complete reads, profile enrichment and atomic first-note behavior.

## Open questions and risks

- Does the existing transaction implementation provide sufficient write serialization across local and Postgres adapters for first-note selection, or should an existing per-event row be locked?
- Can response-loss conflicts present an already-saved matching note clearly while retaining a newer local draft?
- Is grouping legacy stories without new labels sufficient to keep every note discoverable when several notes share one author? Use deterministic “Recollection 1/2” only as UI structure, never fabricated historical titles.

These are implementation verification points; no additional user decision is required for the proposed shape.

## Next implementation step

Expose backend contracts for full visibility, all legacy contributions, ownership, concurrent first saves and story revision conflict before adding the notebook methods.

## Test seams and acceptance evidence

Backend: synthetic approved event with two stories, two members and multiple contributions by one member; assert all notes, safe display names, own update/removal only, cross-event target denied, hidden/withdrawn asset suppresses whole notebook, outsider denied, story limit rollback, no empty story after failed first write, and conflict recovery after repeated first save.

DOM/component: deferred reads/writes verify retained newer/neighbor drafts, disabled duplicate submit, conflict refresh retaining draft, Escape/Cancel behavior, source text escaping, empty states and no late text resurrection after group/unmount/hidden/access loss. Reuse Happy DOM/Vite patterns from `tests/dom/feature-harness.mjs` and archive-hook lifecycle tests.

Browser: link Home/Portal/gallery/review-event/recap/story titles to canonical event ID plus notebook flag; assert the focused notebook heading and first text are visible in the initial viewport while ordinary photo links still land at the Viewer; type and save note, reload and read it, edit/remove, sign in as another member and confirm no edit controls. Include a legacy multi-story fixture and imported context. Capture desktop/phone and day/night; run axe and overflow checks. Reuse `tests/memory-detail.spec.ts` and the real synthetic `tests/browser/memories_server.py` fixture.
