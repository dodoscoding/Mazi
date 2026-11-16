# Independent P1 interface review

Verdict: FAIL at `dd5647b`. One P2 data-loss edge and two small related help-copy corrections need changes. The tested primary journeys otherwise pass.

Reviewer is GPT-6.1 Sol with high reasoning. This is independent review within one model family.

- Base: `9dfdf9c469029d59ae436f522e5c07ca9525b96b`.
- Head: `dd5647bb57d56e1229f27e0fdaeb3af86db5c05c`.
- Stable patch ID: `02817683b1cb23dc9691a084021078e22edf7c37`.
- Scope: P1 interface over merged plan APIs, Ekle menu, existing shared Sheet behavior and isolated synthetic browser fixture.

## Standards

P3. Keep implementation vocabulary out of the form's help text. `src/social/PlanForm.tsx:111` asks for an “IANA” timezone, while line 169 asks for a memory's raw “kimlik”. The developer guidance requires implementation details to stay out of user flows unless they help a meaningful choice. Plain timezone guidance and paste-an-approved-memory-link guidance satisfy the same actions. Keep actual timezone preservation and repeated-hour offset selection; no form redesign is needed. This is one copy finding with two text locations.

No other standards finding was found. The plans module is lazily loaded, state is scoped to its keyed profile/group/route mount, request generations and aborts guard reads, and native React escaping handles text. The new runtime code introduces no explanatory comments or suppressions. The Sheet close label remains optional, so existing consumers retain their prior accessible names. The synthetic fixture explicitly forces the local backend before creating a temporary store and is excluded from deployment.

## Spec

P2. Preserve an existing memory association when editing unrelated plan fields. `src/social/types.ts:62` maps an unavailable projected memory to an empty draft value. `src/social/Plans.tsx:241-252` then sends every draft field, including `memory: null`, in every edit. A memory can be unavailable only to the organizer because they hid it, while other members can still see its plan link. Editing the title or place then silently deletes the group's stored association, rather than changing only what the organizer edited. The plan requires current-visibility filtering of links; a filtered read must not become an implicit global unlink.

I reproduced this against an actual temporary archive using the existing `PlanMemoryTests` fixture and the exact full-field patch shape submitted by the UI:

1. Create a plan linked to a currently visible accepted memory.
2. The organizer hides that memory. `get_plan` correctly returns `memory: None`, while the persisted `memory_id` still points to the accepted memory.
3. Change only the title and submit the UI-shaped full draft, which contains `memory: None`.
4. The persisted `memory_id` becomes null. Unhiding the memory cannot restore the plan link.

```text
API-visible memory when organizer hides target: None
Persisted linked memory before unrelated edit: True
Persisted linked memory after UI-shaped full draft patch: None
Memory link after unhiding: None
```

The backend already preserves an omitted association. The UI should omit an unchanged memory association from an update, or construct a patch from explicit edits, and make removal an explicit action. Add a regression proving that title/place-only editing preserves a filtered existing link and that an intentional visible-link removal still works.

No further scoped runtime blocker was found. Empty-archive creation, current-group deep links, wrong-group denial, profile/access invalidation, uncertain-write key retention, stale-edit drafts, DST gap/fold selection and timezone preservation pass their independent checks. Demo performs no real social read or write. The three screenshots were inspected and show usable typography and controls at the documented sizes. The Sheet layer resolves the confirmed mobile confirmation obstruction without breaking the existing detail/account/sound checks.

## Independent verification

Builds and browser checks were serialized within this worktree. All fixtures were synthetic.

- `node --test tests/dom/social-plans.test.mjs tests/dom/route-history.test.mjs tests/dom/discord-return.test.mjs` passed all 23 tests.
- `MAZI_UNIFIED_PORT=8152 npx playwright test --config playwright.social.config.ts` passed 15 cases with one duplicate phone case skipped. The desktop empty-circle case opens a separate authenticated phone context, uses a different browser timezone, creates on desktop, joins and clears on phone, and verifies zero Atlas requests. The suite also covers organizer edits/cancel/delete, real lost responses, stale edits, DST offsets, current-circle replacement and real wrong-group denial, demo, keyboard and 320-pixel geometry.
- `MAZI_TEST_PORT=5292 npx playwright test tests/interface-clarity.spec.ts tests/theme-shell.spec.ts tests/memory-detail.spec.ts tests/sound.spec.ts --project desktop --project phone` passed 76 cases with 10 inapplicable cases skipped. This includes existing shared Sheet/detail behavior, account focus, accessibility, reduced motion and sound.
- `MAZI_UNIFIED_PORT=8152 npx playwright test --config playwright.unified.config.ts tests/clarity-workspaces.spec.ts --grep 'legacy|source|settings|People'` passed all 12 desktop/phone cases.
- Inspected all three synthetic captures: `plan-desktop.png`, `plan-phone.png` and `create-phone.png`.
- `npm run check:budgets` passed without changing ceilings. Entry 147.5/150 KiB gzip, all scripts 396.4/400 KiB, stylesheet 36.7/40 KiB and globe 242.9/256 KiB.
- `npm run check:docs` passed with 19 authored documents and 318 local links.
- `git diff --check 9dfdf9c...HEAD` passed for the full committed branch.

