# Mazi privacy and access policy

The single group audience and immediate sharing are confirmed in [D14](DECISIONS.md) on 3 October 2026. The owner confirmed server readability, EU hosting, departure withdrawal, and disabled optional AI/recognition on 5 October 2026. Application retention targets are delegated engineering decisions. Local M0 read/denial evidence passes; production enforcement remains M1 work; later-feature policies remain proposals. This document is not a legal compliance assessment.

## Trust boundary

The accepted architecture processes originals on the server. Transport and storage encryption do not make it end-to-end encrypted. Service operators with privileged infrastructure access may technically access stored data. Restricted operational access, audit records, and approved provider terms are therefore required.

If the product requires the service operator to be unable to read media, stop before real imports and redesign key management, client processing, search, and recovery. [Decision D02](DECISIONS.md) owns that fork.

## Audience rules

The initial audience is one invite-only friend group of 8-10 people. Every reader must sign in and have active membership. Imported content becomes available to all active members, including administrators, automatically as each item is successfully ingested. Private staging, selected recipients, and independent component audience controls are deferred. All group data is denied to outsiders and removed members.

| Action or data | Contributor | Other active group members | Group administrator |
| --- | --- | --- | --- |
| Read available imported media, originals, context, location, and identity evidence | Allowed while an active member | Allowed | Allowed while an active member |
| Import to the group | Allowed; successfully ingested items share automatically | Allowed for their own imports | Allowed for their own imports |
| Correct or withdraw/delete a contribution | Own contribution under the accepted lifecycle policy | No ownership implied by read access | May hide from group for moderation; ownership is retained |
| Manage invitations and membership | Only with admin role | Only with admin role | Allowed with audit |
| Edit shared memory title or organization | Creator or assigned editor | Only if assigned editor | Allowed for shared organization |

Read access does not grant mutation ownership. The initial roles are administrator and member. Memory editing permission remains an implementation proposal. A group cannot lose its last administrator without transfer or group closure. Invitation tokens are stored as hashes, expire, and are consumed atomically.

## Sharing and processing

Import selection is the sharing action. Explain before submission that imported media and available source context/metadata become visible to the whole group. There is no later Publish button, recipient selection, or per-component opt-in. Successful items become visible independently of failures or unfinished items in the same batch; subsequent review corrects history and organization.

The single group audience applies to previews, originals, source messages/reactions, locations, person associations, memory metadata, filenames, and origin details. Later active members receive the same archive access. No component may bypass the group boundary through a direct URL, cache, export, count, or derived output.

Private storage, temporary quarantine, validation, and safe rendering are technical boundaries. They do not create contributor-private archive staging. Unsafe or unsupported bytes are not presented as playable media; item availability and failures must be explained. Thumbnail sanitization remains a delivery measure, not a promise that imported originals or metadata are hidden from group members.

Memory and sub-event metadata use the same group audience. Parent links cannot restore deleted, withdrawn, cross-group, or otherwise inaccessible children. Derived fields are recomputed or removed when their supporting evidence is withdrawn. A derived-only empty Memory is omitted; independently authored text can remain under the group policy.

## Optional processing and future People features

The following are later-feature policies, not initial audience controls. The owner-requested [local Phase 5 implementation](../phase5/README.md) exercises manual People, personal hiding, subject suppression and opt-in local embeddings in the Python archive; production enforcement remains a separate gate. Sharing with the friend group does not by itself select an external AI provider or enable recognition.

Optional AI analysis, external model processing, face detection/recognition, have separate purpose controls. Deterministic validation and thumbnail generation are necessary archive processing and are explained during import. If optional processing is off, the import and automatic group-sharing loop still works.

Face recognition is disabled by default. A member cannot authorize identification of another person merely by uploading a photo. Before enabling recognition, the product must define consent for participating members, nonmembers, and minors; supported opt-out/removal paths; and processing retention. Until then, People uses manual, reviewable associations and does not expose recurring unknown face clusters to the group.

For the later People/discovery scope, the proposed behavior lets a member hide or unhide an accessible media item or memory from their own discovery views. Personal hiding also excludes it from that member's search results, AI answers, and recaps. It does not delete another member's contribution or revoke other members' access. A separate private report/request path covers removal from shared viewing; an authorized administrator may hide a shared item during review under the group policy.

