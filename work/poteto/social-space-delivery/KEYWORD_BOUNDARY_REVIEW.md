# Keyword filter boundary independent review

## Artifact and verdict

**PASS** at exact head `d167f7b2c299ea99735fb7c6426f6fd764787c10`; base/merge-base `2b4b09d3f90954bc71c00e262da829366dcb5982`; stable patch ID `c5eb9b9e3cffa655ad3738b31a75bb4fd1469348`. Worktree `keyword-filter-boundary`. Reviewed immutable full diff: red regression `4050725`, fix `d167f7b`, three runtime added/five removed lines, twelve test lines and clarified contract. No implementation edits or publication by reviewer.

## Standards

No findings. The erroneous universal item ceiling is removed rather than raised. Approved-person facts use the same existing query/predicates over internal batches of at most 10,000 IDs, matching compact-label batching. No per-photo query loop or unnecessary abstraction; no new comments or suppression directives to audit. Existing regression tests remain unchanged, and the new assertion exposes both filtered Search and Gallery at the exact prior failing boundary.

## Spec

No findings. Baseline keyword Search supports exact pages beyond 10,000 under metadata work limits, while semantic related search retains its explicit 10,000-photo cap. `PhotoFilter` now respects this distinction. `_keyword_search` starts the existing request clock before constructing filter facts and passes that start to the bounded metadata stream/context; byte/time/origin ceilings, rollback and authorized-photo selection are unchanged. Batching does not reset metadata allowances or alter the current-membership, account, suppression, hidden-event, withdrawn-source or actor predicates. The documentation now accurately distinguishes semantic capacity from keyword/matches work limits.

Independent extra fixture at 10,001 photos confirms an approved tag on `capacity-10000` matches exactly once with `people_present=yes`, full-visible denominator 10,001, and two full approved-person queries containing **10,000 and 1 IDs**. Semantic Search over the same fixture still raises its 10,000-photo error. Hiding that tagged boundary photo returns no match/person name/count and denominator 10,000. Facts continue to come from the complete authorized set rather than the requested page.

## Independent verification

- Python **3.11.15**: `tests.backend.discovery.test_keyword_scaling`, `test_photo_filters`, `test_keyword_budgets`: **19 passed in 4.206s**. Includes exact 10,000/10,001 final pages, new screenshot Search/matches boundary, 1,001-photo constant fact-query assertions, same-child predicates, privacy, per-origin/asset/request byte limits, inclusive time budget and atomic rollback.
- Python **3.14.7**: the exact 10,000/10,001 page and new filtered boundary methods, full photo-filter suite and cooperative time-budget method: **7 passed in 2.070s**.
- Python 3.11 date-basis suite plus `RemainingCapacityTests.test_complete_semantic_index_events_and_places_at_ten_thousand`: **14 passed in 3.264s**, covering legacy extra-context/shared request budgets and seeded 10,000-photo semantic/fingerprint behavior. No costly real-10k image import was run.
- Additional independent 10,001-photo person-query batch/semantic/hide probe described above: passed.
- Full committed branch whitespace passed; worktree clean at reviewed head.

No schema, permission, source-fingerprint or export change. No new hosted calls or production mutations; actual live hosted acceptance is not claimed. Full release CI remains owned by the delivery workflow.
