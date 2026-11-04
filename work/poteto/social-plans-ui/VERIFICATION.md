# P1 interface acceptance

## Revisions and behavior

Base `9dfdf9c469029d59ae436f522e5c07ca9525b96b` contains the merged plan, N1, A1, P1 backend and local-server fixes. Test commit `1367d0b` first exposed the missing Ekle menu. Implementation commit `5767948` adds the lazy Plans interface, forms and lifecycle contracts. Narrow-menu contract `6907169` and fix `c5f9117` keep the contribution choices inside a 320-pixel header.

Grubumuz exposes Planlar. Ekle offers Fotoğraf veya arşiv and Buluşma planla. Plans has a bounded upcoming/all list, stable group-and-plan links, organizer forms, cancellation, deletion and attendance. It never fetches Atlas. A new circle can create a meeting with no photographs. Demo never reads or writes the real group's social API.

The form asks for an IANA timezone and local start, with optional end, place, description and an existing approved-memory link. Repeated hours require a UTC offset. Nonexistent times remain unsavable. Editing a place preserves existing start-time seconds. The server remains authoritative.

An uncertain write retries the exact body and key while retaining the draft. A stale revision can reload the current plan without replacing that draft. Profile, group and access loss clear state and discard late results. A denied write also aborts already-running reads, preventing them from restoring private content after the denial.

## Failing contracts and corrections

The initial DOM contract failed with `Ekle must open a contribution menu`. [Red output](MENU_ENTRY_RED.txt) records the missing behavior before implementation.

A later race test held a read, denied an attendance write, then released the old read. Before the correction, the private plan reappeared. [Red output](DENIED_READ_RED.txt) records that failure. The final denied state aborts requests and invalidates read generations before clearing the plan and draft. The same contract now passes in [the focused DOM run](DOM.txt).

The first mobile cancellation attempt found that the shared Sheet layer at 40 sat beneath the tab bar at 45. The actual confirmation button could not receive a tap. The shared Sheet now sits at 60, and P1 supplies a Turkish close label. Organizer cancellation and deletion pass on both screen sizes. Existing detail, account, sound and accessibility contracts pass after this shared-layer change.

The menu's first geometry check measured its left edge at `-61.03125` pixels on a 320-pixel viewport. [Red output](NARROW_MENU_RED.txt) records the clipping. The mobile popup now aligns to the positioned header's gutters. [Green output](NARROW_MENU_GREEN.txt) verifies both edges and keyboard operation on desktop and phone emulation.

## Environment and commands

Checks ran on macOS with Node 24.15.0, Python 3.14.7, locked npm dependencies and synthetic fixtures. Ports were 5284 and 8144. Builds and browser runs in the worktree were serialized.

| Command | Result |
| --- | --- |
| `node --test tests/dom/social-plans.test.mjs tests/dom/route-history.test.mjs tests/dom/discord-return.test.mjs` | 23 passed. [Output](DOM.txt). Includes StrictMode, replay, stale edits, failed pagination, denied/late results, profile changes, demo isolation, timezone gaps and repeated hours, route aliases and single-consumption Discord return. |
| `MAZI_UNIFIED_PORT=8144 npx playwright test --config playwright.social.config.ts` | 15 passed and one duplicate phone case skipped. [Output](BROWSER.txt). The desktop case itself opens an independent phone context. |
| `MAZI_TEST_PORT=5284 npx playwright test tests/interface-clarity.spec.ts tests/theme-shell.spec.ts tests/memory-detail.spec.ts tests/sound.spec.ts --project desktop --project phone` | 76 passed and 10 inapplicable cases skipped. [Output](SHELL.txt). Includes keyboard, reduced motion, small layouts and axe checks. |
| `MAZI_UNIFIED_PORT=8144 npx playwright test --config playwright.unified.config.ts tests/clarity-workspaces.spec.ts tests/unified.spec.ts` | 24 passed. [Output](INTEGRATION.txt). Covers legacy settings/People focus, sources, archive journeys, named profiles, logout and access loss. |
| `npm run typecheck` | Passed. |
| `npm run build` | Passed during browser-fixture startup. |
| `npm run lint` | Passed. |
| `npm run check:budgets` | Passed without raising ceilings. Entry 147.5/150 KiB gzip, all scripts 396.4/400 KiB, stylesheet 36.7/40 KiB and globe 242.9/256 KiB. |
| `npm run check:docs` | Passed. |
| `git diff --check 9dfdf9c...HEAD` | Passed, including captured logs. |

The empty-circle journey uses two real, independent authenticated browser contexts. Desktop Alice creates a plan. Phone Ben views it from an America/New_York browser timezone, sees the plan's Copenhagen time, joins and clears attendance. Alice refreshes the actual server-backed participant list. The fixture reports zero photographs, and the page records zero Atlas requests.

The lost-response case lets the real server commit a create, drops the first response and retries through the UI. The request bodies and keys match, and the server contains one plan. The stale-edit case changes the real server revision outside the open form, then verifies reload and draft preservation. Organizer edit/cancel/delete, disabled cancelled attendance and existing seconds are exercised against the actual backend.

## Screenshots

These captures contain synthetic profiles and were inspected after capture.

- [Desktop plan and attendance](plan-desktop.png).
- [320-pixel phone plan](plan-phone.png).
- [320-pixel repeated-hour form](create-phone.png).

## Limits and ownership

D17 exposes one configured circle. The browser fixture changes that configured circle through a test-only control to verify same-browser replacement, draft clearing and old-link denial. Real old-group read and attendance endpoints return 403. This is not a new production group-switch API.

The app writes no private plan text or draft to localStorage or sessionStorage. No production API, schema, hosted environment or personal archive changed in this interface slice. The test-only controls live in `tests/browser/social_server.py` and are excluded from deployment.

`npm run test:app` now runs the existing integrated archive fixture and the separate empty social fixture in sequence. The coordinator owns the final complete regression run, independent review, PR publication, merge and deployment. The five-friend findability study and physical-phone pilot remain open. Phone evidence uses Chromium emulation and does not establish production milestone acceptance.
