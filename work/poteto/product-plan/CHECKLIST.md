# Product planning workflow

- [x] Read the Principles section of the poteto-mode skill.
- [x] Phase A: Frame
- [x] Phase B: Design the workflow
- [x] Phase C: Run the loop
- [x] Preserve the source and define product scope with requirement traceability.
- [x] Define privacy, domain, import, and architecture contracts.
- [x] Sequence production milestones with dependencies and acceptance gates.
- [x] Check links and brief coverage, then obtain independent review.
- [x] Phase D: Keep the audit trail
- [x] Phase E: Verify and hand back

## Frame

The deliverable is a local Markdown planning set for Mazi. The user selected a small team targeting production launch. No application, infrastructure, commits, or PRs are part of this run.

Done means the original brief is preserved, all 30 sections map to planned scope, each milestone has dependencies and measurable exit criteria, contracts agree on visibility and lifecycle behavior, local links resolve, and an independent reviewer has checked the actual documents. Any unresolved product or technical choice remains labeled.

Baseline at 580a4c8 has one README and no application or test commands. Expected output is a linked README and roughly ten planning documents. Checks are document checks, not implementation validation.

## Adapted playbook

Use figure-it-out for this product-planning set. The multi-phase program template was inspected but does not fit a product roadmap without implementation commands or approved PR boundaries. Its ten live lanes, runtime prototypes, merge mechanics, and recurring audits are skipped. Nothing is running or being deployed. Future implementation work needs its own bounded plan.

1. Extract the source requirements and mark assumptions.
2. Verify unstable integration claims from primary sources.
3. Draft coherent product and technical contracts.
4. Define delivery order, owners, risk gates, and acceptance scenarios.
5. Run structural checks and independent review; fix contradictions.
6. Open the roadmap and report verified artifacts and remaining decisions.

## Throughput checkpoint

Root owns all authored documents. One read-only reviewer investigates the brief and reviews the final set. This keeps terminology consistent without concurrent edits. The critical path is privacy and dedupe semantics before roadmap acceptance criteria.

## Skips and limits

- Architectural prototypes and implementation are outside this planning request. Architecture is a proposal, with experiment gates before code relies on it.
- The generic program check-plan script does not apply to this bespoke planning format.
- No-comments code audit is skipped because no application code or code comments are authored.
- There is no runtime, database, cost measurement, privacy certification, or performance result to claim.
- Review uses independent agents from the same model family, not cross-family validation.
