# Mazi

A private, invite-only archive for one friend group of 8-10 people. Mazi connects media, source conversations, people, places, and memories. Imported content becomes available to the whole signed-in group automatically; review supports later corrections.

The repository contains product planning and a working Atlas design prototype. The prototype uses fictional memories and generated photographs; it has no authentication, uploads, backend or production infrastructure. The production planning baseline remains dated 2 October 2026.

Start with the [confirmed product context](PRODUCT.md), [roadmap](docs/ROADMAP.md), and [product specification](docs/SPEC.md). The product direction and Atlas choice were confirmed on 3 October 2026.

The existing [project plan](PROJECT_PLAN.md) is preserved. Differences between its technology choices and these proposals are recorded in the decision register for M0 reconciliation.

| Document | Purpose |
| --- | --- |
| [Product context](PRODUCT.md) | Confirmed audience, website scope, sharing, navigation, design ambition, and open decisions. |
| [Visual direction proposal](docs/DESIGN_PROPOSAL.md) | Selected Atlas concept and historical direction exploration. |
| [Implemented design](DESIGN.md) | Atlas colors, typography, layout, components and motion extracted from the prototype. |
| [Prototype stack](docs/PROTOTYPE_STACK.md) | Chosen experiment stack, alternatives, scope and run instructions. |
| [Prototype verification](work/design/atlas/VERIFICATION.md) | Runtime checks, screenshots, review and remaining limits. |
| [Home-to-memory interactions](docs/HOME_MEMORY_INTERACTIONS.md) | Responsive layout, meaningful 3D, navigation, motion, recovery, and prototype evidence requirements. |
| [Roadmap](docs/ROADMAP.md) | Delivery order, dependencies, staffing assumptions, estimates, and release gates. |
| [Two-developer plan](docs/TWO_DEVELOPER_PLAN.md) | Parallel task ownership, dependency handoffs, and acceptance gates for two developers starting at M0. |
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

## Run the Atlas prototype

Use Node 22.12+ (developed on 24.15.0).

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Choose a memory in the 3D atlas or dated list, open it, browse its photographs and expand its conversation. Timeline and Search use the same three demo memories. My Imports and Our circle explain their unavailable prototype features.

```sh
npx playwright install chromium
npm test
npm run build
npm run check:docs
git diff --check
```

`npm run preview` serves the production bundle after building. For a physical phone on a trusted local network, use `npm run dev -- --host 0.0.0.0` and the displayed network URL. Keep all content synthetic: this experiment has no access controls.
