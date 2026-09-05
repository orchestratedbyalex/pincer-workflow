---
ticket: T-04
status: open
size: M
prd: .prd/prd-v1.md
depends_on: [T-03]
---

## Objective
Correct PRD recovery.

## Context
PRD: `.prd/prd-v1.md`, requirement R-04. See the corresponding M0 work package in `docs/pincer-improvement-plan.md`.

## Requirements
Implement the approved M0 behavior with regression coverage. Preserve canonical generation and existing supported interfaces. Reject invalid external input with useful diagnostics.

## Acceptance Criteria
- [ ] Starting requires a usable explicitly associated PRD, with safe legacy binding.
- [ ] New drafts and stale evaluation notes never inherit release readiness.

## Verification
```bash
node test/recovery.test.js
node test/ticket.test.js
```

## Constraints
No new dependencies, publication, or later-milestone runtime redesign. Preserve existing user work; test changes in temporary projects.
