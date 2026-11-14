# Sketch A: event notebook on existing story APIs

## Problem

The canonical event detail already owns imported chat excerpts in `Memory.messages`; persistent recollections belong to existing stories, with multiple stories per event and one note per member per story. Bring those together inside `MemoryView` without creating another persistence model or growing every Atlas response. Preserve every existing story and note, revision checks, and full-memory authorization. Grounding: `src/MemoryView.tsx`, `src/useArchive.ts`, `src/features/memories/mount.js:90–175`, `mazi/atlas.py`, `mazi/memories/memories.py` and its HTTP handler.

## Usage (caller's view)

```tsx
// App: private notebook receives the already selected group, never sessionStorage lookup.
<MemoryView group={archive.group} memory={memory} {...existingProps} />

// MemoryView: excerpts use existing card data; live notes load only for approved events.
<EventNotebook key={`${group}:${memory.id}`} group={group}
  event={memory.kind === "memory" && !demo ? memory.id : null}
  messages={memory.messages} link={link} />

// Inside the one notebook module, render every saved note and one active editor.
const notebook = useEventNotes(group, event);
<button onClick={() => notebook.edit(note.key)}>Edit my note</button>
<form onSubmit={(e) => { e.preventDefault(); void notebook.save(); }}>
  {notebook.state.kind === "ready" && notebook.state.editor.kind === "draft" &&
    <textarea value={notebook.state.editor.draft}
      onChange={(e) => notebook.change(e.target.value)} />}
</form>
// Save invokes notebook.save(); removal invokes notebook.remove(), never delete-story.
```

## Shape

```ts
// Domain shapes private to src/memory/EventNotebook.tsx (or sibling hook if size merits).
type StoryId = string;
type NoteKey = { story: StoryId; author: string };
type Note = { key: NoteKey; authorLabel: string; text: string; editable: boolean };
type SavedStory = { id: StoryId; revision: number; notes: Note[] };
type Editor =
  | { kind: "closed" }
  | { kind: "draft"; target: StoryId | null; draft: string;
      phase: "editing" | "saving" | "conflict"; error: string };
type NotesState =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "error"; message: string }
  | { kind: "ready"; stories: SavedStory[]; editor: Editor; notice: string };
type EventNotes = {
  state: NotesState;
  edit(key: NoteKey): void;
  compose(): void;
  change(text: string): void;
  close(): void;
  save(): Promise<void>;
  remove(): Promise<void>;
  refreshSaved(): Promise<void>;
  retry(): void;
};
function useEventNotes(group: string, event: string | null): EventNotes {
  throw Error("not implemented");
}
function EventNotebook(props: {
  group: string; event: string | null;
  messages: Memory["messages"]; link: LinkFor;
}): React.ReactNode { throw Error("not implemented"); }
```

The module hides HTTP payloads, generation/abort ownership, revision recovery and note targeting. Rendering receives domain notes; HTTP helpers stay private, not a generic API framework. Derive flattened notes from `stories` at render time; do not maintain a second synchronized note list. Screened against architect red flags: this is one domain capability with a small component boundary, no stage-based module chain or pass-through service. Boundary validation parses required response fields once, including editable booleans and numeric revisions. Existing backend remains authoritative for ownership and maximum length.

- Load `GET /api/memories/stories?group=…`, filter by `story.event.id === event`, retain **all** matches in stable server ID order. Never use `find` for the event. Every contribution renders, including a member's notes in several historical stories. Imported excerpts render as a separate source section without claiming complete transcripts.
- `edit(key)` finds the precise story and confirms `editable`; one editor opens for that target. Other editable notes expose Edit actions, never additional textareas. `compose()` resumes the first existing editable note deterministically; if none exists, targets the first existing story. Only a truly storyless event requires create. Explain multiple existing saved notes via their visible cards rather than choosing one secretly.
- Save snapshots target, text, revision and request generation. POST `/api/memories/write` uses the current saved story revision, replacing only that story from its returned result. Save/remove are disabled in flight. Retain draft on network/5xx failure; no localStorage or sessionStorage drafts. Do not overwrite newer typing with a completed request.
- A new event note first POSTs `/api/memories/create`, records its returned story immediately, then writes. If writing fails, retry uses that recorded ID. If creation has an ambiguous network outcome, reload stories before offering retry; empty historical stories remain valid. Existing create is not idempotent: duplicate empty containers from a crash/concurrent tab are tolerated and never conceal contributions.
- On 409 preserve draft, disable writes, expose “Refresh saved notes”. Refresh the selected story via `/api/memories/story?group=…&story=…`, update saved text/revision, retain draft, then require another explicit save. No automatic retry or silent overwrite. An unavailable selected story clears private state rather than retargeting its draft.
- Removal writes empty text to the current story using the same revision path. It never deletes another member's notes or the story itself.
- Key the notebook by group/event; abort and invalidate responses on identity/group/navigation changes, visibility hidden, pagehide and `mazi:access-lost`. Clear saved notes **and drafts** immediately on these privacy transitions. On pageshow/visible/session refresh, reload authorization. 401/403 clears data and dispatches existing access-lost event; do not display stale notes beside an error. Recoverable network and conflict errors retain drafts only while this authorized visible page remains active. Follow `useArchive` generation checks after every await, including create→write.
- `event=null` prevents all note fetch/mutation, including sample mode and standalone photos. Keep source excerpts readable. Empty live notebook links to Archive review where appropriate.

