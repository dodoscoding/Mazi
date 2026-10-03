Planning status on 2 October 2026. Assignee is dodo ([@dodoscoding](https://github.com/dodoscoding)).

Source is the M3 exit and the production gate in [docs/ROADMAP.md](https://github.com/dodoscoding/Mazi/blob/codex/product-roadmap/docs/ROADMAP.md). Depends on the M2 beta and the M3 discovery issue. Accountable role is the technical lead with QA. Estimate for M3 as a whole is 5 to 8 working weeks, not a commitment.

Tests are T01 through T10 and T14 against the release candidate.

## Outcome

The invite-only cohort can use a production archive with useful discovery, safe suggestions, recovery, and a measured scale. The product owner has recorded acceptance. No unresolved access leak or data-loss defect remains.

## Scope

- Finish export, account and group lifecycle, retention jobs, monitoring, incident procedures, and restore verification.
- Run the scale, accessibility, usability, privacy, cost, and release checks below.
- Release only to the agreed invite-only cohort.

## UI steps

This issue does not add a new destination. It proves the surfaces already shaped with dodo.

1. Walk invite, upload, retry, review, publish, timeline, and media detail with a keyboard and a screen reader on narrow and wide layouts.
2. Confirm focus order, named controls, progress announcements, contrast, and reduced motion.
3. Complete a ten-photo memory without a mouse.
4. Review the working flows with the product owner. Attach screenshots to the implementation PRs.
5. Publish the privacy explanation in the product. It distinguishes encryption at rest from end-to-end encryption.
6. Show supported formats, browser versions, and upload limits where the member chooses files.

## Design discussion with dodo

Visitor mode stays **Operate**. This is the quality gate, not a redesign.

Impeccable path. Run `$impeccable audit` on the shipped web surfaces before this issue closes. Fix the audit findings on the surface that owns them. Do not open a new visual world to pass the gate.

### Open decisions for dodo

1. The usability target is proposed. At least 4 of 5 participants import, review, and publish a ten-photo memory within 10 minutes. Accept that target or record a revised one before calling the launch accepted.
2. The retrieval target is proposed. At least 80 percent of a 30-task set finds an agreed event with timeline or search. Same rule. Revise in writing, or meet it.
3. Incident ownership, alerts, cost limits, support contact, and the rollback decision-maker need names before release. Those are operational, and they also decide what the member sees during an outage.

## Production gate

- Record supported source formats, device and browser versions, and upload limits in the product.
- Pass direct database, storage, API, worker, search, and cache authorization tests.
- Complete restore, export, deletion, membership-removal, and rollback drills with evidence.
- Meet the performance and availability targets, or record an accepted revision before release.
- Resolve region, provider terms, processing consent, retention, and any required privacy or legal review for the launch cohort.
- Publish the privacy explanation described above.
- Validate keyboard use, screen readers, focus, contrast, progress announcements, and reduced motion.
- Assign incident ownership, alerts, cost limits, support contact, and a release rollback decision-maker.
- Review the working flows with the product owner and attach screenshots to the implementation PRs.

## Exit

T01 through T10 and T14 pass against the release candidate. The checklist above is complete. No unresolved access leak or data-loss defect remains. Visual and event models remain optional.
