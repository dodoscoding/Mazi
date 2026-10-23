# Event notebook design documentation

## Verdict and boundary

Preserve the incumbent system. The finished notebook is an ordinary extension of the implemented Luminous night memory page, consistent with [DIRECTION.md](DIRECTION.md) and the warm, personal, photo-led commitment in [PRODUCT.md](../../../PRODUCT.md). It introduces no new visual world or approved durable system change. No update to [DESIGN.md](../../../DESIGN.md) or [.impeccable/design.json](../../../.impeccable/design.json) is warranted by this extension; both remain untouched.

The independent [finish review](visual-review.md) records `disposition: ship` with no material visual fixes at this scope. This documentation pass agrees that the checked extension preserves the incumbent visual language. This is a local synthetic implementation record, not production or milestone acceptance.

## Evidence checked

Source checked: [EventNotebook.tsx](../../../src/memory/EventNotebook.tsx), [MemoryView.tsx](../../../src/MemoryView.tsx), [memory.css](../../../src/styles/memory.css), [tokens.css](../../../src/styles/tokens.css), [base.css](../../../src/styles/base.css), [Button.tsx](../../../src/ui/Button.tsx), the title links in [Home.tsx](../../../src/Home.tsx) and [Portal.tsx](../../../src/atlas/Portal.tsx), [useTheme.ts](../../../src/theme/useTheme.ts), and [theme.js](../../../public/theme.js). The direction, product record, existing design record and sidecar, finish review, [capture script](capture.mjs), and [visual checks](visual-checks.json) were read alongside them.

All seven supplied images were opened and inspected:

| Capture | Dimensions | Evidence |
| --- | --- | --- |
| [Before desktop](before-desktop.png) | 1440 × 1555 | Incumbent night ground, photographic viewer, serif title, cool utility controls and factual sidebar. |
| [Desktop full page](desktop.png) | 1440 × 2206 | Notebook follows imported conversation in the primary reading column; existing viewer and sidebar remain recognizable. |
| [Phone full page](mobile.png) | 390 × 2530 | Reading, recollections and factual context stack in document order with comfortable wrapping. |
| [Desktop title arrival](desktop-arrival.png) | 1440 × 1024 | Event title, attributed imported excerpt and recollection section are visible on arrival. |
| [Phone title arrival](mobile-arrival.png) | 390 × 844 | Same reading hierarchy fits the viewport above the fixed tab bar. |
| [Desktop editor](desktop-editor.png) | 1440 × 1024 | Saved notes retain their place above the labelled, focused textarea and warm save action. |
| [Phone editor](mobile-editor.png) | 390 × 844 | The textarea and actions reflow within the reading column; further content remains reachable through document scrolling. |

The before image uses a different synthetic memory, so this is a comparison of system continuity rather than a pixel reproduction claim. The fixed phone tab bar appears partway down the full-page capture because it is fixed to the captured viewport; the arrival and editor viewport images corroborate its normal bottom placement. The capture script uses Chromium at 1440 × 1024 and 390 × 844 with reduced motion, synthetic Atlas text/photos, and persisted synthetic notes. Its recorded reading-state checks report no horizontal overflow, page errors or axe violations; these results were inspected, not rerun by this documentation pass.

## System summary

1. **Palette:** the existing near-black `bg-void` and `bg-deep` grounds, pale `text-primary`, secondary reading context and cool dividers continue unchanged.
2. **Warmth Rule:** cool `accent-atmosphere` identifies source controls; warm `accent-node` author names and `accent-terminator` save action keep people and contribution warm. Written headings and ownership labels also distinguish imported excerpts from recollections.
3. **Type:** Instrument Serif 400 carries event and section headings; Geist carries notes, metadata and controls. Notebook headings reuse `display-m` (32px, 28px below 800px), notes use inherited body size with 1.7 leading, and supporting copy uses 15px or 13px.
4. **Layout and form:** the notebook remains in the incumbent primary column, caps reading width at 70ch, and uses ordinary document scrolling, soft rules, the established spacing scale, a 6px textarea radius, pill controls and the shared 2px focus outline. The 70ch limit and inline editor are local surface choices, not new global rules.
5. **Reduced Motion Rule:** the extension inherits existing motion and reduced-motion behavior. Home and portal title links add `?notebook=1`; MemoryView focuses and scrolls to the event heading, while ordinary photo links retain the viewer route. No new ornament, card system, texture or motion vocabulary is introduced.

## Drift not repaired or canonized

- **DESIGN.md day-toggle drift:** its description, overview and component prose still promise a remembered day toggle. `useTheme.ts` returns only `night`, and `public/theme.js` pins night before first paint. Day token definitions remain in CSS, but their presence does not establish a reachable shipped day mode. This pre-existing discrepancy is recorded, not repaired, because the assignment authorizes only this documentation file and preserves the existing system records.
- **Sidecar drift:** `.impeccable/design.json` still names “The Atlas of Us,” describes copper and a procedural date chart, and includes snippets using older variables such as `--action`, `--serif` and `--ink`. These do not describe the checked Luminous night implementation or DESIGN.md's current primitives. The sidecar is preserved pending an explicitly scoped system-record reconciliation; it is not evidence for new notebook rules.
- **No extension defect is promoted into a system rule.** Existing factual metadata remains local evidence, not a new decorative label prescription. The notebook's surface-specific proportions and wording are not added to the global design system merely because this pass ran.

## Limits

Still images establish the pictured reading and editing appearance only. They do not prove live motion quality, physical-phone behavior, a browser matrix, screen-reader operation, or every loading, error, unavailable and conflict state. The source exposes those state treatments, but behavior and recovery verification remain owned by the implementation review. No application code, shared tokens, DESIGN.md or sidecar was changed by this pass.

Documentation validation: `python3 work/poteto/product-plan/verify_docs.py` passed (16 authored documents, 180 local links, 30 requirement mappings, 8 milestones and 15 acceptance scenarios). A separate check resolved all 24 local links in this handoff. The new-file whitespace check reported no whitespace errors. These checks validate documentation structure and links, not application behavior.
