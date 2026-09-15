---
ticket: T-98
status: done
size: L
prd: .prd/prd-v7.md
depends_on: [T-94]
timeout: 900
started: 2026-09-14T20:39:07Z
last_check: 2026-09-14T20:44:57Z passed 994c0e09517a
verified: 2026-09-14T20:44:57Z 994c0e09517a
finished: 2026-09-14T20:44:57Z
---

## Objective
Make the frozen driver actually place and cap a run, and ship the run orchestrator the
v7 edition is missing, so that no record can name a driver that only half-drove it.

## Context
- PRD: [Make trusted delivery easier and cheaper](../.prd/prd-v7.md).
- Implements: R-08 (a defect in the benchmark edition T-94 shipped; no new scope).
- Scenarios: none of its own; it removes a provenance hole in S-22..S-24 before any run
  exists to be affected by it.
- Relevant files: scripts/delivery-benchmark-v7/live-driver.sh;
  scripts/delivery-benchmark-v7/freeze-spec.cjs;
  test/fixtures/delivery-benchmark-v7/frozen.json;
  docs/prd-v7-protocol.md; docs/prd-v6-artifacts/benchmark/run-live.sh (the v6 driver
  whose behaviour is being ported, read-only).
- Found by: reviewing the merged v7 edition before the first live run, while zero runs
  exist and re-minting the cohort is free.
- Build order, verification limits and shared constraints: [v7 ticket map](../docs/prd-v7-ticket-map.md).

## Requirements

**The two driver defects.** `live-driver.sh` validates `--workspace` and then never uses
it — no `cd`, no `--add-dir` — so the session runs in the caller's working directory
while the frozen configuration claims `cwd_kind: 'scratch'`. It likewise requires and
validates `--wall-clock-minutes` and then never enforces it: there is no timeout in the
exec line, and neither `timeout` nor `gtimeout` exists on the supported host. As shipped
the driver can neither place a run nor cap it, while the freeze asserts both. Fix both.
The cap must actually terminate the session and produce an exit status the caller can
distinguish from the model's own failure; port the v6 mechanism, which used a Node
wrapper for exactly this reason, rather than assuming coreutils.

**The missing orchestrator.** The v7 edition ships libraries and a one-session driver.
There is no run loop, no run directory, no record writer, no resume and no usage-limit
stop, so whoever executes the schedule writes all of it — and the cohort then identifies
a configuration enforced by a file nobody froze. Ship the orchestrator in this
repository and name it in `freeze-spec.cjs` so its digest is part of the cohort. It must
carry the behaviours v6 had and v7 lost:

- Stop the schedule on the first usage, rate or quota limit, marking that run invalid
  with its reason. v6 lost six runs because its driver kept walking after the limit and
  turned every remaining cell into a one-turn failure.
- Kill a session on the wall clock and record the cap as an `operator` intervention. v6's
  single worst event was an uncapped hung process: 5 h 22 m, 59.6% of that study's entire
  calendar span.
- Judge a cap-terminated session on what it committed. v6 got this wrong once, marking a
  55-turn run that committed code and was evaluated as having produced no usable work.
- Checkpoint per cell and resume at the next uncompleted cell, never at cell 1, because a
  schedule this size spans several account reset windows.
- Rerun invalidated cells at repetitions above the schedule (`schedule.cjs` allows up to
  9), each naming the run it replaces, with the original retained and its reason kept.
- Install the pinned kit per arm, which `harness.prepare()` does not do.
- Never re-freeze mid-study. Removing the re-freeze-and-re-evaluate path is the specific
  v6 hole PRD v7 exists to close.

**One new cohort, minted openly.** Editing the driver and adding a named input both
change the cohort identity; that is the mechanism working, not a problem to route around.
Regenerate the committed manifest in the same change and update every place that carries
the old identity. No run exists, so nothing is re-evaluated and no record changes cohort.

**Pin the Codex CLI.** The protocol records Codex availability as outstanding, to be
verified at execution. It is now verified on the supported host — `codex-cli 0.153.4`,
authenticated — so that row becomes a pinned version. Nothing else in section 9 moves.

## Acceptance Criteria
- [x] A run launched through the driver executes in the workspace it was given, proven by
      the session's own working directory rather than by inspection of the script.
- [x] A session that outruns `--wall-clock-minutes` is terminated by the cap, and the
      caller can tell that outcome apart from a model failure and from a usage limit.
- [x] The orchestrator stops the schedule on the first usage limit rather than converting
      the remainder into one-turn failures, and the stop is recorded with its reason.
- [x] An interrupted schedule resumes at the next uncompleted cell with completed cells
      untouched.
- [x] A rerun is numbered above the schedule, names the run it replaces, and leaves the
      original on disk with its reason.
- [x] The orchestrator is a named input of the freeze; editing it changes the cohort, and
      the committed manifest equals `freeze.compute(REPO, SPEC)`.
- [x] Every suite passes with the new cohort, and no v6 artifact is modified.

## Verification
Proves: the driver places and caps a session, and the orchestrator stops, resumes and
reruns correctly against a stand-in model CLI with controlled outcomes. It does not
prove any behaviour of a real model session — that is T-95, and it has not run.
```bash
set -e
node test/benchmark-orchestrator.test.js
node test/delivery-benchmark-v7.test.js
node test/execution-freeze.test.js
node test/delivery-benchmark.test.js
node test/improvement-contracts.test.js
```

## Constraints
- **No live model session and no spending.** The new suite drives a stand-in CLI with
  scripted outcomes — success, usage limit, hang, partial output, nonzero exit. A test
  that bills is not a test.
- Keep v6 untouched: its protocol, fixture freeze, driver and raw records are frozen, and
  `docs/prd-v7-artifacts/v6-preservation.json` digests 674 of its files individually.
  Port v6's behaviour by reading it; never edit it.
- Never add a file under `scripts/delivery-benchmark/` — `benchmark.cjs` digests that
  whole directory.
- Keep this distribution repository in legacy management mode. Use the independently
  pinned released 0.6.0 management kit outside the tree; do not manage tickets with
  runtime code being edited.
- New executable suites join `npm test`, and the packet validators pin the suite count —
  update them in the same change. Never create placeholder passes.
- Preserve prior PRDs, ticket history and unrelated user work.
