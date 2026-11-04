# F1 photo label UI verification

## Scope and revisions

Branch `codex/photo-labels-ui-20261104`, initially based on `1f39e14`. Current main through plans UI/shared Sheet fix `634355f` was merged with `4126511`. The label controls remain in the selected-photo tools; the independent conversation panel owns its separate insertion before EventNotebook. Editors do not change the photo/discussion URL.

Origin verified as `https://github.com/dodoscoding/Mazi.git`. This worker did not push, create a PR, merge to main or deploy. No new dependency or schema migration. The existing versioned F1 backend remains the write authority.

## Delivered behavior

- Compact optional `Photo.labels`/Search item summaries omit Unknowns and full actor/revision records. Two grouped queries cover at most 10,000 already-authorized photo IDs; declaration revisions, current actor membership and current approved-person/suppression predicates govern every read. Existing Atlas 1/300/1,001-photo query counts stay constant and the 35-query HTTP ceiling remains unchanged.
- A lazy shared editor exposes all three dimensions, Unknown and leave-unchanged choices, effective versus declared people presence, manual method/current author and approved-person links. Sharers never imply depicted people. The existing person Search predicate is preserved in links without a People-management startup read; its removal is explicit and group changes clear it.
- Gallery selection uses unique stable asset IDs, an explicit affected count and a 50-photo cap. One bounded read loads the full current selection. Atomic writes send only chosen dimensions and expected versions. Changed selection disposes the editor. Lost-response retries reuse exact command bytes/key; conflicts reread all selected revisions and retain the draft. Access/group/session changes clear drafts and dispose late work.
- Gallery and Search display declared screenshot/AI creation/editing badges without automatic classification. Success rereads authoritative facts. Combined F2 filters remain separate.

## Red and green

`d97750f` exposed missing Atlas/Search summaries (KeyError); `2a2df66` added projection. Existing constant-query tests then exposed a per-chunk query increase: final summaries use exactly two grouped queries rather than one pair per chunk. `575bf3c` and `424bec6` recorded editor retry/selection contracts. Actual browser execution found nested select labels included option text in label lookup; `b366b5c` uses explicit label/control associations and also completes approved-person entry behavior.

## Verification

After merging plans UI/main:

- `.venv/bin/python -m unittest tests.backend.social.test_label_summaries tests.backend.social.test_labels tests.backend.social.test_labels_http tests.backend.test_atlas_projection tests.backend.discovery.test_date_basis`: **39 passed**. Includes hidden/withdrawn photos, actor departure, suppressed people, untouched siblings, semantic/keyword date paths and 1,001-photo exact/constant-query contracts.
- `node --test tests/dom/label-editor.test.mjs tests/dom/gallery-labels.test.mjs tests/dom/search-date-basis.test.mjs tests/dom/photo-evidence.test.mjs tests/dom/memories-mobile.test.mjs tests/dom/search-startup.test.mjs`: **19 passed**. Covers exact receipt retry, draft-preserving conflict, group/access disposal, the 50-photo cap, deferred metadata reads and initial Search isolation.
- `MAZI_TEST_PORT=5294 MAZI_UNIFIED_PORT=8154 npx playwright test --config playwright.unified.config.ts -g 'photo label editing'`: **2 passed**, real synthetic desktop and 320 CSS-pixel phone. Single-child edits preserve siblings; two-photo atomic edits preserve the third photo. Gallery/Search badges agree; first Search makes no Atlas or People-management request. No horizontal overflow at 320 px. Cleanup restores prior declarations using current revisions.
- `npm run build`, `npm run typecheck`, `npm run lint`, `npm run check:docs`: passed. Build carries the existing large-chunk advisory; no new library was added.
- Combined plans + labels measured **401.8 KiB total scripts**, which honestly fails the existing **400 KiB** gate. Entry **149.1/150 KiB**, CSS **36.9/40 KiB**, Globe **242.9/256 KiB** remain within their limits. Root owns the separate measured budget decision; this feature does not change a ceiling.
- `git diff --check` and `git diff --check 1f39e14...HEAD`: passed before final handoff.

## Visual evidence and limits

[Desktop editor](desktop-bulk-editor.png), [phone editor](phone-bulk-editor.png), [desktop Gallery](desktop-gallery-badges.png), [phone Gallery](phone-gallery-badges.png), [desktop Search](desktop-search-badges.png), [phone Search](phone-search-badges.png). The phone editor was visually inspected: labels and provenance links wrap, all controls fit, the affected count stays explicit and the AI declaration reads as a declaration.

Hosted migration/ledger acceptance belongs to the already merged backend slice; no hosted suite was rerun for this schema-free UI/read projection. Physical-device and five-friend acceptance remain separate gates. Root owns independent review, final full-suite verification, integration budget approval and deployment.
