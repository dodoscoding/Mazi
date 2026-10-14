# Phase 5: People and local retrieval

Historical experiment record. The active application now runs with `python -m mazi`; source and test links below point to their consolidated locations. Original acceptance claims and evidence remain historical.

A local implementation of the M5 controls in [the roadmap](../../ROADMAP.md), extending the Phase 4 archive. It adds manual People, personal discovery hiding, subject disassociation and versioned text/visual retrieval. Face recognition and external AI providers are absent. This does not close M5 production acceptance.

## Run

Use the existing Python environment with [Phase 1 requirements](../../../mazi/requirements.txt):

```sh
.venv/bin/python -m mazi
```

This default starts the dependency-light concept/color baseline. For the learned model, use the installation below. Open http://127.0.0.1:8003/discover. Sign in through Imports, choose your group, and search. All existing import, review and places routes are available on this server. It uses `.mazi-imports` by default; set `MAZI_IMPORT_DATA_DIR` to choose a different local archive. Stop other servers before using the same archive. To keep the macOS companion's default port, set `MAZI_IMPORT_PORT=8002` and run only this server. Discord keeps the explicit operator allowlist and token requirements in the [Phase 4 guide](../sources/README.md).

Run the Phase 5 server for these controls: older standalone servers do not implement personal discovery filtering. Database triggers still invalidate derivatives on departure/withdrawal through older writers. The separate synthetic Atlas and legacy Phase 1 staging experiment are not this archive's UI.

## Install the local learned model

```sh
.venv/bin/python -m pip install -r mazi/discovery/requirements-clip.txt
.venv/bin/python -m mazi.discovery.download_model
MAZI_EMBEDDING_MODEL_DIR="$PWD/.models/clip-vit-base-patch32" .venv/bin/python -m mazi
```

The explicit installer downloads about 156 MB of public model/tokenizer files. It verifies the published checksums at pinned revision `d15189d7028b43f1d3e65039190477f6af591c2a`; model binaries stay in ignored `.models/`, outside Git and archive backups. The runtime only opens local files: it never downloads weights or sends archive media anywhere. A missing or invalid configured model produces a visible message and falls back to words/filters. It does not reuse another model's vectors.

In the UI, enable group processing as an administrator, enable processing of your contributions, select Local CLIP semantic search, then choose **Build local search index**. Every contributing member still needs to opt in. Indexing runs in small resumable batches and can be stopped. Inference releases the database write lock; before saving a vector the service rechecks membership, personal hiding, source fingerprints and the consent generation. Disabling then re-enabling consent during a batch cannot revive its old work. Search uses only matching cached learned vectors; not-yet-indexed photos retain keyword matching until you build the index.

