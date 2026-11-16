# H1 backend independent review

## Artifact

- Reviewed head: `f5bb0f7bb92325429bbc3f0315b461558fa6b666`.
- Actual merge-base against current-main reference `27b51d248a86471c2a974f2e7b06f42398b6f58d`: `09f919818b78b990d01b040737e98a42570d40ce`.
- Stable patch ID for `09f9198...f5bb0f7`: `9cf9a6635b07687b39ea3dab0efa0c66df0c1578`.
- Worktree `social-home-api`. Local branch named `main` is stale; review pins the explicit current-main revision and resulting merge-base instead. The branch includes already-reviewed Atlas/export fixture prerequisites, whose equivalent changes are already on current main; those do not change the H1 verdict.
- Scope: plan H1 backend only, including selected-memory read. Frontend adoption/initial-request browser gate is separate. Review-only; no app edits, publication or production mutations.

## Verdict: FAIL

### Standards

No actionable documented-standard violations. The Atlas extraction retains one shared card interpreter and one compact-label hook. Source-table activity projection avoids a copied feed or speculative interface; bounded helpers have concrete responsibilities. Naming/duplication/data-clump/repeated-switch/middle-man heuristics were considered as judgment rather than mandatory restructuring. Introduced comments comprise the accurate Home module docstring; the projector's explanatory comments are moved existing comments. No comment suppressions or invented guarantees were introduced in code.

### Spec

**P2 — Exclude the fallback featured photo from its activity preview.** `mazi/social/home.py`, final fallback branch of `home_view`, assigns `featured` but leaves `exclude=None`. With no upcoming plan or comments and a reaction on the chosen fallback photo, Home returns the photo as its feature and again as an activity target. This violates the plan's no-repeat requirement and canonical promise that featured targets are excluded from Home activity.

Independent reproduction using `CommentsFixture`: read `home_view(...)[featured][memory]`, take its first photo asset, call `reactions.set_reaction(store, ben, group, 'reaction-on-fallback', {'kind':'photo','id':asset}, '👍', True)`, then read Home. Observed featured `memory.id=photo-ASSET` and activity row `memory_id=photo-ASSET` with target `{kind:photo,id:ASSET}`. Set the fallback feature's photo target as `exclude` and add a reaction-only regression that still preserves other targets and the full activity page.

**P2 — Carry one selected-read metadata budget into legacy sharing context.** `mazi/atlas.py:_selected_items` starts and enforces its own two-second/64-MiB/65,536-origin request budget. `_project_cards(selected=True)` subsequently constructs `SharingContext(..., time.perf_counter(), 2)` with a new start and no `consume` callback. Context gets a separate additional 64-MiB/100,000-origin request allowance and resets elapsed time. Consequently extra date-order evidence is not charged to the selected request's documented total limits. The existing A2 Search reader demonstrates the intended shared-start/shared-consumption pattern.

Independent deterministic reproduction: use the existing WhatsApp fixture with raw `04/05/2024, 21:00` and same-run `23/05/2024, 10:00`; locate the first card and call `atlas.memory_view` under `patch('time.perf_counter', side_effect=clock)` where clock returns successive values `min(call_index * .6, 3)`. Observed calls `[0.0, 0.6, 1.2, 1.8, 2.4]`; the request successfully returns `2024-05-04T21:00:00` despite exceeding two seconds from its selected metadata start. The context reset occurs at 1.2. Share the start and request byte/origin accounting across the selected scan and added context, reject before JSON parsing when extra evidence crosses the remaining budget, and add combined scan/context time+byte/count regressions. Separate helper limits must not add up to a larger request limit.

No other correctness findings from the inspected full diff. Candidate merge/keyset ordering handles same-second cross-kind identities, current-member joins and tombstones; continuation after filtered candidates remains stable. Memory targets require all original children and overlapping hidden events are excluded. Selected permanent-photo routes survive grouping, and event routes reuse shared Atlas evidence/labels. The selected origin CASE guard rejects oversized payloads before parsing. Index migration adds six indexes only, with matching SQLite definitions and no table, privilege or audience change.

## Independent validation

