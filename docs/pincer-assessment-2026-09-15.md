# Pincer assessment — 15 September 2026

The next implementation should finish the v7 execution path before spending on its
study, then use real strict-coverage pilots to choose the next usability improvement.
The shipped scaffold, concise resume and first-use documentation address the previous
assessment's recommendations. A new broad feature programme would be premature.

Reviewed local HEAD `0534ea2`, including PR #3's v7 implementation and PR #4's T-98
run-loop fixes. This is a technical/product assessment, not a formal evaluation,
release audit, competitor survey or authorization to execute paid trials.

## What improved

- `coverage scaffold` preserves authored information and exposes unresolved mappings
  without inventing proof or granting authorization.
- `resume --brief` uses the existing computed report and reduces the amount a fresh
  session must read without creating another readiness policy.
- The README now shows a complete strict journey and distinguishes installed support
  from live observations.
- T-98 fixes real execution defects: workspace placement, wall-clock termination,
  fresh-session environment cleanup, stopping on account limits and retaining
  completed-cell checkpoints.
- The project preserves unfavorable historical measurements and explicitly leaves
  unobserved requirements open.

## Findings that should precede paid runs

These findings concern the benchmark orchestration, not demonstrated bypasses in the
shipped product runtime. The reproductions used disposable local workspaces, a tiny
stand-in kit installer, a substituted session response and a substituted passing
held-out evaluator. No model was invoked. Substitution isolates orchestration behavior;
it does not establish that any real candidate would be accepted.

### F-01 — P1: run completion does not produce a reportable effort record

`orchestrator.cjs:255` records a session interval, but never transfers provider usage
from the saved response into `reported`. It also never observes strict adoption.
At line 307 it assigns status from the evaluator outcome without calling
`effort.problems()`.

Reproduction: a stand-in response contained `total_cost_usd: 1.25`, duration and token
usage. A passing evaluator produced a record marked `valid`, but all three reported
metrics remained null without reasons and strict adoption remained unobserved.
`effort.problems()` rejected it. Planning without externally supplied provenance also
leaves required digests missing; the execution API does not refuse this before launch.
Even callers that supply those digests do not resolve the missing metrics/adoption.

Implement one completion path that parses usage, observes workspace adoption,
records unavailable measurements with reasons and validates the record before declaring
it reportable. Preserve candidate acceptance separately from experiment validity.
Test the actual orchestrator output through the actual record validator, including
successful, capped, unavailable and rerun cases. A rerun's explanatory `reason` also
needs a compatible terminal representation: `valid` currently requires reason null.

### F-02 — P1: frozen metadata is not enforced against execution inputs

`driveRun` accepts a cohort, model and caps independently of its planned record and
never compares them with a recomputed freeze. The driver validates a cohort's shape,
not its correspondence to the inputs it executes.

Reproduction: plan under cohort A, then drive that pending cell with cohort B and a
changed model/turn cap. The stand-in driver received B; the completed record retained
A. Execution was not refused. A frozen file being covered by CI does not prevent this
runtime mismatch.

Add a preflight before workspace mutation or session launch that reconciles the
planned record, frozen execution files, kit digest, effective model/tool configuration,
caps and evaluator/browser implementation. Refuse changed inputs or explicitly create
a new cohort. The driver also inherits the caller's environment and personal agent
configuration; recording an allowlist of scalar settings does not itself isolate those
inputs. Make isolation an executed, tested property of the runner.

### F-03 — P1: default and strict arms have no distinct execution instruction

`driveRun` loads the same `brief.prompts` and installs the same kit for both Pincer arms.
The arm name reaches the driver as metadata, but the driver does not pass it to the
agent. `cli-greenfield`'s strict prompt only says to read BRIEF.md and implement it.
Nothing in this path requires strict adoption for one arm and default coverage for the
other; `adoption.required` exists only in the measurement record.

Freeze minimal arm-specific workflow instructions while preserving identical task
intent. Observe the resulting workspace to establish the arm actually followed, and
classify noncompliance as a protocol failure. Merely setting `adoption.observed` from
the requested arm would fabricate the observation.

### F-04 — P1: kit installation commits the unrelated edits being measured

`harness.prepare` applies `unrelatedEdits` before `installKit`, whose final action is
`harness.commitAll` (`orchestrator.cjs:178`). That stages every file.

