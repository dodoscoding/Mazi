# Learned browser acceptance diagnosis

## Grounding

The browser fixture provides solid red, blue and green JPEGs with unrelated Bicycle, Dinner and Garden captions. The real CLIP encoder resizes and normalizes pixels from its verified pinned preprocessing config. Its score combines 35 percent text similarity and 65 percent image similarity, intentionally retaining both evidence sources. Learned indexing saves separate text and image vectors only after current authorization, consent generation and evidence fingerprint rechecks. Search validates those cached vectors before scoring.

## Reproduction and hypotheses

The dedicated native browser command uses `MAZI_DOMAIN_PORT_BASE=19020` to avoid root's acceptance ports and only `tests/browser/discovery-learned.spec.ts`. It reproduces the asserted red-pixel winner losing to Dinner.

The minimized `probe.py` runs the pinned real encoder over the same JPEGs and captions. Image-only red similarity is 0.292692, above blue at 0.240765. Text similarity is 0.492224 for Bicycle and 0.620499 for Dinner. The documented combination ranks Dinner at 0.373672 above Bicycle at 0.362528. Nearby red prompts preserve the same disagreement. A real lake scene has image-only similarity 0.326365 for a dock/lake prompt, above birthday at 0.163274 and harbor at 0.211252.

The ranked hypotheses were preprocessing failure, fusion of conflicting caption/pixel evidence, unstable shared-server state and an unsuitable semantic fixture. Image-only scores refute preprocessing failure. The direct deterministic loop rules out browser state as the cause. Fusion explains the exact observed winner. The browser assertion does not encode the product's combined-evidence contract.

## Designs

A keeps the production fusion contract and gives learned browser acceptance real synthetic demo scenes with neutral metadata. A query without lexical matches must retrieve its intended image scene. The same native test still checks explicit indexing, no unindexed rows, consent withdrawal and literal keyword fallback. Baseline color tests retain their fixture.

B changes fusion weights or adds an image-only mode so the solid-color fixture wins. That changes product ranking and needs representative evaluation, interface decisions and separate acceptance. A single contradictory-caption fixture does not justify it.

Candidate A is preferred and sent to root before implementation. No product behavior change is proposed.

## Implemented contract

Root approved A. `discovery_learned_fixture.py` provides the existing generated lake, birthday and harbor scenes as JPEGs with neutral Archive item titles and photo-number filenames. No title or place describes the query. The browser first proves the dock/lake query has zero Words & filters results, then explicitly indexes the real model and requires Archive item one, the lake scene, to rank first. It still checks 0 remaining, the Local CLIP label, accessibility, disappearance after contributor consent withdrawal, literal filename fallback and group processing controls.

The browser resets processing through public APIs before each case and in finally cleanup. The original desktop failure left vectors and consent enabled, which caused the phone case to fail its initial empty-index expectation instead of reproducing the original ranking failure. Cleanup now isolates both projects even after an assertion fails.

No application/model code, fusion weights, model version, stored-vector contract or browser configuration changed. With the model variable absent, the original red/blue/green baseline fixture and captions remain unchanged. Root owns its separate baseline run and updates to `discovery.spec.ts`.

## Exact verification

Environment used `/tmp/mazi-acceptance-venv/bin/python` with the verified pinned model at `/Users/altanesmer/Desktop/Ales/Mazi/.models/clip-vit-base-patch32`. Inference used the real CPU ONNX sessions. No model doubles or network inference were used.

The initial focused invocation timed out waiting for webServer because this worktree had no dist directory. `npm run build` passed and produced its own local dist. The repeated original-spec command then reproduced the real desktop Dinner-first failure; phone failed its stale shared-index precondition as explained above.

Failing-before and passing-after browser commands used the same selector and independent ports. Only the output folder changed:

```sh
MAZI_PYTHON=/tmp/mazi-acceptance-venv/bin/python \
MAZI_EMBEDDING_MODEL_DIR=/Users/altanesmer/Desktop/Ales/Mazi/.models/clip-vit-base-patch32 \
MAZI_DOMAIN_PORT_BASE=19020 \
MAZI_BROWSER_RESULTS_DIR=/tmp/mazi-learned-capacity-green \
node node_modules/@playwright/test/cli.js test \
  --config tests/browser/playwright.config.ts tests/browser/discovery-learned.spec.ts
```

Both native Chromium projects passed in 9.7 seconds, desktop in 1.5 seconds and Pixel 7 emulation in 2.0 seconds. Axe found no violations in either case. The screenshots are [desktop](evidence/learned-desktop.png) and [phone](evidence/learned-phone.png).

This is explicitly a focused learned-spec invocation. The browser config also matches `discovery.spec.ts`, which encodes baseline color/caption behavior. Running the entire domain suite with the model environment set mixes incompatible fixture contracts and is not claimed as acceptance. Run the baseline suite with the model variable absent. No full suite was run by this worker.

The minimized diagnostic is reproducible with:

```sh
MAZI_EMBEDDING_MODEL_DIR=/Users/altanesmer/Desktop/Ales/Mazi/.models/clip-vit-base-patch32 \
PYTHONPATH=. /tmp/mazi-acceptance-venv/bin/python \
  work/poteto/learned-browser-acceptance/probe.py
```

[PROBE.json](PROBE.json) records the model version, component cosines, combined scores and both source/JPEG fixture hashes. The neutral real-image fixture ranks lake at 0.388057, harbor at 0.310444 and birthday at 0.277841. The script asserts image-only red recognition while reproducing the old combined-score disagreement. This receipt separates preprocessing from fusion rather than changing the expected first result to whichever image happened to win.

Nearby real-model verification also passed:

```sh
MAZI_EMBEDDING_MODEL_DIR=/Users/altanesmer/Desktop/Ales/Mazi/.models/clip-vit-base-patch32 \
/tmp/mazi-acceptance-venv/bin/python -m unittest tests.backend.discovery.test_clip_runtime
```

Its two tests passed in 0.726 seconds, including cross-modal ranking with network connections forbidden and finite deterministic long-text windows. `git diff --check` passed. The generated demo scene smoke set is not an independent representative personal-archive evaluation or a claim that all caption/pixel conflicts rank intuitively.
