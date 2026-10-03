# Home and memory design review evidence

Date: 2026-10-03. Baseline revision: `b7c2cc7afae45212b461e2f141ff5f1ebb5779be`. All changes remain local and uncommitted. Existing planning changes were preserved.

## Scope and status

The owner requested the first three design steps: visual direction, concept imagery, and interaction/motion specification. Two direction rounds were prepared. The owner explicitly chose a bolder re-roll through the decision page; no final direction has been selected. Approval is pending. No runnable interface, final DESIGN.md, real model asset, animation, prototype test, or deployment is claimed.

The handoff consists of [the visual proposal](../../../docs/DESIGN_PROPOSAL.md), [the interaction specification](../../../docs/HOME_MEMORY_INTERACTIONS.md), the two JSON decision payloads in this directory, ten Home direction images in [the decision folder](../../../.impeccable/mocks/decision/), and [two first-round detail/mobile studies](concepts/). The latter are retained exploration rather than the chosen design.

Impeccable context had already run during initialization and was not rerun. Direction seed: `422333e9`. Active question key: `8bf04b31`; the local decision page is temporary and its port is not a permanent project endpoint. The comp-first setting remains unchanged. The question API also reported a session-only flip back to comp; that is not a direction choice.

## Image provenance and inspection

All twelve images were produced with the built-in `image_gen` tool using synthetic content. Each PNG is stored in the workspace with the exact prompt embedded and a JSON sidecar that records `approved: false`, `synthetic: true`, and the producing tool. Exact prompts also exist as `*.prompt.txt` in this directory. No personal archive was supplied, no paid model service was purchased, and no third-party raster was downloaded as a product asset.

The generated images were visually inspected as returned. The first-round warm consumer reference and all six bolder catalog systems were viewed in the browser as inspiration. Catalog imagery is not represented as Mazi output. The decision board was inspected after the bolder images arrived and showed the Memory Signal comp, text, controls, and selection action.

Visible qualifications: early consumer concept duplicates desktop navigation; familiar-library concept invents an avatar overflow count; Tickets mixes date precision; some generated designs add incidental slogans; generated type is not a verified font match. These details are explicitly nonbinding in the proposal. Cross-image people/photographs are illustrative and cannot prove pixel identity through a transition. A selected concept needs a focused composition/detail pass before implementation.

## Validation

- `python3 work/poteto/product-plan/verify_docs.py`: PASS, 14 authored documents, 86 local links, 30 requirement mappings, 8 milestones, 15 acceptance scenarios. The checker now includes the two new design documents.
- `git diff --check`: PASS.
- `git diff --numstat -- PROJECT_PLAN.md docs/source/PRODUCT_BRIEF.md`: no changes.
- `impeccable embed-prompt --scan .impeccable/mocks/decision`: 10 rasters, 0 missing provenance.
- `impeccable embed-prompt --scan work/design/home-memory/concepts`: 2 rasters, 0 missing provenance.
- PNG header/JSON-sidecar inspection: original six assets valid, desktop 1536x1024 and mobile 853x1844; each had a complete prompt and explicit unapproved synthetic status. The final twelve-asset check repeats this inspection after the bolder round.

These checks verify document structure and asset records. Motion, accessibility, resource budgets, device behavior, and friend-test outcomes remain unverified; their required evidence is named in the interaction specification. Framework, renderer, installed fonts, deployment, and the production data architecture remain open decisions.
