# Release performance budgets

These budgets gate a release of the current app. The bundle budgets run in CI. The hosted and archive budgets are checked against recorded measurements; a release that misses one needs a recorded decision.

## Bundle budgets (enforced)

`npm run check:budgets` runs after `npm run build` in CI and fails when a gzip size exceeds its ceiling.

| Asset              | Ceiling (gzip) | Measured 22 October 2026 |
| ------------------ | -------------- | ------------------------ |
| Globe chunk        | 256 KiB        | 242.9 KiB                |
| Entry script       | 150 KiB        | 135.8 KiB                |
| Stylesheet         | 40 KiB         | 34.9 KiB                 |
| All scripts        | 400 KiB        | 378.7 KiB                |

The ceilings sit just above the current build, so any growth is a visible choice. Lowering the Globe ceiling needs the code-splitting work that the build warning names.

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
