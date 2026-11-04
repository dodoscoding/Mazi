# Reviewed place export fixture review

The worker-authored patch `7bca860` was isolated and cherry-picked as `1875a1541190099d61c1129af08c466886b78b1b` on base `09f919818b78b990d01b040737e98a42570d40ce`. Root independently reviewed the complete three-line fixture diff and its surrounding contract. PR #129 contains no runtime change.

## Standards

PASS. One coherent test change preserves existing byte/hash/category/origin, annotation and outside-transaction read assertions. It follows the existing Python test style and adds no abstraction or suppression.

## Spec

PASS. A2 makes the reviewed place authoritative. The old all-category fixture reviewed an unmapped `A place` but expected a source Amsterdam pin; correct suppression produced an IndexError. A mapped `Amsterdam, NL` retains this test's intended exported-place category and now asserts the stronger `review:<asset>` provenance. The separate photo-correction regression still requires no pin for unmapped text and restoration after clearing the correction.

## Independent verification

- `.venv/bin/python -m unittest tests.backend.test_export_admission tests.backend.sources.test_places_export`: 50 passed in 20.1 seconds.
- `.venv/bin/python -m unittest tests.backend.test_photo_corrections.PhotoCorrectionTests.test_reviewed_place_export_replaces_source_and_clear_restores_it`: one passed. An initial mistyped class name was corrected; no test was changed to accommodate it.
- `git diff --check 09f9198...HEAD`: passed.

No schema, privacy, dependency or deployment impact. This is synthetic acceptance and does not establish a production milestone.
