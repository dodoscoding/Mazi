# Mazi domain and processing contracts

These are proposed logical contracts. They are not migrations or implemented API endpoints. Every relationship that crosses a group boundary must be rejected at the database boundary. [Privacy](PRIVACY.md) owns the audience policy.

## Domain vocabulary

| Entity | Meaning and important fields | Invariant |
| --- | --- | --- |
| User | Authenticated account. | An account is not automatically a recognized person. |
| Group, GroupMembership, Invitation | Group, account role/status, hashed invite token, expiry, acceptance. | Active membership is required for group access; accepting an invite is atomic and single-use. |
| MediaAsset | Logical photo or video identity, group, identity scope, media type. | It is not a source occurrence, permission, or globally downloadable master. |
| MediaVariant | Retained file, private object key, SHA-256, format, dimensions, duration, derivative kind, parent variant. | Bytes are immutable. Different crops/edits remain distinct variants or separate assets until reviewed. |
| MediaContribution | Contributor, group, asset, retained variant, review/publication status, consent version. | Ownership and sharing attach to the contribution, not to an asset-wide visibility flag. |
| MediaOrigin | Contribution, source account namespace, conversation/channel, source item, attachment identity, identity certainty, sender assertion, share time, raw metadata reference. | A historical occurrence remains distinct from another occurrence of identical bytes. Ambiguous export records do not prove distinct or identical historical occurrences. |
| SourceMessage | Origin context, raw text, author assertion, source time, reactions, available coverage. | Context has its own grant and retention lifecycle. Display names alone do not identify a User. |
| PublicationGrant | Contribution, component, audience, selected recipients, active/revoked status, policy version. | Grants to media, originals, context, location, and identity display are independent. |
| Memory, MemoryMedia | Group event, owner, draft/published state, optional parent, title, description, time interval, creation method, evidence dependencies; links to logical media. | Memory visibility does not grant child media. Parent hierarchy is acyclic and group-consistent. |
| MemoryGrant | Memory, metadata component, audience, selected recipients, active/revoked status, policy version. | Memory title/text/date, location, and identity metadata have explicit grants independent of child media. |
| Person, PersonMedia, MemoryMember | Group-local identity, reviewed media association, reviewed attendance assertion, subject disassociation/suppression. | A detected face, a named person, and an account are separate concepts. Subject controls also apply to manual associations. |
| PersonalHide | Account, media or memory, hide/unhide state. | Hides material from that account's discovery and derived results without deleting another contribution or changing other viewers' grants. |
| Location, MetadataAssertion | Normalized place; raw/inferred value, source, precision, confidence, author, version. | Inferences never replace original evidence silently. |
| ImportRun, ImportItem, ProcessingJob | Owner, group, source manifest, item outcome, checkpoints, attempts, stage version. | Retry preserves stable item and origin identities. |
| DuplicateDecision, MemorySuggestion | Candidate evidence, score/model version, reviewer, outcome, reversible links. | Similarity does not authorize destructive merging or publication. |
| ConsentRecord, AuditEvent | Actor, scope, purpose, policy version, timestamp, withdrawal; security event metadata. | Optional processing uses current consent and records changes. |

Each contribution retains a recoverable reference to its own submitted file and origin after reconciliation. Grants target the contribution so splitting a false duplicate does not need to reconstruct consent from an asset-wide flag.

## Identity and publication

Private imports have an identity scope per contributor and group. Exact deduplication within that scope can reuse bytes while adding genuine new origins. Private assets are not subject to a globally visible hash uniqueness constraint. Responses cannot reveal another contributor's matching import.

On publication, reconciliation considers only already-published candidates visible to the publishing actor. Matching may connect contributions to one logical asset. A hidden selected-member contribution is not exposed just to deduplicate it. Separate identities may persist across mutually inaccessible audiences. This deliberately spends storage to keep the permission model explainable.

For any viewer, a media entry exists only if at least one contribution grants that viewer media access. The chosen rendition is the highest-quality eligible published variant for that viewer and requested derivative type. There is no unconditional group-wide master path.

