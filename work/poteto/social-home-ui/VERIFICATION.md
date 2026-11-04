# Social Home interface verification

## Scope and revisions

The frontend starts from accepted C1 `8e85429`, integrates published main and H1 API `6715b3f`, and uses the stable bounded Home/activity/selected-memory wire. Published API main `7e147aa` is integrated at `7cfbece`. Subsequent combined-main integration is recorded in the final handoff. Backend migrations and operational evidence belong to the independently reviewed API slice; this frontend adds no persistence schema or dependency.

- Red `c73076c`: forbids a full Atlas request from Home and direct memory routes ([output](RED.txt)).
- Core `66de8d9`: bounded Home/activity and selected detail, with optional route modules.
- `219ff8e`: current selected revalidation, disposal, focus and explicit chunk-error boundary.
- `d94dac9`: real two-session browser fixture, selected/Home test seams and inherited navigation contracts.
- `4a0fca3`: shared Photo styles and Atlas note-link styles load at their actual consumers; asynchronous real Home restores its opener.
- `c96a47a`, `cc7d025`: sample Home heading/return focus and selected read-failure focus, with contextual regression expectations.

The exclusive worktree is `social-home-ui` on `codex/social-home-ui-20261104`. Runtime is local Node 24.15.0, Python 3.14.7 and Chromium with desktop and Pixel 7 emulation. Builds and servers run serially on ports 5304/8172. All profiles, photos, comments and timestamps are synthetic.

## Real two-session journey

The dedicated fixture forces local storage before creating a temporary MemoryStore. Each scenario creates a fresh configured synthetic circle; the actual worker processes imported files. Test controls only change that fixture's current group, simulate next-day time for bounded reads, or withdraw its own origins. They are excluded from production handlers and never open a personal archive.

Desktop Alice opens empty Home, creates a near-future plan through its primary action, and independent 320-pixel phone Ben joins. Alice uploads two generated JPEGs through the real ZIP inventory/import interface and actual worker. A synthetic reviewed title/date makes capture evidence explicitly 2020, while social actions retain their actual 2026 server timestamps. The test accepts their grouping through the real API, enters the permanent photo route and verifies that grouping does not break it. Alice writes two comments, Ben reacts, and both return through Home. A fixture next-day clock and page-return event retire the past plan from the feature and expose the recent conversation. The photo keeps its 2020 evidence; the comment time remains 2026. The canonical photo discussion reopens with both comments, and the existing approved-memory notebook deep link still focuses its heading.

The other real cases cover archive fallback, exact authorized selected target, source withdrawal, Home and selected retryable reads, optional chunk failure/reload, current activity paging as 20 then two rows, 320-pixel layout, reduced motion and scoped axe. A fallback may select either authorized uploaded photo; the assertion checks the canonical selected link against both actual asset IDs, rather than assuming import order.

## Network and latency evidence

Initial real Home makes zero `/api/atlas` and zero `/api/memories/notebook` requests. Direct `photo-ASSET` entry, including a grouped asset, also makes zero full Atlas or notebook requests. Home reads one bounded summary after session/group context. Activity reads one page and no per-row notebooks/plans/reactions. Explicit notebook entry retains its own existing read; Atlas and timeline retain full archive readers on their routes.

[Raw fixture timings](QUERY_TIMINGS.json) count SQL statements and wall time around actual handler projection/serialization. One two-session run sampled Home at 0.462–1.002 ms with 14–31 statements and selected detail at 0.541–1.877 ms with 21–22 statements. The empty Home sample was 0.616 ms with 15 statements. These are tiny loopback synthetic samples, not p95, hosted or network guarantees. Independently measured hosted API limits remain in the backend evidence.

## Verification

- Focused Home/archive/route/OAuth DOM contracts: **29 pass** ([output](DOM.txt)). Covers empty planning, plan feature, canonical discussion links, exact-cursor retry/partial continuation and late feed/selected disposal on group/session change.
- Dedicated real Home browser suite: **seven pass, one explicit duplicate-phone skip**, 37.2 seconds ([output](BROWSER.txt)). One explicit desktop/independent-phone journey replaces a duplicate phone run.
- Existing notebook suite: **30 pass**, 42.5 seconds ([output](NOTEBOOK.txt)). Ownership, retryable drafts, imported excerpts, portal/Gallery links, notebook deep links and Home secondary notes remain intact through the new mock seams.
- Existing detail/clarity suite: **51 pass, seven inapplicable skips**, 16.9 seconds ([output](DETAIL.txt)). Includes both themes' detail axe, Viewer photo selection, portrait/panorama edges, metadata, sample/portal routing, 320-pixel controls, Home loading/error/empty and heading/opener focus.
- Existing integrated shell: **six pass**, 37.2 seconds ([output](UNIFIED.txt)). Includes real story/source workflows and discarded delayed private Home responses after logout.

The existing tests keep their assertions. Synthetic full-card mocks now serve selected and Home endpoints as well as Atlas. Chronological/related detail tests explicitly warm the full Atlas route when they exercise multiple archive cards. Their Back action correctly returns to that Atlas context. Home loading/failure mocks target the new summary response instead of manufacturing a full archive.

The first integration pass caught shared styles that previously arrived through eager MemoryView: photo frames and Atlas note-link underlines. Those styles were moved to Photo and Atlas consumers. It also caught a lazy sample Home mount missing heading focus; Home now owns asynchronous mount/return focus. Copy-selector updates follow Turkish labels without weakening ownership or focus assertions.

Typecheck, Prettier lint, document checker and whole-branch whitespace checks run before handoff. The enforced entry JavaScript, entry stylesheet, Globe and total-script limits remain unchanged. The first route-split build reduced entry from about 149 KiB to 92.7 KiB. The final measured build is recorded at handoff. Optional CSS is split by route; the existing checker explicitly measures index CSS. All emitted CSS is also measured separately and is not described as the enforced entry stylesheet.

## Screenshots and limits

Inspected synthetic captures show empty planning, the upcoming plan, next-day recent conversation on desktop/phone and paged phone activity. Phone captures use normal device scale, so raster dimensions exceed CSS viewport dimensions. Fixed navigation appears at its viewport position within full-page captures.

- [Empty desktop Home](empty-desktop.png).
- [Upcoming plan](plan-desktop.png).
- [Next-day desktop](next-day-desktop.png).
- [Next-day independent 320-pixel phone](next-day-phone.png).
- [Phone activity](activity-phone.png).

Physical phones and the five-friend study remain open. No production migration, external service, hosted mutation, publication or deployment is claimed by this frontend verification. Parent owns independent review, final combined release checks, PR/merge and deployment. Nested delegation is forbidden in this assignment; independent review comes from the parent.
