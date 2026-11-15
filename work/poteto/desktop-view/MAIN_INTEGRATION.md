# Desktop continuity integration into main

PR #160 merged into `codex/remaining-acceptance` at `8185610`, leaving its additional access checks outside `main`. This integration merges that history into `e8e9bc9` and preserves the newer simplified navigation, split group and Atlas loading, archive invalidation, and photo evidence projection.

## Conflict resolution

Keep the current product decisions and deployment contracts from main. Retain sign-in mutations during quiet revalidation, treat denied session responses before parsing their bodies, clear identity state after access loss, and stop queued feature mounts after access loss. Validate group and Globe access quietly on foreground return. Abort quiet validation when archive invalidation occurs so a stale response cannot restore removed photographs.

The imported VERIFICATION.md and screenshots describe PR #160 on its original base. Current browser coverage uses Photos and entry screens in place of retired Timeline and Ask screens. New hook tests use current photo fixtures and preserve main's page lifecycle contract.

## Verification

Local synthetic verification on Node 24.15.0 includes build, DOM tests, unit tests, desktop and phone visibility tests, focused formatting, document checks, bundle budgets, and whitespace checks. The new archive invalidation regression passes. Independent review runs before landing. Hosted GitHub Actions availability and production checks are reported separately at release.

No database migration, archive format change, or new dependency is required. Native macOS desktop switching remains outside the synthetic visibility-event evidence.
