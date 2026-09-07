---
ticket: T-09
status: done
size: S
prd: .prd/prd-v1.md
depends_on: [T-08]
started: 2026-09-07T15:34:59Z
last_check: 2026-09-07T15:35:51Z passed 991aeb6d458a
verified: 2026-09-07T15:35:51Z 991aeb6d458a
finished: 2026-09-07T15:35:51Z
---

## Objective
Separate the product release audit from Pincer-kit dry-run and distribution checks.

## Context
PRD: `.prd/prd-v1.md`, requirements R-05 and R-06. The final release audit showed
that its source checklist still mixed generic candidate readiness with kit maintenance.

## Requirements
Ship a general release checklist on every channel. Keep toy workflow dry runs and this
repository's generator/package checks as separate artifacts. Align evaluation fixes with
the ticket state machine and describe secret review without printing candidate values.

## Acceptance Criteria
- [x] Release audits the selected PRD and candidate without assuming a toy project or Pincer repository.
- [x] Kit distribution checks and safe evaluation-fix instructions remain explicit and independently testable.

## Verification
```bash
node test/workflow.test.js
node test/distribution.test.js
```

## Constraints
Preserve the existing dry-run guide for manual platform trials. Do not add dependencies
or a second release runtime.
