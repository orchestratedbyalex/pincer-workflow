# PRD v7 ticket map and build order

[PRD v7](../.prd/prd-v7.md) is decomposed into **10 open tickets, T-87..T-96**, plus
**T-97**, a fix ticket created during implementation from an observed failure (the
[baseline observation](prd-v7-pilots.md) §2.4 found `REVISION_CHANGED` recommending a
command changes mode refuses). Creating a linked fix ticket and retaining the original
run is what T-89's constraints require of an observed failure.
The user's request, “create the next prd and tickets”, is the basis for this planning
work. These documents define work to implement and observe; they do not record
implementation approval, live spending authorization, passing checks or delivery.

Start with **T-87**. Follow `depends_on`; numeric order is safe. T-90 and T-91
both require the measured baseline from T-89. T-94 needs only T-87/T-88, so the
benchmark controls can be built and frozen before product work is finished.
This is dependency flexibility, not an instruction to run multiple agents.
Sizes describe relative scope, not time estimates. L observation tickets include
actual sessions and review; split them into linked child tickets if useful before
execution, preserving the required scenario coverage.

**Implementation status.** This document is the plan. What was actually built, what
each scenario resolved to and what is still outstanding is in the
[review packet](prd-v7-review-packet.md) — in short: the engineering is done and every
live observation (T-89, T-93, T-95) is outstanding pending the project-access and
spending decisions the protocol lists.

## Ticket order

| Ticket | Work | Size | Depends on | Planned check |
| --- | --- | --- | --- | --- |
| [T-87](../tickets/T-87-freeze-v7-protocol-and-preservation-contract.md) | Freeze the v7 protocol and preservation contract | M | None | C-01 |
| [T-88](../tickets/T-88-record-effort-and-freeze-execution-provenance.md) | Record effort and freeze execution provenance | M | T-87 | C-02 |
| [T-89](../tickets/T-89-observe-three-baseline-strict-pilots.md) | Observe three baseline strict-coverage pilots | L | T-88 | C-03 |
| [T-90](../tickets/T-90-scaffold-reviewable-coverage-drafts.md) | Scaffold reviewable coverage drafts | M | T-89 | C-04 |
| [T-91](../tickets/T-91-add-a-faithful-brief-resume-view.md) | Add a faithful brief resume view | M | T-89 | C-05 |
| [T-92](../tickets/T-92-ship-the-simplified-strict-workflow.md) | Ship the simplified strict workflow | M | T-90, T-91 | C-06 |
| [T-93](../tickets/T-93-observe-platform-journeys-and-agent-handoff.md) | Observe platform journeys and an agent handoff | L | T-92 | C-07 |
| [T-94](../tickets/T-94-build-the-v7-three-arm-benchmark.md) | Build the v7 three-arm benchmark | L | T-87, T-88 | C-08 |
| [T-95](../tickets/T-95-measure-delivery-and-human-review-improvement.md) | Measure delivery and human review improvement | L | T-93, T-94 | C-09 |
| [T-96](../tickets/T-96-assemble-v7-review-and-integration-gates.md) | Assemble v7 review and integration gates | M | T-95 | C-10 |
| [T-97](../tickets/T-97-mode-aware-revision-changed-remedy.md) | Make the `REVISION_CHANGED` remedy mode-aware | S | T-89 | C-11 |

## Scenario ownership and verification

Every scenario has one primary owner below. Integration and live observation may
provide additional evidence. In particular, T-93 observes actual fresh-session use
of T-91's brief view and actual agent compliance with T-92's instructions; T-95
repeats the pilot journeys on the improved kit. T-96 consolidates every result.

The C-NN identifiers below are planned check labels scoped to this document, not
registered candidate checks or execution receipts. Each refers to the exact ticket
verification block. The repository remains in legacy management mode, so no runtime
coverage map or authorization record is created by this planning task. A future
explicitly adopted change must author and validate its map through the normal flow.

