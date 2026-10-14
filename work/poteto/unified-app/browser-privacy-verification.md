# Browser privacy regression verification

Synthetic fixture server only; no user archive directory used.

`npx playwright test --config playwright.unified.config.ts --grep 'circle/session'`: **2 passed (10.0s)**, desktop and Pixel 7 emulation. A new account imports two synthetic photographs, approves a private event and creates a story in its own circle. Tests hold an actual authorized Atlas response body while navigating and selecting a separate empty circle. The feature dropdown adopts the header selection, the original story disappears, and releasing the old body cannot restore the old Atlas title. A second held response is released after actual logout; the signed-out Atlas remains empty.

`npx playwright test --config playwright.unified.config.ts --grep 'access loss'`: **2 passed (2.5s)**, desktop and Pixel 7 emulation. A supporting record with an explicit original-circle query disappears when the header selects another circle. A private unsaved capsule draft is removed after API logout followed by a refresh returning denied access; the feature offers sign-in and removes recap data.

The second run's machine-readable result is saved as `browser-access-loss-results.json`. The focused contracts are reproducible in `tests/unified.spec.ts`; the earlier full workflow run remains recorded in `browser-verification.md`. Final complete `npm run test:app` after lifecycle fixes: **6 passed (13.7s)**. The gate waits for held route delivery before checking the final circle/session state.
