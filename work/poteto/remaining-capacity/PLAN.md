# Remaining capacity work

## Workflow

- [x] Ground the current authorized projection and failure guards.
- [x] Sketch two bounded designs.
- [x] Agree. Parent selected streaming projections over persisted jobs/schema.
- [ ] Implement tests before behavior changes.
- [ ] Verify focused runtime paths and budgets.
- [ ] Scrap any design that cannot preserve complete results and privacy.

## Grounding and design

Visible identifiers come from active origins owned by current members. Discovery removes personal hides. Documents resolve every origin, annotation, source and shared place before determining consent and vector fingerprints. Index inference runs outside the transaction and rechecks membership, consent generation and fingerprint before saving. Review uses those visible identifiers before comparing pixel signatures or resolving event evidence. Places filters active shared location rows.

Candidate A extends the batched metadata projection with consent and fingerprint fields. It scans complete authorized evidence under byte/time budgets, retains bounded ranking rows and indexes at most five images per call. Events retain bounded evidence, Places bounded rows, and duplicates use exact compact-signature candidate indexing. Public response shapes stay stable.

Candidate B persists searchable projections and pixel signatures with generation invalidation, runs asynchronous indexing jobs, and adds public cursors. It reduces repeated work but requires new schema, invalidation and recovery contracts. Deferred because candidate A can fit the local supported budget without those lifecycle risks.

Rubric is complete authorized results, bounded memory/work, preserved public response contracts, measured 1001/10000 support and maintenance cost. Parent independently selected A. No additional subagents were available; parent owns independent review.

Model the Domain selects a per-photograph evidence projection and exact signature candidate index. Prove It Works requires measured complete results and explicit budget exhaustion rather than claiming capacity from removed guards.

## Throughput checkpoint

Prioritize semantic/index metadata projection, event evidence and Places, then exact duplicate candidates. Use focused backend files while other workstreams run. Root owns final full-suite verification and PR/merge.

## Verification progress

Initial failing-before command used `/Users/altanesmer/Desktop/Ales/Mazi/.venv/bin/python -m unittest tests.backend.discovery.test_remaining_capacity`. It failed with `Local search limit is 1,000 items` at 10,000 photographs and `Review set exceeds local limit` at 1,001, before implementation. The imported test class initially also caused five existing archive tests to run; that fixture import was corrected to a module alias.

Focused backend runs after implementation passed 38 tests in 10.096 seconds, 27 in 4.200 seconds, 17 in 2.318 seconds, 13 in 7.096 seconds and 33 in 5.780 seconds. These overlapping runs exercised actual 1,001-photo unified HTTP imports, complete 10,000-record metadata scans, all existing keyword budgets, learned-model consent races, review decisions and complete Places recovery.

The first real 10,000-photo public import run passed in 202.810 seconds including import and 10,000 public location/correction writes. Tiny synthetic 8 by 8 PNGs were distinct by RGB value. Its measured operations took 0.2482 seconds for related search, 0.7082 for the first five index records, 0.1124 for events, 2.5378 for duplicates and 0.0573 for Places. Search returned total 10,000 and its final ten rows; index returned five indexed and 9,995 remaining; event returned every photograph; duplicate review returned its ordered 100-suggestion limit; Places returned all 10,000 rows. This process loaded the modules before the final event/Places keyset-paging adjustment. A final-source rerun is pending; do not present those early timings as final-source timings.

A stale earlier run was terminated before reaching its result after a test fixture bug was corrected. It used capped owned-origin recovery output to locate locations. The corrected fixture reads synthetic imported origin IDs directly, then uses public location/correction methods for all 10,000. No benchmark mocks pixel decoding or import processing.

The exact duplicate index partitions all 64 signature bits into seven nonoverlapping blocks of sizes 9, 9, 9, 9, 9, 9 and 10. A pair differing in at most six bits must share a whole block. Unioned candidate sets therefore preserve every qualifying pair. The regression compares against all brute-force pairs, including a six-block-difference boundary, and checks deterministic ordering, dismissal and hiding.

