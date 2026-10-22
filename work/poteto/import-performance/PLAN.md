# Import performance

## Workflow

### Perf issue

**You own the measurement story. Plan, review, verify the numbers.** Tie every fix to a measurement, don't read source instead of measuring.

1. Capture a baseline trace via the matching control skill.
2. `how` to ground hypotheses. Don't claim a perf ceiling without running it first.
   Most fixes come from eight strategy families. Use them as hypothesis generators, not a checklist. A family earns an attempt only when the trace shows the signal it names.
   - **Elimination.** Before optimizing the hot path, ask whether it needs to exist: a computation nobody consumes, a feature gate that's always off for this user, a sync that redundantly mirrors state, a legacy path kept "just in case". The trace shows what's slow, never that it's deletable, so this family needs the `how` pass, not the profiler.
   - **Divide and conquer.** The dominant cost scales with input size. Split the work so each piece touches less (chunk, shard, prune the search space) or so independent pieces run in parallel.
   - **Caching.** The same computation or fetch repeats on identical inputs. Store and reuse the result. Name what invalidates it before claiming the win.
   - **Indirection.** The hot path does expensive work a cheaper intermediate could absorb: an index instead of a scan, a queue that shifts work off the interactive thread, a handle that lets a cheaper implementation swap in. Add the hop only when it removes more from the critical path than it adds.
   - **Batching.** Many small operations each pay a fixed overhead (RPC, query, syscall, draw call). Coalesce them to pay the overhead once per batch.
   - **Redundancy.** The wait hangs on one slow instance or attempt. Duplicate the work (replicas, hedged requests, speculative execution) and take the fastest result. The trace has to show the wait dominates and the system has headroom.
   - **Lazy evaluation.** Cost lands on results that are never used or not needed yet (eager init on the boot path, rendering offscreen items). Defer the work until first use.
   - **Scheduling.** The work must happen, but not during the interactive moment. Move it to where nobody is waiting: idle callbacks, a background warmup after boot, precompute before the user arrives, cleanup after the frame commits. The win is perceived latency, so measure the interactive path, not total work done.
3. Plan the fix from the trace. If it crosses a function boundary, `architect` first. Delegate implementation to a subagent using your configured perf-issue model (default `claude-fable-5-1-thinking-max`). Review the diff. Capture a post-fix trace.
   Apply the **sequence-verifiable-units** principle skill, verifying each attempt before trying the next.
4. Parse and compare the artifacts (JSON to sqlite, diff). "Inconclusive" or wrong-surface is not a pass. Flag it.
5. Cite the measurement in the PR.
6. Run **Opening a PR**.

For sustained improvement against a metric rather than a one-off fix, use the Hillclimb playbook (`playbooks/hillclimb.md`).

**Reply:** baseline number, post-fix number, delta, artifact path.

## Acceptance and throughput checkpoint

Optimize upload, scan, processing, and reporting without changing sharing consent, archive compatibility, cancellation fencing, or access controls. Measure synthetic before/after timings. Add regression contracts before implementation, review independently, create a PR, merge, deploy the existing service, and verify the deployed revision.

The independent design candidates cover the whole pipeline. Implementation uses exclusive file ownership. Integration, commits, PR, merge, and deployment remain serialized under the parent. The critical path is the scan design followed by correctness/performance checks, review, and deployed smoke test.

## Design phases

- [x] Ground
- [x] Sketch (two candidates)
- [x] Cross-judge, pick, and graft
- [x] Agree (skip human checkpoint; implementation and deployment already authorized)
- [x] Implement
- [x] Scrap if evidence invalidates the design. Skip: measurements support the selected design.
- [ ] Verify and ship

## Coverage

- Candidate A: worker-local reuse and bounded batches.
- Candidate B: durable inventory and bulk database alternatives.
- Parent: hosting, deployment, integration, and user-visible progress.
- Independent reviewers: spec/behavior and repository standards.

## Review basis

Base is origin/main at 034921d. Spec is the acceptance above plus docs/IMPORTS.md, docs/DECISIONS.md, and existing import contracts. GitHub CLI is the forge unless Origin is available and resolves this repo.

## Selected design

Candidate A is the base. Candidate B contributes bounded multi-value inserts. The independent judge agrees. The worker owns one scan generator and archive workspace; the database checkpoint remains authoritative. No schema or persisted sidecar is added. Model the Domain shaped this ownership. Sequence Work into Verifiable Units shaped the failing-test and implementation commits.

GitHub CLI is the forge. Origin is installed but cannot resolve dodoscoding/Mazi. Vercel connector access to the existing team failed403; the authenticated CLI resolves the same project. Deployment integrates onto live40478a2, preserving the current Vercel runtime.
