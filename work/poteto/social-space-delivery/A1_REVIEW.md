# A1 independent shipping review

Verdict: FAIL at the reviewed head. One reproducible place-identity defect blocks the A1 read contract. The existing targeted suites and browser journey otherwise pass.

- Reviewer: GPT-6.1 Sol, high reasoning, independent from the patch author.
- Base: `75727e0b3e28d0fea384f1c0f5cfdc4e04ed4914`.
- Head: `5e6630c42cbd6022b5cc5f7167909d5e3dfd140a`.
- Stable patch ID: `e4628ecbe1d1f6c2d7a51d6eba6856e1281c575c`.
- Diff: `git diff 75727e0...5e6630c`.
- Scope: A1 photo read evidence and display. Search/correction writes are A2 and were not reviewed as missing A1 features.

## Standards

No actionable documented-standard violations or meaningful Fowler smell findings. The pure Python resolver gathers date/place interpretation, and the shared TypeScript formatter serves the UI consumers. Optional asset/evidence fields preserve explicit sample-mode compatibility. Existing raw payload and legacy-card fields stay intact.

The added module docstring describes its domain boundary. There are no added suppression or constraint comments. No comment deletions, restorations, reshape flags or unenforced constraints were identified. No application code was changed by this reviewer.

## Spec

### P2. Distinguish different canonical cities that share a name and country

Affected code is `src/memory/evidence.ts:90` and `:109`, with the producing label in `mazi/archive/photo_metadata.py:27`. The new summary compares only place text, and `evidencePin` compares only pin name/country. The resolver removes the region from every matched city's display text. The actual gazetteer contains Springfield in Massachusetts, Illinois, Missouri, Ohio and Oregon, all in US. Reviewed full labels correctly resolve to distinct canonical centroids but become the same `Springfield, US` text and name/country pair.

Reproduction with the actual resolver:

```python
place_evidence('Springfield, Massachusetts, US', [])
# known, text Springfield, US, pin 42.12/-72.58
place_evidence('Springfield, Illinois, US', [])
# known, text Springfield, US, pin 39.82/-89.65
```

A real runtime call to the new TypeScript functions with those two child records returns `evidencePlaceLabel(memory) == 'Springfield, US'` and `evidencePin(memory)` equal to the Massachusetts pin. Expected results are `Birden fazla yer` and null. The plan says children in different cities receive the multiple-place state and one child's city must never be transferred to another. This defect places a grouped memory at one child's city even though its other child is in a different city.

Preserve canonical city identity independently of the short text. Compare that identity or the exact canonical centroid when deciding whether all children share one pin. Keep enough region information to distinguish ambiguous city names in display. The Atlas node key in `src/atlas/model.ts:23` also remains country/name only, so separate memories with these distinct canonical pins would collapse into one averaged node. Update that key consistently and add regressions for a grouped two-city memory and separate same-name-city cards. Source `shared_places` rows already carry coordinates but no region, so preserve the matched canonical identity when resolving source pins rather than rejecting a valid city only because its name is ambiguous.

Other inspected A1 behavior matches the scoped contract. Stable asset IDs come directly from timeline asset IDs. Capture conflicts keep their original days. Local calendar dates are not shifted through the viewer zone. Discord sharing evidence is qualified UTC. Ambiguous WhatsApp sharing days stay explicit. Reviewed unmapped text overrides source pins. Unknown siblings do not borrow a known sibling's pin in the ordinary different-name fixtures. Legacy byte-projection tests strip only the two additive fields. The optimistic matched whole-memory save updates per-photo evidence before reread. Approximate/range states are reserved and rendered; current producers do not invent them.

## Independent checks

All fixtures were synthetic in `/Users/altanesmer/Desktop/Ales/Mazi-wt/photo-evidence`.

