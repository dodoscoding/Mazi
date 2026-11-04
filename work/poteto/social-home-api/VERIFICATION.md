# H1 backend verification

The work starts at `39249c4`. Red contract commit `b0bfbff` fails because the Home module does not exist. Implementation `98dc292` adds bounded social summary/activity reads and a selected-assets Atlas read. Main through F1 UI `09f9198` was merged as `7c49554`. The shared projector calls the compact label hook exactly once, and selected cards are compared with the current full Atlas representation. No Home frontend change is part of this branch.

## Focused evidence

- Initial seven Home contracts passed after implementation. Current local/HTTP coverage includes empty, archive-only, plan-only and active groups; same-second and concurrent keysets; action edits; source/member/hide removal; grouped-photo links; large native-row budgets; selected evidence and compact labels.
- The merged selected-Atlas/label-summary/Home command passes 61 tests. It runs `tests.backend.social.test_home`, `test_home_http`, `test_label_summaries`, `tests.backend.test_atlas` and `test_atlas_projection`.
- `.venv/bin/python -m unittest discover -s tests/backend/social -t .` passes 102 tests with 16 hosted cases skipped in the local environment.
- The adjacent command below passes 137 tests. The export synthetic profile still covers 20,000 source-location rows with at most 128 records per page.
- The guarded hosted command spawns `.venv/bin/python -m unittest tests.backend.social.test_home_postgres` with `MAZI_DATABASE_SCHEMA=mazi_social_20261104_test MAZI_STORAGE_BUCKET=mazi-social-test MAZI_BACKEND=supabase MAZI_TEST_POSTGRES=1 node --env-file=.env.supabase`. All 3 hosted tests pass after the main merge in 25.5 seconds. The coordinator applied only the index migration to the isolated schema and changed the two action indexes to their final `updated_at` form. Production was not mutated.
- `npm run build`, `npm run lint`, `npm run check:budgets`, `npm run check:docs`, `.venv/bin/python -m compileall -q mazi/social mazi/atlas.py` and whitespace checks pass.

```sh
.venv/bin/python -m unittest tests.backend.test_atlas tests.backend.test_atlas_projection tests.backend.test_atlas_place tests.backend.discovery.test_shared_by tests.backend.sources.test_places_export tests.backend.test_export_file tests.backend.test_export_admission
```

## Before and after corrections

Adding the selected-origin index exposed an ambiguous Atlas fixture query. Two source-evidence assertions failed because `_origin(asset)` could select Ben's duplicate rather than Alice's original. Commit `5690aa5` makes that helper owner-specific without changing the assertions. Production Atlas has explicit insertion ordering and keeps it.

The adjacent run also exposed a pre-existing A2 expectation in the unchanged-export fixture. It set a reviewed free-text place `A place` and then expected the superseded source pin. Current export correctly omits that unmapped reviewed pin. Separate commit `7bca860` uses mapped reviewed `Amsterdam, NL`, retains the category/hash/origins/annotation/byte-read assertions, and asserts `review:<asset>` as the exported origin. The coordinator owns its narrow prerequisite PR. The later 137-test run passes.

## Read boundaries

Home and selected detail fail tests if they call `atlas_view` or `_timeline_items`. Home uses source-table candidates with at most 33 rows per source, 32 merged rows per chunk and 512 examined candidates. Selected detail pages only selected origins in groups of 256 and preserves existing per-origin, per-photo and request metadata limits. An oversized origin fails before full projection.

A 10,000-row native-comment fixture keeps Home within its SQL cap without importing 10,000 JPEGs. A filtered region beyond the page budget returns a continuation, and its older visible action is not skipped. The hosted 2,000-row fixture remains within two candidate batches and checks EXPLAIN plans for comments, reactions and plans. Setup uses one bounded synthetic bulk insert rather than thousands of network round trips.

Same-second comments and mixed source kinds use stable global time/identity order. A new action inserted after the first page does not duplicate or skip unchanged older records. Comment edits and cancelled plans are current-state actions. An item moved by an edit appears on refresh; the feed is not an immutable historical log. Hidden targets, withdrawn sources, departed actors, inactive/deleted reactions and comment tombstones are checked before projection. Home activity excludes its featured target in SQL.

Selected event output matches the shared Atlas projector, including compact labels. A photo keeps its direct permanent-ID route after grouping. An approved-memory route denies when an original child is hidden. Legacy WhatsApp day/month order can use another permitted photo in the same run, and the original correction snapshot stays unchanged. Home previews omit chat/source-provenance detail while preserving date/place evidence and compact labels.

## Hosted measurements

[PROFILE.json](PROFILE.json) contains the final serial warm measurements from the [guarded profile](profile_home.py). SQL counts and serialized JSON bytes include the compact label hook.

| State | Seconds | SQL calls | JSON bytes |
| --- | --- | --- | --- |
| Archive-only Home | 0.662 / 0.593 | 22 | 1090 |
| Active-conversation Home | 0.735 / 0.579 | 21 | 1674 |
| Upcoming-plan Home | 0.310 / 0.299 | 10 | 2524 |
| Selected photo | 0.373 / 0.615 | 12 | 935 |

[PROFILE_CONCURRENT.json](PROFILE_CONCURRENT.json) preserves an earlier post-merge profile that overlapped the hosted verification run. It includes a 1.036-second selected read. The serial run is not presented as a p95 or production guarantee, and no cause is inferred for individual timing variation. Both exclude fixture creation and browser/Vercel HTTP overhead. The script refuses non-test schemas and any bucket other than `mazi-social-test`.

## Remaining acceptance

The backend APIs are verified independently of browser adoption. The coordinator still must integrate lazy Home/activity/selected-detail loaders, prove zero initial Atlas/notebook requests, check group/session clearing, run the full combined browser journey and deploy. Physical-device and five-friend findability gates remain human acceptance work. An explicit capacity error is retained if Home cannot establish its feature within the bounded candidate window. No UI screenshot or production milestone acceptance is claimed by this backend change.