- `.venv/bin/python -m unittest tests.backend.social.test_home tests.backend.social.test_home_http tests.backend.social.test_label_summaries tests.backend.test_atlas tests.backend.test_atlas_projection`: **61 passed**. Includes real HTTP/session denial, empty/archive/plan/conversation states, 10k native comments, 512-candidate continuation, mixed-source keysets, current privacy, selected/full-card equality, immutable correction snapshot, compact labels and oversized selected metadata.
- Guarded `.venv/bin/python -m unittest tests.backend.social.test_home_postgres` loaded via Node child environment with explicit `MAZI_DATABASE_SCHEMA=mazi_social_20261104_test`, `MAZI_STORAGE_BUCKET=mazi-social-test`, `MAZI_BACKEND=supabase`, `MAZI_TEST_POSTGRES=1`: **3 passed in 21.677s**. Synthetic isolated fixtures cleaned up; no migration or production write performed. Includes fractional time/keyset/departure visibility and actual PostgreSQL action-index EXPLAIN checks over 2,000 rows.
- Independent direct reproductions above: both undesired states confirmed.
- `git diff --check 09f9198...f5bb0f7`: passed, including committed evidence.

Author records adjacent export/source and budget/build checks and guarded serial hosted timings; these are not production p95 or browser/Vercel measurements. This review independently ran selected/source-evidence comparisons but did not rerun the entire export suite or browser adoption, which is outside this backend slice. Apply the index migration in the normal release sequence before relying on its hosted performance. Preserve this initial verdict when appending correction verification.

## Reverification after accepted findings — PASS

- Current exact reviewed head: `6715b3f42704106790bf8f41d03a984692f6415e`.
- Current base and actual merge-base: `27b51d248a86471c2a974f2e7b06f42398b6f58d`, merged in `81199a3`.
- Stable full-branch patch ID: `f392d842ed445bc83fee44fa0d3020661c1ad71f`.
- Original FAIL at `f5bb0f7` and both exact reproductions above are preserved. The newer base removes the already-merged export prerequisite from this patch.

**Standards: PASS.** The correction adds a small request-local `_SelectedBudget` with explicit start/bytes/origins, reusing the existing `SharingContext` consumer boundary. No new suppression comments or unrelated refactoring. Fixture assertions now identify the labelled photo by permanent asset ID while retaining exact selected/full-Atlas parity and sibling Unknown omission; the prior index assumption depended on randomized asset ordering and was not a runtime ordering defect.

**Spec: PASS.** `e25e451` sets the fallback featured photo as the excluded activity target, preserving other targets and unfiltered activity behavior. The independent original reaction-only reproduction now leaves only the other photo's activity. `12694e3` creates one selected metadata start and shares its consumer with legacy context. Every selected/context origin is charged to the same two-second, 64-MiB and 65,536-origin request allowance before its JSON parsing; no ceiling is raised. Context retains its per-origin and per-photo safeguards. The original deterministic 2.4-second reproduction now raises `CapacityExceeded` with the same clock sequence. `22b62db` separately forbids context JSON parsing once bytes/origins exhaust the remaining request allowance, and this regression passes independently. Selected routes retain their response shapes, full-card evidence/labels equality, current access and correction snapshots.

Independent verification at this exact head:

- `.venv/bin/python -m unittest tests.backend.social.test_home tests.backend.social.test_home_http tests.backend.social.test_label_summaries tests.backend.test_atlas tests.backend.test_atlas_projection`: **64 passed in 17.362s**.
- Three focused correction contracts rerun independently: combined bytes/origins before parse, shared elapsed time, fallback target exclusion with another visible target: **3 passed**.
- Original direct reproductions rerun outside committed test methods: both now satisfy the intended contract, with the other activity target preserved.
- `python3 work/poteto/product-plan/verify_docs.py`: **passed**, 19 authored documents and 342 local links.
- `git diff --check 27b51d248a86471c2a974f2e7b06f42398b6f58d...6715b3f42704106790bf8f41d03a984692f6415e`: **passed**, including committed evidence; worktree clean.

No remaining actionable findings. The original three isolated hosted tests passed independently before these corrections; author records the three tests passing again after correction in 14.353s. This recheck did not repeat hosted calls or full unrelated regressions. The new budget plumbing is shared Python code with no schema/SQL/privilege change, and the independent local suite covers its exact failure boundaries. Frontend adoption and final integrated browser/deployment gates remain separate as described above.
