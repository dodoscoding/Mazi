# Turkish archive journey verification

Base is main `8aa0302`. Contract commit `b7064d3` and implementation `f588538` complete the plan's N1 journey labels on Atlas, its place correction and summary, timeline, and selected-photo Viewer. Search/Gallery and Home/detail shell copy belong to their concurrent F2/H1 slices. Raw member and sample content remains unchanged. No locale package, schema or API change is added.

## Behavior and review evidence

Visible headings, controls and accessible names now use Turkish consistently, including keyboard year controls, previous/next photo, note links, import entry, replay and recovery. The timeline empty message accurately says unknown-date photographs are separate rather than inventing approximate dates. The Atlas empty text describes only known dates and authorized places.

The 320-pixel visual audit exposed the fallback notice under the expanded phone timeline controls. Its existing information remains visible when the sheet is collapsed; while expanded, it is hidden so the sheet controls remain readable. The top Küre retry remains available. The actual phone contract failed before the three-line responsive rule and passes after, including collapse/reappearance and keyboard targets. Existing assertions were preserved with translated selectors. An initial broad browser attempt exposed stale shared test-helper labels; those were corrected, not weakened.

## Executed checks

- Atlas/timeline/Viewer browser checks: initial 66 passed, nine inapplicable skips and seven stale-copy expectations; corrected focused rerun passed seven with one inapplicable skip. Journey/resilience/sound rerun passed 28 with two optional screenshot skips.
- Full browser matrix on final runtime: Chromium desktop/phone **147 passed, 15 skipped**. Firefox initially failed to launch before any application test. With isolated app data, Firefox desktop/phone **143 passed, 19 skipped** in 41.9 seconds. Combined executed application result: **290 passed, 34 explicitly inapplicable/optional skips**.
- Firefox's local macOS launch issue matches [upstream Playwright #42768](https://github.com/microsoft/playwright/issues/42768). A single control and the full Firefox projects pass with `CFFIXED_USER_HOME=/tmp/mazi-firefox-cf-home-20261104 MAZI_TEST_PORT=5310 npx playwright test --project firefox-desktop --project firefox-phone`. This child-process app-data directory preserves the user's HOME and existing profiles; no browser installation or permission setting changed.
- `node --test tests/dom/atlas.test.mjs tests/dom/timeline-dates.test.mjs tests/dom/photo-evidence.test.mjs`: **11 passed**.
- Production build (through serial browser servers), Prettier lint and full patch whitespace pass. Bundle checker passes: entry **149.6/150 KiB**, all scripts **405.5/420**, primary CSS **36.9/40**, Globe **242.9/256**. No ceilings changed.

## Visual artifacts

[320-pixel Atlas](phone-atlas.png), [summary](phone-summary.png), [timeline](phone-timeline.png), and [desktop timeline](desktop-timeline.png) use explicit sample mode, a force-local temporary archive and reduced motion. All screenshots were inspected; viewport overflow and expanded-notice disposal were asserted. These are emulated synthetic views, not physical-device or five-friend acceptance.

Independent review and final combined F2/H1 regression remain with the delivery coordinator. No production mutation or deployment occurred in this slice.
