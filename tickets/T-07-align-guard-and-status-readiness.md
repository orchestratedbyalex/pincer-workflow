---
ticket: T-07
status: done
size: S
prd: .prd/prd-v1.md
depends_on: [T-06]
started: 2026-09-07T15:24:51Z
last_check: 2026-09-07T15:26:49Z passed 804842bf8130
verified: 2026-09-07T15:26:49Z 804842bf8130
finished: 2026-09-07T15:26:49Z
---

## Objective
Align hook edit simulation and status dependency readiness with the operations they guard.

## Context
PRD: `.prd/prd-v1.md`, requirements R-04 and R-05. The final evaluation reproduced
two conservative-readiness gaps after the original six tickets were built.

## Requirements
Honor `replace_all` while simulating Edit and MultiEdit changes to ticket files. A status
row may advertise a dependency as ready only when that dependency belongs to the same PRD,
matching the existing `start` transition check.

## Acceptance Criteria
- [x] Replace-all edits cannot change protected lifecycle fields through an earlier prose match.
- [x] Cross-PRD dependencies are shown as blocked and are still refused by start.

## Verification
```bash
node test/hooks.test.js
node test/recovery.test.js
```

## Constraints
Keep this fix within the existing M0 parser and status architecture. Do not broaden the hook
into a complete shell security boundary or add dependencies.