| Requirement | Scenario | Primary ticket | Planned check / additional review |
| --- | --- | --- | --- | --- |
| R-01 | S-01 | T-87 | C-01 |
| R-01 | S-02 | T-87 | C-01 |
| R-01 | S-03 | T-87 | C-01 |
| R-02 | S-04 | T-88 | C-02 |
| R-02 | S-05 | T-88 | C-02 |
| R-02 | S-06 | T-88 | C-02 |
| R-03 | S-07 | T-89 | C-03; actual live artifacts and independent acceptance/session review |
| R-03 | S-08 | T-89 | C-03; actual live artifacts and independent acceptance/session review |
| R-03 | S-09 | T-89 | C-03; actual live artifacts and independent acceptance/session review |
| R-04 | S-10 | T-90 | C-04 |
| R-04 | S-11 | T-90 | C-04 |
| R-04 | S-12 | T-90 | C-04 |
| R-05 | S-13 | T-91 | C-05 |
| R-05 | S-14 | T-91 | C-05 |
| R-05 | S-15 | T-91 | C-05; T-93 fresh-session observation |
| R-06 | S-16 | T-92 | C-06 |
| R-06 | S-17 | T-92 | C-06; T-93 live decision review |
| R-06 | S-18 | T-92 | C-06 |
| R-07 | S-19 | T-93 | C-07; actual live artifacts and independent acceptance/session review |
| R-07 | S-20 | T-93 | C-07; actual live artifacts and independent acceptance/session review |
| R-07 | S-21 | T-93 | C-07; actual live artifacts and independent acceptance/session review |
| R-08 | S-22 | T-94 | C-08 |
| R-08 | S-23 | T-94 | C-08 |
| R-08 | S-24 | T-94 | C-08 |
| R-09 | S-25 | T-95 | C-09; actual live artifacts and independent acceptance/session review |
| R-09 | S-26 | T-95 | C-09; actual live artifacts and independent acceptance/session review |
| R-09 | S-27 | T-95 | C-09; actual live artifacts and independent acceptance/session review |
| R-10 | S-28 | T-96 | C-10; external CI and candidate/reviewer evidence |
| R-10 | S-29 | T-96 | C-10; external CI and candidate/reviewer evidence |
| R-10 | S-30 | T-96 | C-10; external CI and candidate/reviewer evidence |

## Planned checks

Commands within each ticket run under `set -e`, so a later successful command cannot
mask an earlier failure. New suites are implementation deliverables and intentionally
do not exist yet. Do not run ticket verification during planning or create placeholder
tests to make the documents appear green.

- **C-01 / T-87:** `node test/improvement-contracts.test.js`; `node test/change-contracts.test.js`; `node test/coverage-contracts.test.js`. Proves static protocol/interface contracts and historical preservation; exact project suitability, reviewer independence and spending decisions remain explicit execution prerequisites.
- **C-02 / T-88:** `node test/effort-records.test.js`; `node test/execution-freeze.test.js`; `node test/delivery-benchmark.test.js`. Proves collection, aggregation, invalid-input refusal, execution identity and redaction against controlled subprocess outcomes; no live delivery benefit is inferred.
- **C-03 / T-89:** `node test/strict-pilot-records.test.js`; `node test/effort-records.test.js`. Proves baseline record completeness, reference/candidate integrity and recomputable effort; actual session compliance and semantic acceptance require review of the linked live artifacts.
- **C-04 / T-90:** `node test/coverage-scaffold.test.js`; `node test/coverage-map.test.js`; `node test/coverage-adoption.test.js`; `node test/coverage-agreement.test.js`. Proves observable scaffold content, unresolved-input handling, containment and no-write behavior, followed by the real existing map/adoption gates.
- **C-05 / T-91:** `node test/resume-brief.test.js`; `node test/change-resume.test.js`; `node test/coverage-reports.test.js`; `node test/runtime-output.test.js`. Proves brief/full behavioral agreement, detail discoverability, compatibility and complete read-only output; T-93 supplies the complementary live fresh-session observation.
- **C-06 / T-92:** `node test/strict-onboarding.test.js`; `node test/workflow.test.js`; `node test/installer.test.js`; `node test/distribution.test.js`; `node test/coverage-distribution.test.js`. Proves documented command usability in packed fixtures, static authorization-guidance contracts, preservation and generated parity; T-93 verifies actual agent behavior.
- **C-07 / T-93:** `node test/platform-trial-records.test.js`; `node test/strict-onboarding.test.js`. Proves record integrity and consistency of versioned capability claims; live compliance is established by the referenced session, evaluator and reviewer artifacts, not record shape.
- **C-08 / T-94:** `node test/delivery-benchmark-v7.test.js`; `node test/execution-freeze.test.js`; `node test/delivery-benchmark.test.js`. Proves schedule/protocol integrity and evaluator sensitivity against independently faulty/working controls, while preserving the old benchmark; actual model/browser observations belong to T-95.
- **C-09 / T-95:** `node test/improvement-trial-records.test.js`; `node test/strict-pilot-records.test.js`; `node test/delivery-benchmark-v7.test.js`. Proves observed-record completeness, candidate/evaluator provenance and recomputed comparisons; independent acceptance, live execution and reviewer judgments must be inspected separately.
- **C-11 / T-97:** `node test/runtime-lifecycle.test.js`; `node test/change-lifecycle.test.js`; `node test/runtime-status.test.js`. Proves the remedy is mode-correct and that the command it names is one the runtime accepts; the rest of the precedence stays covered by the existing readiness suites.
- **C-10 / T-96:** `node test/improvement-review-packet.test.js`; `npm test`. Proves packet/evidence reference integrity, controlled replay cases and complete offline regression coverage; external CI and live-review evidence remain independently identified gates.

