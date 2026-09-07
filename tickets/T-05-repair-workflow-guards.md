---
ticket: T-05
status: done
size: M
prd: .prd/prd-v1.md
depends_on: [T-04]
started: 2026-09-07T14:55:58Z
last_check: 2026-09-07T15:14:41Z passed 14dabf0e8335
verified: 2026-09-07T15:14:41Z 14dabf0e8335
finished: 2026-09-07T15:14:41Z
---

## Objective
Repair workflow guards and project guidance.

## Context
PRD: `.prd/prd-v1.md`, requirement R-05. See the corresponding M0 work package in `docs/pincer-improvement-plan.md`.

## Requirements
Implement the approved M0 behavior with regression coverage. Preserve canonical generation and existing supported interfaces. Reject invalid external input with useful diagnostics.

## Acceptance Criteria
- [x] Hooks parse JSON and protect documented command/state changes.
- [x] Playbooks support greenfield and brownfield, scoped staging and existing authorization.

## Verification
```bash
node test/hooks.test.js
node test/workflow.test.js
```

## Constraints
No new dependencies, publication, or later-milestone runtime redesign. Preserve existing user work; test changes in temporary projects.
