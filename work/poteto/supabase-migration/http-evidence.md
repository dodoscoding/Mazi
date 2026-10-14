# Hosted HTTP acceptance evidence

Synthetic live acceptance on 14 October 2026 against the built app at `http://127.0.0.1:5186`, hosted application records/private Storage, and the independent background worker. The test uses only HTTP; it does not construct domain stores or read backend credentials. D17 fixture credentials and cookies remain in restricted `/tmp` files and are not reproduced here.

## Preparation

```sh
MAZI_TEST_HOSTED_HTTP=1 MAZI_TEST_HTTP_BASE_URL=http://127.0.0.1:5186 \
MAZI_TEST_HTTP_FIXTURE=/tmp/mazi-hosted-synthetic.json \
MAZI_TEST_HTTP_PHASE=prepare \
.venv/bin/python -m unittest tests.backend.test_hosted_http
```

Passed: one test in 52.697 seconds. Verified actual shared-code entry, completed introduction, notification boolean true/false, ZIP upload with equal-range retry and conflicting-range rejection, worker inventory, sharing confirmation, worker completion, private original/preview bytes, source provenance, Atlas, anonymous denial, denied membership in an unrelated group, and cross-origin POST denial. Responses checked `Cache-Control: no-store`.

A second ZIP upload is retained halfway through. Its checkpoint, expected bytes, synthetic run/profile IDs and opaque cookie are recorded in `/tmp/mazi-hosted-http-state.json` and its `.cookies` companion, both mode `0600`. No shared code or backend key is written to this state. Use a fresh `MAZI_TEST_HTTP_STATE` path for another preparation; existing state is never overwritten.

## Fresh-scratch restart

The parent restarted the same hosted API and worker on port 5186 with a fresh `MAZI_IMPORT_DATA_DIR` (`private/http-runtime-after-restart`) before running:

```sh
MAZI_TEST_HOSTED_HTTP=1 MAZI_TEST_HTTP_BASE_URL=http://127.0.0.1:5186 \
MAZI_TEST_HTTP_FIXTURE=/tmp/mazi-hosted-synthetic.json \
MAZI_TEST_HTTP_PHASE=verify \
.venv/bin/python -m unittest tests.backend.test_hosted_http
```

Passed: one test in 39.899 seconds. The existing cookie retained the same profile and completed introduction. The earlier original remained byte-identical; the paused upload retained its checkpoint, resumed, and completed through the independent worker. Provenance contained both contributions. Rendition and ZIP export read successfully. HTTP withdrawal of only the two test imports immediately denied the original; logout cleared the cookie and subsequent session access returned 403. The HTTP admin endpoint removed exactly two own synthetic profile memberships afterward (successful run and interrupted authoring attempt); unrelated profiles and runs are untouched. Private raw test bytes remain retained under the existing orphan-collection limitation.

## Test authoring correction

An initial preparation was interrupted after an incorrect test expectation used `AWAITING_CONFIRMATION` rather than the implemented `INVENTORIED` state. The expectation was corrected. That attempt left one synthetic profile and inventoried run under the `http-synthetic-` namespace; it did not change an existing user's archive. The parent was notified; its membership was subsequently removed through the scoped HTTP cleanup above.
