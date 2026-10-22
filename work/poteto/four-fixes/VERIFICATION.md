# Search, Replay, dates and photographs

## Scope and baseline

The owner requested four fixes and authorized deployment after tests. Capture chronology takes precedence. Complete, resolved sharing evidence can position a memory in Replay with a visible sharing label. Opened photographs must retain their full frame.

The clean checkout fast-forwarded to `d1e9beb`. Production deployment `dpl_CuU4DDrrdBkPQrkrnNBeMW3ZKW82` also contained unmerged deployment, import and worker changes. Twenty source files were restored byte-for-byte against the deployment's SHA-1 identifiers in commit `5df9b38`. Generated `tsconfig.tsbuildinfo` was excluded. This prevents this release from rolling back those deployed changes. The reconstructed production comparison commit is `e95971f15a8ea651365aea75e6a4fd27ac5d508e`.

## Design and ownership

Two independent candidates compared backend projection with a frontend chronology model. [The design judgment](design-judgment.md) selected the frontend model because the authorized API already supplies per-photo sharing evidence. It also required complete coverage for grouped memories and preserved capture fields and capture search filters. Dates with unresolved order remain outside Replay.

Blocking work verified the production baseline and chronology contract. Search and UI implementation used disjoint files. The root alone staged commits and managed release state. Separate Standards and Spec reviewers inspected the change. Reviewers used one model family.

## Reproductions

The small-archive search regression failed with `2719 not less than or equal to 20`. A real Messenger-import fixture with oversized metadata plus 300 synthetic photographs failed with `2728 not less than or equal to 20`. The completed batched route uses 10 SQL statements for the plain 300-photo page, with identical returned data. These are database statement counts, not hosted latency measurements.

The Home browser regression failed with `Expected: "2025"` and `Received: "Undated"`. Chronology unit tests failed before the new module existed. Passing browser checks exercise same-year Replay, pause, completion, restart, sharing labels and portrait/panorama framing on desktop and phone viewports. Geometry checks include ancestor clipping and photo transitions.

## Verification

Local environment is macOS, Node 24.15.0 and CPython 3.14.7. Fixtures are synthetic. Production uses the existing Python 3.12 selection.

- Backend suite passed 492 tests with 12 optional checks skipped.
- Keyword scaling and metadata budgets passed 14 focused tests. Filter and privacy assertions now use explicit expected results through public search.
- Deployment bridge and imported baseline checks passed 66 focused tests.
- DOM suite passed 122 tests. Unit suite passed 20 tests on the integrated release.
- Retrieval evaluation met its synthetic target. Answer evaluation supported 100 answerable questions and abstained on all 50 unanswerable questions.
- The document checker passed. Typecheck and Prettier passed on the integrated release.

Initial full browser execution found two obsolete label assertions and a loss of raw sharing evidence in the portal. Independent Spec review also found approximate capture labels and stale Replay state after manual year navigation. All review findings were corrected. A subsequent full run exposed phone navigation covering the long source dossier and accessibility scans during entrance animations. The portal now ends above the fixed navigation; the regression checks the action bounds before clicking. Accessibility scans await finite animations. Twelve repeated Chromium/Firefox phone cases passed after these corrections. The Spec, Standards and merge reviews have no remaining actionable findings.

Stock Playwright Firefox could not start its macOS profile. The final run uses the repository's documented isolated application wrapper with the same browser engine, described in [the Firefox environment receipt](../m0-acceptance/FIREFOX_ENVIRONMENT.md).

## Final verification and release record

Production changed during verification to `dpl_DuuzTA5xxJT8vH9jVcvz1oSdDyHX`. Its source files matched the local `claude/deploy-integration` checkout at `f49fcf1` by SHA-1. Merge `40d3291` preserves its new music and night-only UI. Existing connection cleanup, cached import scans, hidden-tab draining and the Search fix remain byte-identical to the previously tested versions. [Independent merge review](review-merge-standards.md) confirms both sides were preserved.

The final serial browser gate runs:

```sh
MAZI_FIREFOX_EXECUTABLE=/tmp/mazi-acceptance-firefox/firefox npm test -- --workers=4
npm run test:app
MAZI_PYTHON=.venv/bin/python npm run test:domains
npx playwright test --config playwright.imports.config.ts
```

The release pull request records the final suite totals, exact deployment identity, HTTP smoke checks and promotion result. Production is staged with `--prod --skip-domain` only after local checks pass, checked at its immutable URL, then promoted to `https://mazi-three.vercel.app`. There is no schema migration, capture-date rewrite or new data exposure.

## Implementation commits

- `4f684de`, `8b70045`: failing Search work contracts.
- `be981ae`, `1c04b80`: bulk Search implementation and explicit filter/privacy checks.
- `592e7ab`, `d2bd3e6`: chronology, Replay and full-frame regressions.
- `412303c`: labeled sharing chronology and per-memory Replay.
- `4048434`: uncropped opened photographs and transitions.
- `87a4659`, `fef370e`: phone action clearance regression and fix.
- `0345ad1`: capture/sharing and photograph decision contract.
- `5df9b38`, `40d3291`: preserve both observed production baselines.

## Synthetic UI evidence

[Phone chronology](evidence/sharing-chronology-phone.png), [desktop chronology](evidence/sharing-chronology-desktop.png), [phone portrait](evidence/viewer-portrait-phone.png), [phone panorama](evidence/uncropped-phone.png), [desktop portal](evidence/portal-portrait-desktop.png), [desktop panorama](evidence/uncropped-desktop.png). Red borders mark all four image edges. No private archive photographs are included.

