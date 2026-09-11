---
ticket: T-47
status: open
size: M
prd: .prd/prd-v5.md
depends_on: []
---

## Objective
Freeze lifecycle, agreement, and migration contracts so PRD v5 can be implemented and reviewed without losing work or trusting stale state.

## Context
- Relevant files: template/docs/runtime-contracts.md; test/change-contracts.test.js (new); test/fixtures/prd-v5/ (new); package.json.
- PRD: [Preserve changes, authorization, and resume context](../.prd/prd-v5.md), sections 5–8.
- Implements: R-01, R-02, R-03, R-04, R-05, R-06, R-07, R-08, R-09.
- Scenarios: enabling contract/review work; scenario implementation owners are in the ticket map.
- Build order and coverage: [PRD v5 ticket map](../docs/prd-v5-ticket-map.md).

## Requirements
- Specify exact schemas, version numbers, lifecycle/event ownership, selection location, reason codes, command arguments and exit codes. Define read-only resume versus change resume unambiguously.
- Freeze the agreement digest projection, recoverable authored revision references, decision/authorization reference grammar, and within-delegation disposition. Record local provenance limits.
- Define per-change candidate/evaluation identity, evaluation-reference storage without recursive hashing, and completion-before-candidate ordering. Retain strict post-candidate source checks.
- Specify v0.5.0 import, backup, rollback and interrupted-migration behavior. Save representative released-format fixtures; never use newly generated v5 records as the only old-format fixtures.
- Resolve how tracked lifecycle projections behave across worktrees: local selection and attempt storage are independent; divergent portable histories require explicit reconciliation. No distributed owner is implied.

## Acceptance Criteria
- [ ] Contract has concrete examples of valid, invalid, unknown-schema and conflicting records, including the exact transition table and authorization preconditions.
- [ ] Every persistent field has one owner; digest inputs and exclusions are enumerated, with no unsettled candidate or selection ownership decision.
- [ ] Released v0.5.0 fixtures and their source revision are saved; tests pin the static contract and fixture format.

## Verification
Proves: Pins the agreed static contract and released fixture provenance; catches missing state/command/schema definitions. This does not prove lifecycle execution.
```bash
node test/change-contracts.test.js
```

## Constraints
- Contracts and fixtures only; do not claim runtime support until downstream tickets implement it.
- Implement the new tests named below as part of this ticket and add them to `npm test`; these are planned test paths, not tests that already pass. Reuse existing fixture helpers. After any `template/` edit, run both generators and include the generated changes. Keep existing ticket history untouched; use a pinned released kit to manage this work.

