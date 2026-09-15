---
ticket: T-99
status: done
size: L
prd: .prd/prd-v7.md
depends_on: [T-98]
timeout: 900
started: 2026-09-15T05:39:37Z
last_check: 2026-09-15T06:15:47Z passed a05a552f47b9
verified: 2026-09-15T06:15:47Z a05a552f47b9
finished: 2026-09-15T06:15:47Z
---

## Objective
Close the five gaps between the v7 execution path and a reportable study, so that a run
produces a record its own validator accepts, the strict arm is actually an arm, and a
crash costs a cell rather than corrupting it.

## Context
- PRD: [Make trusted delivery easier and cheaper](../.prd/prd-v7.md).
- Implements: R-08 (defects in the benchmark edition T-94 and T-98 shipped; no new scope).
- Scenarios: none of its own; it removes five holes in S-22..S-24 while zero runs exist.
- Found by: `docs/pincer-assessment-2026-09-15.md`, independently re-verified — four
  findings confirmed as written, one (preservation) real but with a larger defect
  underneath it, plus three gaps the assessment did not raise. See
  [the wiki page](../docs/wiki/systems/v7-execution-gaps.md) for the verification detail.
- Relevant files: scripts/delivery-benchmark-v7/orchestrator.cjs, harness.cjs, effort.cjs,
  freeze-spec.cjs; test/fixtures/delivery-benchmark-v7/frozen.json and the two brownfield
  briefs; test/benchmark-orchestrator.test.js; docs/prd-v7-protocol.md.
- Build order, verification limits and shared constraints: [v7 ticket map](../docs/prd-v7-ticket-map.md).

## Requirements

**The strict arm must be an arm.** `loadBrief(id, dir)` takes no arm, so `brief.prompts` is
arm-independent; `installKit` branches on arm exactly once; the `pincer` and `strict`
workspaces are byte-identical and so is the captured argv. Twenty-four cells — a third of
the schedule — currently buy a duplicate of another arm, and the claim the study exists to
test is untestable by this harness. Give each arm a frozen instruction that varies only the
workflow clause and never the task, and **observe** the adoption that results from the
run's own workspace rather than asserting it from the requested arm. A strict run that did
not adopt is a protocol failure; a default run that did adopt is equally a finding.

**A completed run must produce a record the validator accepts.** `driveRun` assigns status
from the evaluator and writes without ever calling `effort.problems()`. `reported.tokens`,
`reported.cost_usd` and `reported.provider_minutes` stay null while the validator demands a
reason for each; adoption stays unobserved while the validator fails any strict run that
cannot show it. `claimRerun` sets `reason` on a `pending` record, which the validator
rejects outright — a rerun is invalid the instant it is created. Parse what the driver
already saves, record what is genuinely unavailable *with its reason*, and validate before
declaring a record reportable. Keep candidate acceptance separate from experiment validity:
a rejected candidate is a valid measurement.

**Preservation must measure something, and the harness must not break it first.** Two
defects, and they must be fixed together. The check is dead: nothing supplies unrelated
edits, `prepare`'s return value is discarded, and the record carries no `workspace` key, so
every run reports `0 unrelated edit(s) intact` — a fabricated pass on briefs whose own text
tells the agent to leave local edits alone. And the ordering is inverted: edits are applied
before an install whose final act is `git add -A`, which is precisely the behaviour
`harness.cjs` says those checks exist to catch. Wiring the record on without reordering
would fail twelve of seventy-two cells against the kit arms — wrong in the direction that
discredits the product.

**A crash must cost a cell, not corrupt it.** On the success path nothing is written
between planning and the final record, so a killed cell reads `pending` with no events
after completed sessions. Restarting re-drives every prompt and overwrites the logs, and
because `prepare` never wipes, `git add -A` sweeps the dead attempt's commits into the
restarted run's `provenance.base` — a record that looks clean and that no reader or
validator can detect. Re-drive from a genuinely clean workspace, retain the discarded
attempt's logs and name it in an intervention, and checkpoint completed sessions so a
crashed cell says what it had done. Do not resume mid-cell: a session killed in flight
leaves an indeterminate tree, and a cheap resume buys back money at the cost of the
comparison the study exists to produce.

