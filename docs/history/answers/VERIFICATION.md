# Phase 6 verification

Historical experiment record. The active application now runs with `python -m mazi`; source and test links below point to their consolidated locations. Original acceptance claims and evidence remain historical.

Verified on 14 October 2026 against base revision `f6c36be` plus the Phase 6 working-tree changes. Environment: macOS arm64, Python 3.11.5, Node 24.19.0, Playwright 1.63.0, installed Chrome. Synthetic fixtures only; no production data, provider requests, or deployment.

## Results

| Check | Command | Result / evidence |
| --- | --- | --- |
| Answer and HTTP boundaries | `.venv/bin/python -m unittest discover -s phase6/tests -v` | 12 passed; [raw output](evidence/python-tests.txt). Includes outsider/consent denial, hidden evidence, correction/withdrawal, deletion by an independent database writer, permission changes between stages, conflicting/unknown dates, source instruction isolation, durable quotas, JSON/origin validation and rejoin consent. |
| Templated synthetic regression | `.venv/bin/python -m phase6.evaluate` | 100/100 supported record answers and 50/50 abstentions; [report](evidence/answers.json), [fixtures/questions](../../../tests/backend/answers/answer_holdout.json). These questions share templates and are not an independently authored real-archive T13 holdout. |
| Browser contracts | `MAZI_PYTHON=.venv/bin/python MAZI_CHROME_CHANNEL=chrome node node_modules/@playwright/test/cli.js test --config phase6/playwright.config.ts` | 2 passed: desktop and Pixel 7 emulation. Evidence navigation, hidden-link denial, abstention, HTML-safe rendering, no horizontal overflow, and no axe violations on the answered screen. [Desktop](evidence/desktop.png), [phone](evidence/phone.png). Screenshots visually reviewed. |
| Phase 5 regression | `.venv/bin/python -m unittest discover -s phase5/tests -p test_discovery.py -v` | 21 passed. |
| Type/build | `node node_modules/typescript/bin/tsc -b` and `node node_modules/vite/bin/vite.js build` | Passed; existing Atlas chunk-size advisory remains. |
| Formatting | Prettier check over configured source/test paths | Passed. |
| Documentation | `python3 work/poteto/product-plan/verify_docs.py` | Passed. |
| Whitespace | `git diff --check` | Passed. |

The sandbox initially denied loopback server binding; the HTTP/browser suites passed with approved local server execution. Bundled Chromium was absent; installed Chrome was used through the existing channel option. CI now defines the answer unit, evaluation and browser job; its remote execution is not claimed here.

Before PR creation, rebased onto the latest Phase 5 branch (`f6c36be`) and reran all 12 Phase 6 tests, 21 Phase 5 regressions, 150 evaluation questions, and both browser checks successfully.

## Boundaries still open

The fixed answer engine deliberately covers attributed photo metadata and bounded exact-keyword retrieval, not arbitrary conversational reasoning, semantic paraphrases, image understanding or causal claims. The corpus is synthetic and templated. Production M6 requires independent held-out questions, representative archives, deployed API/database/storage authorization, privacy/retention integration, cost and scale checks, and product acceptance. Real device and screen-reader checks remain open. No general language model or external provider is enabled, and no provider terms are implied.

Live citations reauthorize against the current archive. No cached answer can survive withdrawal because answers are never persisted or cached. Already delivered text cannot be recalled; background/navigation clears the screen, but a foreground page does not receive server-pushed deletion updates. These limits are documented rather than represented as production completion.
