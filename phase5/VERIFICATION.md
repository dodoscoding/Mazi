# Phase 5 verification

Verified locally on 13–14 October 2026, on branch `codex/m5-people-retrieval` based on `48fb2cd`, with the Phase 5 working changes. This is local synthetic evidence, not a production release or a remote CI result.

## Executed checks

| Check | Result |
| --- | --- |
| `.venv/bin/python -m unittest discover -s phase5/tests -v` | 27 passed with the 2 optional real-model tests skipped in this run; those 2 also passed separately with CLIP configured. [Raw output](evidence/python-tests.txt). Includes HTTP authorization, consent, identities, suppression, hiding, recovery and pagination. |
| Existing Phase 1 / 2 / 3 / 4 Python suites | 13 / 26 / 9 / 26 passed (74 existing regressions). |
| `MAZI_CHROME_CHANNEL=chrome MAZI_PYTHON="$PWD/.venv/bin/python" node node_modules/@playwright/test/cli.js test --config phase5/playwright.config.ts` | 2 passed: installed desktop Chrome and Pixel 7 emulation. |
| Real model browser flow | 2 additional checks passed with local CLIP configured: desktop Chrome and Pixel 7 emulation, explicit indexing, pixel-based ranking and permission-off fallback. |
| Real ONNX runtime | 2 passed, including image/text ranking while socket connections are blocked and deterministic bounded long-text embedding. [Output](evidence/clip-runtime-tests.txt). |
| Browser accessibility and layout | Axe found no violations on either tested layout; no horizontal overflow or page errors. |
| `.venv/bin/python -m phase5.evaluate` | 100 fixed synthetic questions over 120 candidates: recall@10 100%; 3/3 separate privacy probes passed. [Machine-readable report](evidence/retrieval.json). |
| TypeScript / Vite | `node node_modules/typescript/bin/tsc -b` and `node node_modules/vite/bin/vite.js build` passed. Existing Atlas >500 kB chunk warning remains. |
| Formatting / Python compilation | Prettier passed for all Phase 5 web/config/test files and package scripts; `compileall` passed. |
| Documentation / whitespace | Canonical document checker and `git diff --check` passed. |

Bundled Node was used because this environment does not provide `npm` on PATH. Browser tests used installed Chrome rather than Playwright's absent matching Chromium binary. Local HTTP checks required permission to bind localhost. The initial contract tests failed before implementation. The first two-project browser run exposed shared fixture state, fixed by restoring the subject association before the next project. The shared-place removal test initially omitted the existing API's required date argument; its final run passes. No real account, personal library or external embedding service was used.

## Retrieval evidence and limits

The encoder was written before the fixed [question set](tests/retrieval_holdout.json), never reads it and was not tuned after evaluation. The set was authored by the same implementation agent, covers only 20 supported concepts and is deliberately marked synthetic. Its 100% recall must not be represented as independent, representative or general-purpose semantic quality. The real M5 release evaluation remains open.

The recorded run took about 0.55 seconds for cold indexing plus search of 120 images, and about 0.011 seconds warm p95 across the questions. It computed 240 vectors at approximately 2.26 seconds of processing wall time per 1,000 embeddings. There are no external provider charges; local hardware, storage and operating costs are not estimated by that number. These measurements do not validate the production scale profile or a learned model.

Text uses a versioned 256-dimensional normalized feature hash; visual retrieval uses an 11-dimensional color histogram. Stored rows include dimensions and current provenance fingerprints. Tests replace obsolete versions, change corrected text, withdraw one of two independent origins, disable contributor/group processing and repeat retrieval. Ineligible or withdrawn vectors cannot affect output; consent transitions and withdrawal/departure triggers purge affected rows.

## Learned model continuation, 14 October 2026

