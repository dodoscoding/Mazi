# Main branch backport evidence

The backport starts at `origin/main` revision `3b551388d3fadb7a248fe906fc1e56edd47bd0dd` on `codex/archive-reliability-main`. Each source commit was applied as an ordered filtered binary patch and committed with its original message. The origin was verified as `https://github.com/dodoscoding/Mazi.git` before each commit. No release-branch merge, push, pull request, deployment, or live mutation was performed.

## Commit correspondence

| Release source | Main backport |
| --- | --- |
| `3389aa2` | `392cf33` |
| `24f12bc` | `3828b20` |
| `de0f937` | `677d027` |
| `01a098e` | `a2a906d` |
| `7fdf6f9` | `fd0691c` |
| `573c3aa` | `c46296b` |
| `613f169` | `5dc6639` |
| `b651747` | `efc3f49` |
| `898a281` | `158e15a` |
| `26b931d` | `0e735a4` |
| `1685a79` | `68caa55` |
| `f93a8a2` | `51a246f` |

## Source identity

All 27 included files match release revision `f93a8a28f00356d6cceb99f512d9e649af708ed1` byte for byte. That includes 24 code and test files plus metadata evidence and its two synthetic screenshots. The comparison used `git diff --name-only cf26a7d..f93a8a2` after removing the exclusions below, then compared each working file with `git show f93a8a2:<path>`.

The excluded files are `api/index.py`, `tests/backend/test_vercel_bridge.py`, `docs/DEPLOYMENT.md`, and the Vercel connection-lifecycle evidence document. Those paths are unchanged from the main base. Earlier release-only runtime and configuration changes were not imported.

## Verification

```sh
npm run build
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m unittest tests.backend.test_persistence tests.backend.test_atlas tests.backend.test_atlas_projection tests.backend.archive.test_review tests.backend.discovery.test_discovery tests.backend.test_hosted_recovery tests.backend.test_postgres
node --test tests/dom/archive-hook.test.mjs tests/unit/provenance.test.ts
git diff --check
```

The build passed with the existing large-chunk warning. All 99 backend tests passed, with eight hosted tests skipped because no hosted mutation configuration was enabled. Existing SQLite connection ResourceWarnings appeared during backend fixtures. All nine hook and provenance checks passed. The final one-line private-helper docstring removal changes no executable behavior.

## Integration limits

Main retains its existing loopback HTTP server and always-on worker. This backport includes the lazy, transaction-pool-compatible database boundary, but no Vercel request or drain owner. Its per-request SQL disconnect and WSGI availability responses remain specific to the release adapter and are deliberately excluded. The main process keeps its existing store lifetime and closes stores at shutdown. This backport did not test a main-branch hosted deployment or change connection configuration.
