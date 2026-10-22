# Import performance verification

## Scope and measurement

Base revision is `034921da3e5849f7b45c982ac0704a8d8bcdf380`. Fixtures are synthetic WhatsApp messages and generated JPEG bytes. No personal archive was imported or modified. Python 3.14.7 in the existing virtual environment and Node 24.15.0 ran on macOS. The script runs with `PYTHONPATH=. .venv/bin/python work/poteto/import-performance/benchmark.py`.

[Baseline pipeline results](pipeline-before.json) and [optimized results](benchmark-after.json) use the same script and inputs. Each figure is one observed run, not a statistical latency guarantee. The mixed fixture contains 7,500 records and 223 repeated JPEG attachments. The larger fixture contains 30,000 text records. The fake hosted variant exercises HostedObjects with an in-memory object transport and SQLite. It measures real storage operation counts but contains no network latency or PostgreSQL latency.

| Scan fixture | Before | After | Change |
| --- | ---: | ---: | ---: |
| 7,500 records, 223 attachments | 0.7972s | 0.2670s | 3.0 times faster |
| 30,000 text records | 9.1881s | 1.2261s | 7.5 times faster |
| Mixed inventory INSERT statements | 7,500 | 60 | 99.2% fewer |
| Mixed scan archive opens | 16 | 1 | One retained archive |
| Fake hosted mixed scan GETs | 32 | 2 | 93.75% fewer |
| Fake hosted mixed scan bytes | 8,620,880 | 538,805 | 93.75% fewer |

All 223 attachments reached AVAILABLE_TO_GROUP after confirmation in both versions. The repeated bytes intentionally deduplicate into one unique asset. Processing time was not materially changed. Local report latency rose from 1.2 ms to 3.6 ms for 7,500 records because the report now counts exact NO_MEDIA reasons; it also uses one fewer SQL round trip. Terminal browser reports stop polling. Upload requests for a 56,934,355-byte archive fall from 218 to 109 with 512 KiB chunks. Transfer wall-clock improvement depends on network and storage latency.

## Verification

Focused import engine, adapter, and HTTP contracts pass. The client regression failed before implementation for chunk sizes, terminal polling, and the misleading 97% progress. The new scan contract failed before implementation because the parser and archive were reopened. Full-suite results and independent review are recorded below.

No schema, authentication, storage verification, or sharing-consent change is included. Cancellation remains terminal; automatic resume is outside this performance patch. A saved checkpoint beyond the rebuilt inventory now fails explicitly rather than looping forever. Cold starts still replay the committed prefix once.

## Review and release

[Design candidate A](candidate-a.md), [candidate B](candidate-b.md), and [independent judgment](judge.md) record the choice. The implementation uses A plus B's bounded SQL inserts. Durable sidecars and parallel photo workers were rejected because measurements did not justify their lifecycle cost.

Production currently runs the separate release branch at 40478a2. The optimization must be integrated onto that runtime after merge. Release verification includes sequential HTTP worker requests and deterministic cleanup on worker eviction. Public production timing is not inferred from local benchmarks.

## Final local checks

- Full backend suite ran 444 tests, with 11 environment-dependent skips, in 361.652 seconds. Existing resource warnings appeared; no failures occurred.
- DOM suite passed 115 tests. Unit suite passed 13 tests.
- Chromium desktop/phone shell suite passed 118 tests with 18 conditional skips. Stock Firefox could not start its macOS profile. The documented isolated wrapper passed 114 Firefox tests with 22 conditional skips.
- Unified application suite passed 34 tests. Domain suite passed 21 tests with 2 optional learned-model skips; the one initial Answers navigation timeout passed on isolated rerun.
- Import workspace suite passed 19 tests with 1 conditional skip after fixtures were enlarged to retain interruption coverage at 512 KiB. An initial parallel run also collided with another suite's trace directory; isolated output directories removed that test-runner failure.
- Build, typecheck, lint, documentation checker, and whitespace checks passed.
- Independent Standards review passed. Independent Spec review passed with notes about deployed verification and the limits of fake hosted measurements.

[Actual PostgreSQL 17 evidence](postgres-evidence.json) exercises PostgresConnection with a separately initialized localhost cluster and non-superuser application role. It measures 1.2903 seconds before and 0.3724 seconds after for 7,500 records. Both runs completed with 223 available attachments and one unique asset. Object storage was local. The cluster was stopped and removed. This verifies the real SQL adapter and 896-parameter statements without using production credentials. [The script](postgres-benchmark.py) accepts an explicit baseline checkout.

[Desktop screenshot](import-report-desktop.png) and [phone screenshot](import-report-phone.png) show the synthetic report. Screenshots contain no personal archive data.
