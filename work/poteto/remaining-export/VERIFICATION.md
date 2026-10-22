# Remaining archive export verification

## Scope and design

Issue #72. Base `31d32bd`. No personal archives or environment secret files were read. All archives are synthetic. The owner applies Poteto Mode through the pinned external wrapper and its Codex adapter. The implementation follows the named Model the Domain principle through a one-pass JSON-array structure, and Prove It Works through completed ZIP contents, admission regressions and fresh-process measurements.

- Ground. Traced completed-file build through photograph manifest, source resources, locations, People and personal metadata, then fresh metadata admission under the existing transaction.
- Sketch. Compared record iterators plus private JSON spooling against a private SQLite projection database. Root selected iterators and spooling for the smaller boundary and unchanged ZIP schema.
- Agree. Root approved the design and export-only file ownership. No nested agents were started because the team had no spare slots.
- Implement. Preserved final ZIP high-water enforcement, original/resource checksums, policy comparison and cleanup. Expanded the explicit photograph ceiling from 1,000 to 10,000. Records stream through a private spool before entering their ZIP member. Compact projections use 128-row keyset pages. Large resource metadata and photograph origins use one-row keyset pages.
- Scrap. No replacement design was needed. A first generic OFFSET iterator was replaced with explicit keyset ordering after root review.
- Cross-judge and independent review. Root owns independent review and PR/merge. This worker did not claim an independent reviewer or a hosted/browser verification.
- Deslop and no-comments. The worker inspected its implementation diff for unnecessary comments and scaffolding. Root owns the independent comment review because nested delegation was unavailable.

## Behavioral evidence

The first committed boundary tests failed against the base with the obsolete `Export supports up to 1,000 photographs` error. Commit `d6ef8bd` records that red contract. Its first fixture assertion was later corrected from `red.jpg` to the shared helper's actual `photo.jpg`.

Final focused command used `/Users/altanesmer/Desktop/Ales/Mazi/.venv/bin/python -m unittest` with these modules:

- `tests.backend.archive.test_export_capacity`
- `tests.backend.archive.test_review`
- `tests.backend.test_export_file`
- `tests.backend.test_export_admission`
- `tests.backend.discovery.test_people_export`
- `tests.backend.sources.test_places_export`
- `tests.backend.sources.test_sources`
- `tests.backend.discovery.test_discovery`
- `tests.backend.memories.test_advanced`

Result was 158 tests passed in 50.776 seconds. The log is `focused-tests.txt`. After private spool cleanup and incomplete-write cases were added, the final file/admission/People/array run passed 73 tests in 7.855 seconds. The final People/capacity run passed 26 tests in 15.798 seconds. Existing file/admission tests include actual 128 MiB and one-byte-over limits, legal multi-megabyte JSON, object copy chunk sizes, membership/hide/withdrawal/surviving-copy races and interrupted HTTP delivery. Existing People tests still exercise real policy mutations at the new city-only projection seam.

New contracts cover successful copies of 1,001 and 10,000 photographs; exact 10,001 refusal; complete original and manifest counts; exact People/personal JSON parity across 130 People and 130 memories; empty/null/nested/Unicode arrays with both standard JSON encoder paths; refusal of accidental array reuse; and private spool cleanup on scan failure and incomplete writes.

`git diff --check` passed. The document checker remains blocked by preexisting en dashes in `docs/PROTOTYPE_STACK.md` line 50. Root owns that separate repair. No lint command is configured. Root owns the final full application suite and browser verification.

## Fresh-process measurements

Environment was local macOS, Homebrew CPython 3.14.7, the repository dependency environment, SQLite and the ordinary production limits. Tracemalloc starts after fixture creation. Time includes production export and fresh final admission, then obtaining the ZIP length. Process maximum RSS includes interpreter and fixture setup. macOS reports `ru_maxrss` in bytes. These are individual observations, not medians or universal upper bounds.

| Fixture | Base ZIP bytes | Base seconds | Base traced peak bytes | Base process max RSS bytes | New ZIP bytes | New seconds | New traced peak bytes | New process max RSS bytes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1,000 photographs, 50 People, 50,000 tags, 200 accepted memories | 3066890 | 2.268 | 6167529 | 80756736 | 3066890 | 2.545 | 1701369 | 65519616 |
| One photograph, 10,001 origins, 10,000 contexts of 4,096 ASCII characters | 41652920 | 1.891 | 56733017 | 151552000 | 41652920 | 1.988 | 1083051 | 62226432 |
| 1,001 photographs | Refused | | | | 1820810 | 1.164 | 1651523 | 64241664 |
| 10,000 photographs | Refused | | | | 18189991 | 12.953 | 6210696 | 79462400 |
| 10,000 photographs, 50 People, 500,000 tags, 200 accepted memories | Refused | | | | 26637939 | 98.901 | 8518574 | 82313216 |

