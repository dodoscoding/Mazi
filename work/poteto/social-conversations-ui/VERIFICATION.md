# Conversation interface verification

## Revision and scope

- Base: merged P1 interface `634355f`.
- Runtime feature: `2a7cfc7`; keyboard focus correction: `58a5c56`.
- Current main budget decision `b3efcf7` merged at `32e8b47`. The C1 branch does not independently change any budget.
- Worktree: `social-conversations-ui`, branch `codex/social-conversations-ui-20261104`.
- Local Node 24.15.0, Python 3.14.7, Chromium desktop and Pixel 7 emulation. All profiles, photos and text are synthetic.

The optional lazy panel uses selected permanent photo identity or accepted memory identity. Its query and target remain separate from the notebook and imported source excerpts. No production schema, API, external service or dependency changed. The only route additions are `discussion=photo` and `discussion=memory` on existing details. The selected-photo query survives Viewer navigation.

## Red and green evidence

Red commit `93aae4e` introduces selected-target batch and session-disposal DOM contracts before the panel exists ([output](RED.txt)). The next test-only commit ensures Vite closes even on that expected missing-module failure. The feature then passes those contracts and extends them with exact write retry, stale drafts, private late-response disposal, denied-batch clearing and exact-cursor read retry. [DOM output](DOM.txt) records 21 passing cases including existing route-history and Discord-return tests.

The real browser keyboard contract in `fd98369` exposed a focus loss: setting native disabled on the focused reaction during a write blurred it. [Red output](KEYBOARD_RED.txt) records that failure. Fix `58a5c56` uses guarded aria-disabled while a command is blocked and retains the current projection during confirmed-state refresh, preserving the reaction node. [Focused green output](KEYBOARD_GREEN.txt) records two passing desktop/phone cases. The guard prevents another desired-state write while pending or awaiting exact retry.

## Actual browser journeys

`MAZI_UNIFIED_PORT=8156 npx playwright test --config playwright.conversations.config.ts` passes **13 cases**, with one duplicate phone case skipped, in **19.6 seconds** ([output](BROWSER.txt)). The skipped case explicitly opens desktop Alice and an independent authenticated 320-pixel phone Ben together. Other scenarios run in both projects.

The isolated fixture forces `MAZI_BACKEND=local`, uses a temporary archive and starts the actual AppServer/MemoryStore. It imports two synthetic colored JPEGs, accepts one shared memory and maps Alice/Ben. It is independent of the P1 empty-archive fixture. Per-test reset removes only synthetic social contributions and restores the synthetic origin visibility and configured circle. Withdrawal calls actual `delete_origin`; source pause alone does not withdraw existing origins. The fixture-only circle control is not a production switching API.

The browser contracts verify:

- Two messages from Alice, Ben's current author permissions, comment reaction on/off, exact counts, pressed state and current member name. Photo, sibling photo and approved-memory conversations remain separate; sibling navigation clears the previous photo's draft. Notebook content remains separate.
- Server-committed comment and reaction writes with dropped first responses. Exact retries preserve the body and key, create one comment and keep one desired reaction state.
- A real stale edit from another write, current revision reload and retained draft, followed by a successful explicit save.
- Comment deletion clears displayed reactions and total. Withdrawal of all origins removes the editor and reactions after server revalidation.
- Actual logout while a committed write response is held, then release of that late response. Private text and controls do not return. Configured-circle replacement clears the draft and actual old-group comment reads/writes return 403.
- Twenty-two comments shown as 20 then two. Reaction batches contain 21 then three targets, with zero single-reaction reads. Keyboard reaction focus, composer focus, 320-pixel bounds, reduced motion and scoped axe pass.

Earlier fixture iterations exposed and corrected test setup errors: a pause was not a source withdrawal; the fixture reset reason column requires an empty string rather than null; logout requires a JSON body. A summary locator also needed to include its hidden accessible label. These were fixture/assertion corrections, not production acceptance failures. The keyboard focus failure was a real UI defect and has separate red/green evidence.

## Existing behavior and gates

- `MAZI_UNIFIED_PORT=8156 npx playwright test --config playwright.unified.config.ts tests/event-notebook.spec.ts`: **30 pass**, 11.7 seconds ([output](NOTEBOOK.txt)). Notebook ownership, draft conflicts, sample denial and notebook deep-link focus remain unchanged.
- `MAZI_TEST_PORT=5296 npx playwright test tests/memory-detail.spec.ts --project desktop --project phone`: **37 pass, seven inapplicable skips**, 9.2 seconds ([output](DETAIL.txt)). Existing Viewer, detail, source provenance, metadata and both-theme axe checks remain green.
- Typecheck, Prettier lint and production builds pass. Browser servers build serially in this worktree.
- D27 budgets pass: entry **148.5/150 KiB gzip**, all scripts **402.1/420**, stylesheet **36.8/40**, globe **242.9/256**. The pre-D27 total was above 400 and was reported before integrating the parent's independently accepted budget decision.
- Document checker and full branch whitespace checks run before handoff. Generated shared result JSON is restored.

## Inspected screenshots

- [Independent 320-pixel phone photo conversation](photo-phone.png), showing Ben's reaction and member name.
- [Approved-memory conversation](memory-desktop.png), with separate own comment controls.
- [320-pixel second page and keyboard composer](page-phone.png).

The captures use normal device scale, so their raster dimensions exceed CSS pixel dimensions. They contain only synthetic text and were visually inspected for clipping, wrapping, contrast and focus.

## Limits and review ownership

Current Chromium phone evidence is emulation, not a physical-phone pilot. The five-friend study remains open. No live update transport is added; current authorization is checked on server operations and page visibility/return. The direct grouped-photo `photo-ASSET` detail loader is the following H1 integration scope; this slice proves selected-photo conversations inside approved-memory detail routes.

Parent owns independent review, final combined regression, publication, merge and deployment. No push, PR, deployment, hosted mutation or personal archive access occurred here. Nested delegation is forbidden in this assignment; the parent provides independent no-comments/code review. The implementation adds no code comments, suppressions or any-casts.
