---
ticket: T-02
status: open
size: M
prd: .prd/prd-v1.md
depends_on: [T-01]
---

## Objective
Revoke invalid verification.

## Context
PRD: `.prd/prd-v1.md`, requirement R-02. See the corresponding M0 work package in `docs/pincer-improvement-plan.md`.

## Requirements
Implement the approved M0 behavior with regression coverage. Preserve canonical generation and existing supported interfaces. Reject invalid external input with useful diagnostics.

## Acceptance Criteria
- [ ] Failed and interrupted attempts cannot reuse an earlier passing receipt.
- [ ] Closing runs the current check, and failed completed-ticket checks are visible.

## Verification
```bash
node test/verification.test.js
node test/ticket.test.js
```

## Constraints
No new dependencies, publication, or later-milestone runtime redesign. Preserve existing user work; test changes in temporary projects.
