# C1 comments backend independent shipping review

Verdict: PASS for the backend-only comments slice. No actionable standards, correctness, privacy or regression finding was identified. Reactions, browser controls, drafts and social Home are explicitly separate delivery slices.

- Reviewer: GPT-6.1 Sol, high reasoning, independent from the patch author.
- Base: `02d5cb6e5a378b6c7e0229573b18839bf90cd0a2`.
- Head: `5adfd3bd7ce13b91b4ea9c105ea7e2c1251df90f`.
- Stable patch ID: `689b2f4c95f717eb3eb5dd1fdfb318742a52a4e3`.
- Diff: `git diff 02d5cb6...5adfd3b`.

## Standards

No actionable documented-standard violations or meaningful Fowler smell findings. The Target record keeps target selection together, with validation at the request boundary and one current-target authorization function used by lists, writes, replay and export. The comment domain reuses the settled social revision/receipt helpers and existing export integration. The small SQL fragment gathers identical current-author/tombstone rules rather than scattering them across the queries.

The scoped comment audit found only two module docstrings defining ownership. No added suppression, constraint or explanatory comments require removal. Deletions, restorations, reshape flags and unenforced constraints are all zero. No application code was changed by the reviewer.

## Spec

The scoped comments contract is implemented. Photo conversations use permanent archive asset IDs, and approved-memory conversations use review-event IDs. A photo's later grouping does not move its thread. Multiple separate messages from one author are allowed and notebook recollections remain separate.

Author-only update/delete uses expected positive revisions and conditional writes. Creation time and identity are immutable across edits. Request receipts are group/actor scoped, return current surviving results on exact retry, reject changed content and never repeat a write. Deleted results are checked against the retained target before a replay response. Plain text remains JSON text at this backend boundary; the later UI must render it as text.

Current membership and target visibility protect text, list totals, writes, replay and authored export. Photo targets exclude direct hides and every child of hidden memories. Memory targets require accepted status and all original children, including masks from overlapping hidden events. A separate eligible source keeps a photo accessible after one origin is withdrawn. Loss of its last eligible origin denies the conversation. Composite foreign keys reject cross-group authors and targets even when the author belongs to both groups.

Comments page by immutable creation time and stable ID. Active-author and deletion-ledger filtering occurs before limits, so an invisible row does not consume a page position. Equal-time pagination is covered. Photo/time and memory/time indexes support the target reads.

Explicit deletion and foreign-key cascade deletion both record text-free tombstones. Identity Store departure therefore withdraws comments and prevents stale-row reinsertion from making them readable after rejoin. PostgreSQL comment epochs and deletion times use DOUBLE PRECISION. New tables have RLS and no PUBLIC/anon/authenticated grants. Hosted runtime access to the deletion ledger is SELECT/INSERT only; the trigger function has a private explicit search path and revoked public execution.

Export adds only the caller's currently visible comments. The same projection runs during archive assembly and final fingerprint admission, and a concurrent edit produces the expected conflict. Hidden/withdrawn target comments and other authors' comments are excluded. Empty contribution exports retain their prior inventory.

## Independent checks

Commands ran in `/Users/altanesmer/Desktop/Ales/Mazi-wt/social-comments` with synthetic fixtures.

- `.venv/bin/python -m unittest tests.backend.social.test_comments tests.backend.social.test_comments_http tests.backend.memories.test_memories tests.backend.memories.test_memories_http tests.backend.test_export_admission` passed 51 tests. This includes real HTTP author/origin/session/version checks, concurrent exact retry, both target kinds, visibility, independent-source survival, notebook compatibility, same-time pagination, identity-boundary cleanup, stale-row suppression and final export admission.
- The isolated hosted command below passed all three tests in 25 seconds. It confirms fractional creation time, replay/CAS, authored export with synthetic private bytes, hidden export exclusion, identity Store cascade/tombstones, rejoin with stale-row reinsertion, source withdrawal, runtime/client privileges and target/time index use.

```sh
MAZI_DATABASE_SCHEMA=mazi_social_20261104_test MAZI_STORAGE_BUCKET=mazi-social-test MAZI_BACKEND=supabase MAZI_TEST_POSTGRES=1 node --env-file=.env.supabase -e 'const {spawnSync}=require("node:child_process"); process.exit(spawnSync(".venv/bin/python",["-m","unittest","tests.backend.social.test_comments_postgres"],{stdio:"inherit",env:{...process.env,MAZI_DATABASE_SCHEMA:"mazi_social_20261104_test",MAZI_STORAGE_BUCKET:"mazi-social-test",MAZI_BACKEND:"supabase",MAZI_TEST_POSTGRES:"1"}}).status ?? 1)'
```

The hosted test helper requires a schema ending `_test`. Explicit child overrides selected only `mazi_social_20261104_test` and private bucket `mazi-social-test`. Private credentials were loaded into the environment without being printed. No production schema or archive was tested or mutated. Synthetic text-free deletion-ledger entries intentionally persist because the runtime cannot remove tombstones.

- `npm run check:docs` passed with 19 documents and 316 links.
- `git diff --check 02d5cb6...5adfd3b` passed for the complete committed branch.
- The domain, schema, hosted migration, HTTP integration, export overrides, tests and canonical contract/privacy text were inspected. The worktree remained clean.

## Restore and release limits

The retained-ledger guarantee is supported by actual stale-row reinsertion and a latest SQLite snapshot roundtrip. The implementation and docs correctly avoid claiming that an old backup knows later deletions. Reconcile the current deletion ledger and receipts before a historical restored snapshot serves traffic. This review does not establish a full production backup/recovery drill or retention operation.

Apply the additive hosted migration before deploying the comment reader/writer. Browser conversation controls, in-memory drafts, reactions and the two-member desktop/phone journey remain separate acceptance work. This review did not run the complete integrated suite, production, physical-phone or five-friend checks. No UI screenshot is appropriate for this backend-only slice.

Standards findings: zero. Spec findings: zero within the comments-backend scope. The next acceptance gap is the conversation UI and separately planned reactions.