## Entry and exit gates

1. **Protocol and access:** T-87/T-88 can proceed before project access or spending
   caps are settled. Before T-89 live work, prepare the selected projects, exact
   configuration, reviewers, schedule and cap; obtain only missing decisions.
2. **Baseline before optimization:** T-89 must supply real observations and a
   prioritized friction record before T-90/T-91. If findings invalidate their proposed
   solution, revise scope and traceability rather than silently substituting features.
3. **Truthful observation:** T-89/T-93/T-95 require actual sessions and candidate/
   evaluator artifacts. A passing record validator proves record properties, not
   that the behavior happened or the reviewer judgment is correct. Unavailable
   required work remains open.
4. **Measured scope:** T-95 includes 72 benchmark runs (eight briefs × three arms ×
   three repetitions), three matched improved-versus-baseline pilot comparisons
   and timed independent review by at least two non-implementing reviewers. This
   is not a cost estimate. Cost the schedule before execution; any smaller study
   needs an explicit scope revision.
5. **Quality and efficiency:** A missed performance target is a reported finding,
   not permission to weaken checks or discard runs. Failed required product
   behavior needs linked fix work and retained failures, or stays unfinished.
6. **Integration:** T-96 runs the full offline suite, generated/packed parity and
   the supported CI matrix on the identified implementation source. New executable
   suites join `npm test`; paid sessions never do.
7. **Evaluation boundary:** Finish normal authored documentation and metadata before
   candidate selection. Preserve normal candidate freshness and exact artifact
   allowlists. Evaluation, merge, version bump and publication are separate stages.

## Shared implementation constraints

- Keep the distribution repository in legacy management mode. Pin an independent
  released 0.6.0 management kit outside the working tree and record its digest.
  Do not migrate/register/select/authorize this repo as a planning side effect or
  use runtime code being edited to manage its own tickets.
- Preserve existing state/evidence schemas and default CLI contracts. Scaffold is
  a draft projection and brief resume is a view of existing computed state; neither
  creates another authoritative record or executes checks.
- Keep v6 protocol, fixture freeze, original driver and raw study records unchanged.
  V7 has a new edition and cohort identity. Fixing old methodology means a new
  study, not rewriting old results.
- Preserve the existing approval/sandbox boundary, source invalidation, recovery,
  latest-failure precedence, update preservation and artifact containment.
- Canonical edits belong in `template/`; regenerate both adapters and plugin.
  Never hand-edit derived outputs. Use focused behavioral suites per ticket and
  the complete suite at the integration boundary.
- Live evidence stays sanitized and local. Capture only allowlisted configuration
  metadata; no credentials, secret-value hashes or unrestricted environment dumps.
- The map's completeness and proposed check adequacy are planning judgments.
  Neither this table nor a scenario label constitutes verification or approval.

