---
ticket: T-10
status: done
size: S
prd: .prd/prd-v1.md
depends_on: [T-09]
started: 2026-09-07T15:47:22Z
last_check: 2026-09-07T15:49:39Z passed de6bf261d33a
verified: 2026-09-07T15:49:39Z de6bf261d33a
finished: 2026-09-07T15:49:39Z
---

## Objective
Make the release-readiness check require a recorded latest verification attempt for every done ticket.

## Context
PRD: `.prd/prd-v1.md`, requirements R-02 and R-06. The final release audit found
that T-01 had a valid legacy receipt but no `last_check`, while status still reported
the candidate ready for release.

## Requirements
Treat a missing latest-attempt record on a done ticket as a readiness warning. Refresh
T-01 through the ticket state machine so every ticket in the selected PRD has current
passed-attempt and receipt evidence.

## Acceptance Criteria
- [x] A done ticket without `last_check` is not reported as release-ready and status directs the user to re-run verification.
- [x] T-01 has a passed `last_check` whose hash matches its current verification receipt.

## Verification
```bash
node test/recovery.test.js
node -e "const fs=require('node:fs'); const s=fs.readFileSync('tickets/T-01-preserve-installer-customizations.md','utf8'); const a=s.match(/^last_check: .* passed ([a-f0-9]{12})$/m); const v=s.match(/^verified: .* ([a-f0-9]{12})$/m); if (!a || !v || a[1] !== v[1]) process.exit(1)"
```

## Constraints
Keep status read-only and preserve the supported legacy ticket format. Update ticket
state only through `scripts/pincer-ticket.sh`.
