# M0 access experiment design

## Selection

Choose [candidate A](candidate-a.md), full local Supabase Auth, PostgREST and private Storage. [Candidate B](candidate-b.md) uses PostgreSQL and mediated filesystem delivery, but leaves the selected provider's object policies and identity propagation untested. The independent reviewer scored A 23/25 and B 18/25 against provider evidence, small interface, denial matrix, rerun cost and honest milestone boundaries. Parent agrees. Both reviewers use the same model family.

## Domain and boundary

Membership is active or removed. A contribution is processing, available or withdrawn. Each object has one immutable key tied to its contribution and group. Live database membership and availability determine database rows and private Storage bytes. JWTs identify an actor but never cache membership authorization. Authenticated actors can read eligible records; fixture setup alone holds privileged mutation credentials. This is an experiment, not the production lifecycle schema.

Use a CLI-generated local migration and native Node fetch assertions. Run actual Auth sign-ins, PostgREST reads and Storage downloads/listing. Keep the fixture setup and provider request parser in one test file unless a reusable helper materially reduces duplicated secrets/transport logic. No generic repository or application API is needed for this gate.

## Grafts and limits

Take B's explicit post-commit revocation checks with the same unexpired actor token. Test contributor departure withdrawing their contributions while an independently owned available copy remains. Keep processing and withdrawn neighbors unreadable when a single item becomes available. Reject B's custom token/session service and filesystem delivery because they duplicate the selected provider and reduce evidence parity.

Authenticated private downloads recheck current policy on each new request. Signed URLs and their expiry/cache behavior remain M1 T09 work. Neither local design proves hosted region, TLS/encryption, provider terms, full ingestion, backup recovery, production costs or T01-T15 acceptance.

## Verification predicate

Real JPEG/PNG bytes round-trip for active members and administrator. Anonymous, outsider, removed and cross-group actors get no protected rows, object names or bytes. Direct public routes and writes fail. Making one item ready exposes only that item. Revocation with an old token denies subsequent database/storage reads. Repeat the suite to prove fixture isolation and record safe output. M0 completion waits for this predicate and the agreed decision record.
