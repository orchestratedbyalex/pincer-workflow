---
ticket: T-06
status: open
size: M
prd: .prd/prd-v1.md
depends_on: [T-05]
---

## Objective
Automate distribution checks.

## Context
PRD: `.prd/prd-v1.md`, requirement R-06. See the corresponding M0 work package in `docs/pincer-improvement-plan.md`.

## Requirements
Implement the approved M0 behavior with regression coverage. Preserve canonical generation and existing supported interfaces. Reject invalid external input with useful diagnostics.

## Acceptance Criteria
- [ ] The full regression suite and generated parity pass.
- [ ] Packed installs cover all platforms in greenfield and brownfield projects; CI is defined.

## Verification
```bash
npm test
```

## Constraints
No new dependencies, publication, or later-milestone runtime redesign. Preserve existing user work; test changes in temporary projects.
