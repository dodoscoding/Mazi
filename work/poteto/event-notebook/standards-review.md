# Event notebook standards review

Reviewed `git diff c9b580406e0ead1072bd556f5c239dba357fc4a1...7892934` and the six commits in `git log c9b580406e0ead1072bd556f5c239dba357fc4a1..7892934 --oneline`.

## Documented standards

No hard breaches found against `AGENTS.md`, `docs/CONTRACTS.md`, or `docs/PRIVACY.md`. The new read/write paths recheck current event visibility and membership, derive ownership from the authenticated user, render statements as text, and preserve inherited origin and no-store enforcement. Existing creator deletion and creator-departure behavior is explicitly documented in `docs/history/memories/README.md`, so it is not treated as a new ownership violation.

## Correctness and validation finding

- **P2. Preserve the draft when a refreshed own note has been removed.** `src/memory/EventNotebook.tsx:256-257` returns only `{ kind: "unavailable" }` when a successful refresh no longer contains the selected saved target. Trigger this by opening an existing note in two tabs, removing it in tab B, then saving an edited draft in tab A. The stale revision correctly produces 409. Clicking **Refresh saved notes** then discards tab A's draft, every other notebook note, and all recovery controls despite the authorized GET succeeding. Keep the fresh notebook and draft, and explicitly offer a new-note recovery or a retained-copy path. Add a browser regression for deletion between editing and conflict refresh. The existing conflict test keeps the selected note present and misses this boundary. This is a correctness finding, not a claimed breach of a specific documented state-machine rule.

## Heuristic smells

No actionable baseline smell found. Tooling-enforced formatting and typing issues were excluded.

## Evidence and limits

A focused `.venv/bin/python` experiment reused `MemoryTests.setUp()` with synthetic temporary storage. It saved a note, removed it, attempted the stale save, and reread the notebook. Output was `stale-save conflict: Story changed; refresh before editing` followed by `authorized refresh succeeds; matching own notes: 0`. The frontend loss follows directly from lines 256-257. No full suites were launched because the parent review owns them. No application code was changed.

## Fix verification

**Resolved at `6a65c3ed1ee865755a135ba5ddd08b76c2516a30`.** Reviewed the immutable diff from `7892934` and the four new browser cases. `EventNotebook.tsx:257-271` now retains the freshly authorized notebook and latest draft. With no remaining own note, the target becomes explicitly new and can be saved. With another own note present, the removed target remains selected, mutation is blocked by both the command guard and disabled controls, and the editable textarea preserves native copying. Cancel remains enabled and allows explicit selection of the other note. No silent retarget occurs.

The cases cover conflict refresh and typing during successful removal, each with and without another own note. They assert draft retention, other-member note visibility, blocked writes and explicit cancel/reselection, or a new-target save. Ordinary note/source rendering is unchanged by the fix. No further findings. This follow-up is static review; the worker-reported passing focused, recovery, typecheck and formatting checks were not independently rerun because the parent owns the shared harness.
