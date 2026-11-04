# Atlas projection peak memory correction

## Red contract and diagnosis

Base `27b51d`; Python 3.11.15. Existing end-to-end regression command:

```
/tmp/mazi-social-regression-311/bin/python -m unittest tests.backend.test_atlas_projection.AtlasProjectionTests.test_shared_large_contexts_do_not_accumulate_for_grouped_or_hidden_memories -v
```

Failed at 5,325,513 bytes against the unchanged 4,194,304-byte cap. The fixture has 1,000 photographs grouped into ten memories, repeated 16 KiB contexts and a second fully hidden read. It checks exact grouped message deduplication and empty hidden response.

A temporary tracemalloc probe around response encoding measured 1,460,319 current bytes / 2,349,463 peak before serialization and 5,341,771 peak after `json.dumps`, for a 683,860-character response. The largest live allocation sites were legitimate per-photo date/evidence dictionaries. This falsifies the initial raw-context-retention hypothesis: the additional peak occurs while the default JSON encoder retains its fragment list and joined string. The output must remain byte-for-byte compatible, with no cap increase or loss of evidence.
