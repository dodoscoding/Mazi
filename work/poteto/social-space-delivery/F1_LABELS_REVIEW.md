# F1 photo-labels backend independent shipping review

Verdict: PASS for the backend-only manual-declaration slice. No actionable standards, correctness, privacy or regression finding was identified. Label UI and combined F2 predicates remain separate delivery slices.

- Reviewer: GPT-6.1 Sol, high reasoning, independent from the patch author.
- Base: `7f846826dc0aeb50b252b486835b5fa72443e2fb`.
- Head: `f30e273e552d994814989cae5ef1458b9e81aabb`.
- Stable patch ID: `3b88be0ec62bf880218a3f6c3dea94a7e4e29579`.
- Diff: `git diff 7f84682...f30e273`.

## Standards

No actionable documented-standard violations or meaningful Fowler smell findings. The dimensions registry defines the independent allowed values. Batch input parsing, current-target authorization, version loading, confirmed-person projection and command application have concrete domain ownership. The implementation reuses the settled transaction, receipt and export boundaries without another Store inheritance layer or a generic entity model.

The scoped comment audit found only the new module docstring defining ownership. No added suppression, constraint or explanatory comments require removal. Deletions, restorations, reshape flags and unenforced constraints are all zero. The reviewer made no application changes.

## Spec

The backend preserves independent manual `people_present`, `screenshot` and `ai` dimensions. Old data reads unknown at revision zero. A clear to unknown advances only its own revision and leaves other dimensions unchanged. Effective human presence derives from current permitted confirmed people while declared presence, method, author and version remain distinct. Source sharers and conversation participants are not used as depicted-person evidence.

Confirmed-person projection requires a current tagger and a current subject when linked to an account, and omits suppressed names and their derived presence. A contradictory manual no is checked against active approved tags with suppression intentionally included, so hiding the identity from the response does not allow a contradictory absence write. Its conflict text contains no identity.

Reads and writes accept 1 to 50 unique stable asset IDs. Expected keys must exactly match changed dimensions, and expected versions reject booleans and negative values. The entire batch's current membership, group, eligible source, direct hide and hidden-event-child access is checked before any mutation. Every expected revision and presence contradiction is checked before the write loop. Transaction rollback and conditional version updates preserve all-or-nothing behavior under denial, stale siblings and concurrent editors.

Canonical request content normalizes asset order and JSON key order. Exact replay authorizes the entire current selection again, then reads current permitted results without a write. It does not overwrite later clears, another member's correction or departure cleanup. Changed payloads under the same actor/group key conflict.

The retained version ledger is separate from current declarations. Identity Store departure advances versions and clears only rows still authored by the departing member. Another member's later correction remains intact. Stale restored rows whose revisions differ from the current ledger read unknown without the former actor, even after rejoin. A fresh command must use the retained current revision. SQLite and PostgreSQL reject revision rollback and enforce group/photo/actor relationships.

Label, tag and suppression mutations advance the discovery generation. Hosted timestamps use DOUBLE PRECISION. Both new tables enable RLS and revoke PUBLIC/anon/authenticated access. The runtime may read/insert/update versions but cannot delete the version ledger. Trigger functions use the private explicit search path and revoke public execution. The hosted actor query index is exercised by EXPLAIN.

Authored export includes only the caller's current-version declarations on currently visible photos. Other actors, stale rows, suppressed depicted-person names and hidden targets are excluded. The identical projection participates in ZIP assembly and final metadata admission; changing a declaration between those passes causes a retryable conflict. The bounded labels read queries the selected assets directly and does not fetch Atlas or the whole People-management state.

## Independent verification

Commands ran in `/Users/altanesmer/Desktop/Ales/Mazi-wt/photo-labels-api` with synthetic fixtures.

- `.venv/bin/python -m unittest tests.backend.social.test_labels tests.backend.social.test_labels_http tests.backend.test_export_admission tests.backend.discovery.test_people_export` passed 57 tests in 7.1 seconds. This includes 50 real synthetic imported photos, two simultaneous editors, exact/reordered replay, expected-version boundaries, global approved-tag contradiction checks, suppressed-name omission, hidden/source/group denial, departure/rejoin with stale rows, real HTTP origin/session checks, authored export and final admission.
- The isolated hosted command below passed all three tests in 27.2 seconds. It independently confirms fractional timestamp precision, clear/CAS/replay, generation changes, current-scope export, identity-boundary cleanup, retained versions after stale-row reinsertion, fresh replacement, database rollback guard, confirmed-person/suppression behavior, group constraints, runtime ledger permissions, RLS/client-role denial and the actor index.

```sh
MAZI_DATABASE_SCHEMA=mazi_social_20261104_test MAZI_STORAGE_BUCKET=mazi-social-test MAZI_BACKEND=supabase MAZI_TEST_POSTGRES=1 node --env-file=.env.supabase -e 'const {spawnSync}=require("node:child_process"); process.exit(spawnSync(".venv/bin/python",["-m","unittest","tests.backend.social.test_labels_postgres"],{stdio:"inherit",env:{...process.env,MAZI_DATABASE_SCHEMA:"mazi_social_20261104_test",MAZI_STORAGE_BUCKET:"mazi-social-test",MAZI_BACKEND:"supabase",MAZI_TEST_POSTGRES:"1"}}).status ?? 1)'
```

The hosted helper requires an isolated schema ending `_test`. Explicit child overrides selected only `mazi_social_20261104_test` and private bucket `mazi-social-test`. Existing private credentials were loaded into the environment without printing them. No production schema or archive was tested or mutated.

- `npm run check:docs` passed with 19 documents and 327 links.
- `git diff --check 7f84682...f30e273` passed for the complete committed branch.
- The domain, HTTP adapter, SQLite schema, hosted migration, export overrides, tests and changed canonical documents were inspected. The worktree remained clean.

## Limits and release requirements

Apply the additive hosted migration before enabling these reader/writer endpoints in deployment. This review covers the F1 backend, not badges, editors, bulk-selection UI or F2 same-photo filtering. It did not rerun the entire integrated suite, production, physical-phone or five-friend acceptance.

Retained-ledger stale-row suppression is verified. Historical full-backup recovery still requires reconciliation with current versions and deletion decisions before serving traffic. The ledger stores versions rather than previous declaration values, so these synthetic checks do not imply a historical snapshot knows future corrections. Atlas/Search payloads and processing inference remain unchanged in this slice.

Standards findings: zero. Spec findings: zero within the F1 backend scope. The next acceptance gap is labels UI and combined filtering.
