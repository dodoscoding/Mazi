# Atlas projection peak memory correction

## Red contract and diagnosis

Base `27b51d`; Python 3.11.15. Existing end-to-end regression command:

```
/tmp/mazi-social-regression-311/bin/python -m unittest tests.backend.test_atlas_projection.AtlasProjectionTests.test_shared_large_contexts_do_not_accumulate_for_grouped_or_hidden_memories -v
```

Failed at 5,325,513 bytes against the unchanged 4,194,304-byte cap. The fixture has 1,000 photographs grouped into ten memories, repeated 16 KiB contexts and a second fully hidden read. It checks exact grouped message deduplication and empty hidden response.

A temporary tracemalloc probe around response encoding measured 1,460,319 current bytes / 2,349,463 peak before serialization and 5,341,771 peak after `json.dumps`, for a 683,860-character response. The largest live allocation sites were legitimate per-photo date/evidence dictionaries. This falsifies the initial raw-context-retention hypothesis: the additional peak occurs while the default JSON encoder retains its fragment list and joined string. The output must remain byte-for-byte compatible, with no cap increase or loss of evidence.

## Correction and verification

`98dc611` changes only the shared handler's JSON encoding: encode each default `JSONEncoder.iterencode` fragment into a `BytesIO` buffer, then call the unchanged `send` with the completed bytes. This avoids retaining the JSON encoder's full fragment list and joined Unicode response. It does not stream a partial response onto the socket. Header generation, Content-Length, Cache-Control, cookies, error status handling, bridge response limits and WSGI abandonment behavior are unchanged. Source projection/evidence and all limits are untouched.

The same real HTTP memory regression on Python 3.11 measured 2,833,396 bytes for grouped memories and 893,952 bytes when hidden, against the unchanged 4,194,304-byte cap. Its existing exact content assertions remain intact. Temporary probes lived in `/tmp`; no instrumentation was added to application code.

Verification from this worktree:

- Python 3.11.15 and Python 3.14: `-m unittest tests.backend.test_atlas tests.backend.test_atlas_projection tests.backend.test_atlas_place tests.backend.discovery.test_shared_by`: 60 passed on each interpreter, including A1 evidence, A2 chronology/place and the actual HTTP peak contract.
- Python 3.11: `-m unittest tests.backend.test_json_response tests.backend.test_server tests.backend.test_vercel_bridge tests.backend.test_capacity_http tests.backend.social.test_comments_http tests.backend.social.test_reactions_http tests.backend.social.test_labels_http tests.backend.social.test_plans_http`: 41 passed before adding the second JSON encoding-failure test; both JSON tests then passed separately.
- Python 3.14: `-m unittest tests.backend.test_json_response tests.backend.test_server tests.backend.test_vercel_bridge tests.backend.test_capacity_http`: 32 passed before adding that second JSON test.
- Exact JSON bytes/order/Unicode escaping and cookie forwarding are asserted against `json.dumps(value).encode()`. Encoding failure cannot call `send`, so no partial headers/body are emitted.
- Full branch whitespace and document structure checks passed.

This is a narrow prerequisite from main `27b51d`; the H1 branch was not modified. H1 selected-source budgets remain separate and unchanged. No schema changes, production data, personal archives, network service writes or deployment were involved.