The optional backend runs the real pinned quantized CLIP ONNX text and image sessions on CPU. Installation verifies the publisher's SHA-256/Git blob digests; inference opens only local files. The model directory is ignored and contains no archive media. Python dependencies and the explicit installation command are in [the guide](README.md). Local environment: Python 3.11, macOS 27.0.1 arm64, ONNX Runtime 1.24.3, tokenizers 0.22.2 and NumPy 2.4.3.

The separate [CLIP query fixture](tests/clip_queries.json) has 100 English queries about five already-existing generated demo photographs plus 20 color/shape distractors. The import uses opaque filenames and no captions that disclose the image's subject. This tests actual image/text representations rather than filename aliases. On this limited set, recall@1 was 81%, recall@3 92%, and recall@10 97%; warm p95 was about 0.032 seconds and indexing all 25 candidates took about 1.43 seconds. [The full receipt](evidence/clip-retrieval.json) includes every top-1 miss and source-image checksums. The encoder, ranking weights and fixture were not tuned after seeing these results.

Small details, negation and overlapping dinner scenes caused errors. These authored paraphrases over five generated scenes do not replace 100 independent representative archive questions. This is an integration smoke evaluation, not production acceptance, language coverage or evidence of robust recognition. No real people's images were used.

New lifecycle tests verify missing/corrupt models, incompatible versions, keyword fallback after runtime failure, explicit indexing, hidden/removed candidate exclusion and revocation while inference is running. Group/contributor consent changes, source withdrawal and member removal discard pending work. Removing and rejoining a member or disabling and re-enabling consent mid-batch still invalidate the old computation. The learned model uses cached vectors during search and never performs image inference while holding the search transaction.

The learned-browser checks exercise the actual model and both responsive layouts. [Learned desktop](evidence/learned-desktop.png) and [learned phone](evidence/learned-phone.png) show the explicit index control and the CLIP result mode. CI now installs the optional pinned model, runs real-runtime/evaluation checks and runs the learned UI scenarios separately from the lightweight tests; no remote CI result is claimed.

## Privacy and lifecycle evidence

- Outsiders, removed members, cross-group identities and hidden reference images are denied. Filtering occurs before ranking and pagination; a hidden subset cannot underfill an otherwise available page.
- Personal photo hiding affects gallery, Timeline, map facets/paths, People, reviewed renditions and exports. Independently hiding an archive memory removes that memory from discovery without deleting its photos. Direct originals remain accessible under the group policy.
- Administrator identity proposals require the subject's confirmation. Subjects can suppress a tag created by another member; suppression survives restart and offline backup/restore. Only the subject can opt back in for verified member identities.
- Nonmember removal/restoration requires an administrator's explicit private-verification attestation. It does not disclose verification documents or enable recognition.
- Departures through an older SourceStore connection also clear tags and processing consent through database triggers. Rejoining does not restore those tags or old vectors.
- Search still works by words and structured filters with processing disabled. Recognition has no enable route; no unknown face clusters exist.
- Browser scenarios cover consent changes, related query/fallback, personal hide/restore, subject removal/restore, literal rendering of a hostile Person name, cross-origin rejection and clearing private UI after authorization fails.

[Desktop](evidence/desktop.png) and [phone](evidence/phone.png) screenshots show synthetic colored images. The HTML-like Person name is intentional escaping evidence, rendered as text.

## Open acceptance

M5 remains open for production. Required next evidence includes independent representative in-domain evaluation of the local learned encoder, at least 100 independently held-out representative questions with authorized relevant items, zero-leak tests against the production database/storage/worker paths, real archive usability, Firefox and physical Android validation, and the existing M3 production gates. The synthetic local score is not a waiver.

Recognition remains disabled. Its separately approved consented evaluation set, member/nonmember/minor choices, provider retention/deletion policy and withdrawal drills are not established by this work. Disputed verified account/person mappings need an operator-assisted investigation; aliases and edited copies are not silently matched to a suppressed identity. No M6 answer generation, production deployment or hosted provider processing is included.