The selected [ONNX conversion](https://huggingface.co/Xenova/clip-vit-base-patch32) is based on [CLIP ViT-B/32](https://huggingface.co/openai/clip-vit-base-patch32). It has 512-dimensional text and image representations. Our adapter performs local CPU inference, the pinned resize/crop/normalization, and bounded text windows (first 1,200 tokens from at most 48,000 characters). Ranking combines text and image similarity; it neither creates tags nor treats similarity as factual confidence. Image-to-image search uses the same image vectors. Object/concept filter fields remain explicit text-evidence filters.

Use English queries for this model. Its model card requires task-specific evaluation and describes limitations for other languages and fine details; it does not establish production suitability. Face identification and automated People tagging remain absent. The dependency-light baseline still supports its small English/Turkish vocabulary when no learned-model directory is configured. Tested runtime: Python 3.11, macOS 27 arm64; the selected macOS dependency wheels require macOS 14 or newer. Linux CI is configured but its remote result is not claimed here.

## People and visibility

Create a Person and explicitly confirm a tag on an accessible photograph. Person records are separate from accounts. People summaries show only currently visible associations, places and accepted archive memories. Empty records created by you remain available for manual tagging, but never become search matches just because they exist.

An administrator privately verifies an account/person mapping and requests confirmation in Identity review. The member must confirm it before subject controls apply; a verified mapping cannot be reassigned through this API. A subject can remove a tag made by someone else. The persisted suppression blocks contributors and retries from reinstating the same Person/asset relationship until the subject explicitly restores it. Exact duplicate reimports keep the asset identity and therefore the suppression. The system does not use face detection to identify aliases, edited copies or separately created Person records.

For nonmembers, an administrator must privately verify the subject and their request before recording removal or opt-back-in. The review records the action, not the private supporting evidence. Disputed verified account mappings need an operator-assisted identity investigation; this implementation deliberately cannot silently rebind them.

Hide photographs from your own gallery, search, Timeline, People, map, reviewed suggestions, renditions and archive export. Restore them from your personal controls. Hide accepted archive memories independently; this does not hide their photographs. Personal hiding is a discovery preference, not a revocation of direct original-file access or other members' access. Account departure removes tags and processing opt-in; subject suppression survives restart, backup and exact duplicate replay.

## Retrieval and processing

Words, date range, source, country, place, person and explicit text-concept filters work with optional processing off. Country comes from contributor-shared locations. Object/concept filters use text evidence; they do not claim image object detection.

Optional processing starts off at both group and contributor levels. An administrator enables the group purpose; every active contributor to an asset and its corrected text must opt in before that asset is embedded. Consent changes purge group vectors immediately. Withdrawals and departures invalidate vectors at the database boundary. Current membership, active origins and personal hiding are checked before ranking, counts or pagination. Search holds a short local SQLite transaction while reading and ranking; learned image inference happens in the separate small index batches. No provider request or cached answer can bypass the current read boundary.

The included `local-concepts-palette-v1` baseline uses 256-dimensional synonym-normalized text feature hashing and an 11-dimensional visual color histogram. It supports the small English/Turkish concept vocabulary in `embeddings.py`, color queries and similar-color image retrieval. It is not a learned general-purpose multimodal model and does not understand arbitrary scenes, faces or questions. Its UI names this limitation. The baseline requires no model download. Neither backend needs provider credentials or dispatches archive images externally.

Each vector records modality, model version, dimensions and a fingerprint of current source text/provenance. Changed input or version forces recomputation; incompatible vectors are not mixed. Baseline vectors are built lazily; learned vectors use the explicit index batches described above. Both are preserved in SQLite. Processing counters are internal operational measurements, not group search facets. Limits are 1,000 accessible photos, 200 Person records per group, 100 results per page and 200 characters per search field. First indexing costs more than warm search; this is not the 100,000-item production architecture.

## Operations and validation

```sh
.venv/bin/python -m unittest discover -s tests/backend/discovery -t . -v
.venv/bin/python -m mazi.discovery.evaluate
npm run test:discovery:browser
# After installing the optional model:
.venv/bin/python -m mazi.discovery.evaluate_clip
MAZI_EMBEDDING_MODEL_DIR="$PWD/.models/clip-vit-base-patch32" .venv/bin/python -m unittest discover -s tests/backend/discovery -t . -p test_clip_runtime.py -v
```

The fixed 100-query synthetic holdout is never read by the encoder. It covers a limited vocabulary across 120 candidates; denial checks are scored separately. Do not treat this author-created regression set as independent real-archive quality evidence. [Verification](VERIFICATION.md) records measured results, screenshots and remaining release gates.

Export adds `people.json` with currently discoverable links and `personal-discovery.json` with the requesting member's settings, hidden IDs and suppression controls. It does not export embedding vectors or other members' hiding preferences. The existing offline SQLite/object backup captures the additional tables and triggers; stop services before backup/restore as specified in [operations](../archive/OPERATIONS.md).

Production Next.js/PostgreSQL integration, independent representative in-domain evaluation of the learned encoder, supported-browser/physical-device checks and privacy review remain open. Recognition stays disabled until its separate consent, nonmember/minor handling, retention and deletion gates pass. M6 answers and summaries are not implemented here.
