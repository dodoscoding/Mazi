# Mazi domain and processing contracts

M0 freezes the group-only audience, contribution ownership, normalized-item, availability and authorized-read boundaries below under [D14](DECISIONS.md) and [the M0 decisions](M0_ACCEPTANCE.md). Detailed later-feature structures remain logical contracts, not production migrations or implemented API endpoints. The local access experiment uses a deliberately smaller membership/contribution schema; M1 must implement the full archive relationships. Every relationship that crosses a group boundary must be rejected at the database boundary. [Privacy](PRIVACY.md) owns the audience policy.

## Domain vocabulary

| Entity | Meaning and important fields | Invariant |
| --- | --- | --- |
| User | Authenticated account. | An account is not automatically a recognized person. |
| Group, GroupMembership, Invitation | Group, account role/status, hashed invite token, expiry, acceptance. | Active membership is required for group access; accepting an invite is atomic and single-use. |
| MediaAsset | Logical photo or video identity, group, identity scope, media type. | It is not a source occurrence, permission, or globally downloadable master. |
| MediaVariant | Retained file, private object key, SHA-256, format, dimensions, duration, derivative kind, parent variant. | Bytes are immutable. Different crops/edits remain distinct variants or separate assets until reviewed. |
| MediaContribution | Contributor, group, asset, retained variant, availability/withdrawal status, consent version. | Successful ingestion makes a contribution available to the whole group; ownership remains with its contributor. |
| MediaOrigin | Contribution, source account namespace, conversation/channel, source item, attachment identity, identity certainty, sender assertion, share time, raw metadata reference. | A historical occurrence remains distinct from another occurrence of identical bytes. Ambiguous export records do not prove distinct or identical historical occurrences. |
| SourceMessage | Origin context, raw text, author assertion, source time, reactions, available coverage. | Ingested context uses the group audience and retains its source/deletion dependencies. Display names alone do not identify a User. |
| Group access policy | Active membership, contribution availability, withdrawal state, policy version. | The initial release has one group audience; no PublicationGrant component/recipient schema is required. |
| Memory, MemoryMedia | Group event, owner, availability state, optional parent, title, description, time interval, creation method, evidence dependencies; links to logical media. | Saved memories use the group audience; parent hierarchy is acyclic and cannot expose cross-group or withdrawn media. |
| Person, PersonMedia, MemoryMember | Future M5 proposal: group-local identity, reviewed media association, reviewed attendance assertion, subject disassociation/suppression. | A detected face, a named person, and an account are separate concepts. Subject controls also apply to manual associations. |
| PersonalHide | Future M5 proposal: account, media or memory, hide/unhide state. | Hides material from that account's discovery and derived results without deleting another contribution or changing other viewers' access. |
| Location, MetadataAssertion | Normalized place; raw/inferred value, source, precision, confidence, author, version. | Inferences never replace original evidence silently. |
| ImportRun, ImportItem, ProcessingJob | Owner, group, source manifest, item outcome, checkpoints, attempts, stage version. | Retry preserves stable item and origin identities. |
| DuplicateDecision, MemorySuggestion | Candidate evidence, score/model version, reviewer, outcome, reversible links. | Similarity does not authorize destructive merging or acceptance of a suggested event. |
| ConsentRecord, AuditEvent | Actor, scope, purpose, policy version, timestamp, withdrawal; security event metadata. | Optional processing uses current consent and records changes. |

Each contribution retains a recoverable reference to its own submitted file and origin after reconciliation. Ownership, availability, and processing consent remain attached to contributions so a false duplicate can be split without losing source lifecycle information.

## Identity and automatic group sharing

The group is the identity and read-access scope. After validation, exact deduplication may reuse retained bytes and reconcile matching contributions within that group while preserving genuine new origins. Another group's matching material cannot be revealed through responses, counts, hashes, or rendition selection.

Each successfully ingested contribution becomes available to all current active group members automatically. There is no owner-only archive draft, recipient selector, component grant, or manual publication transaction. Import UI states this behavior before submission. Readiness is per item, so a failed or unfinished neighbor never holds an otherwise available item for review.

The ingest completion operation records validated retained objects, contribution/origin identity, availability, and discoverable results atomically in the database. It checks current membership, group, import cancellation/withdrawal state, applicable processing consent, lease/input version, and idempotency identity. Technical failure remains explicit and retryable. Successful replay returns the same outcome; conflicting payloads cannot silently reuse an idempotency key.

For an active member, a media entry exists while the group has at least one available contribution. The selected rendition is the best eligible available group variant for the requested derivative type. Imported context, filenames, source history, location, original downloads, and identity evidence use the same group audience. Source text is data, and a source identity label is not a verified person association.

Saved Memories and sub-events share their metadata with the group. A parent does not restore a deleted, withdrawn, or cross-group child. Counts include only available children. Derived titles, dates, descriptions, locations, and summaries retain evidence dependencies and are recomputed or omitted when that evidence is removed. A derived-only Memory with no eligible evidence is omitted. Independently authored text can remain under the group policy.

Post-import review corrects dates, resolves similarity suggestions, and organizes memories. It is never a prerequisite for sharing already-ingested content. Accepting an event suggestion changes archive organization; it does not introduce a second audience or a publication gate.

## Deduplication and corrections

SHA-256 compares exact bytes after validation. A distinct historical appearance still gets a MediaOrigin. An exact repeated import of the same occurrence gets neither an extra origin nor an extra contribution.

