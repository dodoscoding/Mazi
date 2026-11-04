# Conversation interface implementation

The existing notebook remains the place for structured recollections. The new flat conversation is optional, opened through a detail link or the photo/memory scope actions. Only one scope is mounted at a time. Selected photo asset identity, current group and profile key the panel; changing a sibling photo destroys its private draft and requests. Approved-memory scope uses its own accepted event identity.

Reuse the current dark/light tokens, display face, body font, native forms and pill buttons. Four outlined emoji toggles show exact counts and pressed state; expandable current member names stay secondary. Comment time is the actual server action timestamp, separate from photograph evidence. No avatars, live transport, animation or new dependencies.

Architect exploration is already bounded by the merged backend and parent-approved detail/query seam. A single visible page of 20 comments plus its archive target produces one bounded 21-target reaction batch; no per-comment network reads. Pagination replaces the visible page. One in-memory editor and at most one exact uncertain command prevent parallel conflicting writes.

- Blocking first steps: read current detail/route ownership and backend projection, then expose selected-target batch and session disposal contracts.
- Independent workstreams: parent owns Home/API and another owner owns photo labels, with separate JSX insertion points.
- Shared mutable state: only this exclusive worktree writes the panel; temporary browser archive is independent of the empty P1 archive.
- Smallest safe decomposition: one child implements the scoped interface; parent assigns independent review. Nested delegation and publication are outside this assignment.
