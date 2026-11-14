# Social release rollout

## Live revision and target

- Production: https://mazi-three.vercel.app
- Deployed application/configuration revision: `41e74de875ab145f4f9d11730df341830f89ab4b` (merged PR #144).
- Deployment: `dpl_6ghKTvCbAH9C7u3gDYdh2DMpS4Ab`, `https://mazi-soaxl27rv-altanesmers-projects.vercel.app`.
- Vercel project `prj_rm73tXXOISr9jfe1FtU9YpAncs2B`, linked team `team_pmgjuOOjaC2wTXtIFmbgFAcB`, scope `altanesmers-projects`.
- [Metadata](STAGED_DEPLOYMENT.json) verifies READY, project and `maziReleaseSha`. [Production alias inspection](PRODUCTION_DEPLOYMENT.json) verifies the live domain resolves to this exact deployment after promotion.

The later rollout-evidence commit changes only this delivery record and operational artifacts. It does not require another deployment; application/configuration trees remain identical to the deployed revision.

## Compatible production migrations

Applied the five reviewed source files, in order, to Supabase project `elgwhwkqutmmbdjthubl`, production schema `mazi`, before app promotion. [Migration manifest](PRODUCTION_MIGRATIONS.json) records source SHA-256, provider versions and successful results. No synthetic production profile, contribution or archive fixture was created.

| Source migration | Hosted version |
| --- | --- |
| `20261104112434_social_plans.sql` | `20261104152535` |
| `20261104114039_social_comments.sql` | `20261104152536` |
| `20261104115301_social_reactions.sql` | `20261104152537` |
| `20261104120616_photo_labels.sql` | `20261104152538` |
| `20261104124646_social_home_indexes.sql` | `20261104152539` |

Catalog verification: all nine new tables have RLS and runtime SELECT, zero anon/authenticated direct SELECT; all six Home indexes exist; `mazi-private` remains private. Security advisors returned zero notices. [The previous production health check](OLD_PRODUCTION_AFTER_MIGRATIONS.json) remained OK after DDL, and alias inspection confirmed it still served the old deployment before promotion.

## Staged failure and correction

Initial application revision `409d20c` built successfully in [deployment J8sZP](INITIAL_STAGED_DEPLOYMENT.json), but the actual protected `/memory/release-probe` request returned Vercel404. [The preserved failure](STAGED_ROUTE_FAILURE.json) exposed an omitted hosting rewrite for the clean memory pathname promised by CONTRACTS124/316. This deployment was not promoted.

[PR #144](https://github.com/dodoscoding/Mazi/pull/144) adds only `/memory/:path*` → `/index.html`. [Independent review](ROUTING_RELEASE_REVIEW.md) verifies every other configuration value is unchanged. [Vercel's wildcard syntax](https://vercel.com/docs/routing/rewrites#wildcard-path-forwarding) supports this rule. The React/pathname reader and all application, backend, migration and dependency trees are unchanged from the completed release matrix.

## Staged and live verification

Both [staged HTTP](STAGED_HTTP.json) and [production HTTP](PRODUCTION_HTTP.json) probes pass 18 GET checks: database-backed health; nine private API denials with no-store; six HTML entry routes including the former failing clean memory link; theme script and hashed application module. Production `/health` returned `{"status":"ok"}` in 0.186 seconds for this one request; this is not a latency distribution or production capacity claim.

Both [staged browser](STAGED_BROWSER.json) and [production browser](PRODUCTION_BROWSER.json) checks pass four actual entry routes plus 320-pixel layout. Shared-code entry appears, private navigation/content remains absent, no page error occurs, and no application write request is made. [Desktop](PRODUCTION_LOGIN.png) and [phone](PRODUCTION_LOGIN_PHONE.png) screenshots contain only anonymous entry. No real archive content was inspected or captured.

Staged access used existing authenticated `vercel curl`; its authorized platform cookie stayed in browser memory. Deployment Protection and Trusted Sources settings were not changed. [Vercel's documented cookie flow](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation) and [CLI authentication](https://vercel.com/docs/cli/curl) support this path. This grants platform access only; the application remains signed out.

## Commands and rollback

Run from the linked repository root with the locked dependencies and existing CLI authentication:

```sh
vercel deploy --prod --skip-domain --yes --scope altanesmers-projects --meta maziReleaseSha=41e74de875ab145f4f9d11730df341830f89ab4b
python3 work/poteto/social-space-delivery/verify_release_http.py https://mazi-soaxl27rv-altanesmers-projects.vercel.app --vercel
node work/poteto/social-space-delivery/verify_deployed_entry.mjs https://mazi-soaxl27rv-altanesmers-projects.vercel.app STAGED
vercel promote mazi-soaxl27rv-altanesmers-projects.vercel.app --yes --scope altanesmers-projects
python3 work/poteto/social-space-delivery/verify_release_http.py https://mazi-three.vercel.app
node work/poteto/social-space-delivery/verify_deployed_entry.mjs https://mazi-three.vercel.app PRODUCTION
```

[Build/deployment output](DEPLOY_RELEASE.log) and [promotion output](PROMOTION.log) preserve the executed release. Python runtime on Vercel is 3.12; configured function region remains fra1. The previous healthy deployment `dpl_2YFAMpbmmpbdmmqFE2Aci6BWGemX` (`mazi-99b3pqtp5-altanesmers-projects.vercel.app`) is the rollback target. A rollback should retain the additive tables/contributions; no destructive down-migration was run or proposed.

## Acceptance limits

The [local release matrix](DELIVERY_EVIDENCE.md#final-local-release-matrix) and qualified isolated PostgreSQL evidence remain separate from these anonymous production checks. Signed-in two-member flows passed against synthetic local archives, and hosted domain contracts passed across exact-path reruns; no signed-in personal production archive was used for testing. The final hosted batch encountered an explicitly retained pooler connection timeout. All 23 original hosted paths passed across reruns, not in a fresh monolithic run.

[Remote CI snapshot](CI_AT_HANDOFF.json) is explicit: learned retrieval, imports and M0 succeeded, and the unified job's backend, DOM, lint, build, budgets, docs and evaluations succeeded; its remaining browser stages were still running. The macOS job was cancelled. No whole remote workflow pass is claimed. The earlier native-companion checks passed at the reviewed unchanged native source.

Five-friend first-click usability, physical-phone acceptance, representative production concurrency/recovery and M0–M7 milestone acceptance remain external gates. Automatic classification remains the plan's deferred source-verified pilot; implemented labels are member declarations and approved-person facts.