Perceptual hashes or embeddings only nominate pairs. Review distinguishes a recompressed copy, an edited image, a burst neighbor, and an unrelated image. Quality selection considers resolution, codec, edit intent, and corruption, not file size alone. Video/audio and Live Photo components are not discarded to keep a still image.

Merge decisions preserve all variants, origins, contribution ownership/availability, and the pre-merge MemoryMedia links. Undo restores those links. New links created after a merge keep their contribution/variant evidence so a split can place them or request explicit review. Uncertain links are never silently attached to both resulting assets.

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
| original_filename, declared_media_type | Untrusted source values retained as group-visible evidence after ingestion. |
| sender, conversation, channel | Source identifiers and labels, not automatically mapped to accounts. |
| capture_assertions, shared_at_assertion | Distinct raw timestamp evidence. |
| location_assertions | Optional raw coordinates/place evidence. |
| context, reactions | Available source text, bounded context, and source-provided reactions. |
| original_metadata_reference | Retained source evidence under the group access policy. |
| warnings, coverage | Missing files/fields, parser uncertainty, and export boundaries. |

The server derives group and owner from the authenticated import, never from adapter content. Adapters do not decide access or canonical identity; the shared downstream ingestion service applies automatic group visibility. The downstream pipeline uses normalized fields and warnings without source-specific controller branches.

Stable occurrence identity combines group, contributor, source account namespace, conversation/channel, source item, and attachment identity when the source supplies reliable IDs. Without them, the adapter first gives each imported record a stable identity within a particular manifest using its manifest digest, record locator, and attachment position. Replaying that same manifest is idempotent.

Cross-export fingerprints nominate occurrence matches; they do not establish identity by themselves. Identical messages with identical timestamps, ambiguous partial overlap, or shifted ordinals remain separate retained source records with uncertain origin correspondence. They enter review instead of being automatically collapsed. The UI distinguishes retained export records from confirmed historical appearances and reports unresolved matches. Exact media-byte dedupe can still occur independently. Parser-version changes reconcile existing record identities rather than generating new ones silently. Fixtures must include a partial export containing only the second of two indistinguishable messages.

## Import lifecycle

The ImportRun is an aggregate progress summary. Individual items can occupy different stages at once. Each item becomes group-visible as it reaches technical readiness; post-import review is tracked separately and never delays that visibility.

| Run state | Meaning and next actions |
| --- | --- |
| QUEUED | Accepted manifest; scanning may start. |
| SCANNING | Validate archive layout, inventory records, and persist checkpoints. |
| UPLOADING | Await permitted file transfers. Already-uploaded items may process. |
| PROCESSING | Validate bytes, retain originals, produce previews and metadata. |
| DEDUPLICATING | Resolve exact identity or produce reviewable similarity suggestions. |
| CLUSTERING | Optional memory suggestions. Skipped when unavailable or disabled. |
| REVIEW_REQUIRED | Corrections or ambiguous-match decisions remain. Successfully ingested items are already visible to the group. |
| COMPLETED | Every item has a terminal ingestion outcome. Successful items are group-visible; review tasks can remain open. Some items may have failed. |
| FAILED | A run-wide problem prevents progress, such as an unreadable archive or invalid authorization. Successful retained items remain recoverable. |
| CANCELLED | New work stops. Previously successful items stay group-visible unless explicitly withdrawn or deleted. |

An item outcome is AVAILABLE_TO_GROUP, MISSING_MEDIA, UNSUPPORTED, SKIPPED, FAILED, or CANCELLED, with a machine-readable reason. Retry transitions eligible failed items back to the required stage. The UI shows counts by outcome, not a misleading all-or-nothing success label.

Counters reconcile discovered items into pending, active, ready, missing, unsupported, skipped, failed, and cancelled buckets. Duplicate appearances count as processed appearances, while unique assets have a separate count. Live source sync uses bounded runs and checkpoints instead of a permanently incomplete import.

Jobs use import_item_id, stage, input version, and algorithm version as their idempotency identity. Leases include expiry and ownership. A completion transaction accepts output only from the current lease and consent version. Retry cannot repeat side effects after a completed stage. Exponential backoff and capped attempts lead to a reviewable failure.

## Search and AI boundary

Search takes an authenticated member, one group, filters, a bounded page size, and a stable cursor. It returns authorized results, accessible evidence identifiers, date uncertainty, and a continuation cursor. Counts and facets use the same authorization filter as results.

Model-bound retrieval additionally requires current processing consent for each component. No group index may incorporate cross-group, withdrawn, or unconsented processing inputs. Model prompts contain evidence as data, never as tool instructions. The model cannot change access, accept a suggested memory, or execute imported instructions.

An answer carries cited evidence, observed archive coverage, and uncertainty. "Earliest imported Copenhagen memory" is supportable; "first trip ever" requires evidence beyond a partial archive. Revocation rechecks before dispatch and answer delivery prevent stale results from becoming new disclosures. Already-sent provider requests follow the disclosed provider retention policy.

## Capsule boundary

At M7, a capsule adds a server-time unlock condition to the normal group access policy. Before unlock, original downloads, thumbnails, embeddings, search snippets, AI answers, recaps, and notifications cannot reveal locked content. Author editing and access rules must be decided separately before implementation. A browser timer is never the access control.
