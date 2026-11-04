# F1 photo-label UI independent review

## Reviewed artifact

- Base and merge base: `b3efcf7d1c300bb12173b58908b31106c32ea08f`.
- Head: `32c51e3a1670e5203974b1b70a4d4d3461875330`.
- Stable patch ID: `569ea4fb7a92a6d3ea9e189b7f42034a89e93b17`.
- Worktree: `photo-labels-ui`; full three-dot diff against the base. Review-only; no implementation edits.
- Scope: F1 manual presentation/editor from `docs/SOCIAL_SPACE_IMPLEMENTATION_PLAN.md`; combined filtering F2 excluded. Budget D27 is already merged and independently accepted by the delivery owner.

## Verdict: FAIL

### Standards

No actionable documented-standard violation found. Projection shares approved-person SQL with the existing full reader; the lazy shared editor serves single and bulk clients without a second write implementation. Reviewed naming, duplication, data clumps, repeated switches, speculative generality and middle-man concerns as judgment, not mandatory refactoring. New-code comment audit finds only the compact projection docstring, which accurately states the preauthorization requirement; no suppression directives or misleading added comments.

### Spec

**P2 — Invalidate pending lazy editor opens when Gallery selection changes.** `src/features/memories/gallery.js:81–85` captures `assets` before awaiting the dynamic import, then checks only `run`. Checkbox changes, clear-selection and selection-mode toggle dispose a mounted editor but do not invalidate the pending import. On the first lazy load, click Edit and then deselect/clear before the import settles: Gallery shows **0 selected** yet opens **1 photo's labels** and reads the unchecked asset. With a valid server response its Save can modify that stale selection. This contradicts the explicit current-selection contract and `docs/CONTRACTS.md` statement “Selection changes dispose the editor.”

Independent synthetic DOM reproduction (no implementation edits): mount Gallery with the existing `mountFeature` harness and two `photoEvidenceMemory` children assigned stable `asset-0`/`asset-1`; click `Fotoğraf seç`, click the first checkbox, click `Seçili etiketleri düzenle`, immediately click the same checkbox again synchronously. Await the label API read. Observed text: `0 fotoğraf seçildi · En fazla 50` followed by `1 fotoğrafın etiketleri`; observed request: `/api/social/labels?group=synthetic-circle&assets=%5B%22asset-0%22%5D`. Checkbox is false. The independently executed repro assertions passed, proving the undesired state exists.

Use an editor/selection generation captured before the import and increment it on selection changes, cancel, mode toggle, group/load and disposal; reject stale completion before mounting or requesting. Add synchronous edit→deselect, edit→clear and edit→toggle regressions that require no editor/read after invalidation.

No other correctness blocker found in the reviewed diff. Compact reads omit unknown/full actor/revision metadata and preserve constant query counts; derived presence uses active account/tag-actor membership and suppression. Labels attach only to already-authorized Atlas/Search photo IDs. Full editor reads are explicit and capped at 50; expected changed-dimension revisions, byte-identical receipt retry, conflict reread with retained draft, unknown clearing, group/session/access disposal and authorized-person links otherwise follow the existing backend contract.

## Independent validation

- `node --test tests/dom/label-editor.test.mjs tests/dom/gallery-labels.test.mjs tests/dom/search-date-basis.test.mjs tests/dom/photo-evidence.test.mjs`: **11 passed**.
- `.venv/bin/python -m unittest tests.backend.social.test_label_summaries tests.backend.social.test_labels tests.backend.social.test_labels_http tests.backend.test_atlas_projection`: **26 passed**, including current suppression/departure, hidden/withdrawn projections, bounded HTTP and constant-query cases.
- Independent additional DOM race reproduction: **1 passed**, detecting the defect described above.
- `git diff --check b3efcf7d1c300bb12173b58908b31106c32ea08f...32c51e3a1670e5203974b1b70a4d4d3461875330`: passed, including committed evidence.
- Inspected settled desktop/phone bulk-editor screenshots, desktop Search badges and phone Gallery badges. Labels/count/controls are visible and phone content wraps within the captured width. These are synthetic author browser captures, not independent physical-device acceptance.

Author records real desktop/320px browser workflows and build/typecheck/lint/docs. They were not repeated because this independent slice found an actionable focused blocker; no dist mutation or concurrent browser rebuild. No hosted rerun is needed for the schema-free projection/editor change; backend ledger acceptance was reviewed separately. Initial Unknown clear and selection-race coverage should be retained in the fix. Historical failure evidence remains preserved when a later verdict is appended.

## Reverification after accepted P2 correction — PASS

- Unchanged base/merge-base: `b3efcf7d1c300bb12173b58908b31106c32ea08f`.
- Current reviewed head: `dbbc35138efe46ead0e01b18bf6acc1638520256`.
- Stable full-branch patch ID: `2e4695458027fb980f5111fc35ea6212e8ebd6be`.
- Red regression commit `6e5bba0`, implementation `dbbc351`; original FAIL evidence above preserved.

The focused correction centralizes editor disposal in `closeEditor`, advances a generation on checkbox changes, clear, mode toggle, group/load and lifecycle disposal, and compares each pending import's captured generation before mounting. Concurrent edit clicks also invalidate prior completions. The originally captured unchecked photo is no longer read or editable after invalidation. No unrelated behavior or schema change was introduced.

Independent rerun of `node --test tests/dom/label-editor.test.mjs tests/dom/gallery-labels.test.mjs tests/dom/search-date-basis.test.mjs tests/dom/photo-evidence.test.mjs`: **14 passed**, including all three edit→deselect/clear/toggle regressions, receipt retry, conflict preservation, access disposal, 50-photo selection and linked-person Search behavior. Full committed branch whitespace passed against the exact new head; worktree clean. Prior 26 independently passed backend tests remain applicable because the fix changes only Gallery JS and its regression tests.

**Standards: PASS; Spec: PASS.** No remaining actionable findings. Author should complete the normal integrated final build/budget check after this logic correction; this reviewer did not rebuild dist or rerun unchanged browser suites. D27 budget approval and physical-device acceptance remain owned by the delivery workflow as previously stated.
