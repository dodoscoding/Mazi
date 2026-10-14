# Candidate A. Additive shared-entry profiles

## Problem

Give code holders one name-based entry flow without changing archive identity keys or membership checks. Existing users have required unique emails and scrypt credentials; sessions, ownership, recipients and groups reference their UUIDs (`mazi/identity/core.py:31-107`). Names become a shared-code alias for those accounts. They do not establish unique humans. Impersonation by any code holder is an accepted product decision.

## Usage. Caller's view

The visitor enters a shared code and name. ` Alice ` and `ALICE` resume the same profile in any browser. New profiles see the introduction and click Continue to Atlas. Completion persists per profile. About opens the same introduction after completion. Every existing page remains behind the shell's session gate.

```python
# Identity HTTP handler. Store owns normalization, membership and atomic creation.
grant = store.enter_shared(code=body["code"], name=body["name"])
self.json(200, grant.profile.public_view(), cookie=session_cookie(grant.token))

# Session endpoint. No client code or group configuration is required.
profile = store.shared_session(self.token())
self.json(200, profile.public_view())

# Continue button. Only the current profile can complete its introduction.
store.complete_introduction(self.token())
self.json(200, {"ok": True})
```

```tsx
const entry = useEntry();
if (entry.status !== "ready") return <EntryGate entry={entry} />;
if (!entry.profile.introduced) return <Introduction onContinue={entry.complete} />;
return route.path === "/about" ? <Introduction /> : <ExistingArchiveShell />;
```

## Shape

One additive table keeps `users`, `members`, `sessions` and all domain foreign keys intact.

```sql
CREATE TABLE IF NOT EXISTS shared_profiles (
 user_id TEXT PRIMARY KEY REFERENCES users(id),
 name_key TEXT NOT NULL UNIQUE,
 display_name TEXT NOT NULL,
 introduced_at INTEGER
);
```

The configured shared entry has one target group. Name uniqueness is global within this app, independent of future group choices. Python computes `name.strip().casefold()` once. SQLite's ASCII-only NOCASE is insufficient. Preserve the first trimmed spelling. Reject nonstrings, empty names, control characters and names longer than 80 characters. Internal whitespace stays significant. Do not silently add accent or compatibility folding.

```python
@dataclass(frozen=True)
class SharedEntryConfig:
    code_digest: bytes
    group_id: str
    session_seconds: int = 60 * 60 * 24 * 365

@dataclass(frozen=True)
class Profile:
    user_id: str
    display_name: str
    group_id: str
    introduced: bool

@dataclass(frozen=True)
class EntryGrant:
    profile: Profile
    token: str

def enter_shared(self, *, code: str, name: str) -> EntryGrant:
    raise NotImplementedError
def shared_session(self, token: str | None) -> Profile:
    raise NotImplementedError
def complete_introduction(self, token: str) -> None:
    raise NotImplementedError
```

`enter_shared` hides code verification, canonical name lookup, backing account allocation, membership and token issuance. Validate HTTP values inside this boundary. Compare the configured SHA-256 digest with `hmac.compare_digest`. The code itself is exact and case-sensitive. Never expose the digest through APIs or bundles.

Creation and lookup run in one SQLite write transaction (`BEGIN IMMEDIATE`) with rollback on failure. Insert a new backing UUID user, profile, member and hashed session together. Retry UUID/technical-email collisions without claiming this proves human uniqueness. A competing connection waits, then reads the unique existing name. If sharing one connection between threads, guard the whole transaction; existing HTTPServer is single-threaded (`mazi/server.py`). Do not call `register` or `create_group` inside this transaction because their separate transaction scopes could commit partial entry.

New backing accounts receive `shared.<uuid>@profiles.invalid`, a random salt and an unguessable random scrypt credential. These satisfy the unchanged schema and cannot be entered through the shared-entry UI. Never put these technical emails in browser responses. `/api/members` adds `display_name` and omits technical email for shared profiles; retain real legacy `email` for unchanged legacy clients. Imports renders `member.display_name || member.email`. Do not overwrite old email credentials or account IDs.

Resume requires that the existing profile is still a member of the configured group. Removal must stay effective. Never silently reinsert removed membership or elevate a role on resume. New names get member role. Admin assignment is an operator action. Existing domain methods continue to authorize through `_member`; archive ownership and selected recipients remain keyed by user UUID.

Session cookie and database expiry share the 365-day lifetime. Keep HttpOnly, SameSite=Strict and Path=/; add Secure for HTTPS. Logout deletes only that browser token. `complete_introduction` uses `COALESCE(introduced_at, now)` and is idempotent. Returning before clicking Continue still shows the introduction. About does not reset completion.

## Module map