Backend change is additive display metadata only: enrich `_story_view` contributions with `author_name`, derived by a left join on `shared_profiles.user_id`, fallback “Circle member”. Keep `author` ID and `editable` unchanged for existing consumers. No new endpoint or schema. Existing `_story` full-memory authorization is reused on every read/write; no raw contribution endpoint is introduced.

Presentation uses the current warm headings and blue source accents. All imported excerpts are readable from the event page; notes are a distinct section labeled as member recollections. Save status uses a live region; textarea has a visible label and 2,000-character limit. Edit/cancel/recovery preserve sensible keyboard focus. Restrained CSS reveal honors reduced motion. Review/recap/story event titles get canonical hash links with event ID rather than story ID.

## Synthesis decision

Candidate A only; parent arena owns comparison and final synthesis. Recommend this base when scope is one event page because backend authorization already exists and the notes lifecycle stays local to that page.

## Tradeoffs accepted

- We accept fetching the group's bounded story list in exchange for no new route or storage and compatibility with existing story consumers.
- We accept separate Atlas and story reads in exchange for keeping ordinary Atlas payloads unchanged. Each is independently authorized; visibility/session hooks clear both on known privacy transitions.
- We accept historical multiple notes per author in exchange for preserving every saved contribution. One editor targets an exact story rather than collapsing notes into a lossy author map.
- We accept story-wide revision conflicts caused by another member writing in exchange for existing tested concurrency semantics.

## Alternatives considered

- Embed stories/contributions inside every Atlas memory card. This hides event association in the projection but expands private responses and couples note writes to Atlas refresh; the caller still needs editor state, mutation, conflict and access lifecycle handling. Interface depth improves little for the added coupling. It can provide an atomic initial event+notes snapshot and is reasonable if all views later need notes, but is unnecessary here.
- Add an event-specific notebook endpoint with a unique event note store. It can hide aggregation and concurrency well, but introduces schema/migration/export/departure behavior and a transition for existing many-story data. Rejected for this bounded feature.

## Open questions and risks

- Can author profile names be absent for legacy accounts? Use the explicit safe label fallback and assert it in tests; no user decision is needed.
- Does source withdrawal between separate successful Atlas and story reads require atomic UI synchronization beyond current visibility/session refresh? Preserve current archive refresh behavior and verify denied story reads clear the notebook; this shape does not promise push revocation.
- Can ambiguous create results duplicate an empty story? Yes under existing non-idempotent create semantics; reload-before-retry minimizes this, retaining every story prevents loss, and adding an idempotency contract is outside the minimal change.

## Verification contract

1. Backend: two stories for one event, two authors and multiple notes from one author remain visible; display names plus missing-profile fallback; owner-only writes; removal affects one contribution; persistence across reopening; stale revision 409; hide/reject/withdraw/departure denial. Extend `tests/backend/memories/test_memories.py` and `_http.py`; preserve current Atlas projection tests.
2. DOM: open event notebook; show all imported excerpts and every story contribution; one active editor; correctly target second historical note; create once then retry failed write; retain text after 409/5xx; explicit refresh updates revision while preserving draft; double-submit blocked; stale deferred response ignored after route/group/hidden/access clear; sample/photo modes make no story calls.
3. Browser: review/recap/shared-story headings navigate to canonical memory route; add/edit/remove note in place and prove persistence after reload; second member sees saved note and cannot edit it; desktop/night and phone/day screenshots; keyboard, reduced motion and error recovery checks.
4. Commands: `.venv/bin/python -m unittest tests.backend.test_atlas tests.backend.test_atlas_projection tests.backend.memories.test_memories tests.backend.memories.test_memories_http`; focused new DOM contract; focused Playwright spec; `npm run build`; relevant Prettier check; final repo suites and document checker per brief. These are planned checks, not claimed execution.

## Next implementation step

Expose a failing two-story notebook contract and an author-display-name backend contract, then implement the local notebook against the existing endpoints.
