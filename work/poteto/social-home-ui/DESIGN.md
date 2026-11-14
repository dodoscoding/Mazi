# Bounded social landing implementation

The existing three destinations stay intact. Real Home consumes the backend's feature discriminant: upcoming plan, latest visible conversation, photo fallback or empty planning. One summary supplies the featured content and up to three real activity links. Activity is a separate 20-row read-only route under Grubumuz. The browser does not reconstruct ordering from archive timestamps.

Reuse the current fonts, dark/light tokens, quiet photo card and pill actions. Empty Home leads with a plan and secondary photo intake. Comment time is an explicit social timestamp; the photo's own date/place evidence remains in its metadata line. Keep user titles and comments as supplied.

The selected detail is an optional route module around the existing MemoryView. It always reads current selected authority, rather than downloading Atlas or trusting its cached card. Group/profile/target identity owns requests; cancellation and disposal reject late results. Optional feature and Home modules load at their routes, with a visible failure/reload boundary. Shared photo and note-link styles belong to the actual shared consumers, so first paint does not depend on visiting a detail first.

- Blocking first steps: expose the forbidden initial Atlas request, confirm backend wire and selected/grouped-photo semantics, then implement bounded route ownership.
- Independent workstreams: API owner supplies current bounded reads, F2 owns Search/Gallery filters, parent owns Atlas/Timeline/Viewer Turkish controls. This owner changes App, Home, selected detail and relevant MemoryView controls.
- Shared mutable state: one exclusive worktree, independent temporary browser archive and serialized builds. Both main's F2 contracts and API's appended contracts are preserved during integration.
- Smallest safe decomposition: one owner for the coupled route/data/focus migration, with independent review supplied by the parent. No nested delegation or publication is authorized here.

The route split reduces entry bytes while retaining the existing total-script ceiling. No new UI dependency, cache framework, live socket or notification service is introduced.
