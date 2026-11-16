# A2-write independent shipping review

Verdict: PASS for the selected-photo correction/editor/export slice. No actionable correctness, privacy, regression or documented-standard finding was identified.

- Reviewer: GPT-6.1 Sol, high reasoning, independent from the patch author.
- Base: `cdfe6f42b5cee4f6df2a07828006c618d3ebf930`.
- Head: `7f09c8581b866227771350fa966978b296fe58bd`.
- Stable patch ID: `0401bffeba7e4f2e7325413bbffc087583795160`.
- Diff: `git diff cdfe6f4...7f09c858`.
- The branch incorporated current main at `ed4ec87`; the review uses the current-main merge base above.

## Standards

No actionable documented-standard violations or meaningful Fowler smell findings. The selected-photo command owns its canonical snapshot and field patch inside the existing write boundary. The lazy editor keeps request cancellation, snapshot and draft state together. It does not introduce a schema layer or replace the existing full Review contract.

The scoped comment audit found one new HTTP-test comment describing the existing shared-session authentication contract. It does not justify a workaround or suppression. No added application comments, suppression directives or constraint comments require changes. No application files were edited by this reviewer.

## Spec

The snapshot includes canonical title/date/place/anniversary values and the current authorized origin IDs/fingerprints, rather than relying on a second-resolution timestamp. Snapshot read, current-access validation, comparison and mutation occur in one immediate archive transaction. The allowlisted patch preserves every omitted annotation field and sibling photo. A changed annotation or authorized-origin fingerprint invalidates the snapshot. Current group membership, direct hides, hidden-memory children and active source ownership are rechecked.

Date correction uses exact calendar validation. Null clears the override; an anniversary-dependent clear fails atomically until the full Review flow explicitly changes that anniversary. Place correction preserves free text, and ambiguous/offline city candidates use the existing gazetteer. Only a matched canonical city supplies a pin. Clearing an override can expose remaining source evidence and does not erase contributor pin-removal records.

The lazy editor uses the selected photo's stable asset ID. It disables edits until the initial snapshot arrives, preventing the observed initial-load draft overwrite. Save failures and 409 preserve the draft; a conflict rereads current authority before the member explicitly retries. Selection changes remount the editor, and group/session/access loss aborts requests and clears/closes private state. A successful save requests an authoritative Atlas reread. Whole-memory city placement remains a separate form and states the exact affected photograph count.

Reviewed locations now participate in authorized Places and export projection. A reviewed city replaces source coordinates in places.json; unmapped text stays in manifest annotations and suppresses source pins. A clear restores any remaining source location. Both ZIP assembly and final metadata admission use the revised projection, and a correction during export causes a conflict. Origin payloads and fingerprints remain unchanged. Existing same-image reimport and removed-pin behavior is retained.

There is no schema change. The same `store.transaction()` immediate boundary maps to the existing exclusive hosted advisory transaction lock through PostgresConnection. No new database-specific mutation syntax is introduced. Hosted runtime execution was not independently repeated in this review.

## Independent verification

Commands ran in `/Users/altanesmer/Desktop/Ales/Mazi-wt/photo-corrections-ui` using synthetic fixtures. Browser builds and fixture servers were serialized.

- `.venv/bin/python -m unittest tests.backend.test_photo_corrections tests.backend.test_atlas_place tests.backend.sources.test_places_export tests.backend.sources.test_gps_places` passed 50 tests in 20.4 seconds. These include real HTTP origin/allowlist/conflict handling, sibling/field preservation, anniversary clear rejection, same-second changes, reviewed/free/clear locations, final export admission and removed-pin reimport. The 20,000-location export profile stayed at 128 rows and 27,648 projected UTF-8 bytes per page; final validation measured 1.25 seconds locally.
- `node --test tests/dom/photo-correction.test.mjs tests/dom/archive-hook.test.mjs tests/dom/place-tray.test.mjs tests/dom/photo-evidence.test.mjs` passed 20 tests. This covers preserved conflict drafts, explicit retry with the refreshed snapshot, cancelled late responses, initial snapshot loading and authoritative archive refresh.
- `MAZI_TEST_PORT=5290 MAZI_UNIFIED_PORT=8150 npx playwright test --config playwright.unified.config.ts --grep 'selected child corrections' --project desktop --project phone --reporter=list` passed both real-backend journeys. Each saves place and date, checks refreshed selected-photo facts, changes to a sibling without carrying those edits, clears the selected override and restores fixture annotations during cleanup.
- `npm run check:docs` passed with 19 documents and 328 links.
- `git diff --check cdfe6f4...7f09c858` passed for the full committed branch.

I inspected the actual phone screenshot. The saved free-place text is explicitly unmapped, date/place lines wrap, selected-photo actions are separate and the grouped summary does not borrow the selected child's place for siblings. The browser rerun changed only the generated desktop screenshot due to capture state; I restored that reviewer-produced artifact to the committed version. The worktree is clean.

## Limits

The first snapshot's transient read failure currently recovers by closing and reopening the editor; no user draft is accepted until that read succeeds. Saved-draft retry and stale-snapshot retry are covered independently. Arbitrary multi-photo date/place batches are not added; whole-memory city placement remains explicit and separate.

This review did not repeat the whole integrated suite, hosted runtime, production, physical-phone or five-friend acceptance. The existing hosted transaction adapter was inspected, and the author explicitly documents that this schema-free slice did not rerun hosted tests. Full release checks remain the coordinator's acceptance gate.

Standards findings: zero. Spec blockers: zero within this delivery slice.
