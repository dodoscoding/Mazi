# Storage implementation evidence

Recorded 14 October 2026. The implementation is `mazi/storage.py`; focused contracts are `tests/backend/test_storage.py`.

## Behavior and boundaries

The six existing areas preserve local file keys. Hosted objects store immutable chunks capped at 4 MiB, each verified against remote bytes before a durable database receipt. The domain caller must serialize and commit receipt changes in the same transaction as its received offset. Replayed ranges can span receipt boundaries. A failed database transaction can leave remote objects, but cannot leave an acknowledged receipt. `unreferenced()` reports those objects without deleting them while another transaction could be uploading.

Reset assigns a new generation and queues previous receipts for deletion. Remove denies subsequent reads through a tombstone. `retry_deletions()` retries durable entries after the tombstone transaction commits. It must never run inside a domain transaction that may roll back. Temporary hosted parser files use a private directory and mode 0600 and are removed on context exit. Downloads stay backend-proxied; no signed/public URL is generated.

Recovery can enumerate all raw remote keys with `objects.remote.list()` and export/import with `get(key)` and immutable verified `put(key,data)`. Enumeration recursively visits every folder and paginates in batches of 100. Logical enumeration with `objects.list(area)` includes accepted partial transfers.

## Verification

The first focused test run failed because `mazi.storage` did not exist. After implementation, `.venv/bin/python -m unittest tests.backend.test_storage` passed nine tests in 0.008 seconds. Fixtures are synthetic in-memory SQLite receipts and a fake remote transport. Cases cover failed remote upload, database rollback after remote upload, replay spanning chunk boundaries, a fresh objects instance, private temporary cleanup, generation reset, failed deletion and later retry, corrupted remote bytes, missing receipt ranges, immutable conflicts, chunk-size limits local path traversal denial, API header contracts and recursive enumeration beyond 100 objects. `git diff --check` passed at this boundary.

## Hosted API checks

Initial probes used an incorrectly retrieved 15-character prefix of the modern secret. Their rejected requests do not indicate endpoint incompatibility. No objects were created by those probes. The coordinator corrected credential retrieval, and apikey-only remote enumeration succeeded with the complete modern secret.

The current [API key documentation](https://supabase.com/docs/guides/getting-started/api-keys) says modern secrets belong in `apikey`, and are not JWT bearer tokens. The implementation follows that rule. An explicit server-only `MAZI_SUPABASE_STORAGE_KEY` override remains available for legacy installations; it is not needed by this project. Legacy JWT credentials send both `apikey` and Bearer; modern secrets remain apikey-only.

The [current changelog](https://supabase.com/changelog.md) was fetched and the 12 October CBC TLS removal item inspected. Standard `urllib` TLS verification remains enabled; no custom insecure SSL context is used.

## Follow-up durability checks

Local retain now writes a mode-0600 temporary file, flushes and fsyncs bytes, atomically installs using a hard link without overwriting an existing object, verifies collisions, fsyncs the directory and removes the temporary file. An injected fsync interruption before installation leaves no final file and a subsequent retry succeeds.

Physical deletion and receipt cleanup now run within the same database transaction and its shared advisory lock. This makes deletion wait for a held recovery snapshot boundary. Failure rolls back metadata and preserves the durable queue.

`.venv/bin/python -m unittest tests.backend.test_storage` passed ten contracts in 0.009 seconds after these changes.

A live hosted experiment with the complete modern secret passed against `elgwhwkqutmmbdjthubl`. It used a random `archives/storage-proof-<uuid>` logical key and actual PostgreSQL receipt transactions. It accepted two chunks, replayed a range spanning both, denied a conflicting retry, reopened a separate connection, reconstructed bytes through a private 0600 temporary file, retained an immutable duplicate, reset the generation and read the replacement bytes. Remove and retry deleted all three remote chunk keys; the test removed only its own receipts and metadata. A second random `source-resources/storage-integrity-<uuid>` fixture changed only its own receipt checksum and confirmed the real remote read was denied. Its single object and metadata were then removed. Credentials were not printed. The live commands completed successfully in approximately 25 seconds and 5.1 seconds respectively.