The media-preview grant includes the sanitized preview, media type, dimensions/duration, approved display date with uncertainty, and an explicitly reviewed caption. It does not include raw filenames, origin identifiers, source badges/history, messages/reactions, location, or identity associations. Source details use the context grant. Location, identity, and original-file access retain their independent grants. A caption copied or generated from protected inputs retains those evidence dependencies.

Source badges, counts, captions, locations, and identities come only from independently visible components. Identity reconciliation cannot union their audiences. Original download requires its own grant. Moving a media link into a shared Memory does not publish a private contribution.

A Memory starts as an owner-only draft. Its owner explicitly grants each metadata component to a private, selected-member, or group audience. Parent and child relationships do not expand either audience. A viewer must be authorized for both the Memory and each returned media contribution. Counts include only that viewer's accessible children.

Derived titles, descriptions, dates, places, and summaries track their supporting evidence and permission version. If evidence loses visibility, recompute those fields from eligible inputs or hide them until recomputation completes. A derived-only Memory with no accessible evidence is hidden from that viewer, including its existence and counts. Independently authored text can remain under an explicit Memory grant, but copied source content retains its original access dependency. The owner can still inspect the private draft and repair its links.

The logical publication operation includes the selected contributions, component grants, audience, recipient set, idempotency key, and expected policy version. It checks ownership, current membership, completed validation, recipient membership, and version before committing all changes atomically. Version conflicts require a fresh review, not a silent overwrite. Repeating the same request returns the same publication outcome. Reusing its key with a different payload is rejected.

## Deduplication and corrections

SHA-256 compares exact bytes after validation. A distinct historical appearance still gets a MediaOrigin. An exact repeated import of the same occurrence gets neither an extra origin nor an extra grant.

Perceptual hashes or embeddings only nominate pairs. Review distinguishes a recompressed copy, an edited image, a burst neighbor, and an unrelated image. Quality selection considers resolution, codec, edit intent, and corruption, not file size alone. Video/audio and Live Photo components are not discarded to keep a still image.

Merge decisions preserve all variants, origins, contribution grants, and the pre-merge MemoryMedia links. Undo restores those links. New links created after a merge keep their contribution/variant evidence so a split can place them or request explicit review. Uncertain links are never silently attached to both resulting assets.

## Timestamp and confidence semantics

Each time assertion stores a raw value, parsed local value, timezone or offset if known, precision, source kind, source locator, and inference flag. A UTC instant is nullable when the input cannot support one. A date-only value does not become midnight UTC.

The resolved display date records the chosen assertion and resolution reason. User correction takes precedence but retains previous assertions. A usual candidate order is valid capture EXIF, Apple capture metadata, other source capture metadata, trustworthy file evidence, then message-sharing time as an explicitly estimated fallback. This is a review heuristic, not proof. File export/creation time is never presented as capture time without its estimate label.

Contradictory offsets, ambiguous locale dates, implausible EXIF, or conflicts between capture sources enter review. Unknown dates remain undated. Capture and share times have separate fields and labels. On This Day uses only an accepted month/day with sufficient precision.

Timestamp, location, identity, duplicate, and cluster confidence are separate values. Each includes evidence, method/model version, and a reason. A score is not called a probability until calibrated against labeled fixtures.

## Normalized import boundary

An adapter emits a versioned NormalizedImportItem and a capability/coverage report. The minimum logical fields are below.

| Field | Meaning |
| --- | --- |
| schema_version, adapter_version | Versions for replay and compatibility. |
| source_type, source_account_namespace | Platform and stable importing account/export namespace. |
| source_item_id, occurrence_key, attachment_key | Identity of the source occurrence, distinct from its file checksum. |
| local_blob_reference, external_reference | Optional authorized file or fetch reference. Neither is assumed present. |
| original_filename, declared_media_type | Untrusted source values retained for the owner's inspection. |
| sender, conversation, channel | Source identifiers and labels, not automatically mapped to accounts. |
| capture_assertions, shared_at_assertion | Distinct raw timestamp evidence. |
| location_assertions | Optional raw coordinates/place evidence. |
| context, reactions | Available source text, bounded context, and source-provided reactions. |
| original_metadata_reference | Private retained source evidence. |
| warnings, coverage | Missing files/fields, parser uncertainty, and export boundaries. |

