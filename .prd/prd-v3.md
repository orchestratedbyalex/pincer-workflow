---
version: 3
status: draft
date: 2026-09-10
profile: small
---

# Recovery, evidence checks and plan questions after the interactive trial

## Profile

`small`: three wording changes to shipped playbooks and one checklist, each with
an observable rule that a wording test can pin; no runtime code, no schema
change, no authorization boundary, and verification is `npm test` plus the two
generators producing no diff.

## 1. Problem

The first interactive trial of the published 0.4.0 kit
(`docs/trial-2026-09-10-interactive.md`) passed release but showed three
places where the playbooks leave the agent to guess. After a hand repair that
restored the source to the evaluated candidate, the agent re-verified the
ticket and committed a receipt refresh nobody asked for; the candidate rule
then correctly demanded a second full evaluation for a two-timestamp change.
Evaluate bundled three commands under one check and marked the bundle
`unverified` although two of the commands passed. Plan asked what "done" looks
like when the brief had already named the test runner.

**Original brief** (the advice the user approved with "go ahead"): "Ship the
wording fixes as a small PRD: the recovery rule from finding 1 (when the source
matches HEAD and the committed receipt passed, the user restores the ticket and
nothing is committed; a receipt refresh on a built PRD is a new candidate and
must be weighed as such), one check per command in evaluate, and a line in the
plan playbook against asking what the brief already settles." Findings 1, 3
and 4 of the trial record are the source of each requirement.

**Authorization basis:** the user approved this scope in the session on
2026-09-10; the file list below is the delegated implementation choice.

## 2. Solution

Sharpen three playbooks and the dry-run checklist so the observed ambiguities
have one documented answer, and pin each answer with a wording assertion in
`test/workflow.test.js`, which is how this kit protects playbook contracts.
The candidate rule in `notes_current` stays as it is: a ticket change after
evaluation is a new candidate. The change assumes the agent reads the
recovery section when a ticket is in a failed or hand-edited state, as the
trial showed it does. It excludes runtime capture of command logs and any
automated ticket recovery, which belong to the M1 runtime.

## 3. Scope

| This PRD covers | This PRD does NOT cover |
| --- | --- |
| Recovery wording in the code playbook for a repair that returns the tree to the evaluated candidate | Changing `notes_current`, the guard, or `pincer-ticket.sh verify` behavior |
| The dry-run checklist cheat box that describes the expected hand-off | Automated recovery that preserves attempt history (M1) |
| One command per `checks` entry in the evaluate playbook and the checklist | Validator rules that try to detect prose in `command` (M1 log capture makes it moot) |
| The plan playbook's rule for questions the brief partly answers | Any change to the four-question budget or the design question |
| Wording tests for all three, regenerated adapters and plugin | The trial's other observations (log provenance, `4xx` wording leak) |

## 4. Requirements

#### R-01 — A repair that restores the candidate commits nothing
- Scenario: a PRD is `built` and evaluated; a source file is changed in the
  working tree; `verify` on its ticket fails and revokes the receipt; the user
  restores the source and the ticket from their own terminal so `git status
  --short` is empty. Then the code playbook says the committed receipt stands,
  the agent runs no `verify` and makes no commit, and status reports the notes
  current.
- Scenario: the agent is asked to restore a ticket file with git. It declines,
  names the exact command the user runs in their own terminal, and includes
  the source path in that command when the fault is in source, instead of
  editing the source itself or asking how to fix it.
- Scenario: the source change is real and stays. The playbook says this is a
  new ticket and a new candidate, and the re-verified receipt is committed
  with that ticket's work, never on its own as a "refresh".
- Failure path: the user's repair leaves the tree dirty or the ticket still
  carries a failed `last_check`. Status keeps reporting stale or the warning,
  and the next action stays `/pincer-code` with a re-verify, as today.
