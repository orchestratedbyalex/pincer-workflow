---
ticket: T-01
status: done
size: M
prd: .prd/prd-v1.md
depends_on: []
started: 2026-09-05T18:45:40Z
verified: 2026-09-05T18:47:32Z 5ce6679e6494
finished: 2026-09-05T18:47:43Z
---

## Objective
Preserve installer customizations.

## Context
PRD: `.prd/prd-v1.md`, requirement R-01. See the corresponding M0 work package in `docs/pincer-improvement-plan.md`.

## Requirements
Implement the approved M0 behavior with regression coverage. Preserve canonical generation and existing supported interfaces. Reject invalid external input with useful diagnostics.

## Acceptance Criteria
- [x] Repeated updates preserve customized project files and existing conflict sidecars.
- [x] Legacy manifests cannot turn local edits into overwrite permission.

## Verification
```bash
node test/installer.test.js
node test/smoke.test.js
```

## Constraints
No new dependencies, publication, or later-milestone runtime redesign. Preserve existing user work; test changes in temporary projects.
