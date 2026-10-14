# Phase 3 local verification

Historical experiment record. The active application now runs with `python -m mazi`; source and test links below point to their consolidated locations. Original acceptance claims and evidence remain historical.

Implementation date: 6 October 2026. The working-tree implementation extends the Phase 2 local import engine; it is not a production release candidate. Tests use synthetic images and archive records. No personal archive, hosted service, product-owner signoff or invite-only launch was used.

| Check | Result | Limit |
| --- | --- | --- |
| Phase 3 Python suite | 9 passing checks covering access, source removal, member departure, correction, conflicting dates, suggestions, merge/split, export and offline restore. | Local SQLite and files only. |
| Phase 2 regression suite | 26 passing adapter, engine and HTTP checks. | Synthetic fixtures. |
| Phase 3 browser journey | 2 passing journeys, desktop Chromium and Pixel 7 emulation: import, correction, merge/split, ZIP export and withdrawal. | Emulation is not physical Android or Firefox. |
| Accessibility scan | No axe violations in the tested review state on either layout. | Screen-reader and keyboard acceptance not completed. |
| Type and document checks | TypeScript check and planning document structure check pass. | Phase 3 Python/JS is outside the Vite application build. |

Commands from the repository root:

```sh
.venv/bin/python -m unittest discover -s phase3/tests -v
.venv/bin/python -m unittest discover -s phase2/tests -v
MAZI_PYTHON="$PWD/.venv/bin/python" npm run test:archive:browser
npm run typecheck
npm run check:docs
git diff --check
```

Local T05 evidence includes recompressed near-duplicate suggestion, a dissimilar-color negative case, explicit merge, split and original-preserving rendition selection. T06 evidence includes reviewed exact-date correction and unresolved conflicting source dates. T09 evidence includes immediate denied reads after withdrawal, member departure, independent contribution survival, export omission and a backup taken after withdrawal restoring the withdrawn state. T10 evidence includes reviewed event acceptance, rejection/undo mechanics and approved On This Day behavior. T08 has only the tested browser and automated accessibility slice. The local health and administrator metrics endpoints are smoke checks, not hosted alerts. These are not production acceptance results.

The production release requires provider integration, physical-device and Firefox checks, scale and cost runs, consented archive fixtures, held-out suggestion evaluation, retention purge and tombstone replay, hosted backup/restore and rollback drills, incident ownership, privacy/legal review where needed, and product-owner approval. None is marked complete by this record.
