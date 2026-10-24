# Notebook discovery fix

## Scope

Make event title links recognisable and notes reachable without scrolling past a large photograph. Preserve the existing event kind, notebook query flag, note API and editing rules. The current event model already distinguishes events from individual photos; this change needs no new state shape.

## Bug fix playbook

- [x] Reproduce it yourself on the matching surface via the control skill (Non-negotiables).
- [x] Binary-search the cause. Runtime screenshots and computed positions confirm that detail has no notes jump link. CSS inspection confirms that title link rules never restore the underline removed globally. The notebook query focuses the event H1 instead of the notebook ref.
- [x] Plan the fix. Independent read-only exploration compared explicit links with section navigation. Choose explicit links, persistent underlines and a clear notes heading. Delegate the fix to a worker, then inspect its diff.
- [x] Verify on the same surface. Exercise desktop and phone arrival, repeated jump activation, note saving and ordinary photo opening.
- [x] Stage the commits so the failing repro lands before the fix in git history.
- [ ] Run Opening a PR. Review and verification precede publication. The coordinator owns the subsequent release under the owner's continuing merge/deploy request.

## Evidence and boundaries

Baseline screenshots and geometry are `before-desktop.png`, `before-phone.png` and `before.json`. They use only synthetic archive fixtures. Playwright owns browser verification. Changes to data storage, authentication and note permissions are outside this fix.

The existing Poteto and Impeccable workflows continue from the feature. Model the Domain keeps the existing event discriminator and route flag. Prove It Works requires real title/jump navigation and note writes in the browser. The independent proposal chose plain links over tabs because this page does not need tab state.

## Throughput

One implementation worker owns application files and tests. The coordinator owns this evidence directory, PR and release. Run the single browser server serially. Review the final patch independently before any merge or deployment. Reuse existing dependencies. Do not modify the original checkout or the merged feature's release evidence.

## Workflow limits

The upstream cloud-agent names map to available local Codex workers through the Poteto adapter. Review independence uses one model family. This is a narrow refinement of the existing visual world, so no new visual-world interview, image generation or broad redesign is needed. No new architecture boundary is introduced.
