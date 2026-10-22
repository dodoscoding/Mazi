# Search startup verification

## Behavior

Search now requests its paginated photographs after circle selection without requesting the archive-wide Atlas or People state. The **Include memories, chats, places and people** action loads those complete categories and their existing management controls. **Load people** in the filters requests the same context. Discover retains automatic context loading.

Until context is ready, counts describe photographs only. The screen never claims that other categories have zero results. People tagging, the Person filter, and related search remain disabled until their existing state arrives. Context failures offer another attempt while preserving photographs, query, and keyword filters. Late context from a previous circle cannot populate the new circle or clear its access state.

This changes frontend request timing only. The local server handles requests sequentially. Once a user explicitly includes other categories, expensive context work can still delay later requests on that server. No backend concurrency, projection, capacity increase, partial result cap, schema, or permission change is claimed.

## Verification

Implementation was rebased on `8bddf78`. Environment was macOS, Node 24.15.0, Python 3.14.7, Playwright 1.63.0, and bundled Chromium with desktop Chrome and Pixel 7 emulation. Tests use disposable synthetic archives. Solid-color photographs are fixture data.

- `node --test tests/dom/discovery-keyword.test.mjs tests/dom/search-startup.test.mjs tests/dom/workspace-design.test.mjs` passed 12 tests. New contracts cover stalled context, unchanged query and keyword filters, retry, group changes, denied access, and photo pagination without waiting for optional context.
- `MAZI_UNIFIED_PORT=8027 npx playwright test --config playwright.unified.config.ts tests/features-redesign.spec.ts -g 'Search photographs'` passed both desktop and phone cases. These exercise real photo search, a held context request, keyword filtering during the hold, failure, retry, and restored People/tagging controls. The production build passed as part of the command.
- `MAZI_DOMAIN_PORT_BASE=18120 MAZI_PYTHON=.venv/bin/python npx playwright test --config tests/browser/playwright.config.ts tests/browser/discovery.spec.ts --project=discovery-desktop --project=discovery-phone -g 'People, combined'` passed both existing Discover journeys, including People, semantic retrieval, tagging removal, consent changes, and denied access cleanup.
- `npm run typecheck`, `npm run lint`, and `git diff --check` passed. The pre-existing large Globe bundle warning remains.

Inspected representative screenshots are [phone photograph-first search](evidence/phone-search-photographs-ready.png) and [desktop included categories](evidence/desktop-search-context-ready.png). Complete browser artifacts remain local under `work/poteto/unified-app/browser-results/`. Independent review and the full suite remain with the parent workstream.
