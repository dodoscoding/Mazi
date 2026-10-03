Planning status on 2 October 2026. Assignee is dodo ([@dodoscoding](https://github.com/dodoscoding)).

Source is [docs/ROADMAP.md](https://github.com/dodoscoding/Mazi/blob/codex/product-roadmap/docs/ROADMAP.md) M1 and journey 1 in [docs/SPEC.md](https://github.com/dodoscoding/Mazi/blob/codex/product-roadmap/docs/SPEC.md). Depends on the M0 exit. Tests are T01 and the authorization half of T02.

## Outcome

A group creator can sign in, create a private group, and send a single-use expiring invitation. The recipient can accept before expiry. An expired, replayed, or revoked invitation grants nothing. An administrator who is not a recipient cannot read private staging.

## Scope

- Authentication, group membership, and roles.
- Single-use expiring invitations.
- Database authorization for shared reads and writes.
- Denial of cross-group access and of owner or group reassignment.
- Membership removal.

Private staging, publication, and the archive screens are separate issues.

## UI steps

1. The creator signs in and creates a private group. There is no public discovery and no feed.
2. The creator sends one invitation through a channel they already use. The product does not need to become that channel.
3. The recipient opens the invitation and accepts before it expires.
4. An expired invitation explains that it cannot be used. It does not reveal group contents.
5. A revoked invitation or a removed member reaches the same dead end.
6. An administrator opens group settings and still has no path into another member's private staging.

States to design with dodo.

- Signed out, and a session that expired mid-task.
- First group, and a member who already belongs to one group. Cross-group discovery stays excluded.
- Invitation pending, accepted, expired, replayed, and revoked.
- Concurrent accept. Only one acceptance succeeds.
- Administrator view that proves staging is absent, not merely hidden behind a disabled button.
- Narrow and wide layouts. Keyboard and screen reader names for the invite flow (T08).

## Design discussion with dodo

Visitor mode is **Operate**. This is account and membership UI. Standard sign-in, a short form, and a clear invitation state beat a branded onboarding story.

Impeccable path. Finish `[Design] Agree product context and the Operate interface with dodo` first. Then `$impeccable shape` this surface. Do not invent a palette in this issue.

### Starting brief

The person arriving is either creating a trusted group or accepting a friend's invitation. Success is one valid membership and no leaked staging. The invitation screen shows expiry and single-use behavior in the interface, not only in an email.

### Open decisions for dodo

1. Where invitation copy says the invite expires, and what the expired screen shows when the person is already signed in to a different account.
2. How an administrator's home proves they cannot see private staging without displaying a count of hidden items.
3. Account recovery is in the M3 capability table. Decide whether M1 needs a minimal recovery path or a documented deferral.

## Exit

T01 passes. A single acceptance succeeds. Invalid invitations fail. Cross-group access is denied. Admins cannot read private staging.
