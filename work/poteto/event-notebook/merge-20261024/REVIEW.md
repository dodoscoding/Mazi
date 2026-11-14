# Event notebook integration review

Reviewed the working merge of feature HEAD `3a532835c754d59e626cfb8b0a616328c4a8a525` and incoming main `2eccda3e207c08e7a705547fcb274a811b5d979e` on 24 October 2026. Scope covers the resolved Home and MemoryView conflicts, App and route integration, and notebook lifecycle alignment with D24. This is an independent review using the same model family as the implementation agent.

## Findings

No actionable correctness, regression, security, or validation findings within the integration scope.

- `src/Home.tsx:919` preserves main's replacement navigation for the portal's opened memory. The adjacent notebook link also replaces that portal entry, so Back returns past the portal. Main's PlaceForm, UnplacedTray, and placement callback remain present.
- `src/MemoryView.tsx:1` combines the notebook hooks with main's MouseEvent import and Back handling. `src/App.tsx:46` retains placed memories while forwarding the archive group and notebook route flag to MemoryView. `src/useRoute.ts:33` retains the notebook query flag alongside main's history tracking.
- `src/memory/EventNotebook.tsx:80` now retains loaded notes, drafts, and pending requests through visibility and page-cache events, matching `docs/DECISIONS.md:124`. Its access-loss listener and unmount cleanup still abort requests and advance the generation. Reads and saves check that generation before applying results.
- `src/useEntry.ts:118` quietly revalidates on foreground return and persisted pageshow. Session denial unmounts the authenticated screen through `src/App.tsx:186`. Identity or circle changes dispatch access loss. Transient failures retain the ready screen.

## Independent verification

- `node --test tests/dom/route-history.test.mjs tests/dom/entry-hook.test.mjs` passed all 7 tests. These cover background retention, transient failure, denied access, changed identity/circle, selected-circle retention, direct-link Back, photo replacement, and feature hash-link history.
- `git ls-files -u` returned no entries.
- A tracked-text scan found no conflict start/end markers. Source, test, and documentation scans found no separator markers; historical test-output separators were excluded from interpretation as conflicts.
- `git diff --check` and `git diff --cached --check` passed.

Reviewed the new notebook retention and session-401/403 browser contracts. The coordinator owns their execution and the broader browser, backend, build, and DOM/unit checks. No shared browser harness was launched for this review. Synthetic verification does not establish production milestone acceptance. Application files were not edited.

## Follow-up test review

The single `page.reload()` addition at `tests/unified.spec.ts:315` preserves the delayed-response logout contract. Main now retains the circle's loaded Atlas across route changes, so returning Home alone does not initiate the request the test holds. Reload creates a fresh application instance and Atlas read. The existing handler still captures a real authenticated server response before logout, gates delivery until after logout, and asserts that private memory controls and authenticated navigation do not reappear. No production behavior changed. No actionable finding. This follow-up was reviewed statically; no runtime tests were launched.
