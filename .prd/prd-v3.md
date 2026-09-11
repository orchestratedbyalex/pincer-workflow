---
version: 3
status: built
date: 2026-09-10
profile: small
---

# Recovery, evidence checks and plan questions after the interactive trial

## Profile

`small`: a bounded playbook and checklist change based on an observed trial;
no runtime, guard or schema change. Recovery adds one exception to an existing
rule, so it carries explicit conditions and a negative scenario despite the
small implementation. Wording assertions protect the documented contract; two
focused live observations check that an agent follows it.

## 1. Problem

The first interactive trial of the published 0.4.0 kit
(`docs/trial-2026-09-10-interactive.md`) passed release but showed three
places where the playbooks leave the agent to guess. Asked to restore a ticket
while a source fault was still in place, the agent reverted the source itself,
re-verified the ticket and committed a receipt refresh nobody asked for; the
candidate rule then correctly demanded a second full evaluation for a
two-timestamp change. Evaluate bundled three commands under one check and
marked the bundle `unverified` although two of the commands passed. Plan asked
what "done" looks like when the brief had already named the test runner.

**Original brief** (the advice the user approved with "go ahead"): "Ship the
wording fixes as a small PRD: the recovery rule from finding 1 (when the source
matches HEAD and the committed receipt passed, the user restores the ticket and
nothing is committed; a receipt refresh on a built PRD is a new candidate and
must be weighed as such), one check per command in evaluate, and a line in the
plan playbook against asking what the brief already settles." Findings 1, 3
and 4 of the trial record are the source of each requirement.

**Authorization basis:** the user approved the brief above on 2026-09-10 and
revised this PRD the same day after an external review; the file list was
delegated. Approval of the PRD does not start implementation.

## 2. Solution

Sharpen plan, code, evaluate and status, plus the dry-run checklist, so the
observed ambiguities have one documented answer. Protect the contract with
wording assertions in `test/workflow.test.js` and record the live observations
in a trial file. The candidate rule in `notes_current` stays as it is: a
ticket change after evaluation is a new candidate. The change assumes the
agent reads the recovery section when a ticket is in a failed or hand-edited
state, as the trial showed it does. It excludes runtime capture of command
logs and any automated ticket recovery, which belong to the M1 runtime.

## 3. Scope

| This PRD covers | This PRD does NOT cover |
| --- | --- |
| The recovery rule for a tree that is back at the evaluated candidate, in code and status | Changing `notes_current`, the guard, or `pincer-ticket.sh verify` behavior |
| The dry-run checklist cheat box that describes the expected hand-off | Automated recovery that preserves attempt history (M1) |
| One independently reported executable check per entry in evaluate and the checklist | Validator heuristics for prose in `command` or runtime log capture |
| Asking only unresolved material questions in plan, including when design direction is supplied | Increasing the question budget or removing frontend design discovery |
| Wording tests, a focused trial record, regenerated adapters and plugin | The trial's other observations (log provenance, `4xx` wording leak) |

## 4. Requirements

#### R-01 — A tree that is back at the evaluated candidate commits nothing
- Default, unchanged: a failed attempt remains a failure; a restored receipt
  is never evidence. A malformed or hand-edited ticket is preserved as it is,
  the validation error is reported, the user repairs it in their own terminal,
  and the ticket returns through `start`, `verify`, `done` for fresh
  verification. Source restoration is not routine ticket repair.
- Exception, checkable by the agent: the PRD is built and its evaluated
  candidate has valid evidence; tracked files
  other than the ticket file being restored match that candidate (or the
  candidate plus its evidence-only commit) and nothing is untracked; and the
  ticket's Verification block passes when run directly, not through `verify`,
  which would write a receipt. When all three hold, the committed evaluation
  still describes the tree. The agent says so, names the exact command for the
  user to restore the ticket file in their own terminal, and does not run
  `verify`, does not refresh the receipt, and commits nothing. Restoring the
  ticket file puts back what is committed; it is not new evidence, so the
  default sentence stays true.
- Scenario (the trial): a source edit made `verify` fail and revoke the
  receipt; the edit was then reverted so `notes.js` matches the candidate. The
  Verification block passes directly. The assistant names
  `git checkout -- tickets/T-02-done-command.md` for the user, explains that the
  candidate evaluation stands, and commits nothing. After the user runs it,
  `pincer-status.sh` reports `current` with no warnings.
- Scenario: the user asks the assistant to restore the ticket itself. It
  declines (the guard blocks it and the rule forbids it), names the command
  for the user, and does not ask which way to fix the source when the answer
  is already settled by the tree matching the candidate.
- Scenario: source changes remain relative to the candidate. The rule does
  not apply. If the change is wanted, it goes through a ticket under the
  existing lifecycle and becomes a new candidate to re-evaluate. If it is not
  wanted, the assistant says which paths differ and lets the user decide
  whether to discard them; permission to restore a ticket does not authorize
  discarding source changes.
- Negative scenario: the tree matches the candidate but the Verification block
  fails when run directly. The failure is real (environment, external data or
  flaky check). Keep the failed `last_check`, investigate, and repair through
  the lifecycle with fresh verification. Do not restore the receipt to obtain
  a green status.
- Failure path: a failed receipt on a done ticket keeps the readiness warning
  and the `Next /pincer-code — re-run verify` routing; nothing in this PRD
  changes runtime routing. Quote the actual status output and resolve its
  cause.
