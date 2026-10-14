# Unified app verification

Status: verified locally on 14 October 2026. Branch `codex/unified-atlas-app`, based on `ab42a0f`. Changes remain uncommitted. Tests use synthetic fixtures and temporary data directories. No deployment or production acceptance is claimed.

## Result

One Atlas app now provides imports and membership, archive review, places and source controls, people and discovery, evidence answers, recaps, collaborative stories, ordered sub-events, manual slideshows, AVI exports, sealed capsules and opt-in in-app notices. Atlas and Timeline read authorized archive cards. Sample memories require explicit `?demo=1` mode.

The frontend lives in `src/`, including scoped feature modules. The backend lives in domain-named `mazi/` packages with one entry point. Numbered runtime directories are retired. Historical documentation/evidence moved to `docs/history`. The macOS source companion moved to `tools/apple-photos`.

## Checks

| Check | Result | Evidence |
| --- | --- | --- |
| Original Phase 7 baseline | 13 tests passed before relocation. | Baseline command recorded in the task; `.venv/bin/python -m unittest discover -s phase7/tests`. |
| Backend regression | 141 tests run, 139 passed, 2 optional learned-runtime checks skipped. | [backend-tests.txt](backend-tests.txt) |
| Atlas desktop and phone browser regression | 20 passed, including keyboard navigation, renderer failure, image recovery, reduced motion and idle rendering. | [atlas-browser-tests.txt](atlas-browser-tests.txt) |
| Domain desktop and phone browser regression | 14 passed, 2 optional learned-model cases skipped. | [domain-browser-tests.txt](domain-browser-tests.txt) |
| Integrated desktop and phone journeys | 6 passed, including import-to-Atlas, stories/downloads/capsules, repeated mounts, delayed response races and access-loss cleanup. | [browser verification](browser-verification.md), [result JSON](browser-results.json) |
| Existing stored data | Original baseline creates a populated archive; the current app reopens matching sessions, membership, IDs, original bytes, corrections, stories, hiding and capsules. | [replay script](verify_previous_storage.py), [result](storage-compatibility.json) |
| Development origin and built launcher | Actual Vite proxy preserves valid login routing and rejects forged Origin. Built app serves route aliases, rejects an occupied port and releases its socket on SIGINT. | [launcher result](launcher-verification.json), [independent review](implementation-review.md) |
| Build, formatting and docs | TypeScript/Vite build, Prettier, document checker and whitespace check pass. Document checker covers 16 authored documents and 163 links. | `npm run build`, `npm run lint`, `npm run check:docs`, `git diff --check`. |
| Native companion | macOS companion builds and signs after relocation; app URL is configurable and defaults to the public 5173 URL. | `sh tools/apple-photos/build.sh`. |
| Evaluators | Existing local retrieval and answer evaluators pass after relocation. | `.venv/bin/python -m mazi.discovery.evaluate`, `.venv/bin/python -m mazi.answers.evaluate`. |

Desktop and phone screenshots show the actual unified Memories screen: [desktop](browser-desktop.png), [phone](browser-phone.png). Phone checks use emulation, not physical hardware.

## Review and corrections

Independent review used `gpt-6.1-sol` with high reasoning from the same model family. It found a retained private capsule draft after access denial and supporting-record state from a previous circle. Both were fixed and independently reproduced again. Feature denial now disposes requests, DOM, private inputs and owned media URLs. Evidence reads require the selected circle. Regression tests cover both and delayed authorized Atlas bodies after circle/session changes.

The review also corrected CI command references, optional model requirement paths, the companion URL, and sample-only Timeline wording. The scoped comment audit is closed. See [the full review and resolution](implementation-review.md).

## Limits

The app preserves the local engine's feature and format limits. Video exports remain silent MJPEG AVI, notifications are in-app, and people associations are manual. Optional CLIP model/runtime tests were skipped locally because the model runtime is not installed. The migrated imperative feature workflows remain JavaScript; the shared lifecycle and Atlas integration are typed TypeScript. Production hosting/authentication, representative exporter fixtures and physical device acceptance remain outside this consolidation. Remote CI was updated but not run here.

The Three bundle still produces the existing build size warning. Backend tests pass with Python ResourceWarnings from test database cleanup; launcher shutdown and storage behavior were verified separately. Ordinary startup preserves `.mazi-imports` and does not seed it or combine it with the historical `.mazi-pilot` directory.

## Decision trail

[Plan](plan.md), [design brief](design-brief.md), [decision trail](decisions.tsv), [backend inventory](backend-map.md), and [frontend inventory](frontend-map.md) record scope and alternatives. Original module names in investigation prose identify the pre-migration source. Model the Domain drove domain ownership; Prove It Works drove the integrated browser, old-storage and launcher checks.
