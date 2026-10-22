# Archive reliability verification

## Scope and revisions

Baseline deployed release: `cf26a7d9a3e342108079c1cd05829d9154f12ad4`. Final application change: `f93a8a28f00356d6cceb99f512d9e649af708ed1`. This record covers connection availability, Atlas loading and source metadata. Production deployment acceptance is recorded separately on the release PR after promotion.

The original checkout and personal import files are unchanged. No photo records were rewritten or reimported. Hosted mutation contracts used the disposable `mazi_reliability_test` schema; real archive checks only read existing records and bytes. A temporary owner session was created for authenticated verification and must be removed after deployment checks.

## Verification

| Check | Result |
| --- | --- |
| `npm run test:backend` | 491 tests, 12 environment-dependent skips, no failures |
| `npm run test:dom` | 122 passed |
| `npm run test:unit` | 16 passed |
| `MAZI_UNIFIED_PORT=8029 npm run test:app` | 34 desktop/phone workflows passed |
| `MAZI_TEST_PORT=5189 npm test -- --workers=4` | Chromium 120 passed; 18 skips; Firefox could not launch its profile before app execution |
| `npm run build`, `npm run lint`, `npm run check:docs`, `git diff --check` | Passed; existing build chunk-size warning remains |
| Hosted PostgreSQL contracts on transaction pool port 6543 | 10 passed, including concurrent readers and withdrawal fence |
| Twenty concurrent cached stores | Repeated queries, concurrent Atlas reads, disconnect/reopen and buffered cursors passed |
| Existing real archive metadata | All 300 unique photos matched all 305 active source records; 194 normalized and 111 ambiguous sharing timestamps preserved |
| Existing real archive HTTP previews | All 300 returned 200 and fully decoded; 55,032,945 bytes checked |

Firefox has an existing documented macOS profile problem. A reinstall and alternate temporary directory did not resolve stock startup. The repository's documented isolated-branding launcher is being used for the separate Firefox rerun; results are recorded on the PR. It does not modify the installed browser or user profile.

The complete preview verification took 505.464 seconds through one serialized local WSGI instance while a browser also requested images. This is bulk integrity evidence, not a page-load benchmark. One concurrent browser sample timed out while fetching additional previews; standalone/staged browser results are recorded separately.

## Measured loading change

The same 300-photo production projection measured 22.028 seconds before and 1.143 seconds after from the local client. With source metadata included it measured 1.247 seconds. These are individual paired observations, not production percentiles or browser timing claims. Synthetic Atlas SELECT counts fell from 916 to 18 and remain constant at 1, 300 and 1,001 photos. Preview authorization now uses one policy transaction before object download. Atlas-to-detail navigation reuses the existing state while privacy invalidation remains active.

## Review and release limits

Independent specification and standards reviewers approved the final code revision; see `spec-review.md` and `standards-review.md`. The earlier SQLite preview-contention finding was reproduced and fixed before approval. PR95 separately backports shared code to main; native Vercel integration stays on the release branch.

GitHub Actions run `39832093976` did not start any job steps. Its annotation reports failed account payments or a spending limit. This is an external CI blocker; no billing or branch protections were changed. Local results are reported explicitly rather than treating CI as passed.

The release requires the transaction-pooler port 6543 and the new adapter together. No production schema migration is required. Capture dates remain unknown when the import did not establish them; ambiguous day/month sharing dates remain labeled uncertain. The earlier truncated source JPEG remains the existing import failure and is outside these three fixes.
