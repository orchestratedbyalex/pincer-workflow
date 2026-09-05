---
ticket: T-05
status: open
size: M
prd: .prd/prd-v1.md
depends_on: [T-04]
---

## Objective
Repair workflow guards and project guidance.

## Context
PRD: `.prd/prd-v1.md`, requirement R-05. See the corresponding M0 work package in `docs/pincer-improvement-plan.md`.

## Requirements
Implement the approved M0 behavior with regression coverage. Preserve canonical generation and existing supported interfaces. Reject invalid external input with useful diagnostics.

## Acceptance Criteria
- [ ] Hooks parse JSON and protect documented command/state changes.
- [ ] Playbooks support greenfield and brownfield, scoped staging and existing authorization.

## Verification
```bash
node test/hooks.test.js
node test/workflow.test.js
```

## Constraints
No new dependencies, publication, or later-milestone runtime redesign. Preserve existing user work; test changes in temporary projects.
