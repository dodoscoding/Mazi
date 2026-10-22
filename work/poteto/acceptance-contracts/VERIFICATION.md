# Acceptance contract verification

Based on merged main `7073486`. Only browser test contracts changed. The tests retain exact completeness, story editing, export, privacy, and recovery assertions.

Search now compares its initial photographs with the current authorized keyword-search snapshot, including exact IDs and an explicit single-page completeness assertion. Prior synthetic imports can therefore increase the shared archive without making a correct search fail. Category and semantic-search fixtures explicitly include their optional context before using People or asserting combined results. The capacity fixture uses the current 10,000-photo message and the native Source combobox role.

Story journeys address the recollection textbox within the current creator's Our summer article. They remove only stale, creator-deletable Our summer test stories before arranging the journey. All existing editing, sub-event, slideshow, export, and cleanup checks remain.

## Verification

Environment was macOS, Node 24.15.0, Python 3.14.7, Playwright 1.63.0, bundled Chromium, desktop Chrome and Pixel 7 emulation. Servers use disposable synthetic archives.

- `MAZI_UNIFIED_PORT=8027 npx playwright test --config playwright.unified.config.ts` passed all 34 cases in 1.4 minutes, including desktop then phone against shared server state.
- `MAZI_DOMAIN_PORT_BASE=18120 MAZI_PYTHON=.venv/bin/python npx playwright test --config tests/browser/playwright.config.ts tests/browser/discovery.spec.ts tests/browser/memories.spec.ts tests/browser/browse-features.spec.ts --project=discovery-desktop --project=discovery-phone --project=memories-desktop --project=memories-phone` passed all 14 cases in 31.3 seconds.
- Typecheck, configured Prettier lint, and `git diff --check` passed. The unified command also built the production application. The existing large Globe bundle warning remains.

Generated screenshots and the tracked browser-results report were restored to avoid unrelated evidence churn. Local failure traces from the intermediate obsolete Source-label selector are superseded by the complete passing domain run. The learned-model invocation and the rest of the domain suite remain with the parent workstream.
