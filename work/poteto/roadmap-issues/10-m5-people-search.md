Planning status on 2 October 2026. Assignee is dodo ([@dodoscoding](https://github.com/dodoscoding)).

Source is [docs/ROADMAP.md](https://github.com/dodoscoding/Mazi/blob/codex/product-roadmap/docs/ROADMAP.md) M5 and the People and Search rows in [docs/SPEC.md](https://github.com/dodoscoding/Mazi/blob/codex/product-roadmap/docs/SPEC.md). Depends on the M3 launch. Run in parallel with M4 only with separate capacity. Accountable role is the retrieval lead. Estimate is 4 to 7 working weeks, not a commitment.

Tests are T11, plus T01, T02, and T09 for the new read paths.

## Outcome

A member can filter authorized memories by person and by meaning, with manual People associations that stay separate from accounts. Face recognition stays off unless the consent gates pass. Search still works when recognition and all AI processing are disabled.

## Scope

- Versioned visual and text embeddings, combined authorized filters, and a held-out retrieval evaluation set.
- People with manual confirmed associations.
- Separate account and person identities.
- Personal hiding, subject disassociation, and no automatic retagging after removal.
- Face recognition only after nonmember consent, withdrawal, provider retention, and deletion choices are settled and tested.

No popularity scores. No competitive rankings. Nonmembers in messages or images do not become searchable identified people by default.

## UI steps

People.

1. The member opens People only after this milestone ships. Until then the destination is absent.
2. They confirm a person association by hand. An account and a person are not the same control.
3. They can hide a media item from their own discovery. The item remains for other members who are allowed to see it.
4. They can remove a tag, including one applied by someone else, from the subject relationship. The other person's media file remains.
5. A removed tag does not return on the next import.

Search.

1. Existing keyword search still works with AI off.
2. Combined filters for place, person, and the semantic query return only authorized items.
3. A hidden lookalike does not appear for the member who hid it.
4. Empty results still do not prove an event never happened. Archive coverage stays visible.

Recognition, only if the gates pass.

1. The product asks for the required consent before any face recognition runs.
2. Withdrawal stops that processing from affecting later results.
3. If the gates are not accepted, the People and search UI above still ship, and recognition controls are absent.

States to design with dodo.

- AI off, recognition off, and recognition consented.
- A person with no confirmed media.
- Personal hide versus subject disassociation. The member must be able to tell these apart.
- A nonmember who appears in a photo and has a private request path.
- Permission denied and a withdrawn embedding that must not leak through summaries.

## Design discussion with dodo

Visitor mode is **Operate**. People is a set of confirmed associations and shared memories. It is not a social graph and not a ranking.

Impeccable path. Shape People and the extended search after the design-kickoff issue. Consent UI is part of the surface. Do not add it as a settings afterthought once recognition exists.

### Starting brief

The member wants memories of a specific friend, or a description of a moment, inside the archive they are allowed to see. Success is a result set that stays inside grants, with a manual association the subject can undo.

### Open decisions for dodo

1. The words and controls that separate "hide this from me" from "this person is not in this media."
2. Whether recognition ships in the same release as semantic search. The roadmap allows semantic search while recognition stays disabled. Prefer that split unless consent evidence already exists.
3. The private request path for a nonmember. Who receives it, and what the member who uploaded the photo sees.

## Exit

T11 passes. T01, T02, and T09 stay green for retrieval. The retrieval target in the test plan is met or explicitly revised. Face recognition may remain disabled.
