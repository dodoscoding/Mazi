# Mazi simplification final verification

All thirteen tickets (#147–#159) for [spec #146](https://github.com/dodoscoding/Mazi/issues/146) are implemented on `codex/app-simplification`, submitted through [PR #161](https://github.com/dodoscoding/Mazi/pull/161). The approved decision is D28; its original issue used provisional D21 before reconciliation with newer main history.

## Revisions and environment

- Tested application revision: `b6e315efff2ac6c9f2172741fbee5fe364562353`.
- Pre-implementation comparison: `485bcabe83f8da3a9bc635fe0c9646a45a1a43da`, which reconciles the original checkout with main `107117c5f4315f4b569ba5dc386aba5f9b19ac7e`.
- Full backend run: `da2afe015ddf777f20a39cdf3040f809165d8cc9`. Backend source, backend tests, dependencies and migrations have no subsequent diff at the tested application revision.
- macOS 27.0 arm64, Node 24.15.0, Python 3.14.7, Playwright 1.63.0, Chromium 153.0.8010.12/build 1243, Firefox 155.0/build 1543.
- Fixtures are temporary synthetic archives from the existing unified, conversation, source, archive, discovery, recap and Past creations servers. The sample suite uses the existing explicit fictional sample archive. No personal archive or live provider credentials were used.
- Complete versions and process environment: [environment.json](verification/environment.json).

## Final results

| Boundary | Command | Result | Receipt |
| --- | --- | --- | --- |
| Integrated real app, Chromium desktop and Pixel 7 emulation | `MAZI_UNIFIED_PORT=8190 npm run test:app` | 181 passed; 1 existing phone-only guard | [app.log](verification/app.log) |
| Sample archive, Chromium and Firefox desktop/phone projects | `MAZI_TEST_PORT=8193 CFFIXED_USER_HOME=<fresh isolated app-data> npm test -- --workers=2` | 290 passed; 34 existing device/opt-in guards; 81 cases per project | [chromium-firefox.log](verification/chromium-firefox.log) |
| Retained domain UI and HTTP workflows, desktop/phone | `MAZI_DOMAIN_PORT_BASE=18180 MAZI_PYTHON=/tmp/mazi-simplification-validation/.venv/bin/python MAZI_BROWSER_RESULTS_DIR=/tmp/mazi-final-domain-results npm run test:domains` | 44 passed; no skips | [domains.log](verification/domains.log) |
| Backend domains, HTTP, ownership, access, withdrawal, capsule timing and capacity | `PYTHONWARNINGS=ignore npm run test:backend` | 710 run; OK; 28 existing skips | [backend.log](verification/backend.log) |
| Formatting | `npm run lint` | Passed | [lint-unit-dom.log](verification/lint-unit-dom.log) |
| Existing unit contracts | `npm run test:unit` | 23 passed | [lint-unit-dom.log](verification/lint-unit-dom.log) |
| Full existing DOM contracts, run alone with a per-test bound | `node --test --test-timeout=30000 tests/dom/*.test.mjs` | 160 passed; natural exit 0 | [lint-unit-dom.log](verification/lint-unit-dom.log) |
| TypeScript and production assets | `npm run build` | Passed | [#159 receipt](ISSUE-159.md), final merge checks |
| Unchanged bundle limits | `npm run check:budgets` | 392.3/420 KiB gzip total scripts; all individual limits passed | [final checks](verification/final-checks.log) |
| Canonical documents and whitespace | `python3 work/poteto/product-plan/verify_docs.py`; `git diff --check` | Passed | [final checks](verification/final-checks.log) |

The app command includes 110 unified journeys, 21 conversation journeys, 6 source journeys, 6 correction-queue journeys, 26 Photos/search/retirement journeys, 8 recap journeys and 4 Past creations journeys. Its existing guarded conversation case is covered through the desktop variant. Sample skips retain the existing device-specific, optional screenshot and capability guards; no new skips were introduced to hide failures.

The app and sample suites ran from separate checkouts of the same immutable revision, avoiding concurrent asset-build writes. Synthetic state stayed in separate temporary servers. Optional learned-model inference and hosted/PostgreSQL gates were not provisioned; local consent, keyword retrieval and permission cases ran. These results establish local automated acceptance, not physical-device, hosted-load, deployment or M0–M7 production acceptance.

## Review and corrections

The two review axes were independent and used the pre-implementation fixed point:

- [Standards review](review/STANDARDS.md): one documented overlay-token violation and one unused gallery-mode heuristic. [Both resolved](review/STANDARDS_VERIFICATION.md).
- [Spec review](review/SPEC.md): cached Globe visibility did not refresh after Settings mutations; empty creation identifiers incorrectly listed unrelated creations. [Both resolved, with no new actionable findings](review/SPEC_VERIFICATION.md).
- Full acceptance then exposed loss of saved feedback from overly broad archive invalidation. The same fix workstream now invalidates/cancels Atlas reads while preserving circle context, Settings drafts, expanded controls and saved notices. Session/group/retry invalidation remains intact. Public desktop/phone regressions and independent verification passed.
- [Review-fix evidence](REVIEW_FIXES.md) records red/green results, cancellation/denial coverage and the small phone search-action layout refinement. No schema, storage-format, source-brief or persisted-data purge accompanies the simplification.

An earlier concurrent DOM attempt failed an unchanged archive-hook assertion and did not terminate. The exact cause was not reproduced; concurrent load remains only a hypothesis. Unchanged focused and full bounded reruns terminated naturally, followed by the final standalone 160/160 run above. No assertion was removed, skipped or forced to pass.

## Browser setup and visual evidence

The pinned Firefox initially failed before any assertion because of the [Playwright/macOS app-data issue](https://github.com/microsoft/playwright/issues/42768). A fresh `CFFIXED_USER_HOME` isolates test browser app-data. The real Firefox profile, original `HOME`, system permissions, dependency pins and test assertions remain unchanged. The final complete Chromium/Firefox run passed with this process-local environment; its exact path is recorded in the environment receipt.

Final screenshots use the existing explicit fictional sample mode and public sample photographs, keeping personal archives out of evidence:

- [Desktop Globe](screenshots/final-sample-desktop-globe.png)
- [Desktop Photos](screenshots/final-sample-desktop-photos.png)
- [Phone Globe](screenshots/final-sample-phone-globe.png)
- [Phone Photos](screenshots/final-sample-phone-photos.png)

[Capture metadata](screenshots/final-sample-capture.json) records the viewports and sample flag. Unknown sample capture dates intentionally remain Undated. The per-ticket receipts retain richer synthetic chronology, query, access and recovery screenshots. Optional sound, reduced-motion behavior, fallback access and the established globe visual world remain.

Relative to the pre-implementation baseline, frontend source contains 2,919 added and 9,536 deleted lines: a net reduction of 6,617 lines. Tests and acceptance evidence are accounted for separately. Old destination compositions are deleted; retained imports, source connections, correction queues, gallery, source context and historical readers remain shared modules.

## Handoff

All original review findings are resolved and the final automated checks above pass. PR #161 carries closing references for the parent and all thirteen child tickets; GitHub closes them when the PR is merged. Review and merge remain the next owner action. Deployment and production acceptance remain separate.
