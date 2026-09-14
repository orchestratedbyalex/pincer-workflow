---
ticket: T-80
status: done
size: M
prd: .prd/prd-v6.md
depends_on: []
started: 2026-09-13T19:53:22Z
last_check: 2026-09-13T20:09:28Z passed 0548de0c01e9
verified: 2026-09-13T20:09:28Z 0548de0c01e9
finished: 2026-09-13T20:09:29Z
---

## Objective
Fix review finding F-03 and the four further defects found with it: `coverage`'s next action does not implement the documented precedence, so on a paused, planned, cancelled, superseded or busy change it recommends a command the runtime refuses. `phases.nextAction()` tests implementation problems before lifecycle state, which makes the lifecycle branch unreachable exactly when there is unfinished work. `resume.decide()` implements the precedence correctly; coverage duplicates it and has drifted from it.

## Context
- Relevant files: template/scripts/pincer-runtime/phases.cjs (nextAction, the `Next` line at 213); template/scripts/pincer-runtime/resume.cjs (decide, the correct precedence); template/scripts/pincer-runtime/status.cjs; template/docs/runtime-contracts.md ("next action precedence", rules 1-8); test/coverage-reports.test.js.
- PRD: [Complete requirement coverage and explain change impact](../.prd/prd-v6.md), R-09 (S-25 "Human/JSON coverage and impact name the same affected IDs and blockers; a fresh session can locate the next ticket/check/decision"), which requires the v5 blocker precedence to be kept.
- Also PRD v5 R-06 ("Historical changes route to inspection or a replacement change, never to execution"; S-18 "Human output, JSON, and command gates agree"), R-04 ("planned, paused, cancelled, or superseded execution is refused") and S-09.
- Source: `docs/pincer-assessment-2026-09-13.md` finding F-03 (P2), received 13 September 2026; confirmed during `/pincer-evaluate` of the combined v5+v6 candidate, which found four further states with the same cause.
- Implements: R-09 ("one ordered next action ... Keep v5 blocker precedence").

## Requirements
- One precedence, computed once. `coverage` consumes the same decision `resume` does rather than keeping a second copy, so the two reports cannot disagree again. Where coverage adds its own detail (the affected scenario, check or decision), it adds it to that decision instead of recomputing the route.
- A running attempt of the change outranks everything but invalid state (rule 2): coverage names the attempt and offers `recover`, and `ATTEMPT_RUNNING` appears in its blockers, in both the human and the JSON form.
- A terminal change routes to inspection and a replacement change, never to execution and never to `change authorize`, whatever the authorization verdict says.
- A planned or paused change routes to `change activate` / `change resume`.
- A report produced for an explicitly named `--change` that is not the selected change names `change select <id>` before any execution command, in `coverage`, `resume` and `status` alike.
- The human `Next` line and `next` in JSON carry the same action in every one of those states.

## Acceptance Criteria
- [x] For planned, paused, cancelled, superseded, attempt-running and non-selected-`--change` states, the command `coverage` prints is a command that succeeds, or is an inspection command; `test/coverage-reports.test.js` asserts each state and runs the printed command.
- [x] `coverage`, `resume` and `status` print the same routing decision for every state above.
- [x] `ATTEMPT_RUNNING` appears in coverage's blockers while an attempt is running.
- [x] The contract's precedence list and coverage's behaviour match line for line.

## Verification
Proves: every state routes to a command the runtime will accept, and the three reports agree.
```bash
node test/coverage-reports.test.js
node test/change-resume.test.js
node test/coverage-contracts.test.js
node test/change-contracts.test.js
```

## Constraints
- Findings on done tickets are fixed here, never by editing T-74. After any `template/` edit run both generators and include the generated files. Manage this ticket with the pinned released v0.5.0 kit.
- Reports stay read-only: no file written, no check launched, no approval requested.
