---
ticket: T-03
status: done
size: M
prd: .prd/prd-v1.md
depends_on: [T-02]
started: 2026-09-06T06:38:48Z
last_check: 2026-09-06T06:43:52Z passed 3ae717176748
verified: 2026-09-06T06:43:52Z 3ae717176748
finished: 2026-09-06T06:43:52Z
---

## Objective
Validate ticket input.

## Context
PRD: `.prd/prd-v1.md`, requirement R-03. See the corresponding M0 work package in `docs/pincer-improvement-plan.md`.

## Requirements
Implement the approved M0 behavior with regression coverage. Preserve canonical generation and existing supported interfaces. Reject invalid external input with useful diagnostics.

## Acceptance Criteria
- [x] Malformed metadata, missing sections and ambiguous tickets fail clearly.
- [x] Supported indented unchecked criteria block completion.

## Verification
```bash
node test/validation.test.js
node test/ticket.test.js
```

## Constraints
No new dependencies, publication, or later-milestone runtime redesign. Preserve existing user work; test changes in temporary projects.
