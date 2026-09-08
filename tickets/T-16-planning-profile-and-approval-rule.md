---
ticket: T-16
status: open
size: M
prd: .prd/prd-v2.md
depends_on: [T-11]
---

## Objective
Scale planning weight by risk through a validated `profile: small|standard` PRD field and apply one authorization-reuse rule across plan, narrow, code and evaluate.

## Context
- PRD: `.prd/prd-v2.md`, requirement R-05. Implements: R-05.
- Dry-run findings 3 and 4 in `docs/dry-run-2026-09-08-sonnet.md`: inconsistent approval gates; 115-line PRDs for CSS changes.
- `template/scripts/pincer-ticket-lib.sh` `validate_prd`; `template/scripts/pincer-status.sh` PRD line.
- `template/.claude/commands/pincer-plan.md`, `pincer-narrow.md`, `pincer-code.md`, `pincer-evaluate.md`; `template/.claude/references/prd-template.md`.
- `test/validation.test.js` (PRD metadata), `test/workflow.test.js` (wording).

## Requirements
- `validate_prd` accepts an optional `profile` field with value `small` or `standard`; any other value is a validation error naming the allowed values. Missing profile means `standard` (older PRDs). Status prints the effective profile on the PRD line.
- PRD template: document `profile`; define `small` as bounded scope, low risk, known behavior and straightforward verification, and state that few changed lines alone do not qualify; migrations, authorization boundaries, uncertain requirements and broad effects stay `standard`. The PRD records why the profile fits. Small PRDs keep Problem/Outcome, Scope, Requirements with scenarios, Verification, Risks and Exclusions, and omit empty sections and repetition. Interface examples may clarify contracts; implementation code must not substitute for requirements.
- Plan playbook: choose and justify the profile; honor an explicit budget without inventing a default timebox and without silently cutting requirements.
- Narrow playbook: ticket count follows cohesion and dependencies with no hard one-to-two-ticket cap; a PRD-authorized breakdown needs no second approval; newly discovered consequential choices are surfaced before implementation.
- One authorization rule, written identically in plan, narrow, code and evaluate: reuse explicit authorization for the same scope and decisions; ask only about a material choice not already authorized; prepare the concrete proposal first; a delegated architecture decision does not require another approval; record the authorization basis and covered scope in the PRD or handover; an agent-written record or status field is not authenticated human approval; when resuming without the necessary context, do not invent authorization.
- Remove fixed-timebox wording from the playbooks ("within the timebox" in evaluate step 7 and similar) where the user supplied no budget.
- Tests: `test/validation.test.js` covers `profile` accepted values, rejection message and default; `test/workflow.test.js` asserts the shared rule text appears in all four playbooks, the no-cap and no-default-timebox wording, and the profile definition in the template.

## Acceptance Criteria
- [ ] `profile: small` and `profile: standard` validate, an invalid value is rejected with the allowed values named, and a missing profile reports as standard in status.
- [ ] The PRD template and plan playbook define when small applies, require a recorded justification, and forbid implementation code as a substitute for requirements.
- [ ] Plan, narrow, code and evaluate contain the same authorization-reuse rule, no hard ticket cap and no default timebox.
- [ ] `node test/validation.test.js` and `node test/workflow.test.js` cover the above and pass; generated outputs match.

## Verification
```bash
node test/validation.test.js && node test/workflow.test.js && node test/distribution.test.js
```

## Constraints
- No authenticated approvals or approval provenance (M1).
- Do not change ticket format or receipts.
