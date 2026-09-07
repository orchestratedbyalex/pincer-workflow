---
ticket: T-04
status: done
size: M
prd: .prd/prd-v1.md
depends_on: [T-03]
started: 2026-09-06T06:44:08Z
last_check: 2026-09-07T14:55:12Z passed 347345439496
verified: 2026-09-07T14:55:12Z 347345439496
finished: 2026-09-07T14:55:12Z
---

## Objective
Correct PRD recovery.

## Context
PRD: `.prd/prd-v1.md`, requirement R-04. See the corresponding M0 work package in `docs/pincer-improvement-plan.md`.

## Requirements
Implement the approved M0 behavior with regression coverage. Preserve canonical generation and existing supported interfaces. Reject invalid external input with useful diagnostics.

## Acceptance Criteria
- [x] Starting requires a usable explicitly associated PRD, with safe legacy binding.
- [x] New drafts and stale evaluation notes never inherit release readiness.

## Verification
```bash
node test/recovery.test.js
node test/ticket.test.js
```

## Constraints
No new dependencies, publication, or later-milestone runtime redesign. Preserve existing user work; test changes in temporary projects.
