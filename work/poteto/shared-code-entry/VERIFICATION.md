# Shared-code entry verification

## Scope and environment

The owner approved shared code plus visible name with immediate existing-profile resumption. Email and personal passwords are absent from the entry UI. Existing application pages remain. This is local application evidence, not hosted deployment or production milestone acceptance.

Worktree: `/Users/altanesmer/.codex/worktrees/shared-code-entry/Mazi`. Branch: `codex/shared-code-entry`. Base: `2a2f861`, the merged unified-app revision. The original checkout and its `.mazi-imports` archive were not modified. Dependency directories are local symlinks to the installed workspace environment. Tests use temporary synthetic archives.

Environment: macOS, Node 24.15.0, Python 3.14.7, locked Playwright 1.63.0. Desktop and phone checks use browser emulation. No physical device or hosted environment was tested.

## Before implementation

- `npm run build` passed at the base. Vite reported the existing large Atlas chunk warning.
- `npm run test:backend` passed 141 tests with 2 existing skips in 21.340 seconds. Log: `/tmp/mazi-shared-code-baseline-backend.log`.
- `python3 work/poteto/product-plan/verify_docs.py` and `git diff --check` passed.
- Commit `c520daa` adds six shared-entry contracts. `python3 -m unittest discover -s tests -p test_shared_entry.py` failed before implementation because Store had no setup_shared method. The tests were subsequently moved under `tests/backend/identity/` so the normal backend command discovers them.

## Design and review

Two design candidates and an independent reviewer selected the additive profile table. [Synthesis](SYNTHESIS.md) records the comparison and corrections. All agents used one model family. The backend comment audit found no new narrative comments or suppressions. It retained the setup command's module docstring because argparse displays it as command help.

The independent backend review examined `2a2f861..2fd7ccf` and found no defects. Its [extra probe](evidence/backend-probe.py) loads those exact Git revisions and creates temporary databases. It verifies preservation of the actual old schema's users, ownership and grants, repeated setup, the exact 30-day expiry boundary, profile-scoped introduction, rollback on a failed session insert, and denial before setup. [Probe results](evidence/backend-probe-results.txt) passed.

The UI review examined `2a2f861..c90974f`. Its comment and deslop audits passed. The reviewer identified a stale Atlas denial that could invalidate a newer successful load, plus browser assertions that depended on desktop tests running before phone tests. Corrections and final checks are recorded below.

The [final independent review](evidence/final-review.txt) covers `2a2f861..1ec20e4` and found no remaining actionable issues. The same isolated hook probe now leaves entry and archive ready after the stale denial. [After-fix results](evidence/stale-denial-after.json) retain that proof. The final comment audit removed one unused fixture docstring and found no other candidates.

## Final verification

At `c90974f`:

| Command or check | Result |
| --- | --- |
| `npm run test:backend` | 151 tests ran, 2 existing skips, no failures. |
| `npm run test:app` | 12 desktop and phone tests passed. |
| `MAZI_FIREFOX_EXECUTABLE=/tmp/mazi-entry-firefox/firefox npm test -- --workers=2` | 38 passed, 2 intentional Firefox screenshot skips. |
| `npm run build` | Passed TypeScript and Vite build. The existing large Atlas chunk warning remains. |
| `npm run lint` | Passed Prettier. |

An independent browser probe used the temporary sample server on port 18099. It completed login through the form, introduction, About, a second browser's case-insensitive name resumption, and a remembered reload. Both desktop and Pixel 7 emulation retained the same profile UUID. All six Axe scans passed with no page errors or horizontal overflow. [Accessibility results](evidence/accessibility.json) retain the results.

Parent review inspected all six screenshots for legibility, clipping, hierarchy, and consistency with the existing palette and typography:

| Page | Desktop | Phone |
| --- | --- | --- |
| Login | [Desktop](screenshots/login-desktop.png) | [Phone](screenshots/login-phone.png) |
| Introduction | [Desktop](screenshots/welcome-desktop.png) | [Phone](screenshots/welcome-phone.png) |
| About | [Desktop](screenshots/about-desktop.png) | [Phone](screenshots/about-phone.png) |

