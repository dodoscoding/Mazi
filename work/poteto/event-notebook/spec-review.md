# Event notebook spec review

Reviewed the fixed application diff `c9b580406e0ead1072bd556f5c239dba357fc4a1...7892934` against the feature brief, direction, architecture judgment, and Event notebook decision. Application code remained unchanged. The parent owns full-suite validation and the completed comment review.

## Finding

**P2. Keep the draft when a saved contribution disappears during conflict recovery.** In `src/memory/EventNotebook.tsx`, lines 256–257, a successful refresh returns the entire component to `unavailable` when the selected contribution no longer exists. Reproduce by editing a saved note in tab A, removing that same contribution in tab B, saving A's draft to receive 409, then choosing Refresh saved notes. The event remains accessible and the refresh returns 200, but the code removes A's draft and every other displayed recollection. A lost successful remove response reaches the same branch after retry and refresh.

This violates the brief's “retained drafts on recoverable failures” and the decision's “Recoverable failures keep the visible draft.” Architecture judgment item 2 also requires “After conflict, retain the draft, require an explicit refresh, and require an explicit subsequent Save.” Keep the refreshed notebook readable, retain the draft in an explicit missing-target recovery state, and let the member choose a valid subsequent action. Add a browser regression for removal in another tab and lost remove responses. Existing conflict coverage only refreshes a still-present target.

## Other acceptance checks

The read projection exposes every story contribution; each own note retains its exact story/revision target. Server writes reuse full-event authorization, mutate only the authenticated member, and atomically create the first story and contribution. Title links use canonical event IDs across the changed entry points. Sample and standalone-photo guards prevent notebook reads. These are static code conclusions, not claims of runtime or hosted-adapter verification.

## Fix verification

**Resolved at `6a65c3ed1ee865755a135ba5ddd08b76c2516a30`.** Lines 257–270 retain the refreshed notebook and current draft. With another own note, the `removed` state blocks writes at line 181 and explicitly directs copying, cancelling, and selecting that note. Without another own note, recovery uses a new target for an explicit subsequent Save. Tests at `tests/event-notebook.spec.ts`, lines 429–522, assert both branches after conflict refresh and successful removal with newer typing, including other-member text preservation and cancellation/reopening. Static verification found no remaining gap in the reported P2. Runtime results belong to the worker and parent; I did not use the shared harness.
