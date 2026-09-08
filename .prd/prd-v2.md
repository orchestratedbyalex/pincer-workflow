---
version: 2
status: draft
date: 2026-09-08
---

# Verification that tests behavior, and gates that fit the change

## Problem
The 2026-09-08 dry run (`docs/dry-run-2026-09-08-sonnet.md`) showed the M0 trust
repairs holding, and showed where the kit still costs users effort for no gain.
Verification blocks grep for identifiers, so a receipt can pass while the
feature is broken. The release checklist asks for visual evidence the kit gives
no place to store. Plan and narrow apply opposite approval rules. A PRD for a
one-line CSS change weighs the same as one for a feature. Five smaller defects
from the same run are cheap to fix alongside.

## Solution
Tighten the contracts in the playbooks, templates and scripts so that a
verification block must fail on wrong behavior, evaluate persists evidence
where release can find it, one approval rule covers plan and narrow, and PRD
and ticket weight follow change size. Fix the five small defects in the
status and ticket scripts and the guard. Everything stays in `template/`,
regenerated and tested as today.

## Scope
| This PRD covers | This PRD does NOT cover |
| --- | --- |
| R-01 Behavioral verification: ticket template and narrow playbook require checks that exercise the change; source greps allowed only as a secondary line | Automatic generation of tests; mutation testing |
| R-02 Evidence location: evaluate writes visual and command evidence under `.prd/evidence/prd-vN/`; release checklist item 11 reads from there or is dropped for non-UI work | Screenshot diffing; hosted evidence storage |
| R-03 One approval rule: plan asks once when architecture or scope is new to the repo; narrow never asks for a breakdown that follows the PRD | Authenticated approval identities (already out of scope in v1) |
| R-04 Size profile: a size line in the brief or PRD (`profile: small` or `standard`); small caps PRD to core sections and one to two tickets; PRDs never contain code | The full M3 profile system with per-profile checklists |
| R-05 Small fixes: guard allows `git checkout`/`git restore` of ticket paths to HEAD; verify failure message says the failure was recorded; single readiness WARN; elapsed line only while a ticket is in progress or a budget is set; built-status flip folded into the evaluate commit | Any change to the receipt format or manifest schema |
| R-06 Dry-run checklist: single-line cheat instructions, hook payload tests instead of model prompts, cheat order | Automating the live trial |

## Architecture
Playbooks `pincer-plan.md`, `pincer-narrow.md`, `pincer-evaluate.md` and the
two templates carry R-01, R-03, R-04; `docs/release-checklist.md` and the
evaluate playbook carry R-02; `pincer-ticket.sh`, `pincer-status.sh`,
`pincer-ticket-lib.sh` and `hook-policy.cjs` carry R-05;
`docs/dry-run-checklist.md` carries R-06. Contract tests in
`test/workflow.test.js` pin the playbook wording; `test/hooks.test.js` pins the
guard change; `test/verification.test.js` and a status test pin the script
changes. No new dependencies, no schema changes, generated outputs stay under
`template/`.

Data flow for evidence: evaluate produces files → `.prd/evidence/prd-vN/` →
NOTES.md lists them by path → release checks the listed paths exist.

## Success Criteria
| Requirement | Verification |
| --- | --- |
| R-01 | Contract test: ticket template and narrow playbook state the behavioral rule; a ticket whose block is only greps fails a new `validate_ticket` warning |
| R-02 | Evaluate playbook names the evidence directory; release checklist item 11 references it; `test/workflow.test.js` asserts both |
| R-03 | `test/workflow.test.js` asserts plan asks once and narrow does not ask for approval of a breakdown |
| R-04 | PRD template documents `profile`; plan playbook caps small PRDs; contract test asserts "no implementation code" survives |
| R-05 | `test/hooks.test.js` allows restore-to-HEAD of a ticket path; `test/verification.test.js` asserts the new failure message; status output contains one WARN per ticket and no elapsed line for a built PRD |
| R-06 | `docs/dry-run-checklist.md` cheat steps are single lines and reference `bash .claude/hooks/block-dangerous.sh` payloads |

## Out of Scope
- M1 evidence design beyond a directory convention, M2 measurement, M4
  learning loop (improvement plan).
- Codex hook adapter, Copilot and Codex chain trials (open threads).
- Windows validation.
