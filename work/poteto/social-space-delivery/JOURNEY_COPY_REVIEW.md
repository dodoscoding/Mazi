# Independent N1 Turkish journey copy review

Verdict: FAIL at `07d2fe2` because two existing place-form contracts were not updated for the new copy. The reviewed runtime and focused browser interactions pass; no product behavior defect was found.

- Base: `8aa03020aa8003160fa98e082e9232b7febcd9dc`.
- Head: `07d2fe25f4e0dbe06ff8c6fabd90c99d624ed663`.
- Stable patch ID: `a182ee097e439d3007ac361b309109803a980e97`.
- Scope: Atlas/Portal/place form/intro/scrubber, Timeline and Viewer labels, matching tests, and expanded phone-sheet fallback-notice geometry. Root-authored patch independently reviewed by GPT-6.1 Sol with high reasoning, within one model family.

## Standards

P2: Update the existing place-form copy contracts before shipping. `tests/dom/place-tray.test.mjs:167` still expects the tray rows to end in `2 photos` and `1 photo`, while `UnplacedTray` now renders `2 fotoğraf` and `1 fotoğraf`. `tests/dom/place-tray.test.mjs:235` still asserts the old English unknown-city message, while PlaceForm now returns the intended Turkish message. Consequently, the existing place-form suite fails before completing its ambiguity/pin and unknown-city assertions. AGENTS requires relevant tests to pass before declaring the workstream complete; the assignment explicitly includes matching existing test selectors.

Independent reproduction:

```text
node --test tests/dom/photo-evidence.test.mjs tests/dom/place-tray.test.mjs
5 passed, 2 failed

Expected: Lake weekendJun 2024 · No place recorded · 2 photos
Actual:   Lake weekendJun 2024 · No place recorded · 2 fotoğraf
Expected: Photo shared by AnaJun 2024 · No place recorded · 1 photo
Actual:   Photo shared by AnaJun 2024 · No place recorded · 1 fotoğraf

Expected: “Nowhereville” isn't on the map. Check the spelling or add the country, e.g. “Victoria, CA”.
Actual:   “Nowhereville” haritada bulunamadı. Yazımı kontrol et veya ülke kodunu ekle, ör. “Victoria, CA”.
```

Update those three expected strings to the intended copy and retain all current exact request, ambiguous-candidate, no-write, aria-invalid, selection and pin assertions. No application change is needed for this finding.

No other standards finding. Runtime changes are labels, accessible names, more accurate empty/recovery explanations and one responsive visibility rule. No dependency, schema, API, private-storage or member-content transformation is added. Two existing comments were reworded to match translated names; no new runtime explanatory comments or suppressions were introduced. Existing browser assertions were preserved with matching translated locators; the phone geometry contract adds rather than removes checks.

## Spec

No scoped runtime finding. The translated controls preserve handlers, navigation URLs, selection, input state, keyboard behavior, photo boundaries, author/source metadata and sample text. Plural calls explicitly use the Turkish uninflected count noun. The timeline empty copy now describes unknown-date items without inventing approximate dates. Existing place-form saving, ambiguity, error, clear and all-photo scope remain intact in the diff.

The phone-only CSS hides `.flat-note` while the Atlas sheet is expanded and restores it at snap zero. The actual 320-pixel phone contract verifies visibility before expansion, hiding after expansion, reachable place/memory controls and reappearance after collapse. Retry through the existing Küre control remains available; fallback information is not removed from the collapsed view. Current desktop behavior is unaffected.

Inspected all four committed synthetic screenshots (`phone-atlas.png`, `phone-summary.png`, `phone-timeline.png`, `desktop-timeline.png`). Translated controls wrap and remain readable. Raw English sample titles, narratives, date evidence and metadata remain unchanged as specified. Search/Gallery and Home/detail-shell translation are separate F2/H1 workstreams; this review does not treat that explicitly deferred copy as a finding.

## Independent verification

- `node --test tests/dom/atlas.test.mjs tests/dom/timeline-dates.test.mjs`: **nine passed**. Includes renderer retry/late results, lifecycle/reduced motion and accurate unknown-date timeline text.
- `node --test tests/dom/photo-evidence.test.mjs tests/dom/place-tray.test.mjs`: **five passed, two failed** as detailed above. Both selected-photo evidence contracts passed.
- `node --test tests/dom/places-recovery.test.mjs tests/dom/place-tray.test.mjs`: **12 passed, two failed**, with only the same copy failures. All nine recovery contracts pass, including failed-refresh draft/selection retention, late reads, access-loss clearing, focus restoration and saved share/remove despite reread failure.
- `MAZI_TEST_PORT=5314 npx playwright test tests/atlas.spec.ts tests/browse.spec.ts tests/memory-detail.spec.ts tests/journey.spec.ts --project desktop --project phone --workers 2 --grep 'phone sheet|scrubber step|portal opens|first visit|choosing a year|buttons and arrow keys|keyboard focus stays|select, open|deep links, photo boundaries'`: **17 passed, one desktop-inapplicable skip**, 14.1 seconds. Covers intro skip, year keys, portal/Escape/focus, Timeline synchronization, Viewer keys/end focus/retry, journey/history and 320-pixel sheet overlap correction.
- That browser run started and stopped a fresh force-local temporary sample server and built serially. An earlier attempt to reuse coordinator port 5312 encountered connection refusal because the coordinator had already stopped it; no application checks executed in that infrastructure-only attempt. The fresh-server run is the result above.
- `npm run check:budgets`: unchanged ceilings pass; entry 149.6/150 KiB gzip, all scripts 405.5/420, CSS 36.9/40, Globe 242.9/256.
- `git diff --check 8aa0302...HEAD`: passes the full committed branch, including evidence.

The coordinator's complete Chromium/Firefox matrix remains author evidence; it was not repeated here. No Firefox environment workaround was needed for these independent Chromium runs. No application files or production data changed. Eight pre-existing untracked Firefox captures under `work/poteto/photo-evidence/screenshots/` and `work/poteto/social-navigation/` were preserved; the tracked tree remains clean. Physical-phone and five-friend acceptance remain separate.

## Superseding test-only recheck

Verdict: PASS at `e279efdd2dcea8ea84cafc4d589c9ee5359e0ef9`. The initial FAIL and its evidence remain above; this verdict supersedes it.

- Base remains `8aa03020aa8003160fa98e082e9232b7febcd9dc`.
- Exact head: `e279efdd2dcea8ea84cafc4d589c9ee5359e0ef9`.
- Stable full-branch patch ID: `7d4b7dc33534c2c3f213afca97038d0463b33eee`.

The only change after the previously reviewed head is the three exact expected strings in `tests/dom/place-tray.test.mjs`. It now expects the translated photo counts and unknown-city message. All exact request, candidate selection, no-write, focus/state and pin assertions remain unchanged; the runtime is identical to the browser-reviewed revision. No new Standards or Spec finding.

Independently reran:

```text
node --test tests/dom/atlas.test.mjs tests/dom/timeline-dates.test.mjs tests/dom/photo-evidence.test.mjs tests/dom/place-tray.test.mjs
16 passed; 0 failed; 0 skipped
```

This completes both previously interrupted place contracts, including ambiguous Victoria selection/pin and unknown-city no-write/aria-invalid behavior. `git diff --check 8aa0302...HEAD` passes. The existing independent 17 browser passes, nine place recovery passes and visual/budget evidence remain valid because runtime did not change. The tracked tree remains clean, with the same eight coordinator-owned untracked Firefox captures preserved. No browser rerun or production operation was needed for this expected-text-only correction.