The server derives group and owner from the authenticated import, never from adapter content. Adapters do not publish, create grants, or decide canonical identity. The downstream pipeline uses normalized fields and warnings without source-specific controller branches.

Stable occurrence identity combines group, contributor, source account namespace, conversation/channel, source item, and attachment identity when the source supplies reliable IDs. Without them, the adapter first gives each imported record a stable identity within a particular manifest using its manifest digest, record locator, and attachment position. Replaying that same manifest is idempotent.

Cross-export fingerprints nominate occurrence matches; they do not establish identity by themselves. Identical messages with identical timestamps, ambiguous partial overlap, or shifted ordinals remain separate retained source records with uncertain origin correspondence. They enter review instead of being automatically collapsed. The UI distinguishes retained export records from confirmed historical appearances and reports unresolved matches. Exact media-byte dedupe can still occur independently. Parser-version changes reconcile existing record identities rather than generating new ones silently. Fixtures must include a partial export containing only the second of two indistinguishable messages.

## Import lifecycle

The ImportRun is an aggregate progress summary. Individual items can occupy different stages at once. Processing completion and publication are separate states.

| Run state | Meaning and next actions |
| --- | --- |
| QUEUED | Accepted manifest; scanning may start. |
| SCANNING | Validate archive layout, inventory records, and persist checkpoints. |
| UPLOADING | Await permitted file transfers. Already-uploaded items may process. |
| PROCESSING | Validate bytes, retain originals, produce previews and metadata. |
| DEDUPLICATING | Resolve exact identity or produce reviewable similarity suggestions. |
| CLUSTERING | Optional memory suggestions. Skipped when unavailable or disabled. |
| REVIEW_REQUIRED | Successful items are available to the owner; review/publish/discard choices remain. |
| COMPLETED | Every item has a terminal ingestion outcome and review choices are resolved or explicitly deferred privately. Some items may have failed. |
| FAILED | A run-wide problem prevents progress, such as an unreadable archive or invalid authorization. Successful retained items remain recoverable. |
| CANCELLED | New work stops. Retained successful items remain private until reviewed or deleted. |

An item outcome is READY_FOR_REVIEW, MISSING_MEDIA, UNSUPPORTED, SKIPPED, FAILED, or CANCELLED, with a machine-readable reason. Retry transitions eligible failed items back to the required stage. The UI shows counts by outcome, not a misleading all-or-nothing success label.

Counters reconcile discovered items into pending, active, ready, missing, unsupported, skipped, failed, and cancelled buckets. Duplicate appearances count as processed appearances, while unique assets have a separate count. Live source sync uses bounded runs and checkpoints instead of a permanently incomplete import.

Jobs use import_item_id, stage, input version, and algorithm version as their idempotency identity. Leases include expiry and ownership. A completion transaction accepts output only from the current lease and consent version. Retry cannot repeat side effects after a completed stage. Exponential backoff and capped attempts lead to a reviewable failure.

## Search and AI boundary

Search takes an authenticated member, one group, filters, a bounded page size, and a stable cursor. It returns authorized results, accessible evidence identifiers, date uncertainty, and a continuation cursor. Counts and facets use the same authorization filter as results.

Model-bound retrieval additionally requires current processing consent for each component. No shared index may combine a visible image with private chat text. Model prompts contain evidence as data, never as tool instructions. The model cannot grant access or publish a memory.

An answer carries cited evidence, observed archive coverage, and uncertainty. "Earliest imported Copenhagen memory" is supportable; "first trip ever" requires evidence beyond a partial archive. Revocation rechecks before dispatch and answer delivery prevent stale results from becoming new disclosures. Already-sent provider requests follow the disclosed provider retention policy.

## Capsule boundary

At M7, a capsule adds a server-time unlock condition to the normal grants. Before unlock, original downloads, thumbnails, embeddings, search snippets, AI answers, recaps, and notifications cannot reveal locked content. Author editing and access rules must be decided separately before implementation. A browser timer is never the access control.