- `mazi/identity/core.py` owns the additive schema and the three entry operations. No second identity repository or forwarding service is needed.
- `mazi/identity/server.py` adapts `/api/entry`, `/api/session` and `/api/introduction/complete`. Existing origin, JSON, size and error handling applies. In configured unified shared-entry mode, deny register/login/invite acceptance entry routes. Legacy standalone domain harnesses retain their default behavior.
- `mazi/server.py` loads validated server-only entry configuration and adds `/about` to direct app paths. Pass configuration once to the store; inherited handlers reach the identity handler without a separate auth chain.
- `src/useEntry.ts` owns session refresh, entry, completion and logout. Its discriminated state is loading, signed-out, ready or error. Abort/generation handling clears identity changes and stale private responses.
- `src/App.tsx` places the entry gate before feature selection and archive loading. Replace the signed-out welcome with code/name entry. Add About and shell sign-out. Preserve all existing feature registrations and routes.
- `src/useArchive.ts` loads only after the session gate is ready. Remove unauthenticated `?demo=1` sample mode and its sample link from the unified app. Public synthetic assets may remain; they confer no archive API access.
- `src/features/imports/{template.html,mount.js}` removes email/password forms and their event handlers, rather than hiding them. Keep authenticated import and member controls. Remove single-use join/invite UI in shared-entry mode and retain circle administration where applicable.

## Migration and concrete operator setup

Add an idempotent `python -m mazi.identity.setup_shared --root <synthetic-or-operator-selected-root> --admin-name <name> [--group-id UUID] [--map-name NAME=USER_UUID]` command. It reads database identities only when explicitly invoked on that root. Never run it against personal `.mazi-imports` during development or verification.

The command generates a random shared code and writes its digest and group ID to a 0600 server config beside the database. Show the generated code once for the operator to share. Require no pasted secret. Existing config is retained unless an explicit rotate flag is supplied. Startup fails closed with a precise setup command if config is missing; it never falls back to publicly entering or choosing the first existing group.

For a fresh archive, setup creates a configured admin profile/backing user and its group atomically. The admin's first entry still sees the introduction. For an existing group, require a UUID mapping for an existing admin name, verify admin membership, and preserve its user ID and role. Additional explicit name-to-UUID mappings require membership and unique normalized names. Never infer mappings from email prefixes or modify archive ownership. Unmapped legacy users remain intact; their existing credentials continue to work in legacy harnesses. In the unified mode, an unmapped old session returns entry-required until mapped or replaced by shared-code entry.

Record the superseding local entry decision in `docs/DECISIONS.md` and update applicable identity/UI contracts. Preserve production invitation and identity assurance limits as a separate planning boundary.

## Tests and acceptance evidence

- Store contracts use temporary synthetic roots. New name creates one user/member/profile; trimmed casefolded repeat in a fresh store connection returns the same UUID. Unicode casefold example `Straße`/`STRASSE` resumes. Empty/control/overlong input and wrong code leave no rows.
- Two separate SQLite connections enter the same normalized name concurrently. Both receive valid distinct session tokens for one profile. Inject session insertion failure and assert no partial account/member/profile creation.
- Existing fixture account mapping retains owner UUID, grants, membership role and credentials. Collision fails atomically. Removed membership denies resume and token use for group data; entry never restores it.
- HTTP tests assert persistent cookie attributes, matching server expiry, restart persistence, logout revocation, expiry, JSON/origin enforcement and code/digest/technical-email absence in responses. Deny unmapped legacy session at shared session gate.
- Playwright desktop and phone test new introduction, completion across fresh browser contexts, returning Atlas, About replay, sign-out and error recovery. Direct `/about`, `/imports`, `/circle`, hash routes and `?demo=1` show only entry when signed out. No email/password controls remain in the DOM.
- Preserve import, archive, review, places, discovery, answers and memories flows after shared entry. Preserve delayed-response rejection on profile changes and membership loss from `tests/unified.spec.ts` and existing feature lifecycle.
- Run focused identity/HTTP tests, `npm run build`, unified browser contracts, domain backend/browser regressions, document checker and `git diff --check`. Source inspection here is design evidence only; no runtime acceptance is claimed.

## Tradeoffs accepted

- Accept a backing technical email in storage in exchange for zero schema break across existing domain joins. Its presentation requires a deliberate boundary change.
- Accept that a code holder can resume any mapped name, including admin, in exchange for the explicitly requested frictionless entry. Role checks protect against role elevation, not accepted identity impersonation.
- Accept a one-year bearer session in exchange for persistent browser return. Code rotation changes future entry; revoke existing sessions explicitly if immediate cutoff is intended.

## Alternatives considered

- Extend `users` with profile fields. This avoids a join but couples entry/onboarding policy to the durable archive account and changes every identity row's meaning. The additive table confines shared-entry state and makes explicit legacy mappings reversible.
- Use the name itself as the user ID. This simplifies lookup but breaks durable ownership references and makes rename/case collisions identity migrations.
- Issue an anonymous group session without a profile. This hides account allocation but exposes attribution and onboarding state to every domain caller and cannot resume owner-specific imports across browsers.

## Synthesis decision and risks

Candidate only. Parent arena chooses the base. No unresolved product preference is required. Check that group membership revocation remains authoritative, hidden feature forms are deleted, and every unified mode API requiring identity enforces mapped shared session state. Inspect domain export paths for technical-email leakage before implementation acceptance.

## Next implementation step

Write focused synthetic store/HTTP contracts for atomic normalized-name entry and stable mapped legacy ownership, then implement the additive table and setup command.