**Execution inputs must be reconciled with the freeze.** `driveRun` takes cohort, model and
caps from its caller and compares them with nothing; `freeze.compute` is not called at
execution time at all. Refuse a mismatch before the workspace is touched or a session
launched. Scope this to cohort, model and caps: the inherited environment is constant
across arms and so cannot confound the comparison, and sandboxing it is a separate project
that this ticket must not grow into.

**Three gaps the assessment did not raise, all cheap.** The orchestrator has no operator
entry point — no `require.main`, no npm script, no documented invocation — so an operator
must hand-write exactly the unfrozen caller the freeze exists to eliminate; ship one.
`driveSchedule` has no parameter for a browser adapter, so the `ui-states` brief is
structurally `unavailable` for nine of seventy-two runs whatever the agent writes; make the
adapter suppliable and leave the choice of adapter to the operator. And a cap-less dry run
writes `outstanding`, which is terminal to `driveRun` and unreplaceable by `claimRerun`, so
one refusal strands a cell permanently and the study can never read `complete`; a refusal
that launched nothing must leave the cell as it found it.

**One new cohort, minted openly.** Editing the named execution path changes the cohort;
regenerate the committed manifest in the same change. No run exists, so nothing is
re-evaluated. This is the last moment the re-mint is free.

## Acceptance Criteria
- [x] The three arms receive different execution instructions with identical task intent,
      proven by the prompt the driver was actually given rather than by inspection.
- [x] Adoption is read from the run's own workspace; a strict run that did not adopt is
      recorded as a protocol failure, and a default run that did adopt is recorded too.
- [x] A completed run's record passes `effort.problems()` with no problems, for a plain
      arm and a strict arm, driven end to end through a stand-in CLI.
- [x] Every null reported metric carries its reason; no metric is reported as a fake zero.
- [x] A rerun record is valid: it names the run it replaces without a `reason` the
      validator refuses, and the original stays on disk with its own reason.
- [x] Unrelated edits survive kit installation, and a run that sweeps them into a commit
      fails the preservation check — proven on both an untracked file and a modified
      tracked file, on all three arms.
- [x] A killed cell re-drives from a clean workspace: the restarted run's base does not
      contain the dead attempt's commits, its logs are retained under a distinct name, and
      the discarded attempt is named in an intervention event.
- [x] A cell whose cohort, model or caps disagree with its planned record is refused before
      the workspace is touched, and no session is launched.
- [x] A cap-less invocation leaves the cell drivable rather than stranding it.
- [x] The orchestrator has an operator entry point, and a browser adapter can be supplied
      through it.
- [x] Every suite passes with the new cohort, the committed manifest equals
      `freeze.compute(REPO, SPEC)`, and no v6 artifact is modified.

## Verification
Proves: the orchestrator produces records its own validator accepts, distinguishes the
arms, preserves what it promises to preserve, and survives a kill — all against a stand-in
model CLI with controlled outcomes. It does not prove any behaviour of a real model
session; that is T-95, and it has not run.
```bash
set -e
node test/benchmark-orchestrator.test.js
node test/delivery-benchmark-v7.test.js
node test/execution-freeze.test.js
node test/delivery-benchmark.test.js
node test/improvement-contracts.test.js
node test/improvement-review-packet.test.js
```

## Constraints
- **No live model session and no spending.** Every new case drives a stand-in CLI. A test
  that bills is not a test.
- Keep v6 untouched: its protocol, fixture freeze, driver and raw records are frozen, and
  `docs/prd-v7-artifacts/v6-preservation.json` digests 674 of its files individually.
- Never add a file under `scripts/delivery-benchmark/` — `benchmark.cjs` digests that whole
  directory.
- Append to `SPEC.harness`, never prepend: `test/delivery-benchmark-v7.test.js` indexes it.
- Keep this distribution repository in legacy management mode. Use the independently pinned
  released 0.6.0 management kit outside the tree.
- Extend the existing orchestrator suite rather than adding a new one, so the suite count
  the packet validators pin does not move. Never create placeholder passes.
- Do not grow this ticket into environment isolation, mid-cell resume, or a staging
  allowlist for the kit install. Each was considered and is more than the defect warrants.
- Preserve prior PRDs, ticket history and unrelated user work.
