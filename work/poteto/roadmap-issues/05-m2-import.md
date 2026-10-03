Planning status on 2 October 2026. Assignee is dodo ([@dodoscoding](https://github.com/dodoscoding)).

Source is [docs/ROADMAP.md](https://github.com/dodoscoding/Mazi/blob/codex/product-roadmap/docs/ROADMAP.md) M2. Depends on the M1 manual importer and the M0 fixtures. Accountable role is the import engineer. Estimate is 4 to 6 working weeks, not a commitment.

Tests are T03, T04, T06, T07, and T09.

## Outcome

A closed beta can reconstruct history from supported WhatsApp, Messenger, and Discord user exports. Every discovered item has an outcome. Replaying a 20,000-item manifest adds no repeated appearances.

## Scope

- Finalize the normalized adapter contract using the manual importer.
- WhatsApp export first, then Messenger, then Discord user export. Reorder only if fixture evidence justifies it.
- Preserve bounded message context, reactions where supplied, source identities, archive coverage, and separate share dates.
- Checkpointed scans, queue leases, per-item retry, cancellation, import reconciliation, and a human-readable outcome report.
- Test common image and video formats against the published format matrix. Reject unsupported codecs clearly.
- Closed beta with at least three consented groups and the representative archive fixture set.

Discord server intake is M4. Source integrations may claim only fields the fixtures demonstrate.

## UI steps

1. The contributor selects an export and sees the inventory before processing. Available, missing, and unsupported counts are visible. Processing choices are explicit.
2. Transfer and scan progress survive interruption. Successful items stay reviewable when other items fail.
3. The member can cancel. Cancellation does not discard items that already succeeded.
4. The outcome report lists every discovered item as success, missing, unsupported, skipped, or failure. The member can read the reason without opening logs.
5. Review still defaults to unpublished. Archive import never publishes by itself.
6. Shared source text appears in search only after the member shares it. Coverage stays partial until the report shows otherwise.

States to design with dodo.

- A large export still running, with a finished prefix the member can already review.
- Malformed archive, path-traversal rejection, and an unsupported codec. The copy names the limit.
- Repeated import of the same manifest. The report shows that nothing new was added.
- Ambiguous records that stay unresolved instead of being silently merged.
- Empty archive, and an archive whose media is missing while messages remain.
- Keyboard access and progress announcements.

## Design discussion with dodo

Visitor mode is **Operate**. The report is the product of this milestone. A member must be able to trust the accounting without reading a worker log.

Impeccable path. Shape the inventory and the outcome report after the design-kickoff issue. The report can be dense. Density is appropriate when every row is a decision or a result.

### Starting brief

The contributor is bringing years of chat history into a private review pile. Success is an inventory that matches the fixture, a report that accounts for every item, and no group-visible memory until the existing publish step.

### Open decisions for dodo

1. How bounded message context appears next to a photo before anyone shares it. Private context must be obvious to the importer and invisible to everyone else.
2. How archive coverage is stated on the report so a partial export cannot read as a complete history.
3. Whether WhatsApp, Messenger, and Discord need different review cues, or one report with a source badge. Prefer one report unless fixture evidence shows a field that cannot share the row.

## Exit

T03, T04, T06, T07, and T09 pass. Every discovered item has an outcome. Replaying a 20,000-item manifest adds no repeated appearances. The beta privacy walkthrough is complete before invitations expand. Claims stay inside demonstrated fields.
