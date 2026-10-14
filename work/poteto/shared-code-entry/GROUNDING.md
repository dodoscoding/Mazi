# Shared-code entry grounding

## User decisions

The user requested implementation on 14 October 2026 after the idea interview. Anyone with the shared code can enter immediately. A name is unique after case folding and trimming. Existing names resume immediately without email, personal passwords, or approval. The owner accepts that code holders can use another person's profile. New profiles see an introduction once, then Atlas. Returning users go straight to Atlas. About makes the introduction available again. Keep all existing application pages.

## Current application

Base revision is 120c16d, codex/unified-atlas-app. The user's main checkout returned to ab42a0f after the investigation. Work continues in a managed isolated worktree based on the unified application, preserving unrelated files and archives.

mazi/identity/core.py stores SQLite users keyed by UUID with unique email and scrypt credentials, hashed sessions with a 24-hour lifetime, groups, members, and single-use invitations. Store methods own these rules. Existing domain code joins users and members and assumes this schema.

mazi/identity/server.py implements cookie handling and identity API routes. Higher domain servers compose through inheritance, and mazi/server.py serves the unified API. Trace actual ownership before choosing integration points.

src/App.tsx owns the React shell and signed-out Home. Hash routing lives in src/useRoute.ts. src/useArchive.ts loads groups and Atlas records. src/features/imports currently includes email/password registration and login, group creation, invitations, and import controls. Our circle uses the same feature module. Existing pages consume that identity and group context.

The canonical contracts describe single-use invites and identities that display names alone cannot establish. Record a new explicit decision replacing those entry semantics for this local application. Production milestone acceptance remains separate.

## Candidate task

Produce a compact design package with caller usage, data shape, signatures, module map, migration/configuration approach, tradeoffs, concrete tests, and rejected alternatives. Read the actual source. No implementation edits. Designs must be structurally distinct. Each candidate owns only its assigned Markdown file.

Candidate A explores an additive profile table tied to the existing user/member/session model. Candidate B explores extending the existing user model for shared-code profiles. Both must keep storage compatibility and preserve existing domain behavior.

## Selection rubric

Score each criterion 1 to 5 with source evidence: compatibility with existing archive identities and foreign keys; atomic name normalization/resume behavior; small domain API and clear auth/onboarding state; preserved authorization and no public content bypass; complete user flow with a practical operator setup and test plan.
