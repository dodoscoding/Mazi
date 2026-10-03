# Atlas prototype verification

Date: 2026-10-03. Implementation base revision: b7c2cc7afae45212b461e2f141ff5f1ebb5779be; the checks below initially ran before committing. Existing planning edits were retained. Source brief and initial plan remain untouched.

## Scope and environment

macOS arm64, Node 24.15.0 / npm 11.12.1, React 19.2.8, Fiber 9.8.1, Three 0.186.1, Vite 8.3.2, TypeScript 7.0.2; exact dependency lock in package-lock.json. Playwright 1.63.0 Chromium 153.0.8010.12, desktop 1440x1024 and iPhone 13 geometry/touch emulation (Chromium, not iOS Safari). Codex in-app browser inspected Home and detail at 1440 and 390 CSS px. Synthetic fixture data only.

## Behavioral evidence

`npm test`: 20 tests passed in 8.6 seconds after the final caption-layout correction. Tests cover selection/open/photos/context, history/direct/unknown links, boundary controls, focused headings and Home return, rapid navigation reversal, keyboard gallery/selection, live reduced-motion changes, unavailable View Transitions, failed photograph and retry, actual WEBGL_lose_context and remount/recovery, Search empty/results states, axe Home/detail analysis and widths 320/390/768/1280/1600.

Initial failing journey test: after installing the missing Chromium binary, the scaffold timed out waiting for Select Lake days. Initial implemented suite exposed an immediate browser-Back/history race; navigation now commits history synchronously and invalidates stale visual callbacks. Transition promise cancellation is handled. Six initial checks passed; both history checks failed before the fix, then both passed. Test files retain reproducible contracts.

Direct scene picking observed in the in-app browser: clicking the lake plane changed URL to `#/?selected=lake-days`, title to Lake days and both date/list selected state. Next photo changed the photo and count; Show conversation revealed all three fixture messages.

## Visual evidence

[Desktop Home](../../../.impeccable/review/desktop.png), [phone Home](../../../.impeccable/review/mobile.png), [desktop memory](../../../.impeccable/review/desktop-detail.png), [phone memory](../../../.impeccable/review/mobile-detail.png). First inspection found phone atlas caption overlapping a photo; final layout allocates separate caption space.

The chosen [Atlas concept](../../../.impeccable/mocks/decision/bolder-atlas.png) supplies midnight ground, copper selection, serif lettering, curved dated chart and dominant right-hand photograph. The prototype has three actual memory objects instead of decorative extra records, accurate fixture photo counts, an honest demo disclosure, and no implied geography. The actual procedural chart is broader/rounder than the concept's upright cropped chart. This is not pixel-identical reproduction.

Impeccable comp-spec/font measurements were attempted, but its coarse automatic regions selected incorrect content (e.g. the metadata region reported 52.5px cap height). Those measurements are not accepted as fidelity evidence. The automated build-phase remains at spec; no forced pass or claimed numerical fidelity score. Independent review must judge actual screenshots against the selected reference and scope.

## Assets

Five fictional photographs generated with the built-in image_gen tool, converted with cwebp quality 84. All delivered assets are under public/media with exact prompt/provenance sidecars; prompt originals are in this directory. No stock hotlinks, real personal data, paid model service or cropped mockup pixels. Fonts are self-hosted from Fontsource under their retained OFL licenses. 3D geometry is procedural in src/Atlas.tsx, not a raster imitation or external model.

## Limits

No production authentication, ingestion, storage, authorization or deployment. No real iPhone/Android hardware, Safari/Firefox pass, manual screen-reader session, low-end GPU performance certification, or 2-3-friend user study yet. Automated axe checks are not WCAG certification. The Vite build reports a large lazy-loaded 3D chunk; Fiber currently uses the deprecated Three.Clock API internally, producing a development warning. No 60 fps claim. Motion continuity is implemented and interruption tested; subjective feel remains a user-test question.

## Final local checks

- `npm run build`: passed TypeScript and production bundling; build.log records the lazy 3D chunk warning (920.51 kB minified / 244.93 kB gzip). Entry JavaScript is 206.58 kB / 65.22 kB gzip.
- `npm test`: 20/20 passed on desktop and phone emulation after the final implementation changes. Resting-atlas measurement observed no more than one requestAnimationFrame callback in 500 ms after a 1200 ms settle, on both configurations. This is an idle-work check, not a frame-rate benchmark.
- Document checker: 15 authored documents, 99 local links, 30 requirement mappings, 8 milestones, 15 acceptance scenarios passed.
- `git diff --check`: passed.
- `impeccable detect --json src/App.tsx src/Atlas.tsx src/Photo.tsx src/styles.css`: zero findings.
- `impeccable embed-prompt --scan public/media`: five rasters, zero missing provenance.
- Screenshots were recaptured from the top with settled images and reduced motion by tests/evidence.spec.ts after the in-app browser full-page capture included an offscreen fixed skip link. All four final files were opened and inspected. Phone captures are 390 CSS px at DPR 3.

Independent review result follows separately.

## Independent review corrections

The initial review requested fixes for Home retry bubbling into navigation and button hover contrast. A new Home retry contract reproduced the wrong detail URL before the fix. The photo component now places its success-state link around the image alone, leaving recovery controls outside navigation. The hover ground is now #a8542b with #fff9f0 text. Both desktop and phone regression checks pass.

The machine/manual review distinction is explicitly recorded in [.impeccable/build/REVIEW_STATUS.md](../../../.impeccable/build/REVIEW_STATUS.md). No automatic comp gate has been forced or claimed passed. See [finish review and fix verdict](FINISH_REVIEW.md).

The independent fix verdict is **ship** for experiment readiness: workflow disclosure, Home retry and hover contrast all resolved. It is not a fresh whole-surface or numerical fidelity certification. The documenter produced DESIGN.md and .impeccable/design.json from the implementation; their JSON parses and values were checked against the source. At that review checkpoint, no commit, push, deployment or remote issue update had been made. The owner subsequently approved the prototype and authorized a pull request and merge; D16 records that acceptance.

## Integration verification

Before committing on 3 October 2026, the complete suite passed again: 20/20 checks in 8.3 seconds. `npm run build` passed (entry 206.66 kB / 65.27 kB gzip; unchanged lazy Atlas chunk warning), Prettier passed for source, tests and configuration, and `git diff --check` passed. The recorded source/test/media SHA-256 manifest matched every file. Screenshots were regenerated by the same evidence tests. The integration branch starts at main revision 4e0999f, whose file tree matches the original implementation base; the intervening commits merged the earlier planning PRs. Local question-server PID/port state and logs are ignored; the selected-direction answer is retained.
