# M0 verification record

Date: 5 October 2026. Base revision: 5128bbe71c0c7722389199a45ac4c9d09aeac897. Runtime/test implementation revision: 7a9aadd. Branch: codex/m0-acceptance. Evidence covers the local milestone experiment and owner-reported decisions. Full production T01-T15 acceptance remains separate.

## Environment

macOS arm64, Node 24.15.0, pinned Supabase CLI 2.119.0, Docker 29.4.0 through OrbStack. Auth/PostgREST/Storage/PostgreSQL run in an isolated local project named mazi-m0-experiment on API port 56321 and database port 56322. No hosted project, real archive or paid service is provisioned.

## Baseline and investigation

The main checkout was clean at 5128bbe, with origin https://github.com/dodoscoding/Mazi.git and no other worktrees. A managed worktree preserves that checkout. Origin CLI could not resolve dodoscoding/Mazi, so the task uses GitHub CLI for PR operations.

The preserved roadmap had six unchecked M0 gates and no database/storage evidence. The product owner reports positive feedback from 2-3 friends and accepts Chrome/Firefox desktop targets, with phone selection delegated. Android Chrome/Firefox are selected. The owner accepted EU hosting, a server-readable archive, AI/recognition off, a €75 ceiling without paid provisioning, departure withdrawing contributions, and manual JPEG/PNG pilot support with other formats conditional. No individual study observations or physical-device measurements were supplied.

Poteto dependency verification passed against pin 7366ac128bdf95f45e6734f412b49a4031800169. Independent architecture candidates and a same-family reviewer selected actual local Supabase over standalone PostgreSQL/filesystem delivery. [Design and synthesis](DESIGN.md) records the decision.

Supabase's changelog and official RLS/private-bucket docs were checked before implementation. The [September PostgreSQL update](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) affects legacy crypto, ltree, btree_gist NaN indexes and custom selectivity operators; this experiment introduces none of those structures.

## Results

| Run | Actual result |
| --- | --- |
| Missing-schema contract at db377b9 | FAIL as expected at privileged membership insertion, HTTP 404. Auth setup/sign-ins were real. |
| `npm run m0:start` | Actual local PostgreSQL/Auth/PostgREST/private Storage services started. |
| `npx supabase db reset --local` | Passed; replayed 20261005111409 and bucket seed in the dedicated synthetic database. |
| `npm run test:m0` after reset | 9/9 passed, no skips, 2.424 seconds; integration repeat passed 9/9 in 2.559 seconds; final reviewed fresh replay passed 9/9 in 2.294 seconds. Earlier provider runs also passed 9/9 twice. |
| `npx supabase migration list --local` | Local file and applied version both 20261005111409. |
| `npx supabase db advisors --local --type security --fail-on error` | Passed, zero issues. |
| `MAZI_FIREFOX_EXECUTABLE=/tmp/mazi-firefox-isolated/firefox npm test -- --workers=2` | 38 passed, 2 canonical Firefox screenshot skips, 25.7 seconds. All four projects exercised; no Node provider tests imported by Playwright. |
| `npm run build` and `npm run typecheck` | Passed; existing lazy Atlas chunk warning persists. |
| `npm run lint` | Passed Prettier formatting checks; this is not a separate semantic linter. |
| `npm run check:docs` | Passed structure, local links, B01-B30, M0-M7 and T01-T15. |
| `git diff --check` | Passed. |

[Provider receipt](ACCESS_VERIFICATION.md) contains the actor/read/mutation matrix and image versions. [Fixture manifest](../../../tests/m0/fixtures/manifest.json) contains provenance and SHA-256 checksums; [normalized expectations](../../../tests/m0/fixtures/normalized-items.json) declare the M1 handoff rather than claim an executed normalizer. Each retained sample matches its expected bytes.

The browser run uses Playwright 1.63.0, Chromium 153.0.8010.12 and Firefox 155.0 on macOS 27.0 arm64. Desktop is 1440x1024. Chromium phone uses Pixel 7 emulation; Firefox phone uses a 390x844 touch-enabled desktop viewport because Playwright Firefox cannot emulate Android GeckoView. Reduced motion, keyboard journeys, image/renderer recovery, history, search and accessibility assertions pass. [Firefox environment receipt](FIREFOX_ENVIRONMENT.md) reproduces stock-launch failure and the same-engine isolated-branding workaround. It changes no installed browser or user profile. This is engine/viewport evidence, not physical Android or stock release-browser certification.

GitHub CI configuration runs browser/build/format/docs checks and the real local provider suite. The task has not claimed a remote CI result. M0 is complete for the accepted narrowed scope; production acceptance scenarios remain uncompleted.

## Independent review

The independent gpt-6.1-sol reviewer approved runtime/test revision 7a9aadd and the acceptance docs after corrections. It checked the actual database catalog, not just the migration text. Storage retains provider-owned base grants; its RLS policies deny writes. Application tables grant SELECT only. The private helper has the expected ACL, empty search path and live reader/contributor predicate.

Review corrected one stale privacy status and an unsupported exact-copy assertion. The strengthened withdrawal test now compares identical PNG bytes and preserves the independent administrator contribution. A fresh reset and 9/9 actor checks passed after removing ineffective Storage ACL statements. Two generated ignore-file labels were removed; no introduced SQL/application comments or suppressions remain. No blocking findings remain. Physical Android, hosted terms/regions/cost and signed-link enforcement remain explicit later gates. Review used one model family.

## Limits

The experiment has no production invitation UI, resumable upload, full media decoder, derivatives, durable worker or release infrastructure. Passing binary round trips does not prove ingestion, corruption rejection, metadata parsing, quota enforcement or production lifecycle acceptance. Those remain M1 work against the declared limits. Chat exports, HEIC, video and native integration require representative fixtures before support claims.

Local provider execution cannot verify hosted region, TLS/encryption configuration, provider terms, backup recovery, operating costs, production quotas or the 100,000-item M3 profile. Physical Android, manual screen-reader, GPU and performance testing remain required before pilot acceptance. Signed URLs and their expiry/cache behavior remain M1 T09 work. The experiment does not constrain signed-link issuance or lifetime; M1 must test direct provider signing routes and enforce the selected expiry before using any policy in production. Already delivered bytes cannot be recalled.

Independent design and final review use agents from one model family; cross-family review is unavailable. No transcript directory was inspected. Evidence comes from this task's commands, files and user messages.

## Commit sequence

- db377b9 exposes the missing provider contract with real JPEG/PNG fixtures and a failing schema read.
- 2585860 adds the selected browser projects and isolates browser discovery.
- 5b22299 implements live membership and contribution eligibility.
- ab424c4 hardens actor discovery and mutation assertions and establishes CI.
- 2576956 removes ineffective Storage ACL changes; RLS owns Storage denial.
- 8f62021 proves an independent exact copy survives withdrawal.
- 7a9aadd removes generated ignore-file narration.
- The following documentation commit records M0 acceptance and the logical normalized-item handoff; its exact revision is the PR head.