- Preserve: the guard's blocked forms; the existing sentences the R-06 wording
  tests assert ("hand the repair to the user, who performs it in their own
  terminal", "a restored receipt is never evidence", "Do not recommend
  restoring source files or unrelated edits"); the candidate rule that any
  ticket commit after evaluation forces re-evaluation.

#### R-02 — One command per evidence check
- Scenario: evaluate runs three commands during the security pass (tracked
  `.env` check, secret scan, dependency audit). The manifest records three
  `checks` entries, each with the one command that ran in `command`, its own
  `result`, and its own log; only the audit that could not run is
  `unverified`.
- Scenario: a manual smoke run is recorded as a check. Its `command` is the
  command line that was run, or the check is recorded with the commands as
  separate entries; prose describing a session is not a command.
- Failure path: none at runtime; the validator keeps accepting any non-empty
  `command` string, and the rule is a playbook contract pinned by a wording
  test and a dry-run checklist box.
- Preserve: evidence schema 1, `unverified` for tools that cannot run,
  `required: false` for non-required checks, existing manifests validate
  unchanged.

#### R-03 — Plan asks only what the brief leaves open
- Scenario: the brief says "Use node:test with `npm test`". Plan does not ask
  what "done" looks like; if it needs the unanswered part (a demo, a manual
  check), it asks only that part and says which part the brief settled.
- Scenario: the brief settles storage, stack and scope. Plan asks no discovery
  question and records the brief's answers under the requirements.
- Failure path: a question repeats something the brief states. The dry-run
  checklist box "none were already answered by the brief" fails, as today.
- Preserve: the question budget of four, batching, the frontend design
  question, and "Never ask a question the brief already answers".

## 5. Architecture

#### Structure
```
template/.claude/commands/pincer-code.md      # Recovering a ticket file: repair outcomes
template/.claude/commands/pincer-evaluate.md  # step 9: one command per checks entry
template/.claude/commands/pincer-plan.md      # Phase 1 step 2: partly answered questions
template/docs/dry-run-checklist.md            # code cheat box; evaluate check box
test/workflow.test.js                         # wording assertions for R-01..R-03
template/.agents/skills/…, template/.github/prompts/…, plugin/…   # regenerated
```

#### Key components
- The code playbook's recovery section gains a short "after the repair"
  paragraph distinguishing a tree back at the candidate (nothing to do) from a
  real source change (new ticket, new candidate), and states how the hand-off
  is phrased.
- The evaluate playbook's step 9 says one command per check, and that the
  `command` field holds the command line as run.
- The plan playbook's discovery step says a partly answered question is asked
  only for the open part.
- `test/workflow.test.js` pins each sentence, as the R-06 block already does;
  `test/distribution.test.js` fails if the generated adapters or the plugin
  are stale.

#### Data flow
Playbook text → generators (`template/scripts/sync-prompts.sh`,
`scripts/build-plugin.sh`) → adapters and plugin → `npm test`.

## 6. Success Criteria

| Criterion | How to verify |
| --- | --- |
| Wording tests cover all three rules and pass | `npm test` |
| Generated outputs are current | `bash template/scripts/sync-prompts.sh && bash scripts/build-plugin.sh && git status --short` shows no drift |
| The recovery paragraph answers the trial's case | Re-run the trial's code cheat in the fixture at `~/Documents/dev/personal/pincer-trial-interactive`: after the user's restore, the assistant makes no commit and status is current |
| Existing R-06 assertions still hold | `node test/workflow.test.js` |

## 7. Out of Scope

- Capturing command logs by running the command through the kit rather than
  letting the agent author the log (trial finding 2; M1 runtime).
- Automated ticket recovery that preserves attempt history (M1).
- Validator heuristics for prose in `command`.
- The security-defaults wording leaking into PRDs ("4xx-equivalent"; trial
  finding 5).
- Making `pincer-ticket.sh verify` leave a passing receipt untouched (trial
  finding 6); a re-stamp on success is the current contract.
