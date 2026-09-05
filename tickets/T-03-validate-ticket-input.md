---
ticket: T-03
status: open
size: M
prd: .prd/prd-v1.md
depends_on: [T-02]
---

## Objective
Validate ticket input.

## Context
PRD: `.prd/prd-v1.md`, requirement R-03. See the corresponding M0 work package in `docs/pincer-improvement-plan.md`.

## Requirements
Implement the approved M0 behavior with regression coverage. Preserve canonical generation and existing supported interfaces. Reject invalid external input with useful diagnostics.

## Acceptance Criteria
- [ ] Malformed metadata, missing sections and ambiguous tickets fail clearly.
- [ ] Supported indented unchecked criteria block completion.

## Verification
```bash
node test/validation.test.js
node test/ticket.test.js
```

## Constraints
No new dependencies, publication, or later-milestone runtime redesign. Preserve existing user work; test changes in temporary projects.