The review corrections are in `e4f3d69` and `1ec20e4`. Commit `caf8b3d` first adds a failing stale-denial regression. An independent reproduction at `c90974f` also confirmed that the older request's signal was not aborted. [Before-fix results](evidence/stale-denial-before.json) retain that observation. The fix checks generation and abort state before any authorization side effects. Both current 401 and 403 responses still clear private state. The integrated tests now derive expected counts from the fixture, so phone tests no longer depend on desktop imports.

Final checks at `1ec20e4`:

| Command or check | Result |
| --- | --- |
| `npm run test:app -- --project=phone` | 7 passed in isolation. |
| `npm run test:app` | 14 desktop and phone tests passed, including the stale-denial regression. This command also built the final app. |
| `MAZI_PYTHON="$PWD/.venv/bin/python" npm run test:domains` | 14 passed and 2 optional learned-model checks skipped at `5c6a7a7`. |
| `npm run lint` | Passed after all source and test changes. |
| `python3 work/poteto/product-plan/verify_docs.py` | Passed 16 authored documents, 168 links, 30 requirements, 8 milestones, and 15 acceptance scenarios. |
| `git diff --check` and `git diff --check 2a2f861 HEAD` | Passed. |
| Setup command smoke test | Temporary archive creation, repeat setup, explicit code rotation, and old-code denial passed. |

Backend code did not change after the 151-test run. The sample-mode code did not change after the 38-test browser run. The final source correction affects live archive authorization and is covered by the final integrated run.

The backend suite emitted the same SQLite ResourceWarning count as the baseline. These existing cleanup warnings and the Atlas chunk-size warning remain outside this entry change.

The first domain test run failed two answer-page assertions because they expected the old inline access-denial message. The new login gate replaces that message. Updated assertions verify that the dedicated login appears and private evidence disappears. The clean full domain rerun passed. The optional learned-model tests need a separately installed model.

Logs for this session are `/tmp/mazi-entry-all-backend.log`, `/tmp/mazi-entry-sample.log`, `/tmp/mazi-entry-domains.log`, `/tmp/mazi-entry-stale-red.log`, `/tmp/mazi-entry-phone-isolated.log`, and `/tmp/mazi-entry-after-race.log`. These temporary logs supplement the committed tests and evidence above.

## Commits

- `ed2af30` defines the agreed access and introduction contracts.
- `c520daa` exposes the missing shared-profile behavior with failing tests.
- `2fd7ccf` adds transactional shared profiles, setup, and server authorization.
- `af45efb` covers legacy ownership and failed-entry rollback.
- `c90974f` adds dedicated entry, one-time introduction, and About.
- `5c6a7a7` updates domain browser tests to the shared-code flow.
- `caf8b3d` reproduces the stale Atlas denial race.
- `e4f3d69` ignores obsolete Atlas access denials.
- `1ec20e4` removes browser project-order dependencies.

## Operational limits

The existing archive needs explicit operator setup and legacy name-to-user mappings, as documented in [README](../../../README.md#run-mazi). Tests did not configure the user's archive. Code holders can resume another member's profile, including the owner, as the user accepted in D17. Code rotation changes future entry and does not revoke existing sessions. No deployment, production authentication acceptance, physical-device acceptance, or remote CI result is claimed.

## Browser environment

The existing [Firefox environment receipt](../m0-acceptance/FIREFOX_ENVIRONMENT.md) documents a macOS bundled-Firefox startup problem. For this task, `/tmp/mazi-entry-firefox/firefox` uses the same isolated branding workaround with the installed Firefox 155.0 engine. A direct launch and page creation passed. Browser cache files and the user's Firefox profile were unchanged. Any Firefox suite run with this launcher is reported explicitly, not as stock-launch acceptance.
