# Shared-code entry design

## Decision

Use Candidate A's additive shared_profiles table and existing user UUIDs, memberships, and hashed sessions. The independent reviewer scored A 23/25 and B 20/25. Parent review agrees that preserving the four-column users schema avoids needless migration risk. The two designs use the same model family and distinct prompts, not cross-family validation.

Keep one Store-owned shared-entry policy. Three domain operations enter or resume a profile, read the current shared session, and complete introduction. The browser state distinguishes loading, signed-out, onboarding, ready, and error. Model the Domain shapes this choice so entry and onboarding cannot drift across separate booleans.

## Grafts and corrections

- From B, update Discovery member labels as well as Imports and pin archive loading to the configured authenticated group.
- From B, test repeated migration/setup against an old four-column user table with existing ownership and grants.
- Use a 30-day persistent browser session, matching cookie and database expiry. Expiry returns to the same shared-code/name form and never creates a second existing profile.
- Enforce mapped, current shared membership in the inherited Handler.user method for every domain API when the unified app enables shared entry. A React gate alone is insufficient.
- Add direct login, welcome, About, circle, and search application paths while retaining hash navigation. Signed-out deep links and sample mode must show the entry screen.
- Shared-mode UI exposes no legacy email/password, group creation, or single-use invite controls. Legacy low-level APIs and Store methods remain available only to isolated legacy test harnesses when shared mode is disabled.
- Setup uses explicit legacy user/name bindings. New members never become administrators. Preserve removed names and do not restore withdrawn membership during resume.
- Make operator setup idempotent and recoverable across interruption. Prefer storing shared policy with the profile transaction in SQLite, with an explicit setup command that generates the code once and stores only its digest. This adapts A's separate config-file plan to remove a second persistence boundary.

## Alternatives rejected

Extending users couples local onboarding to existing account records and changes positional inserts. Replacing the schema or using names as primary keys risks archive ownership. Browser-only identity cannot satisfy resumption on another browser. No email or personal secret is introduced because the user explicitly selected the shared-code tradeoff.

## Implementation and proof

One worker owns application, test, and run-guide edits. Parent owns canonical decision records and evidence. Tests use temporary archives. First expose atomic normalized-name entry, stable legacy ownership, persistent session, denied unmapped sessions, and profile-scoped introduction in behavioral tests. Then implement against this shape. Run focused checks before committing, followed by backend and browser regressions. Prove It Works requires desktop and phone entry, fresh-browser resume, About, direct-route gating, logout/access-loss, and preserved archive workflows.

The unified application's PR merged while design work was in progress. The feature branch now starts at main merge 2a2f861, whose file content matches the investigated 120c16d. Baseline build passed. Baseline backend suite passed 141 tests with 2 existing skips. Document checker and whitespace checks passed.