A member with a verified association to a Person can remove themselves from a manual or recognized tag and from an attendance assertion. Disassociation removes that link from People, person-filtered search, and derived summaries, while preserving unrelated contributions. A suppression record prevents an importer, model retry, or another contributor from silently reinstating the disputed association. The subject can later opt back in. Disputed account/person mappings and nonmember requests use a private review path with minimal evidence disclosure. These controls are required before People launches, regardless of whether recognition is enabled.

## Enforcement points

Database policies enforce current group membership, contribution state, ownership, and mutation limits. Object delivery enforces corresponding file permissions. APIs also authorize requests, but frontend checks alone never establish access. Privileged worker credentials stay server-side and do not make imported claims trustworthy.

The same policy applies to thumbnails, original links, filenames, origin counts, participant counts, map points, date summaries, search facets, embeddings, captions, answers, exports, recaps, and notifications. A hidden relationship must not become visible through a count or a cached aggregate.

Workers load current group scope, contribution state, and any required processing consent before each stage and before attaching results. Events and summaries use only eligible group inputs. Automatic sharing cannot attach data from another group or restore a withdrawn contribution.

## Revocation and membership changes

Contribution withdrawal or membership revocation increments the policy version and denies affected new reads immediately after commit. New signed links are denied. Existing signed URLs can remain usable for at most the configured expiry, proposed at 60 seconds. Already downloaded files cannot be recalled.

Revocation invalidates application caches, search results, materialized summaries, and pending answer delivery. Deletion/withdrawal queues purge obsolete embeddings and other derivatives. Queries deny access immediately through current policies while physical cleanup proceeds. Re-enabling a model must not resurrect withdrawn output accidentally.

A member leaving or being removed loses group access immediately. The accepted D06 policy withdraws that member's contributions and their source dependencies from the group. The departure workflow offers an export beforehand where appropriate. An account-scoped export/delete flow remains available for owned data without restoring group browsing access.

Another member's independently imported and authorized copy may remain visible. Removing one origin must remove its context, dependent metadata, and identity assertions without deleting independent contributions. Object garbage collection occurs only when no retained contribution requires the bytes.

## Retention and deletion

The M0 engineering decision adopts the following application targets on 5 October 2026. They are not provider retention guarantees. Verify feasibility, provider terms, and the launch cohort's obligations before real imports or hosted provisioning.

| Data | Accepted application retention or deletion target |
| --- | --- |
| Unfinished temporary uploads | Remove after 7 days without activity. |
| Raw source archives | Delete 30 days after completed import unless the owner explicitly retains them; normalized permitted provenance remains. |
| Group contributions | Retain until deletion, withdrawal, or applicable account/group closure policy; subject to quota. There is no private staging retention class. |
| Withdrawn contributions and revoked memberships | Deny affected reads immediately; retain minimal change history needed for audit. |
| Deleted originals and derivatives | Purge live storage and indices within 7 days, subject to independent contribution references. |
| Security audit metadata | Retain 180 days without message bodies or media. |
| Backups | 30-day expiry; restored data must reapply deletion tombstones before access. |
| External model inputs/outputs | Provider-specific terms must be recorded and accepted before enablement. No unverified zero-retention promise. |

Account and group deletion report what was removed, what remains because of independent contributions, and when backups expire. Export includes authorized owned originals where available, normalized metadata, provenance, and machine-readable memory relationships. Export excludes cross-group and withdrawn origins. Ownership and export scope remain distinct from group read access.

## M0 experiment boundary

Use synthetic actors and media for the local database/Auth/private Storage experiment. No paid provisioning or real archive is required for the narrowed JPEG/PNG pilot contract. Keep optional AI and face recognition off. M1 needs object backups as well as database backups; a provider database backup alone cannot satisfy recovery.

EU hosting is accepted. Verify actual regions, provider terms, hosting security, and privacy disclosures before real imports or hosted provisioning. The €75 monthly ceiling is a planning constraint and does not prove provider deletion or backup expiry. [M0 acceptance](M0_ACCEPTANCE.md) separates accepted targets from pending evidence.

## Production review

Before launch, identify data regions, subprocessors, provider training/retention settings, consent text, support routes, nonmember requests, incident ownership, and any needed privacy/legal assessment. Keep sensitive production exports out of development fixtures. Do not claim regulatory compliance from the existence of RLS or encryption.

Mandatory privacy scenarios are T01, T02, T05, T09, T11, T13, and T15 in the [test plan](TEST_PLAN.md), according to the enabled milestone. A feature stays disabled if its access and revocation scenarios fail.
