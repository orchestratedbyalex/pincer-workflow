---
ticket: T-06
status: done
size: M
prd: .prd/prd-v1.md
depends_on: [T-05]
started: 2026-09-07T15:15:15Z
last_check: 2026-09-07T15:20:54Z passed f135f9fa4f38
verified: 2026-09-07T15:20:54Z f135f9fa4f38
finished: 2026-09-07T15:20:54Z
---

## Objective
Automate distribution checks.

## Context
PRD: `.prd/prd-v1.md`, requirement R-06. See the corresponding M0 work package in `docs/pincer-improvement-plan.md`.

## Requirements
Implement the approved M0 behavior with regression coverage. Preserve canonical generation and existing supported interfaces. Reject invalid external input with useful diagnostics.

## Acceptance Criteria
- [x] The full regression suite and generated parity pass.
- [x] Packed installs cover all platforms in greenfield and brownfield projects; CI is defined.

## Verification
```bash
npm test
```

## Constraints
No new dependencies, publication, or later-milestone runtime redesign. Preserve existing user work; test changes in temporary projects.
