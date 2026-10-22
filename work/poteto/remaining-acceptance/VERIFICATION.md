# Remaining issue acceptance, 22 October 2026

## Outcome and scope

The remaining implementation work for issues #39, #59, #72 and #80 is implemented, independently reviewed and merged. Broader acceptance tracker #62 retains production deployment, live Photos-library permissions and representative scale/performance acceptance. The user explicitly accepted phone-browser evidence and finishing with local verification after GitHub Actions reported a billing restriction. Neither choice establishes physical-device or remote CI success.

The user authorized creating PRs and merging without waiting for CI, followed by application testing and CI repair. Every new archive fixture was synthetic. The live archive schema, private bucket and local `.mazi-imports` were preserved.

## Reviewed and merged changes

| PR | Change | Merge revision | Acceptance evidence |
| --- | --- | --- | --- |
| [81](https://github.com/dodoscoding/Mazi/pull/81) | Cohesive workspaces, phone controls, visible phone upload progress | `f55d51ee1f54cd19e4add4b98389f1d28d122e0e` | [UI verification](../remaining-ui/VERIFICATION.md) |
| [82](https://github.com/dodoscoding/Mazi/pull/82) | Bounded 10,000-photo related search/indexing/review and 20,000-location Places; consistent snapshot and retryable SQLite contention | `8bddf78aa178b36787885f4e4597723b64b258ec` | [Capacity evidence](../remaining-capacity/PLAN.md) |
| [83](https://github.com/dodoscoding/Mazi/pull/83) | Stream export metadata; support 10,000 photographs within retained byte budgets | `1b0dd1d8a2f1ded8309177418590b6cda2f23903` | [Export evidence](../remaining-export/VERIFICATION.md) |
| [84](https://github.com/dodoscoding/Mazi/pull/84) | Load Search photographs first; request optional context explicitly; preserve retry/access-loss behavior | `9f62b25f02d20050b96c8dbabeeefc9e58c65008` | [Search evidence](../search-startup/VERIFICATION.md) |
| [85](https://github.com/dodoscoding/Mazi/pull/85) | Fix actual PostgreSQL export ordering without schema changes | `7073486d9ef4ec78b1d9c0d8f0178e3e64f8c6a0` | [Hosted regression and independent review](../remaining-export/VERIFICATION.md) |
| [86](https://github.com/dodoscoding/Mazi/pull/86) | Repair exact Search snapshot and scoped story browser contracts | `670955ca58e60ccc3cd1b8cf0a3448e320b0cfff` | [Contract verification](../acceptance-contracts/VERIFICATION.md) |
| [87](https://github.com/dodoscoding/Mazi/pull/87) | Isolate meaningful actual-model retrieval fixture; preserve production scoring | `fa4eed0974053845dfef46b5901839a931488042` | [Learned verification](../learned-browser-acceptance/PLAN.md) |

Independent reviewers checked the immutable implementation heads before merge. Review used separate agents within the same available model family. Final integration source is `fa4eed0974053845dfef46b5901839a931488042`; the local acceptance branch also contains documentation-only ASCII repair `730c991` and integration merges. No application source changes follow that revision in this evidence workstream.

## Application experience

The unified desktop and phone suites exercise entry/session, circle membership, Atlas and flat alternatives, imported photographs, stories, discovery, questions with citations, access loss and sign-out. Domain suites cover upload inventory/ingestion, replay/withdrawal, corrections, review, export, People and consent, Places/source controls, sealed capsules and collaborative story editing. Chromium and Firefox shell suites additionally cover responsive presentation and optional-resource recovery.

Separate headed Chromium journeys used the actual hosted PostgreSQL/private Storage providers through a local application server. The desktop user uploaded and ingested a synthetic photograph, decoded its preview, searched, downloaded the archive, visited sources and signed out. A second member repeated search, preview, download, sources and sign-out in phone emulation. Both ZIPs passed integrity checks, contained one decodable original and valid JSON metadata, and both Search pages had zero axe violations and no page errors. Phone import is covered by local browser contracts, not by this hosted second-member journey. See [structured outcomes](browser/hosted-browser.json), [desktop import](browser/hosted-import-desktop.png), [desktop Search](browser/hosted-search-desktop.png), and [phone Search](browser/hosted-search-phone.png).

Manual in-app-browser entry also confirmed that an invalid synthetic shared code produces a useful error, retains the name, and enables retry when the code is edited. The UI workstream captured 56 viewport/theme/route images, checked keyboard and touch-target behavior, and fixed the rendered phone progress bar. Its 720-CSS-pixel reflow case approximates 200% reflow; it does not prove native browser zoom. The physical iPhone was offline; the user chose browser evidence.

## Verification results

| Check and command | Result | Evidence |
| --- | --- | --- |
| `npm run test:backend` | 400 run: 390 passed, 10 environment-dependent skips | `backend-full.log` |
| `npm run test:dom` | 108 passed | `dom-full.log` |
| `npm run test:unit` | 13 passed | `unit-full.log` |
| `npm test -- --workers=2` with Firefox wrapper | 232 passed, 40 conditional viewport/screenshot skips | `browser-shell.log` |
| `npm run test:app` | 34 passed | `browser-unified-final.log` |
| `npm run test:domains` with model unset | 22 passed, 2 learned-model cases intentionally skipped | `browser-domains-baseline-final.log` |
| `npm run test:domains -- --grep 'learned model'` with pinned model | 2 passed; independent review also passed both cases | `browser-learned-final.log` |
| Hosted PostgreSQL contracts, isolated schema | 9 passed after export fix | `postgres-final.log` |
| Hosted private Storage journey | 1 passed: scratch loss/resume, all byte classes, denied reads and withdrawal | `hosted-journey.log` |
| `npm run test:m0` against local Supabase | 9 passed; retained JWTs lose access after revocation/withdrawal | `m0.log` |
| Local Supabase security advisors | No errors | `m0-advisors.log` |
| Actual pinned CLIP runtime | 2 passed | `clip-runtime.log` |
| Retrieval and answer evaluations | Passed synthetic thresholds; no failed questions/claims | `retrieval-baseline.log`, `answers-evaluation.log` |
| CLIP evaluation | 100 queries / 25 candidates; recall@1 0.92, @3 0.98, @10 0.99; warm p95 0.020 seconds | `clip-retrieval.json` |
| `npm run build`, `npm run lint` | Passed | `build-final.log`, `lint.log` |
| `npm run check:docs` after ASCII repair | 16 documents, 171 links, 30 requirements, 8 milestones, 15 scenarios checked | `docs-repaired.log` |
| macOS Photos companion build | Built and signed | `companion-build.log` |

The full backend suite ran with the backend source at PR83. The later PostgreSQL export fix received 81 focused adjacent tests plus the nine actual hosted PostgreSQL cases and successful hosted browser downloads. UI-only Search changes and test-only PR86/87 were checked by focused suites and the final integrated browser runs. This avoids representing all results as one simultaneous clean-room run. Provider-only cases skipped in the full backend suite have separate provider evidence above.

Initial unified acceptance failed four stale fixture/selector contracts; PR86 fixes them without weakening complete-result assertions. The first domain run mixed the actual-model environment into baseline cases and also exposed the contradictory learned image/caption fixture. Baseline and learned suites now run separately, with PR87's neutral image fixture proving nonlexical ranking, indexing, consent withdrawal and filename fallback. Initial failures and final logs are retained; trailing log whitespace is normalized for repository checks. `app-checks.json` records the initial run, not final status. An initial hosted PostgreSQL contract attempt overlapped an active fixture worker; its competing job claims failed two cases. After stopping that worker, all nine passed. These fixture/run-order failures are distinguished from the actual export defect repaired by PR85.

## Capacity measurements and limits

The full baseline index run used 10,000 authorized metadata records sharing one real JPEG, with the actual baseline encoder and no inference, clock or budget mocks. All 2,000 batches completed: 10,000 indexed, none discarded, none remaining, with complete final related-search totals. Elapsed time was 1,257.369 seconds (about 20 minutes 57 seconds), and the slowest batch was 2.733 seconds. Other checks ran concurrently; this is an observation, not an isolated performance maximum. See `index-throughput.py` and `index-throughput.log`. This fixture does not establish 10,000 distinct-image learned-model throughput.

A separately imported 10,000-photo synthetic archive measured related search 0.255 seconds, one index batch 0.676 seconds, event review 0.137 seconds, duplicate review 2.415 seconds and Places 1.339 seconds in the backend run. Capacity work also verifies exact supported/over-limit boundaries, privacy transitions and complete results rather than silent truncation.

The dense 10,000-photo export fixture included 50 People, 500,000 tags and 200 memories. It produced 26,637,939 ZIP bytes in 98.901 seconds under allocation tracing, with 8,518,574 traced peak bytes and 82,313,216 bytes maximum RSS. The origin-heavy fixture reduced traced metadata allocation from roughly 56.7 MB to 1.1 MB. These measured local cases are not universal memory ceilings or large-hosted latency promises. See [export measurements and limits](../remaining-export/VERIFICATION.md).

The 128 MiB ZIP budget, metadata spool budget, temporary disk requirements and final policy admission remain explicit. ZIP, metadata spool and a hosted-object temporary file can coexist. Legal scalar metadata and one person's association set can still materialize. A successful admission check cannot revoke already transmitted bytes after later consent changes. Export is the photograph/source archive copy, not a complete application backup.

## Environment, privacy and cleanup

Local macOS, Node 24.15.0, CPython 3.14.7 for application checks; separate CPython 3.11 for pinned ONNX dependencies. Browser binaries came from the locked Playwright package. Stock Firefox hit the documented macOS profile startup problem; an isolated temporary application wrapper with unchanged engine worked. The installed browser cache was not modified. See [Firefox environment note](../m0-acceptance/FIREFOX_ENVIRONMENT.md).

Provider tests used only isolated schema `mazi_acceptance_20261022_test` and private bucket `mazi-acceptance-20261022-test`. Guarded fixture/cleanup helpers refuse the live targets. Cleanup deleted all 12 synthetic objects and the isolated bucket, dropped the isolated schema, and verified zero remaining isolated schemas while live `mazi` retained 48 tables. The hosted test server stopped, private synthetic entry-code file was removed, and local Supabase was stopped without resetting retained data. See `hosted-cleanup.log` and `m0-cleanup.log`. Provider secrets were never added to this evidence directory.

## CI and outstanding acceptance

The repository documentation check initially failed on two unsupported en dashes in an existing prototype evidence line. Commit `730c991` changes them to ASCII ranges; the checker passes. PR86/87 repair the browser contracts used by CI, and baseline retrieval/answer evaluations pass locally. No checks were disabled.

GitHub run [39745839239](https://github.com/dodoscoding/Mazi/actions/runs/39745839239) failed before job startup. Its check annotation states that recent account payments failed or the spending limit needs increasing. `ci-annotations.json` preserves that result. The Ubuntu migration notice is not the failure cause. The user chose **Finish with local verification**; account billing was not changed, and remote CI is not claimed green.

Issue #62 remains the honest acceptance ledger for:

- Production hosting of the Python application, worker and durable storage. A local server using real hosted providers does not establish cloud application deployment.
- Live macOS Photos permission/revocation and real-library behavior. Compilation and synthetic companion contracts do not establish those flows.
- Representative archive/model quality and large hosted latency; actual-device load/render budgets if required for release. The generated-image CLIP evaluation is a smoke fixture, and physical-device evidence was explicitly waived for this task.
- Existing performance costs: Globe is about 942 kB minified / 252 kB gzip; a legal 10,000-photo Atlas remains approximately 5.57 MB with 30,029 SQL statements. Search startup no longer fetches Atlas and People unless context is requested.

These limitations do not invalidate the completed bounded local feature repairs, but they prevent claiming full production milestone acceptance.