The docs checker fails on preexisting en dashes in `docs/PROTOTYPE_STACK.md` line 50, also present at base `31d32bd`. Root owns this preexisting CI repair. `git diff --check` passed.

## Remaining limitations

Local SQLite evidence does not establish hosted PostgreSQL performance, learned-model inference throughput, browser rendering or production milestone acceptance. Larger index requests retain two full metadata scans per batch for complete current remaining counts. Only five images are inferred per call; the tests measure first and last batch completion rather than the full wall time of 2,000 sequential batches. Hash-degenerate duplicate sets can exhaust explicit comparison or preview budgets. Cooperative time checks cannot interrupt locks, SQL, image decode or model inference. There is no schema or storage change, and source originals and privacy consent are unchanged. Search-page Atlas/People startup remains a separate UI concern owned by root.

## Final implementation evidence

At `81d6470`, the focused command `/Users/altanesmer/Desktop/Ales/Mazi/.venv/bin/python -m unittest tests.backend.discovery.test_remaining_capacity tests.backend.discovery.test_keyword_scaling tests.backend.discovery.test_keyword_budgets tests.backend.discovery.test_learned tests.backend.discovery.test_discovery tests.backend.archive.test_review tests.backend.test_capacity_http` passed 61 tests in 193.426 seconds. The real 10,000-photo import measured related search at 0.2546 seconds, first index batch at 0.6598 seconds, event suggestions at 0.1243 seconds, duplicate suggestions at 1.3160 seconds and Places at 1.3462 seconds. The point scan used final bounded keyset pages. Later changes skip unnecessary vector-cache reads after selecting five candidates and stabilize the Places scan with its writer transaction; they have separate focused checks below.

Independent review found a real Places keyset race. With 129 ordinary imported origins, another SourceStore could move the first-page location date after that page, causing one origin to appear twice. The new regression failed before the fix because the public mutation committed during the scan. `6cf8370` captures that failure; `87ef92a` stabilizes the entire authorized map scan with the existing writer transaction. Twenty-four focused tests passed in 4.909 seconds, including the public concurrent-mutation regression and 10,000-point output.

Reviewer follow-up identified four old map-capacity assertions in the export/HTTP tests. They now assert complete 1,001/10,000-row maps. A separate real HTTP contract seeds 20,001 authorized location rows from one ordinary import, verifies typed capacity failure even with nonmatching filters, removes one location through the public write route and verifies exact recovery to 20,000 unique points. `/Users/altanesmer/Desktop/Ales/Mazi/.venv/bin/python -m unittest tests.backend.test_places_http tests.backend.sources.test_places_export.SourcePlacesExportTests tests.backend.sources.test_places_export.MemoryPlacesExportTests.test_personal_hide_removes_only_requesters_locations_and_assets` passed six tests in 12.012 seconds. An earlier command accidentally named a nonexistent test class; the corrected command is the passing evidence.

`PYTHONPATH=. /Users/altanesmer/Desktop/Ales/Mazi/.venv/bin/python work/poteto/remaining-capacity/measure.py` produced `MEASUREMENTS.json` at `87ef92a`. This separate allocation fixture has 10,000 seeded authorized metadata records sharing one actual decoded JPEG preview. It does not replace the distinct-photo public import proof. With production budgets enabled, traced Python peaks were 7,384,997 bytes for related search, 890,161 for indexing, 8,155,669 for events, 4,620,553 for duplicates and 6,183,906 for Places. Every operation returned complete expected output or its explicit 100-suggestion page. These observed allocation peaks are not process-RSS maxima or hosted guarantees.

No full-suite run was performed by this worker. Root owns the final full-suite, independent final review, PR and merge. Existing ResourceWarning messages from fixture database lifetimes appeared in passing adjacent suites; no new test failure was suppressed. The known preexisting docs-checker failure remains assigned to root.
