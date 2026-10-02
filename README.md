# Mazi

A private, invite-only archive of a friend group's shared history. Mazi connects media, source conversations, people, places, and reviewed memories while preserving each contributor's control over sharing.

The repository is in product planning. No application or infrastructure has been implemented. The planning baseline is dated 2 October 2026 and assumes a small team targeting a production launch.

Start with the [roadmap](docs/ROADMAP.md) and [product specification](docs/SPEC.md).

The existing [project plan](PROJECT_PLAN.md) is preserved. Differences between its technology choices and these proposals are recorded in the decision register for M0 reconciliation.

| Document | Purpose |
| --- | --- |
| [Roadmap](docs/ROADMAP.md) | Delivery order, dependencies, staffing assumptions, estimates, and release gates. |
| [Product specification](docs/SPEC.md) | User journeys, release scope, navigation, and traceability to the brief. |
| [Architecture](docs/ARCHITECTURE.md) | Proposed components, data flow, scale, and operational design. |
| [Contracts](docs/CONTRACTS.md) | Domain relationships, publication rules, import states, and retry semantics. |
| [Privacy](docs/PRIVACY.md) | Access matrix, consent, revocation, retention, and deletion. |
| [Imports](docs/IMPORTS.md) | Adapter behavior, source limitations, fixtures, and platform evidence. |
| [Test plan](docs/TEST_PLAN.md) | Acceptance scenarios, proposed budgets, and production evidence. |
| [Decisions and risks](docs/DECISIONS.md) | Proposed defaults, alternatives, open decisions, and risk owners. |
| [Source register](docs/SOURCES.md) | External evidence and limits of verification. |
| [Original product brief](docs/source/PRODUCT_BRIEF.md) | Unchanged source supplied by the user. |

Milestone status is owned by the roadmap. Privacy policy is owned by the privacy document. Technical choices remain proposals until their listed evidence gates pass. Future implementation should update these documents when it changes a contract.