`measure.py` reproduces the cases. It accepts a photograph count, optional `dense` or `origins` mode, and optional code-root path for a base revision's `mazi` package. Baseline code was extracted using `git archive 31d32bd mazi` into `/tmp/mazi-export-base-31d32bd`; no baseline source was edited. The same synthetic fixture generator was used for both revisions. Fresh fixtures have different random account/group IDs, so equal ZIP sizes alone are not a byte-parity claim. Exact member parity is checked by the behavioral suite above and by `compare.py` on a shared synthetic archive. The 1,000-photo dense case matched all 1,005 member names, order and SHA-256 hashes against the base. The one-photo, 10,001-origin case matched all six.

Example commands:

```sh
/Users/altanesmer/Desktop/Ales/Mazi/.venv/bin/python work/poteto/remaining-export/measure.py 1000 dense
/Users/altanesmer/Desktop/Ales/Mazi/.venv/bin/python work/poteto/remaining-export/measure.py 1 origins
/Users/altanesmer/Desktop/Ales/Mazi/.venv/bin/python work/poteto/remaining-export/measure.py 1001
/Users/altanesmer/Desktop/Ales/Mazi/.venv/bin/python work/poteto/remaining-export/measure.py 10000
/Users/altanesmer/Desktop/Ales/Mazi/.venv/bin/python work/poteto/remaining-export/measure.py 1000 dense /tmp/mazi-export-base-31d32bd
/Users/altanesmer/Desktop/Ales/Mazi/.venv/bin/python work/poteto/remaining-export/compare.py 1000 dense /tmp/mazi-export-base-31d32bd
```

## Limits and deployment implications

The final ZIP remains limited to 128 MiB. Cumulative serialized public metadata is checked against the same allowance before each spool write; each completed metadata spool is therefore also at most 128 MiB. One spool coexists with the ZIP, so those files can consume almost 256 MiB together. One materialized hosted source object can coexist during construction. Final validation can spool metadata while the completed ZIP still exists. Files are anonymous/private and cleaned through the existing exception-preserving cleanup boundary.

The encoder still materializes one legal scalar string, and one origin/resource record can be large. One person's asset and city sets, up to the supported photograph count, remain in memory. The bounded city cache remains fresh for each projection and retains its existing 1,000-key/4,096-entry/262,144-character ceilings. Visible-ID lists and ZIP central-directory objects remain proportional to the supported photograph count. These are not claims of constant memory for arbitrary legal scalar values or a whole-host memory ceiling.

Temporary files on tmpfs consume host/container memory outside Python RSS. Storage capacity, its filesystem backing, database latency, hosted object materialization and request duration need verification in the actual deployment. This worker did not provision or test a hosted runtime, a physical device or a native browser. Successful admission remains the policy boundary; later commits cannot revoke admitted/transmitted bytes. The copy is the photograph/source archive format, not an application backup.

## Main integration and personal ordering repair

Merged `origin/main` at `8bddf78` without conflicts into merge commit `44fb6f6`. The integrated export, Places HTTP/location, Discovery and remaining-capacity checks passed 139 tests in 246.255 seconds. The command used `python -m unittest` for `archive.test_export_capacity`, `test_export_file`, `test_export_admission`, `sources.test_places_export`, `test_places_http`, `discovery.test_discovery`, `discovery.test_people_export` and `discovery.test_remaining_capacity` beneath `tests.backend`. The exact output is `integration-tests.txt`.

An additional parity check exposed array-order differences after reverse-order personal hide/disassociation actions. Independent review also identified mixed accepted/rejected hidden-memory timestamp ties. Commit `b4ae2d1` records two failing public regressions. Commit `591c17f` restores hidden-photo asset order, suppression person/asset order, and hidden-memory timestamp/status/insertion order. The fix retains keyset paging and live visibility predicates. A shared-fixture comparison against `31d32bd`, combining both reverse actions and tied mixed-status memories, matched all ten member names, order and SHA-256 hashes. A five-resource SQLite probe showed the prior resource projection scans the resource table in insertion order, matching the existing resource keyset.

The final export/file/admission/People modules passed 79 tests in 21.292 seconds after these corrections. The exact output is `final-export-tests.txt`. Root's independent reviewer separately passed the two ordering regressions and a real city-policy admission mutation case. Root owns final app-wide, browser and hosted acceptance.

The final maximum-supported-photograph fixture combined 10,000 photographs, 50 People, 500,000 tags and 200 accepted memories under unchanged production limits. A fresh process completed a 26,637,939-byte ZIP and its final admission in 98.901 seconds with tracemalloc active. Traced peak was 8,518,574 bytes and process maximum RSS was 82,313,216 bytes. `measurement-10000-dense.json` records that observation. This dense run exercises city-cache overflow and recomputation; its elapsed time is a cost disclosure, not an untraced latency promise, hosted request-duration acceptance or maximum-memory guarantee.