Reproduction: prepare the brownfield-maintenance workspace with an untracked
`operator-note.txt`. Before install, status reports `?? operator-note.txt`. After
installing the stand-in kit, status is clean and `git ls-files` includes the note.
The harness has violated preservation before an agent starts, and only kit arms take
this installation path.

Install and commit the kit before injecting the controlled unrelated edits, or stage
only installation-owned changes while preserving the prior index and working tree.
Pass the resulting preservation baseline to the evaluator. Test both modified tracked
files and untracked files across all three arms.

### F-05 — P1: interruption inside a run is not checkpointed

The persisted record remains `pending` with zero events at session launch. Successful
session events are kept in memory until the entire prompt sequence and evaluation
finish. Logs are written only after the synchronous driver returns.

Observed in the stand-in at the launch boundary: the on-disk record still had no setup
or running-session event. Source inspection shows a restart will call `prepare` and
start the prompt loop again. A process crash/kill therefore risks repeating paid work,
rewriting workspace files and overwriting same-named logs. This review did not perform
a real process-kill test; the missing checkpoint was directly inspected.

Persist a run claim and session boundaries, keep unique append-only attempt artifacts,
and distinguish never-started from interrupted work. Resume from a known boundary or
retain the interruption and allocate an explicit rerun. Add kill-and-restart tests and
exclusive run claiming; temporary-file rename alone is not a concurrent allocation lock.

## Recommended implementation sequence

1. **Finish trustworthy v7 execution.** Close F-01 through F-05 with an offline
   end-to-end runner test, including record validation and interruption. Configure a
   real held-out browser adapter for UI cases. Re-mint the frozen cohort openly before
   its first live run. This is a bounded follow-up to T-98, not another measurement
   subsystem.
2. **Observe the strict journey on real work.** Complete the already planned baseline
   pilots with the pinned baseline kit, then matched improved-kit runs. Include a
   brownfield project with unrelated edits and a Claude-to-Codex handoff. Record map
   authoring, repeated reads, decisions, recovery and human review effort. Project
   selection/access, trial caps and independent reviewers remain execution prerequisites.
3. **Use the findings to simplify coverage authoring.** My leading product hypothesis
   is a guided authoring flow on top of the existing scaffold: expose one unresolved
   decision at a time, show requirement/scenario and candidate ticket/check context,
   validate a proposed map and present an exact diff before adoption. Preserve authored
   ownership of links and commands and the existing authorization boundary. This is a
   proposal to validate in pilots, not a claim that its benefit is measured.
4. **Make release preparation reproducible.** Add a local preparation command that
   updates version metadata, regenerates distribution outputs and runs parity checks
   before candidate selection. Keep publication separate. This directly addresses the
   recorded version/plugin mismatch and avoids invalidating evaluation with the later
   version bump; do not broaden the evidence allowlist to hide that ordering error.
5. **Measure before expanding.** Complete the approved comparison and timed independent
   reviews after the runner is ready. Keep the existing 72-run scope unless explicitly
   revised. Judge success by accepted changes, preserved behavior, interventions,
   authoring/recovery time and reviewer effort, alongside agent cost/time.

Defer dashboards, automatic parallel orchestration, additional lifecycle states and
broad platform expansion until observation shows a concrete need. The product's
strongest opportunity is making reliable continuation and review substantially easier.

## Verification and limits

- Inspected the current PRD, latest commits, review packet, protocol, wiki, installer,
  orchestration, driver, freeze, effort validation and corresponding tests.
- Reproduced record incompleteness, cohort mismatch and preservation contamination with
  an offline probe; inspected the persisted record at the session launch boundary.
- Local `npm test` was started and has passed through coverage evidence checks without
  a failure so far; the full chain is still running, so this is not a full-suite pass.
- Queried [CI run 34930700263](https://github.com/orchestratedbyalex/pincer-workflow/actions/runs/34930700263)
  on exact HEAD: Ubuntu Node 22 and 24 passed; both macOS jobs were still running.
  The separate successful Pages deployment is not a regression-suite result.
- No npm publication state or current platform capability was independently
  checked for this assessment. Local git history contains both merges. Existing review
  packet/wiki claims about unpushed v7 and unpinned Codex conflict with newer local
  records and should be reconciled in current summaries, retaining historical evidence.
- No product source, runtime state, ticket status or frozen benchmark input was changed.
