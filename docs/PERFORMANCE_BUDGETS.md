# Release performance budgets

These budgets gate a release of the current app. The bundle budgets run in CI. The hosted and archive budgets are checked against recorded measurements; a release that misses one needs a recorded decision.

## Bundle budgets (enforced)

`npm run check:budgets` runs after `npm run build` in CI and fails when a gzip size exceeds its ceiling.

| Asset              | Ceiling (gzip) | Measured 22 October 2026 |
| ------------------ | -------------- | ------------------------ |
| Globe chunk        | 256 KiB        | 242.9 KiB                |
| Entry script       | 150 KiB        | 135.8 KiB                |
| Stylesheet         | 40 KiB         | 34.9 KiB                 |
| All scripts        | 420 KiB        | 378.7 KiB                |

D27 allocates 20 KiB of additional total-script budget for the accepted social features. The entry script, stylesheet and Globe ceilings remain unchanged. The combined plans and labels build measured 401.8 KiB total, 149.1 KiB entry and 36.9 KiB CSS on 4 November 2026. The labels editor is still a pending feature PR at this measurement. [Decision and release gates](DECISIONS.md#social-feature-bundle-budget-4-november-2026) and [measurement evidence](../work/poteto/social-bundle-budget/VERIFICATION.md) record the scope. The final combined build must pass every ceiling before deployment.

The ceilings make growth a visible choice. Lowering the Globe ceiling needs the code-splitting work that the build warning names.

## Hosted latency budgets

Measured on the Vercel deployment ([D20](DECISIONS.md#vercel-production-runtime-22-october-2026)) with warm functions, from a browser and from `curl` in Europe. See the [live verification](../work/poteto/production-deploy/VERIFICATION.md).

| Request                         | Budget        | Measured                       |
| ------------------------------- | ------------- | ------------------------------ |
| `/health`, `/api/session`       | p50 ≤ 300 ms  | 133 ms and 156 ms median       |
| Gallery, Atlas, keyword search  | ≤ 1 s each    | 334 ms, 405 ms, 550 ms         |
| Preview or original photograph  | ≤ 1 s         | 352 ms and 445 ms              |
| One 512 KiB upload chunk        | ≤ 1.5 s       | 868 ms median, 1,139 ms max    |
| Archive export                  | ≥ 2 MB/s      | 12.8 MB in 4.5 s (2.8 MB/s)    |
| Small import, upload to visible | ≤ 3 min       | 12 photos, 12.8 MB, about 107 s |

These cover one member and a 12-photo synthetic circle. Cold starts, concurrent members and large hosted archives are not measured.

## Representative archive

An owner-supplied WhatsApp export (57 MB, 10,676 messages, 306 JPEGs) ran through the public HTTP API on a local server with the pinned CLIP model. [real_archive.py](../work/poteto/production-deploy/real_archive.py) prints aggregates only; the [result](../work/poteto/production-deploy/real-archive-whatsapp.json) holds no message text.

| Measure                   | Result                                                        |
| ------------------------- | ------------------------------------------------------------- |
| Import with date order    | 14.7 s; 305 photos available, 300 unique, 1 truncated JPEG rejected as invalid media |
| Atlas                     | 300 dated cards, 337,740 bytes, 14 ms                          |
| Learned indexing          | 300 photos in 23.7 s (about 12.7 photos/s), slowest batch 0.50 s |
| Related search            | about 0.11 s per query                                         |
| Export                    | 56.9 MB valid ZIP in 0.22 s                                    |

The run found two defects, both now fixed. Times written as `21.07.45` left every message undated, and a truncated JPEG was retried as a storage failure. With no date order chosen, 3,132 of the 10,676 messages remain ambiguous; choosing day/month/year resolves all of them.

At the measured rate, learned indexing of 10,000 distinct photographs would take about 13 minutes on this Mac. That is an extrapolation, not a measurement. Retrieval quality on real photographs is not measured: English keyword and related queries on this mostly non-English chat returned no keyword matches, related search ranked all 300 photos, and the English answer abstained. A labeled query set from the owner is needed to score quality.

## Reaction-page authorization

A synthetic hosted page with one visible photograph and 20 native comments required 127 SQL calls per reaction batch. Repeating the same fixture before and after batch authorization produced 127 to 7 calls. Two warm reads changed from 3.805 and 3.624 seconds to 0.208 and 0.234 seconds. These measurements include current permission checks and PostgreSQL transaction time, and exclude browser/Vercel HTTP overhead. They are not a production latency guarantee.

The batch now loads eligible comment targets once, deduplicates their original photo/memory targets, and shares bounded photo authorization with the existing label and conversation readers. Every requested target remains mandatory. Hidden, withdrawn, departed-author and deletion-tombstoned targets still deny the whole batch. Memory authorization retains the current all-original-children policy.

A query-count regression caps the 21-target fixture at 15 statements instead of using a flaky wall-clock threshold. The [measurement and verification](../work/poteto/reaction-batch-performance/VERIFICATION.md) includes guarded reproduction and raw samples. The performance correction changes no storage schema or audience rule.

## Bounded Home and selected detail

The H1 backend uses indexed native-action candidates and a selected-assets Atlas projector. A guarded synthetic hosted profile measured two serial warm reads for each state after compact label summaries were integrated. Archive-only Home took 0.662/0.593 seconds with 22 SQL calls; conversation Home took 0.735/0.579 seconds with 21 calls; upcoming-plan Home took 0.310/0.299 seconds with 10 calls. A selected photo took 0.373/0.615 seconds with 12 calls. Serialized responses were 1,090, 1,674, 2,524 and 935 bytes respectively.

These samples exclude fixture creation, browser and Vercel HTTP overhead. They do not establish p95 or production concurrency performance. A separate profile overlapped hosted verification and is retained as additional evidence, including a 1.036-second selected read. The [H1 verification and guarded profile](../work/poteto/social-home-api/VERIFICATION.md) records both runs.

The candidate boundary is 33 rows per source query, 32 merged rows per chunk and 512 examined candidates per page. A 10,000-comment synthetic local fixture proves Home does not download or project the full archive; the hosted 2,000-row fixture verifies the action-time indexes and bounded candidate batches. Full browser adoption still must prove zero initial Atlas/notebook requests.
