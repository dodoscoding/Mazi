Planning status on 2 October 2026. No milestone has started. Assignee is dodo ([@dodoscoding](https://github.com/dodoscoding)).

Source is [docs/ROADMAP.md](https://github.com/dodoscoding/Mazi/blob/codex/product-roadmap/docs/ROADMAP.md) M0. Accountable role is the technical lead with the product lead. Estimate is 1 to 2 working weeks for the assumed squad. That range is not a commitment.

## Outcome

The expensive unknowns are resolved far enough to build the private memory pilot. Privacy decisions that affect storage are recorded. Every promised importer has a fixture and a declared format. A second account is denied another account's private object.

## Scope

- Confirm the first production scope, format limits, group limits, capacity, cost ceiling, and supported browsers.
- Accept or revise the proposed stack and the server-readable privacy model in [docs/DECISIONS.md](https://github.com/dodoscoding/Mazi/blob/codex/product-roadmap/docs/DECISIONS.md). Reconcile D10 with the Inngest mention in `PROJECT_PLAN.md` before code relies on either.
- Collect consented, redacted exports from each source and document missing fields. Store sensitive fixtures outside Git.
- Exercise a small upload-to-private-preview experiment with database authorization and storage denial from a second account.
- Exercise a PhotoKit selection and iCloud retrieval experiment on a supported device. Record permission and background limits.
- Define each role's acceptance evidence. Establish build, lint, type, and test commands when the app scaffold exists.
- Export-format research and the bounded PhotoKit experiment may start here. They do not imply early feature delivery.

## UI steps

M0 does not ship a member interface. The denied-access experiment and the PhotoKit experiment may use a throwaway harness. That harness is not the product UI and does not need a visual world.

The member-facing work starts in the M1 issues after this exit. Dodo's design discussion for navigation and tone lives on `[Design] Agree product context and the Operate interface with dodo`.

## Design discussion with dodo

Answer these before M1 interface work treats them as settled. They change layout, copy, and what a screen is allowed to reveal.

1. Production scope. D05 proposes the M3 archive loop before native Apple sync and conversational AI. Confirm or revise it.
2. Privacy copy. The product must be able to say encryption in transit and at rest without claiming end-to-end encryption. D02 is proposed, not accepted.
3. Format and upload limits. The working assumption is JPEG, PNG, HEIC, and tested MP4 or MOV combinations. Unproven formats are rejected in the product, not inferred.
4. Original downloads. Sanitized previews are the default. An original is a separate grant. The later publish screen must not offer an unrestricted original until this choice is recorded.
5. Cohort, region, provider terms, and monthly cost ceiling. Until those exist, real imports stay on synthetic or consented fixtures.

## Exit

Privacy decisions that affect storage are recorded. Every promised importer has a fixture and a declared supported format. The first denied-access experiment has evidence. If a source cannot meet the proposed scope, the reduced scope is recorded before anyone estimates its parser.

These experiments have not run. Do not describe them as results.
