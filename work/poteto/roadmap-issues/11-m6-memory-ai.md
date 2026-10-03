Planning status on 2 October 2026. Assignee is dodo ([@dodoscoding](https://github.com/dodoscoding)).

Source is [docs/ROADMAP.md](https://github.com/dodoscoding/Mazi/blob/codex/product-roadmap/docs/ROADMAP.md) M6 and the Memory AI row in [docs/SPEC.md](https://github.com/dodoscoding/Mazi/blob/codex/product-roadmap/docs/SPEC.md). Depends on M5 retrieval. Accountable role is the retrieval lead with the product lead. Estimate is 3 to 5 working weeks, not a commitment.

Test is T13. Basic archiving must keep working when this feature is off or the provider is down (T14).

## Outcome

A member can ask a question and receive an answer grounded in archive evidence they can still open, or an abstention when the archive does not support the claim. Imported messages cannot grant tools or data access.

## Scope

- Retrieval-grounded answers with accessible evidence links.
- Explicit archive-coverage language.
- Permission and processing-consent checks before retrieval, provider dispatch, and answer delivery.
- Imported messages treated as untrusted content.
- Abstention, conflicting-date behavior, deletion invalidation, usage limits, and cost reporting.

No provider is selected. D11 says AI is opt-in. Core import and review do not wait on a model.

## UI steps

1. Memory AI appears in navigation only when this milestone ships and the member has opted in. Otherwise the destination is absent.
2. The member asks a question in ordinary language.
3. An answer lists the evidence the member can open. Each factual claim has a link that still authorizes.
4. The answer states archive coverage. It does not say the group never did something merely because the import was partial.
5. Conflicting dates stay visible. The answer does not collapse them into one confident day.
6. If the evidence is missing, hidden, deleted, or revoked mid-answer, the answer abstains or withdraws the stale part.
7. A question that tries to give instructions, including text imported from a chat, does not change permissions or run an action. The reply treats that text as evidence, or refuses it.
8. The member can see usage limits and that a cost exists. The interface does not need to become a billing console.

States to design with dodo.

- Opted out, and a provider outage. Import, Timeline, and Search still work.
- Answerable question, unanswerable question, and "earliest ever" when coverage is incomplete.
- Conflicting dates.
- Evidence the member could see when they asked and cannot see when the answer returns.
- Prompt text inside an imported message.
- Loading, limit reached, and a deleted source.

## Design discussion with dodo

Visitor mode is **Operate**. The answer is a reading surface inside a tool. Evidence and uncertainty are the content. A chat transcript decoration is not the job.

Impeccable path. Shape this surface after the design-kickoff issue and after M5 search exists. `$impeccable clarify` belongs here if the abstention copy is vague. Do not ship a confident tone the evidence cannot support.

### Starting brief

The member wants to know what the shared archive can support. Success is an answer they can check, or a clear abstention. An incomplete archive never supports an absolute claim about the group's entire past.

### Open decisions for dodo

1. How coverage is phrased when the answer uses three memories and the import report said the export was partial.
2. What the member sees when two photos disagree on the date. Show both, or abstain. Do not average them in the sentence.
3. Where opt-in lives so a member can use the archive for years without ever opening this destination.

## Exit

T13 passes on the held-out questions and the adversarial cases. Every factual answer is supported by evidence the requesting member can still access.
