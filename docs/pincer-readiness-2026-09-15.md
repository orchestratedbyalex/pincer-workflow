# Pincer readiness — 15 September 2026, after T-99

## Decision

Continue the original direction, but finish a bounded validation increment before
starting another broad feature programme or the paid comparison. The installed
product has a substantial engineering foundation. The current study runner still
has reproducible measurement defects, and the live evidence needed to close PRD v7
does not exist. Best-in-class performance is an objective, not an established result.

Reviewed HEAD: `380555449df504e9a1b6a44a2df3624710600ccf` (PR #5 merged).
This report updates the earlier assessment against `0534ea2`; it does not rewrite
that historical record. It is advice, not a formal evaluation or release verdict.

## Current state

| Area | Verified state | Implication |
| --- | --- | --- |
| Published npm version | `npm view pincer-workflow version` returns `0.6.0` | Main contains product changes beyond tag v0.6.0; merged and published are different states |
| Regression checks | Current SHA passed all four CI jobs: Ubuntu/macOS × Node 22/24 | Strong automated baseline, subject to what the tests actually exercise |
| Runtime foundation | Shared runtime, source-bound attempts, explicit change lifecycle and authorization, strict coverage, candidate evidence | Retain and build on it |
| V7 product improvements | Coverage scaffold, brief resume, onboarding and mode-aware revision remedy are in main | Implemented; real-use benefit is still unmeasured |
| Management state | Legacy mode; PRD v7 ticketed; 5 of its 13 tickets done, 8 open | No current strict change record for this distribution repository |
| Candidate evidence | Status reports `CANDIDATE_STALE`: NOTES/evidence belong to PRD v6 | V7 is not release-ready |
| Live work | T-89 pilots, T-93 platform journeys/handoff and T-95 comparison/reviews unfinished | These are substantive deliverables, not paperwork |
| Working tree before review | Untracked `docs/diagrams/` and `docs/pincer-workflow-guide.md` | Preserve and deliberately include or exclude before selecting a release candidate |

CI: [run 34958530803](https://github.com/orchestratedbyalex/pincer-workflow/actions/runs/34958530803).
The package test chain contains 63 suites. A fresh local run passed its first nine
suites, then stopped in recovery because the sandbox refused an HTTP listener on
127.0.0.1 (`EPERM`). The recovery suite passed when rerun outside the sandbox.
This is not a claim that the full local chain passed; the complete pass is CI's.

T-90, T-91, T-92, T-96 and T-97 have implementation material but remain open behind
their dependencies. The review packet explicitly explains this. Do not mark them
done merely to align the ticket count with the code. Complete the observations, or
make an explicit scope/build-order revision preserving what actually happened.

## Position against the original plan

These are assessment judgments against `docs/pincer-improvement-plan.md`, not
new milestone completion records.

| Milestone | Assessment |
| --- | --- |
| M0 — Repair trust | Substantially delivered, with preservation and failure regression coverage |
| M1 — Reliable runtime | Substantial implementation delivered; continue testing silent failure and recovery boundaries |
| M2 — PRD continuity | Requirement/scenario inventory, mappings, dispositions and impact delivered; semantic adequacy still requires review |
| M3 — Adaptive workflow and parity | Partial: resume and adapters exist; observed end-to-end platform parity remains open |
| M4 — Prove the advantage | Infrastructure exists, but the advantage has not been demonstrated |

The next step is to complete the M3/M4 evidence and use it to choose the next product
improvement. There is no reason here to restart the architecture programme.

## Remaining findings before paid study execution

All three reproductions below are offline. The probe uses temporary projects, the
actual orchestrator and validator, and substituted session/evaluator results. It
never invokes an agent. An accepted stand-in evaluator is only a control for the
orchestrator; it says nothing about the quality of a real candidate.

### F-01 — P1: effective configuration still escapes experiment identity

At `scripts/delivery-benchmark-v7/orchestrator.cjs:558`, `main()` computes the freeze
from static SPEC, then accepts model and cap overrides. It records those overrides
in the planned environment, so the later planned-versus-driven comparison agrees
with them without checking that they match the frozen configuration.

Reproduction: call the actual `main()` twice with separate temporary `--runs`
directories and `--plan-only`: model-A/10 turns and model-B/20 turns. Both produce
cohort `47dedc0a6102fc66e7c69348d3d4487dc4a68258f7bc72428314696addd8e1ce`,
while the records contain different models/caps. No session launches.

T-99 fixed disagreement between a planned record and a caller. This is a distinct
remaining gap between the effective configuration and the identity of the experiment.
Either refuse overrides inconsistent with SPEC, or compute the cohort from the
effective configuration before planning. Pin and reconcile the kit and browser
adapter as execution inputs too. Capture actual tool version and host details:
the operator entry point currently leaves tool, tool_version, OS, platform release
and permission mode null in planned records, and the run loop does not populate them.

Source inspection also shows inherited personal configuration remains uncontrolled:
`harness.sh` inherits `process.env`, and `live-driver.sh:100` removes only two nesting
variables. A shared personal configuration does not prove a bare-agent baseline or
eliminate interaction with different arm instructions. Isolate relevant settings or
capture and explicitly define that baseline. No private configuration was read here.

### F-02 — P1: restart after a persisted session invalidates the record

The restart path retains events while replaying setup and all sessions. Event IDs
remain `<run>:setup` and `<run>:S1`, so replay repeats IDs already checkpointed.
See `orchestrator.cjs:394`, `:423` and `:440`.

Reproduction: run one plain control through a substituted successful session and
evaluator: status `valid`, `effort.problems()` empty. Restore the record to the
post-session/pre-evaluation pending boundary, retaining setup/session events, then
call `driveRun` again. The result is `invalid`; the validator reports
`EVENT_DUPLICATE` for setup and S1. This simulates a persisted crash boundary; it is
not a real process-kill test.

The current restart test constructs an interrupted workspace with an event-empty
record. It therefore misses the boundary the newly added checkpoints produce.
Use attempt-specific event identities or separate immutable attempt records. Retain
all interrupted effort and logs, and validate every restart boundary. Execution
should also claim a cell exclusively; the current read/write sequence has no run lock.

### F-03 — P1: incomplete usage becomes a complete-looking total

At `orchestrator.cjs:210`, `readUsage()` returns a numeric total once any session
supplies that metric, even when another session payload is missing or malformed.

Reproduction: S1 reports $1.25, 120 tokens and one provider minute; S2 contains
truncated JSON. The result is:

```json
{"reported":{"tokens":120,"cost_usd":1.25,"provider_minutes":1},"unavailable":{}}
```

This silently understates the run's cost/time/tokens. Mark incomplete aggregate
metrics null with reasons, or model measured subtotals explicitly without presenting
them as totals. Retain cost from discarded attempts as well: completion currently
reads the current logs directory, not archived attempt logs.

Also cover every terminal exit with the same finalization contract. Source inspection
shows account-limit, ambiguous-exit and evaluator-exception branches return before
`complete()`. They can leave metrics without the reasons the validator requires.
An unavailable evaluation also needs an explicit terminal reason. Add actual
orchestrator-to-validator cases for these paths, not only authored record fixtures.

## Other attention needed now

1. **A real browser evaluator.** The seam accepts an adapter, but none is selected or
   implemented for the study. Nine UI cells would be unavailable without it. Exercise
   working and deliberately broken UI controls through a real browser before freezing.
2. **Release preparation.** Finalize version metadata and generated plugin/adapters
   before candidate selection, then evaluate that candidate. Add a small preparation
   command to make that order reproducible. Keep the evidence rules conservative.
3. **Current summaries.** Wiki and review packet still mix historical and current
   claims: main SHA, publication verification, suite counts and completed merges.
   Reconcile current summaries while preserving frozen historical evidence. The wiki
   advice to put a measurement correction in an unfrozen sibling is unsafe for study
   integrity if that sibling changes execution or scoring; those changes need provenance
   and a cohort decision regardless of file location.
4. **Dogfooding.** The distribution repo's legacy mode is documented, not a runtime
   defect. After validation, trial its own supported multi-change/strict path for a
   future change using an independent pinned management kit. Do not migrate historical
   records merely to make status look better.

The unproven stale-lock race, hook false positives and obsolete installed file cleanup
remain secondary follow-ups. No new installed-runtime bypass was demonstrated by this
review. This is not an exhaustive runtime or security audit.

## Recommended sequence and exit gates

### 1. Close the bounded execution and release-preparation gaps

Fix F-01–F-03, the terminal-record paths, exclusive run claiming and browser readiness.
Test actual output records across successful, rejected, unavailable, interrupted and
restarted runs. Verify effective input provenance before launching anything. Re-mint
the cohort openly while no live study records exist. Prepare release metadata before
selecting the candidate; do not call PRD v7 complete while observations remain open.

**Exit:** offline controls and deliberate failures behave correctly, records validate,
input changes are refused or change cohort, and CI passes on the resulting commit.

### 2. Complete the real journeys already planned

Select one greenfield and two brownfield projects, including unrelated local edits.
Run baseline and improved kits on matched snapshots. Include an authorized revision,
pause, fresh-session recovery, Claude-to-Codex handoff, and schema 3 evaluation.
Observe ordinary use of shipped instructions and record every operator intervention.

**Exit:** T-89/T-93 have inspectable evidence, failures remain visible, and repeated
approval, authoring and recovery friction is measured. Project access, spending/time
caps and the required independent reviewers still need concrete arrangements; this
assessment does not launch or authorize paid trials.

### 3. Make one measured usability improvement

My leading hypothesis remains guided coverage authoring: show unresolved scenarios,
relevant ticket/check context, proposed links, validation errors and the exact map
diff, then retain explicit reviewed adoption. Validate this hypothesis in the pilots.
Keep the small-change path proportionate and preserve source-bound evidence and
authorization. Do not infer that less output automatically means less work.

**Exit:** fewer avoidable operations and less authoring/recovery time on matched tasks,
with no weaker coverage, preservation or stale-evidence behavior.

### 4. Complete the comparison, then expand selectively

Retain the planned 72 cells and independent timed reviews unless scope is explicitly
revised. Use a staged operational preflight to catch runner failures before the full
schedule; do not quietly replace the study with a smaller favorable sample.

The previous study accepted 17/18 candidates in each arm. Pincer cost $43.34 against
$9.20, approximately 4.7 times as much, on six bounded briefs. Its limits prevent
generalization to all work, but it is a concrete reason to prioritize overhead and
user effort. Source: `docs/trial-prd-v6.md`, comparison table and limitations.

Define success as accepted changes with preserved behavior, lower avoidable effort,
reliable handoffs and faster accurate review. Measure distributions, denominators,
failures and human time alongside provider usage. A negative result is useful evidence.

## What best in class should mean

The strongest product promise remains: know what was agreed, what changed, what passed
and what remains, even after changing agents or returning later. Make that trustworthy
and easy enough that users choose it again.

Structured specification workflows are already available in
[Spec Kit](https://github.com/github/spec-kit) and
[OpenSpec](https://github.com/Fission-AI/OpenSpec). This brief source check is not a
comparative benchmark. My strategic inference is that Pincer should compete on
demonstrated continuity, evidence quality and total user effort. After the current
plain-agent comparison, benchmark pinned relevant alternatives on matched work before
making a class-leading claim. Do not add more agents, dashboards, lifecycle states or
platform breadth without an observed need.

## Review artifacts and limits

- Reproduction script retained locally at `/tmp/pincer-review-probe.cjs`; output at
  `/tmp/pincer-review-probe-output.txt`. These scratch artifacts are temporary, not
  durable release evidence. The reproduction conditions/results are recorded above.
- No feature source, ticket state, frozen benchmark input or evaluation was changed.
  This readiness report is the only repository file added by the review.
- No paid session, publication, merge or remote message was performed.
