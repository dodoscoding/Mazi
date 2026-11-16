# Standards fix verification

Verified immutable HEAD `e2193ea7b5bd79e51bda1bd4ead525a1366b7206` against reviewed `da2afe015ddf777f20a39cdf3040f809165d8cc9`; both resolve and the diff is nonempty.

1. **Resolved — shared overlay token.** `src/styles/past-creations.css:43` now uses `background: var(--overlay-sheet)`, satisfying `DESIGN.md:200,321`. The token exists for both palettes in `src/styles/tokens.css:107,140`.
2. **Resolved — possible Speculative Generality.** `src/features/memories/gallery.js:22–26` removes the unused `photos` option; `src/features/photos/mount.js:33–37` removes its corresponding caller flag. `gallery.js:783–788` now calls the month renderer directly, and historical view/order handlers and renderer are gone. Active photo/recap chronology remains at `gallery.js:635–663`, with read-only sample and search/reset callbacks retained at `photos/mount.js:34–36`.

Reviewed the adjacent Settings notification, explicit Past creations selectors, and compact search wrapper changes for concrete introduced regressions; none identified. No new broad refactor recommendations.

Validation: static diff/caller inspection plus supplied `REVIEW_FIXES.md` and gallery DOM receipt (11 passed). I did not rerun builds or browser jobs; root owns the frozen-revision acceptance run.

**Resolved: 2/2. Remaining findings: 0. Introduced concrete regressions identified: 0.**
