# Keep the view in the background: verification

Branch `fix/keep-view-on-background`, cut from origin/main 548ba3f. Field findings: groups A, E and F of `work/poteto/field-bugs-20261023/FINDINGS.md`. Decision: [D24](../../../docs/DECISIONS.md#keep-the-view-in-the-background-24-october-2026). Measured on 24 October 2026 on macOS with Node 24.15.0 and the synthetic `tests.browser.memories_server` archive. Every repro and browser result below uses synthetic data.

## What changed

| Bug | Fix |
| --- | --- |
| 1. Backgrounding reloads the app | `useEntry` no longer drops to `loading` on hide or pagehide. When the tab is shown again, or restored from the back-forward cache, it revalidates `/api/session` in the background. A 401 or 403 signs out, a different person or circle signs out with "Your access changed", and an outage or 503 keeps the screen. `useArchive` and `FeaturePage` no longer clear, dispose or refetch on hide, pagehide or pageshow. |
| 2. Home, Imports, Home reloads the atlas | `useArchive` loads circle context and the atlas in separate effects. The atlas loads once per circle and survives page moves. |
| 3. Memory Back returns Home | Each history entry records how many in-app entries come before it, including entries made by plain hash links. Back to atlas and Esc call `history.back()` when the previous entry is in the app. On a direct link they fall back to `/?selected=…`. Earlier, later and related memories, and the portal dossier's Open memory, replace the current entry, so one Back leaves the memory view. |
| 4. The chosen circle is overwritten | `useArchive` uses the circle in `sessionStorage` (`mazi.group`, an id only) if the person still belongs to it, and the profile default otherwise. `useEntry` no longer overwrites a stored choice, and signing out clears it. |

## Measured

Browser repro, Pixel 7 emulation in headless Chromium: `work/poteto/keep-view-20261024/repro.mjs`. The before run used a build of the 548ba3f `src`, and the after run used a build of a542cee.

Before (`repro-before.txt`):

```
while hidden {"header":false,"status":"Opening Mazi…","canvas":0}
after visible {"sameHeaderNode":false,"statusesSeen":["Opening Mazi…","Loading the atlas","Drawing your atlas…"]}
api requests on return ["/api/session","/api/groups","/api/atlas"]
atlas requests for Home -> Imports -> Home ["/api/atlas"]
timeline -> memory -> Back {"memoryHash":"#/memory/4ed1…","afterBack":"#/?selected=4ed1…","afterHistoryBack":"#/memory/4ed1…"}
feature hash link -> memory -> Esc "#/?selected=4ed1…"
review kept across hide false
```

After (`repro-after.txt`):

```
while hidden {"header":true,"status":null,"canvas":1}
after visible {"sameHeaderNode":true,"statusesSeen":[]}
api requests on return ["/api/session"]
atlas requests for Home -> Imports -> Home []
timeline -> memory -> Back {"memoryHash":"#/memory/932f…","afterBack":"#/timeline","afterHistoryBack":"#/"}
feature hash link -> memory -> Esc "#/review"
review kept across hide true
```

Memory ids differ between the two runs because each server start seeds a new archive.

Regression tests: `tests/dom/entry-hook.test.mjs`, `tests/dom/archive-hook.test.mjs` (three new cases, plus two cases rewritten from clear-on-hide to clear-on-lost-access), `tests/dom/feature-page.test.mjs` and `tests/dom/route-history.test.mjs`. They landed in 6c24d4e and 7d2b740, before the fixes. On 548ba3f the entry, archive and route cases fail with assertion or missing-export errors. The feature-page case did not finish there and was killed after 50 seconds.

Gates at a542cee plus the docs commit:

| Command | Result |
| --- | --- |
| `npm run build` | Pass |
| `npm run lint` | Pass |
| `npm run check:docs` | Pass |
| `npm run test:dom` | 142 of 142 pass |
| `npm run test:backend` | 520 tests, OK (12 skipped) |
| `git diff --check` | Clean |

Further browser checks, run because the change affects Back behaviour:

- `npx playwright test tests/journey.spec.ts tests/resilience.spec.ts tests/memory-detail.spec.ts tests/atlas.spec.ts` on the desktop project: 37 passed and 4 skipped. On the phone project: 36 passed and 5 skipped.
- `playwright.imports.config.ts` on the desktop project: 9 passed and 1 skipped. This covers the existing visibility and identity-change cases on Imports and Circle.
- `tests/resilience.spec.ts` now presses the browser's Back once instead of twice, because the portal entry is replaced.

## Not verified

- No real phone. Backgrounding was simulated by overriding `document.hidden` and firing `visibilitychange`. Real iOS or Android suspension, tab discarding and back-forward cache restores were not driven.
- Bug 4 was checked only in the DOM test. Shared-mode entry denies every circle except the configured one, and production has one circle, so a second circle could not be chosen end to end.
- A Search result opening a memory was not driven: Search showed no memory links for this fixture. The same path, a plain hash link from a feature page, was driven from Review.
- The Firefox projects, `npm test` in full, `test:app` and `test:domains` were not run.
- Not deployed. The added idle `/api/work` calls from hidden non-Imports pages were not measured on Vercel.

## Known limits

- A hidden page shows what it showed until the tab returns. Returning revalidates the session only. New imports appear after navigation or a reload.
- The session check covers the configured circle. Losing access to a circle chosen in the picker is noticed on the next request for that circle, which returns 403 and clears the view.
- The pill still reads "Back to atlas" when it returns to Timeline or another page. Restoring Timeline's scroll position is out of scope.
