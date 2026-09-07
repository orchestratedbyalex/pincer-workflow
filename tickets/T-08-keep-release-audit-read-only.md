---
ticket: T-08
status: done
size: S
prd: .prd/prd-v1.md
depends_on: [T-07]
started: 2026-09-07T15:30:15Z
last_check: 2026-09-07T15:30:31Z passed ead9a0e17d1a
verified: 2026-09-07T15:30:31Z ead9a0e17d1a
finished: 2026-09-07T15:30:31Z
---

## Objective
Keep the release audit read-only so it cannot invalidate the evaluation it audits.

## Context
PRD: `.prd/prd-v1.md`, requirements R-02, R-04, and R-05. The release playbook
currently promises a read-only audit and then invokes a state-writing verification command.

## Requirements
Release must inspect current receipts and rerun the project-level release gate directly.
It must not call the ticket state writer, rewrite receipts, or dirty the evaluated candidate.

## Acceptance Criteria
- [x] Release instructions do not invoke state-writing ticket transitions.
- [x] The candidate-wide gate still runs and any failure blocks PASS.

## Verification
```bash
node test/workflow.test.js
```

## Constraints
Do not add a second receipt mode or expand the M0 runtime. Keep the audit read-only.
