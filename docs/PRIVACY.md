# Mazi privacy and access policy

This is a proposed product policy for implementation and review. It is not a legal compliance assessment. Privacy decisions that affect data collection must be resolved before inviting the production cohort.

## Trust boundary

The proposed service processes originals on the server. Transport and storage encryption do not make it end-to-end encrypted. Service operators with privileged infrastructure access may technically access stored data. Restricted operational access, audit records, and approved provider terms are therefore required.

If the product requires the service operator to be unable to read media, stop before real imports and redesign key management, client processing, search, and recovery. [Decision D02](DECISIONS.md) owns that fork.

## Audience rules

Private staging belongs to the contributor. Group ownership and administration do not grant access to another member's staging. Every read also requires the relevant current account and membership state. All group data is denied to outsiders.

| Action or data | Contributor | Selected active recipients | Other active group members | Group administrator |
| --- | --- | --- | --- | --- |
| Read private staged media and context | Own content only | Denied | Denied | Denied unless contributor |
| Read selected-member publication | Own content | Allowed component grants only | Denied | Only if selected |
| Read group publication | Own content | Allowed component grants | Allowed component grants | Allowed component grants |
| Publish or expand a contribution's audience | Own content only | Denied | Denied | Denied unless contributor |
| Revoke/delete a contribution | Own content | Denied | Denied | May hide from group for moderation; cannot expose or claim it |
| Manage invitations and membership | Only with admin role | Only with admin role | Only with admin role | Allowed with audit |
| Edit shared memory title or organization | Creator or assigned editor | Only if assigned editor and authorized | Only if assigned editor and authorized | Allowed for shared organization; no access expansion |

The initial roles are administrator and member. Memory editing permission is explicit. A group cannot lose its last administrator without transfer or group closure. Invitation tokens are stored as hashes, expire, and are consumed atomically.

## Independent sharing and processing controls

Media preview, original download, source messages/reactions, location, and person associations each have a grant. Private is the import default. Group visibility includes future active members; selected-member visibility uses an explicit recipient list. The review UI states this distinction.

Context, original download, precise location, and person associations default to unshared even when the contributor shares a preview. Context selection shows exactly which nearby messages are included. More permissive media grants cannot widen metadata grants.

A preview grant exposes its approved display date, media type/dimensions, and reviewed caption. Raw filenames, origin details, messages, location, and identities need the corresponding independent grants. The [contracts](CONTRACTS.md) define that field boundary.

Memory metadata has its own owner and grants. A shared parent does not publish a private sub-event or its title. Derived titles, dates, locations, and summaries disappear or are recomputed when their supporting evidence becomes inaccessible. A derived-only empty Memory is hidden from that viewer. Explicitly authored standalone text can remain under its own grant; copied source text cannot bypass the source permission.

Sanitized previews remove embedded private metadata. Original download requires explicit disclosure because a file can still contain GPS or device information. Visible landmarks cannot be reliably removed by metadata settings; the share preview must not imply that hiding GPS anonymizes the image.

Optional AI analysis, external model processing, face detection/recognition, and identity display have separate purpose controls. Deterministic validation and thumbnail generation are necessary archive processing and are explained during import. If optional processing is off, the import and sharing loop still works.

Face recognition is disabled by default. A member cannot authorize identification of another person merely by uploading a photo. Before enabling recognition, the product must define consent for participating members, nonmembers, and minors; supported opt-out/removal paths; and processing retention. Until then, People uses manual, reviewable associations and does not expose recurring unknown face clusters to the group.

Every member can hide or unhide an accessible media item or memory from their own discovery views. Personal hiding also excludes it from that member's search results, AI answers, and recaps. It does not delete another member's contribution or revoke other members' access. A separate private report/request path covers removal from shared viewing; an authorized administrator may hide a shared item during review without opening private staging.

A member with a verified association to a Person can remove themselves from a manual or recognized tag and from an attendance assertion. Disassociation removes that link from People, person-filtered search, and derived summaries, while preserving unrelated contributions. A suppression record prevents an importer, model retry, or another contributor from silently reinstating the disputed association. The subject can later opt back in. Disputed account/person mappings and nonmember requests use a private review path with minimal evidence disclosure. These controls are required before People launches, regardless of whether recognition is enabled.

## Enforcement points

Database policies enforce membership, ownership, grants, and mutation limits. Object delivery enforces corresponding file permissions. APIs also authorize requests, but frontend checks alone never establish access. Privileged worker credentials stay server-side and do not make imported claims trustworthy.

The same policy applies to thumbnails, original links, filenames, origin counts, participant counts, map points, date summaries, search facets, embeddings, captions, answers, exports, recaps, and notifications. A hidden relationship must not become visible through a count or a cached aggregate.

Workers load the current scope and consent before each stage and before attaching results. Events and summaries derived from mixed-permission inputs need a matching restricted audience or fresh computation from eligible inputs. Publication never copies unrestricted metadata from a canonical asset into a shared row.

## Revocation and membership changes

Revocation increments the policy version and removes the grant from new reads immediately after commit. New signed links are denied. Existing signed URLs can remain usable for at most the configured expiry, proposed at 60 seconds. Already downloaded files cannot be recalled.

Revocation invalidates application caches, search results, materialized summaries, and pending answer delivery. Deletion/withdrawal queues purge obsolete embeddings and other derivatives. Queries deny access immediately through current policies while physical cleanup proceeds. Re-enabling a model must not resurrect withdrawn output accidentally.

A member leaving or being removed loses group access immediately. Proposed default behavior also revokes that member's contributions from the group, pending confirmation in D06. The departure workflow offers an export beforehand where appropriate. An account-scoped export/delete flow remains available for owned data without restoring group browsing access.

Another member's independently imported and authorized copy may remain visible. Removing one origin must remove its context, metadata grants, and identity assertions without deleting independent contributions. Object garbage collection occurs only when no retained contribution requires the bytes.

## Retention and deletion

The following are proposed operational targets. M0 must approve them against cost, provider capabilities, and the launch cohort's obligations.

| Data | Proposed retention or deletion rule |
| --- | --- |
| Unfinished temporary uploads | Remove after 7 days without activity. |
| Raw source archives | Delete 30 days after completed import unless the owner explicitly retains them; normalized permitted provenance remains. |
| Staged contributions | Retain until owner deletion or account closure, subject to quota and an explained inactivity policy. |
| Revoked grants | Deny reads immediately; retain minimal change history needed for audit. |
| Deleted originals and derivatives | Purge live storage and indices within 7 days, subject to independent contribution references. |
| Security audit metadata | Retain 180 days without message bodies or media. |
| Backups | Proposed 30-day expiry; restored data must reapply deletion tombstones before access. |
| External model inputs/outputs | Provider-specific terms must be recorded and accepted before enablement. No unverified zero-retention promise. |

Account and group deletion report what was removed, what remains because of independent contributions, and when backups expire. Export includes authorized owned originals where available, normalized metadata, provenance, and machine-readable memory relationships. Export does not include another contributor's private origins.

## Production review

Before launch, identify data regions, subprocessors, provider training/retention settings, consent text, support routes, nonmember requests, incident ownership, and any needed privacy/legal assessment. Keep sensitive production exports out of development fixtures. Do not claim regulatory compliance from the existence of RLS or encryption.

Mandatory privacy scenarios are T01, T02, T05, T09, T11, T13, and T15 in the [test plan](TEST_PLAN.md), according to the enabled milestone. A feature stays disabled if its access and revocation scenarios fail.
