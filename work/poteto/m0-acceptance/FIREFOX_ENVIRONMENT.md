# Firefox launch environment receipt

## Result

On 5 October 2026, macOS 27.0 (26A428), arm64, Node 24.15.0, Playwright 1.63.0, bundled Firefox 155.0 (`firefox-1543`) failed before the app with `Could not find profile folder.` The same unmodified browser engine launches with isolated application branding and a scratch resource link. Repository revision: `5128bbe71c0c7722389199a45ac4c9d09aeac897`, with concurrent M0 working-tree changes. This is an environment workaround, not stock Firefox launch acceptance.

[Playwright issue 42768](https://github.com/microsoft/playwright/issues/42768) reports the protected shared app-data directory and requires `-app` first. [Mozilla bug 2062988](https://bugzilla.mozilla.org/show_bug.cgi?id=2062988) fixes the older headless hang by reporting the profile-selection failure; it does not fix the underlying selection failure. The observed fail-fast behavior is consistent with that Firefox 155 change. No probe of the user's Firefox directory was performed, so local TCC denial is inferred from the matching report and successful branding isolation rather than independently inspecting private data.

## Controlled experiment

The baseline `firefox.launch({timeout:15000})` exited 1 with the profile error. A copied `application.ini` changed only `Vendor=Mozilla` to `Vendor=MaziExperiment` and `Name=Firefox` to `Name=MaziPlaywrightFirefox`. A wrapper prepended `-app`. This reached browser startup, but external app resources were missing and new-page creation stalled; adding a scratch symlink to the bundled `Resources/browser/omni.ja` enabled page creation. A debug launch then printed `Juggler listening to the pipe`, returned version `155.0`, and created a page. Navigation initially failed because no Vite server was listening; the suite's configured webServer subsequently launched the actual app.

Only `/tmp/mazi-firefox-isolated` contains the wrapper/config. The existing cache bundle was read and never modified. HOME, OS permissions, and the existing Firefox profile were untouched. Gecko may create an isolated application-data directory under the new branding. This is not a release browser install and does not prove real phone-device behavior.

## Reproduction

From the worktree root, create the scratch artifacts without changing application or browser cache files:

```sh
mkdir -p /tmp/mazi-firefox-isolated
python3 - <<'PYCODE'
from pathlib import Path
root = Path('/Users/altanesmer/Library/Caches/ms-playwright/firefox-1543/firefox/Nightly.app/Contents')
out = Path('/tmp/mazi-firefox-isolated')
ini = (root / 'Resources/application.ini').read_text()
(out / 'application.ini').write_text(ini.replace('Vendor=Mozilla', 'Vendor=MaziExperiment').replace('Name=Firefox', 'Name=MaziPlaywrightFirefox'))
(out / 'firefox').write_text('#!/bin/sh\nexec "' + str(root / 'MacOS/firefox') + '" -app /tmp/mazi-firefox-isolated/application.ini "$@"\n')
(out / 'firefox').chmod(0o755)
if not (out / 'omni.ja').exists():
    (out / 'omni.ja').symlink_to(root / 'Resources/browser/omni.ja')
PYCODE
```

Direct launch proof (use while the Vite app is running):

```sh
node --input-type=module - <<'JSCODE'
import { firefox } from 'playwright';
const browser = await firefox.launch({executablePath:'/tmp/mazi-firefox-isolated/firefox', timeout:10000});
console.log(await browser.version());
const page = await browser.newPage();
await page.goto('http://127.0.0.1:5173');
console.log(await page.title());
await browser.close();
JSCODE
```

Scratch `/tmp/mazi-firefox-isolated/playwright.config.ts` imports the real config and overrides only selection, executable, absolute paths, and output:

```ts
import base from "/Users/altanesmer/.codex/worktrees/m0-acceptance/Mazi/playwright.config";
export default {
  ...base,
  testDir: "/Users/altanesmer/.codex/worktrees/m0-acceptance/Mazi/tests",
  outputDir: "/tmp/mazi-firefox-isolated/test-results",
  reporter: [["list"]],
  projects: base.projects!.filter(p => p.name!.startsWith("firefox")).map(p => ({
    ...p, use: {...p.use, launchOptions: {executablePath: "/tmp/mazi-firefox-isolated/firefox"}}
  })),
  webServer: {...base.webServer, cwd: "/Users/altanesmer/.codex/worktrees/m0-acceptance/Mazi"}
};
```

Suite command:

```sh
npx playwright test evidence.spec.ts journey.spec.ts resilience.spec.ts --config=/tmp/mazi-firefox-isolated/playwright.config.ts --workers=2
```

The first run (without explicit spec names) passed 18 browser tests and skipped two canonical screenshot tests in 13.4 seconds, exit 0. It also imported `tests/m0/access.test.mjs` as a discovery side effect, printing a separate Node test failure; that line is not browser acceptance evidence. Explicit browser selectors avoid that side effect. The clean rerun passed **18 tests, 2 skipped, in 12.9 seconds**, exit 0; log: `/tmp/mazi-firefox-isolated/firefox-suite.log`, artifacts: `/tmp/mazi-firefox-isolated/test-results`. Both Firefox desktop and 390×844 touch-enabled viewport projects passed. This temporary phone project has `isMobile: false`, as Firefox does not implement Playwright mobile emulation. The two skips are the explicit Firefox exclusion in the canonical screenshot test; screenshots remain Chromium evidence. A subsequent direct launch against running Vite returned version `155.0` and title `Mazi — The Atlas of Us`.

## Durable opt-in configuration

The parent-owned opt-in `MAZI_FIREFOX_EXECUTABLE` sets Firefox `launchOptions.executablePath` only when provided. Its value should name the wrapper; normal launch stays unchanged. Keep resource branding workaround explicit in verification receipts, regenerate scratch files for the installed browser revision, and remove the override once the upstream environment issue is resolved. Do not silently substitute a different engine or declare stock Firefox fixed. Docker fallback was unnecessary.

The final repository configuration filters browser discovery to `**/*.spec.ts`. The parent ran all four projects through `MAZI_FIREFOX_EXECUTABLE=/tmp/mazi-firefox-isolated/firefox npm test -- --workers=2`; 38 tests passed and 2 canonical Firefox screenshot tests skipped in 25.7 seconds. This clean run did not import Node provider tests.
