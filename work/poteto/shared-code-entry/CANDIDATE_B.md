# Candidate B. Profiles are users

## Usage

A visitor enters the shared code and a name. The server creates that named user or resumes the existing user. First entry shows the introduction. Completing it opens Atlas. Later entry from any browser opens Atlas. About reopens the introduction without resetting completion. All existing pages remain behind the same entry gate.

```ts
const session = await enterArchive({ code, name });
setSession(session);
navigate(session.profile.introduced ? "/" : "/about");

const session = await readSession(); // Cookie only, including after reload.
if (session.kind === "signed-out") renderEntry();
else renderPrivateShell(session); // Gate before FeaturePage or sample data.

await completeIntroduction(); // Server owns persistent completion.
navigate("/");
```

```py
entry = store.enter_shared(code, name, policy)
handler.set_session_cookie(entry.token, policy.session_seconds)
return entry.session
```

## Problem and source constraints

At base `120c16d`, `mazi/identity/core.py` owns users, hashed sessions, groups and members. Every archive owner and selected recipient is a user UUID. `members_for` joins users directly. Extending users avoids another identity join while preserving those references. `register` currently inserts four positional values, so adding columns requires an explicit column list in that method.

The HTTP chain from `mazi/server.py` through `mazi/memories/server.py` eventually reaches `mazi/identity/server.py`. Add identity endpoints at that leaf, not a second auth wrapper. `src/useArchive.ts` currently probes groups to discover sign-in. `src/App.tsx` renders FeaturePage before checking archive state and accepts `?demo=1`. Imports owns additional login/register controls. These are concrete integration points, not a new application rewrite.

## Shape

Keep existing users columns, UUIDs, credential hashes and all foreign keys. Add nullable columns atomically through a schema migration.

```sql
ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE users ADD COLUMN name_key TEXT;
ALTER TABLE users ADD COLUMN introduced_at INTEGER;
CREATE UNIQUE INDEX users_by_name ON users(name_key) WHERE name_key IS NOT NULL;
```

A shared profile is a user with both `display_name` and `name_key`. A legacy account initially has neither. Store methods alone update these fields and validate their pairing. A unique global key is intentional for this one shared-code archive. Membership remains the authority for each group. The index resolves entry without scanning accounts or inferring an email.

```py
@dataclass(frozen=True)
class ProfileName:
    display: str
    key: str

@dataclass(frozen=True)
class EntryPolicy:
    code_digest: bytes
    group_id: str
    session_seconds: int = 30 * 86400

@dataclass(frozen=True)
class Profile:
    user_id: str
    name: str
    introduced: bool

@dataclass(frozen=True)
class ArchiveSession:
    profile: Profile
    group_id: str
    role: Literal["admin", "member"]

@dataclass(frozen=True)
class Entry:
    token: str
    session: ArchiveSession

def parse_profile_name(raw: str) -> ProfileName: ... # Not implemented.
def enter_shared(self, code: str, name: str, policy: EntryPolicy) -> Entry: ...
def shared_session(self, token: str | None, policy: EntryPolicy) -> ArchiveSession: ...
def complete_introduction(self, user: str, policy: EntryPolicy) -> ArchiveSession: ...
```

The three methods belong on Store. These three public operations hide normalization, lookup, atomic creation, membership, session issuance and completion. Callers only choose entry versus private shell. Wire JSON stays in the handler.

Name validation uses Python `str.strip()` then `str.casefold()` for the key. Preserve the trimmed spelling on first create. Reject nonstrings, blank names, control characters and display names over 100 characters. Bound code length and compare a digest in constant time before lookup. Do not silently collapse internal spaces or add Unicode compatibility normalization beyond the agreed trimming/case folding.

Entry executes one `BEGIN IMMEDIATE` transaction on the Store connection. Lookup by key, create if absent, insert the configured membership only for a new user, and insert a separately generated hashed session token. Commit together. A concurrent process resumes the committed row rather than creating a second profile. Tokens stay per browser, so logging out one token leaves another token valid. UUID primary-key collision retries cannot establish unique humans.

For new users, retain mandatory legacy credential fields with a unique reserved address `shared-<uuid>@profiles.invalid`, random salt and an scrypt hash of a discarded random password. Use explicit columns. No credential is returned, displayed or logged. This is compatibility storage, not an email-based identity. `members_for` gains `name`; shared-mode HTTP serialization omits email, and Imports plus Discovery render `name`. Keep legacy Store output compatibility where existing contracts require it.

Existing profiles must still have membership in the configured group on resume and session reads. Never `INSERT OR IGNORE` membership on every entry, since that would undo removal. A removed name remains reserved and entry denies access. New names can still enter under the accepted shared-code policy, so removal does not ban a human holding the code.

Introduction completion updates `introduced_at = COALESCE(introduced_at, now)` after session and membership checks. Retry is harmless. It is per user, not localStorage or browser. About is an authenticated route, but an explicit visit never erases completion. Concurrent first visits may both see the introduction until one completes it.

## Module map and flow

