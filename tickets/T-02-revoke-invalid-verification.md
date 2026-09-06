---
ticket: T-02
status: done
size: M
prd: .prd/prd-v1.md
depends_on: [T-01]
started: 2026-09-05T18:47:44Z
last_check: 2026-09-06T06:38:27Z passed 89eb117e9525
finished: 2026-09-05T18:49:32Z
verified: 2026-09-06T06:38:27Z 89eb117e9525
---

## Objective
Revoke invalid verification.

## Context
PRD: `.prd/prd-v1.md`, requirement R-02. See the corresponding M0 work package in `docs/pincer-improvement-plan.md`.

## Requirements
Implement the approved M0 behavior with regression coverage. Preserve canonical generation and existing supported interfaces. Reject invalid external input with useful diagnostics.

## Acceptance Criteria
- [x] Failed and interrupted attempts cannot reuse an earlier passing receipt.
- [x] Closing runs the current check, and failed completed-ticket checks are visible.

## Verification
```bash
node test/verification.test.js
node test/ticket.test.js
```

## Constraints
No new dependencies, publication, or later-milestone runtime redesign. Preserve existing user work; test changes in temporary projects.