Generated existing navigation screenshots and integrated result JSON were restored after independent runs. The reviewed worktree is clean. No production account, archive, migration or deployment was accessed. D17 current-circle replacement evidence remains honestly synthetic; no live multi-circle switch or physical-phone pilot is claimed.

## Superseding focused recheck

Verdict: PASS at `60f6b036c303c43bbbcef89ed5eaabfbc112d317`. This supersedes the original FAIL above; the original findings and evidence remain preserved.

- Original review base: `9dfdf9c469029d59ae436f522e5c07ca9525b96b`.
- Current-main comparison base: `39249c4a1c906d297ace0e0a865129a699a2d506`.
- Reviewed head: `60f6b036c303c43bbbcef89ed5eaabfbc112d317`.
- Stable patch ID against current-main base: `f3cd4c6ffd9dfecb7ad079a52c8abf4aa457febd`.
- Stable full-branch patch ID against original review base: `fb786455f492621c5951bda76c485761c602ba37`.
- Compared the correction with prior reviewed head `dd5647bb57d56e1229f27e0fdaeb3af86db5c05c`; red contract `6eb218a`, fix `ce010ca`, current-main merge `784c580` and final evidence `60f6b03` are present.

### Standards recheck

Both copy corrections are resolved. The form now asks for a timezone and an approved memory link in plain language. It retains the stored timezone and necessary repeated-hour UTC offset choice. I inspected the refreshed `create-phone.png`; the corrected help fits the narrow form. The correction adds no runtime comments or suppressions. The isolated test probe's module docstring briefly states its purpose; it does not add implementation commentary to the product flow.

The merge leaves the previously reviewed P1 changes in `App`, `Shell`, shared `Sheet`, navigation, timezone helpers, types and styles unchanged. Comparing against current main isolates the expected P1 feature and evidence; merged upstream features are not attributed to this correction. No new standards finding.

### Spec recheck

The edit baseline is captured when opening the form and retained across a stale-revision reload. Update payloads include only fields changed from that baseline. Consequently, an unchanged hidden-memory projection is omitted, explicit removal of a visible association sends `memory: null`, and untouched saves close without issuing a write. Successful writes and access denial discard the baseline. Existing uncertain-write retries retain the exact command body and key.

Independently reran:

```text
node --test tests/dom/social-plans.test.mjs tests/dom/route-history.test.mjs tests/dom/discord-return.test.mjs
28 passed; 0 failed; 0 skipped
```

This includes the actual UI-generated title-only and visible-unlink patches applied by the child Python probe to a fresh local MemoryStore. The probe checks the second member still sees the organizer-hidden association before editing, preservation after title editing and unhiding, and removal for both members after explicit unlinking.

I also reran the original scenario independently, using a separate temporary `PlanMemoryTests` archive and changed-field update payloads. Its assertions and output were:

```text
Organizer projection hidden; second member still sees linked memory
Changed fields ['title'] preserve persisted linked memory
Changed fields ['place'] preserve persisted linked memory
Unhiding restores projected link
Explicit null removes association for both members
```

The backend clears omitted offset selections when date/timezone fields change, so field-differential edits remain compatible with its DST validation. No new spec finding.

### Integrity and limits

`git diff --check 9dfdf9c...HEAD` and `git diff --check 39249c4...HEAD` both pass, including committed evidence logs. The reviewed worktree remains clean; no application files were changed by this review. All independently executed data operations used temporary local synthetic archives with the local backend explicitly selected.

The previous independent browser/shared-shell checks remain the evidence for unchanged journeys. I did not repeat those 100-plus cases or claim a new independent combined-budget/browser run. The author's committed combined-app verification records 15 P1 browser passes with one duplicate case skipped and unchanged budget ceilings; this recheck directly verifies the corrected patch behavior, archive persistence and copy. Physical-phone and five-friend acceptance limits remain open as stated above. No production data, migration, publication or deployment was accessed.
