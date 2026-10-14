# Phase 6: Evidence-backed Memory answers

Historical experiment record. The active application now runs with `python -m mazi`; source and test links below point to their consolidated locations. Original acceptance claims and evidence remain historical.

Local implementation of M6 over the Phase 2–5 archive. This is an offline extractive answer engine, not a general conversational language model or production T13 acceptance. It needs no new Python packages or model download.

## Run

From the repository root:

```sh
.venv/bin/python -m mazi
```

Open http://127.0.0.1:8004/ask. The server includes import, review, sources, and People routes and shares `.mazi-imports`. Override `MAZI_IMPORT_DATA_DIR` and `MAZI_IMPORT_PORT` as needed. Keep fixtures synthetic and the server on loopback.

Sign in through Imports. In People & search, enable group local processing and contribution processing. In Memory answers, an administrator enables group Memory answers; the requesting member and every supporting contributor/correction author must separately opt in. Existing related-search consent does not silently opt anyone in. Keyword search still works with optional processing off.

## Supported questions

Use a title/place keyword, “When was bicycle?”, “Where was dinner?”, “Earliest Amsterdam”, or “Latest garden”. The engine requires all non-question keywords in currently eligible source text. It returns up to five matching photo records and attributes titles, dates and places to the archive. Matching source messages help locate records but are never instructions or factual answer text. It does not infer events from image pixels, identify people, explain causes, count a complete history, or answer arbitrary conversational questions. No tools or network model dispatch exist.

Every response carries incomplete-archive language. Dates with conflicting assertions are shown as conflicting; unknown dates stay unknown. Explicit reviewed corrections take precedence. Earliest/latest abstain if any matching eligible record has an unknown or conflicting date. First-ever and other absolute history questions abstain. Records beyond the first five are counted explicitly rather than silently presented as a complete answer.

## Access, invalidation and limits

- Membership, personal photo hiding, active source visibility, Phase 5 eligibility, and separate Memory answer consent are checked before retrieval, local engine dispatch, and delivery.
- A fresh snapshot of eligible evidence and consent generation prevents in-flight corrections, withdrawal, deletion, consent changes, or new evidence from delivering an obsolete answer. Changed evidence returns a retryable conflict.
- Citation links open an accessible record page and recheck current permissions and consent. No answer or question content is stored. Already delivered content cannot be recalled; backgrounding/navigation clears the displayed answer.
- Local limits: 500 characters per question, 1,000 visible photos, five citations per response, and 50 attempts per member/group/UTC day. Reserved attempts, including invalidated requests, count toward the durable limit. Malformed/unauthorized requests do not reserve attempts.
- Usage reports requests and completed processing seconds. External provider cost is €0; local infrastructure cost is explicitly unmeasured. Persistent metadata contains no question or answer bodies.
- The schema adds `answer_processing`, `answer_usage`, and consent/departure triggers. Initialization is additive and restart-safe. Existing database/object backup tooling includes these tables; production usage-metadata retention and account deletion integration remain open.

## Verify

```sh
.venv/bin/python -m unittest discover -s tests/backend/answers -t . -v
.venv/bin/python -m mazi.answers.evaluate
MAZI_PYTHON=.venv/bin/python npm run test:answers:browser
npm run build
npm run lint
npm run check:docs
```

Set `MAZI_CHROME_CHANNEL=chrome` to use installed Chrome when bundled Chromium is unavailable. The test server uses disposable synthetic data. [Verification](VERIFICATION.md) distinguishes local evidence from production release gates. The 150 templated evaluation questions are a regression corpus, not independent representative questions or evidence of general-language quality.