- Preserve: guard behavior, the existing R-06 sentences and their assertions
  ("hand the repair to the user, who performs it in their own terminal", "a
  restored receipt is never evidence", "Do not recommend restoring source files
  or unrelated edits"), fresh verification for ordinary recovery, and
  re-evaluation after any ticket commit. Status line "Never restore a ticket
  file from git to clear a warning; a failed attempt is a record" gains the
  same exception so code and status do not conflict.

#### R-02 — Separate independently reported executable checks
- Scenario: evaluate runs three commands during the security pass (tracked
  `.env` check, secret scan, dependency audit). The manifest records three
  `checks` entries, each with the actual command line in `command`, its own
  `result` and its own safe log for commands that ran; only the audit that
  could not run is `unverified`.
- Scenario: a manual smoke run is recorded as a check. Its `command` is the
  command line that was run, or the run is recorded as separate entries when
  the commands establish independent outcomes; prose describing a session is
  not a command. Command lines and logs must not expose secrets; note a
  redaction rather than inventing an executable substitute.
- Boundary: `npm test` may remain one executable check with an aggregate
  result and log. Do not split every subprocess or assertion. Independently
  assessed scans and audits must not share a result that hides their
  individual outcomes. Visual and reviewer checks keep their kinds and do not
  acquire artificial shell commands.
- Failure path: none at runtime; the validator keeps accepting any non-empty
  `command` string, and the rule is a playbook contract pinned by a wording
  test and a dry-run checklist box.
- Preserve: evidence schema 1, `unverified` for tools that cannot run,
  `required: false` for non-required checks, existing manifests validate
  unchanged. Unavailable tools get a reason, not a fabricated log;
  requiredness follows the agreed verification plan, not whether a tool passed.

#### R-03 — Plan asks only what the brief leaves open
- Scenario: the brief says "Use node:test with `npm test`". Plan records that
  verification choice without asking for it again. A test runner does not
  settle all acceptance behavior: if a material decision remains about a demo,
  manual check or expected behavior, ask only about that open part and name
  the settled part. Do not add a question to fill the budget.
- Scenario: the brief settles every material discovery decision, including
  acceptance behavior. Plan asks no discovery question and records the brief's
  answers. Storage, stack and scope alone need not settle everything.
- Failure path: a question repeats something the brief states. The dry-run
  checklist box "none were already answered by the brief" fails, as today.
- Preserve: the question budget of four, batching, the frontend design topic,
  and "Never ask a question the brief already answers". Apply the same rule
  when design direction has already been supplied; otherwise keep the design
  question for frontend projects.

## 5. Architecture

#### Structure
```
template/.claude/commands/pincer-code.md      # Recovering a ticket file: the back-at-candidate exception
template/.claude/commands/pincer-status.md    # recovery line agrees with code
template/.claude/commands/pincer-evaluate.md  # step 9: one command per check, command line as run
template/.claude/commands/pincer-plan.md      # Phase 1 step 2: partly answered questions
template/docs/dry-run-checklist.md            # code cheat box; evaluate check box
test/workflow.test.js                         # wording assertions for R-01..R-03
docs/trial-<date>-prd-v3.md                   # the two live observations and what stays outstanding
template/.agents/skills/…, template/.github/prompts/…, plugin/…   # regenerated
```

#### Key components
- Code and status keep the default and add the one exception with its three
  conditions; short enough to be read, not a paragraph of caveats. No script,
  guard or state format change.
- Evaluate's step 9 records one command per check with the command line as
  run, and keeps non-command check kinds.
- The plan playbook's discovery step says a partly answered question is asked
  only for the open part.
- `test/workflow.test.js` pins the new sentences next to the existing R-06
  assertions; `test/distribution.test.js` fails if the generated adapters or
  the plugin are stale.

#### Data flow
Playbook text → generators (`template/scripts/sync-prompts.sh`,
`scripts/build-plugin.sh`) → adapters and plugin → `npm test`.

## 6. Success Criteria

| Criterion | How to verify |
| --- | --- |
| Code and status carry the same rule and the R-06 assertions still hold | `npm test` passes with the new wording assertions added |
| Generated outputs are current | Run both generators, then run them again with no further diff; distribution parity passes |
| R-01 eligible case commits nothing | In the existing fixture, from the modified kit's packed tarball: inject the `done` fault, observe the failed `verify`, revert the source, then ask the assistant to restore the ticket; observe the named command, no `verify`, no commit, unchanged HEAD, and `current` status after the user runs it |
| R-01 negative case keeps the failure — `outstanding (see Out of Scope)` | Same fixture, clean tree, a Verification block made to fail without a source change; observe that the assistant keeps the failed `last_check` and does not recommend restoring the receipt. Attempted 2026-09-10 with a bypassable environment fault; not observed |
| R-02 and R-03 wording present | Wording assertions. R-02 was observed as a by-product of the trial re-evaluation (six checks, security pass as three entries); R-03 live observation is outstanding until the next full trial |

Record kit revision or package digest, agent and model versions, prompts and
observed outputs in the trial record, and finalize that record before
selecting the evaluation candidate, since a later doc commit makes the
candidate stale. Wording tests prove contract presence, not agent compliance;
observations not made are reported as outstanding, not as passing.

## 7. Out of Scope

- Capturing command logs by running the command through the kit rather than
  letting the agent author the log (trial finding 2; M1 runtime).
- Automated ticket recovery that preserves attempt history (M1).
- Validator heuristics for prose in `command`.
- The security-defaults wording leaking into PRDs ("4xx-equivalent"; trial
  finding 5).
- Making `pincer-ticket.sh verify` leave a passing receipt untouched (trial
  finding 6); a re-stamp on success is the current contract.
- Live observation of the R-01 negative scenario with a persistent failure.
  Attempted on 2026-09-10 with an environment fault (`docs/trial-2026-09-10-prd-v3.md`);
  the agent detected and bypassed the fault, so the observation stays
  outstanding and the wording question it raised is logged for follow-up.