- `.venv/bin/python -m unittest tests.backend.test_atlas tests.backend.test_atlas_projection tests.backend.archive.test_chronology` passed 50 tests.
- `node --test tests/unit/chronology.test.ts tests/dom/photo-evidence.test.mjs tests/dom/place-tray.test.mjs` passed 13 tests.
- `MAZI_TEST_PORT=5281 npx playwright test tests/memory-detail.spec.ts --grep 'photo facts stay visible' --project desktop --project phone --reporter=list` passed both desktop and phone journeys. Those checks traverse Home, both gallery layouts, selected-photo Viewer, Timeline and the unplaced Atlas list.
- `git diff --check 75727e0...5e6630c` passed.
- The actual phone gallery and Viewer screenshots were inspected. Facts remain below thumbnails and the selected sharing-only photo shows its own sharing day and unknown place. The browser rerun regenerated the same committed artifacts without a tracked diff.
- A direct Python gazetteer/resolver check confirmed the distinct Springfield centroids, and a direct Node call confirmed the false summary/pin.

## Limits

The current head is not merge-ready until the city-identity regression is fixed and independently rechecked. I did not rerun the full suite, hosted parity, production or physical-phone tests. This read-only slice adds no schema/writer behavior. Human findability and physical-device acceptance remain separate.

Standards findings: zero. Spec findings: one P2 place-identity defect. No other blocking finding was identified in this pass.


## Reverification after the city-identity fix

Current shipping verdict: PASS at `a12df88dc28a74a517a15c2fd4766d2afe1a6e2a`. This supersedes the earlier FAIL verdict for shipping purposes. The original failed-head evidence above remains accurate and is retained.

- Base remains `75727e0b3e28d0fea384f1c0f5cfdc4e04ed4914`.
- Current head is `a12df88dc28a74a517a15c2fd4766d2afe1a6e2a`.
- Current stable full-PR patch ID is `2755b7eaaee55736519bb0d3b8864582bd41652f`.
- Focused review delta is `git diff 5e6630c...a12df88`. Full-PR comparison remains `git diff 75727e0...a12df88`.

The fix preserves the region in ambiguous same-name city labels and optional pin metadata. Source records with exact canonical centroids resolve to the correct city even when the shared city name alone is ambiguous. Conflicting centroids produce conflict/no pin, and an ambiguous city without a matched canonical centroid remains unmapped. Group summaries compare canonical pin identity independently of text. Atlas node keys also include canonical coordinates for evidence-backed cards, so separate Springfield cards no longer collapse into an averaged point. Legacy sample cards retain their existing country/name keys.

Whole-memory place-save responses now preserve the ambiguous city's region in the returned pin. The optimistic client update includes that region in every changed child's display text. The source read model and saved optimistic record therefore agree before and after reread.

Independent focused checks all pass:

- `.venv/bin/python -m unittest tests.backend.test_atlas` passed 35 tests, including the actual gazetteer Springfield regions, source centroids, conflicting same-name source cities and returned saved-pin region.
- `node --test tests/unit/chronology.test.ts tests/unit/atlas-model.test.ts tests/dom/photo-evidence.test.mjs tests/dom/place-tray.test.mjs` passed 22 tests. The same-name-city regression asserts multiple-place text, no grouped pin, distinct Atlas node keys and separate exact centroids. The optimistic-save DOM regression asserts region-preserving child labels.
- A direct Python call now returns distinct `Springfield, Massachusetts, US` and `Springfield, Illinois, US` labels with their own canonical pins.
- The original direct Node reproduction now returns `Birden fazla yer` and null.
- `git diff --check 75727e0...a12df88` passed.

The author added the regression contract at `f743794` and the implementation fix at `a12df88`. The reviewer independently observed the failing behavior at the previous head and the passing behavior at this head. The earlier independent desktop/phone photo journey remains applicable to the unchanged date/viewer behavior; the author also records rerunning that journey after the fix. This second review did not repeat unrelated complete suites or production checks. No app files were edited by the reviewer and the worktree remains clean.

Current Standards findings: zero. Current Spec blockers: zero. The reported P2 city-identity defect is resolved.