- `mazi/identity/core.py` owns additive migration, name parsing, shared operations and existing domain authorization.
- `mazi/identity/server.py` owns `POST /api/entry`, `GET /api/session`, `POST /api/introduction/complete`, origin/JSON checks and cookie serialization. Session response never includes token, email or code.
- `mazi/server.py` loads validated server policy and adds `/about` to app paths. Unified shared mode disables HTTP email/password register/login routes while legacy Store contracts remain usable in isolated tests.
- `src/useSession.ts` owns loading, signed-out, ready and error session states plus `mazi:session` refresh. It aborts stale responses and clears private state on access loss.
- `src/App.tsx` places entry/loading/error gates before route dispatch. About is available in private navigation. `useArchive` receives the authenticated group instead of using groups as authentication.
- `src/features/imports/template.html` and `mount.js` remove credential forms and handlers. Imports and Circle retain import/member controls. Disable self-service group creation and single-use invite controls in shared mode to keep one configured circle.
- `src/features/discovery/mount.js` uses member names. `src/useRoute.ts` retains hash navigation. A direct private URL still passes the session gate.

Remove the public sample link and stop `?demo=1` from bypassing session checks in shared mode. If sample fixtures remain for prototype testing, load them only after authentication in this mode. Server archive/media endpoints retain their current `_member` and component grants; no static route exposes actual stored originals.

## Migration and concrete setup

Provide a local operator command `python3 -m mazi.identity.setup_shared --root <synthetic-or-operator-selected-dir>` with an explicit archive path. Never discover or read `.mazi-imports` during implementation. The command creates a mode-0600 config containing a generated shared code and fixed group UUID, prints the code once locally, and is idempotent when configuration already exists. The code is excluded from Git and browser bundles. Server startup fails clearly for missing/malformed config, missing group or no configured admin. No secret is requested in chat.

For a fresh store, setup takes `--admin-name` and creates that profile plus one group/admin membership in a transaction. Set its introduction incomplete. Entry itself never promotes the first arbitrary visitor. For existing stores, require `--group <uuid>` and explicit repeatable `--bind-user <uuid>=<name>` options. Attach names to those existing users without changing their IDs, passwords, groups, ownership, grants or sessions. Choose an existing group admin as the configured admin. Reject unknown users, nonmember bindings and normalized collisions atomically. Never auto-map from email or guess that a display name belongs to a legacy user.

Unbound legacy accounts remain intact and cannot be resumed by name. An operator can bind them later; this limitation prevents accidental loss of identity continuity. Shared session cookies use the existing `mazi_session`, HttpOnly, SameSite=Strict, Path=/ and 30-day Max-Age aligned with DB expiry. Use Secure when served with HTTPS. Existing 24-hour sessions keep their original expiry. Code rotation blocks new entry but does not silently revoke existing cookies; session deletion is a separate operator action.

Implement the parent-recorded D17 in `docs/DECISIONS.md` and its CONTRACTS/PRIVACY/SPEC references. Update affected local run and identity documentation. Production invite-only acceptance remains distinct.

## Verification contract

Use temporary synthetic SQLite stores and isolated browser contexts. No tests here were run because this deliverable is design only.

- Migration twice preserves legacy UUID, scrypt login, memberships, owned media and recipient grants. New column defaults preserve unbound accounts. Explicit registration columns work after migration.
- `" Alice "`, `"alice"` and casefold-equivalent names resume one UUID across Store instances and browser contexts. Distinct trimmed names create distinct IDs. Parallel entry produces one profile and two independent sessions.
- Wrong code, blank/long/control names and invalid JSON create no user, membership or session. Missing config fails closed. No code or reserved email appears in responses or rendered member labels.
- New profile starts incomplete. Completion retries retain one timestamp. Restart and a second browser resume completion. About revisits preserve it. Expired cookies require entry and logout clears that browser's cookie.
- New members are never admins. Setup binds an existing admin without changing ownership. Removed member entry and existing cookie cannot access the group. Other-group grants stay denied.
- Every retained page, direct hash route, direct app route, About and `?demo=1` shows entry before authenticated content. Imports and Circle contain no email/password controls, including error/recovery states. Session expiry clears previously rendered content.
- Run focused identity/HTTP tests, full relevant Python tests, `npm run build`, desktop/phone Playwright, document checker and `git diff --check`. Record synthetic fixtures and actual evidence after implementation.

## Tradeoffs and alternatives

We accept reserved credential placeholders and edits to positional inserts in exchange for one identity row and unchanged archive foreign keys. We accept extending users with local-profile concerns in exchange for no profile mapping or repeated joins. We accept global names for one configured archive; multiple independent shared circles would need a revised key contract.

A separate profile mapping table hides legacy credential placeholders more cleanly but adds user/profile synchronization and another join for every identity presentation. A replacement credential-free users schema removes placeholders but requires rebuilding a referenced table and risks existing credential/domain contracts. Browser-local names avoid schema work but expose identity reconstruction to callers and cannot resume across browsers.

## Synthesis decision and next step

Candidate B awaits parent synthesis. First implementation step is a migration/entry test using an old four-column users fixture with owned media, then the smallest additive Store change.

Known risks require implementation evidence rather than a new product question. Accepted code-holder impersonation includes any named admin. Finite cookies eventually expire. Names are profile labels and cannot prove human uniqueness. Operator binding is required for legacy continuity. This candidate inspected source only and did not access personal archives.
