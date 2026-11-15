# Standards review

Pinned HEAD `da2afe015ddf777f20a39cdf3040f809165d8cc9` and baseline `485bcabe83f8da3a9bc635fe0c9646a45a1a43da` both resolve; the three-dot diff is nonempty. Read the supplied complete commit list and standards sources. Static review only; repository unchanged.

## Documented-standard violations

1. **[P3] Use the shared overlay color token** — `src/styles/past-creations.css:43` adds `background: #0009;`. `DESIGN.md:200` says “Components use the tokens and never raw hex,” repeated at line 321. The new deletion-dialog backdrop bypasses the shared `--overlay-sheet` palette and will diverge when that palette changes. Replace the literal with the existing overlay token.

## Heuristic findings

2. **[P3] Possible Speculative Generality: remove the unused historical gallery mode** — `src/features/memories/gallery.js:29` adds `{ photos = false, readOnly = false, onSearch, onReset } = {}`; the only application caller, `src/features/photos/mount.js:33–38`, always supplies `photos: true`. Consequently the retained alternative renderer after `if (photos) return renderMonths(shown);` (gallery lines 805 onward), and scattered `!photos` branches, have no active consumer after the memories mount is deleted. Make this the Photos gallery directly and remove the unused mode to reduce the branching surface for future filter/chronology fixes. This is a judgment call, not a documented-rule breach.

**Counts:** 1 documented-standard violation; 1 heuristic finding. Worst: P3 in each category. No correctness/security regression established by this axis.
