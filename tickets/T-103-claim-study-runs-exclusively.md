---
ticket: T-103
status: open
size: M
prd: .prd/prd-v8.md
depends_on: [T-101]
timeout: 900
---

## Objective
Prevent two operators or processes from launching or rewriting the same measured cell.

## Context
- PRD: [Prove reliable delivery with less effort](../.prd/prd-v8.md).
- Implements: R-04.
- Scenarios: S-10, S-11, S-12.
- Relevant paths: `scripts/delivery-benchmark-v7/orchestrator.cjs`, `scripts/delivery-benchmark-v7/schedule.cjs`.
- Source: [readiness assessment](../docs/pincer-readiness-2026-09-15.md).
- Order, predecessor obligations and verification limits: [v8 ticket map](../docs/prd-v8-ticket-map.md).

## Requirements
- Two simultaneous attempts to execute one cell produce exactly one launch and one explicit busy refusal; separate cells can proceed without sharing mutable workspaces or event files.
- Run ownership, rerun-slot allocation and record publication survive injected crashes before and after claim/write boundaries; live ownership cannot be reclaimed as stale and an abandoned claim has an explicit recoverable disposition.
- A losing claimant or malformed/escaping run identity changes no workspace or artifacts; recovery preserves original logs and completed records and creates no duplicate paid work silently.

Use atomic exclusive ownership and unique atomic record writes. Define ownership liveness and recovery in T-100; test simultaneous processes and real termination of stand-in processes. This is study-run ownership, not a redesign of the installed runtime transaction engine.

## Acceptance Criteria
- [ ] S-10: Two simultaneous attempts to execute one cell produce exactly one launch and one explicit busy refusal; separate cells can proceed without sharing mutable workspaces or event files.
- [ ] S-11: Run ownership, rerun-slot allocation and record publication survive injected crashes before and after claim/write boundaries; live ownership cannot be reclaimed as stale and an abandoned claim has an explicit recoverable disposition.
- [ ] S-12: A losing claimant or malformed/escaping run identity changes no workspace or artifacts; recovery preserves original logs and completed records and creates no duplicate paid work silently.

## Verification
Proves: The focused checks exercise the stated controls and failure paths. Static assertions are sufficient only for authored contracts/generated artifacts; behavioral claims require observed outputs, side effects or refusal behavior.
```bash
set -e
node test/benchmark-run-claims.test.js
```

The named new command/test files are deliverables of this ticket or its predecessors,
not evidence that already exists. Add executable offline suites to the normal integration
chain. Do not create placeholder passes. A record validator is not proof of live behavior;
keep any observation criterion unchecked until its linked artifacts have been reviewed.

## Constraints
- Preserve existing authorization, source/evidence freshness, failure precedence,
  recovery, unrelated user work and all legacy/migrated/changes/strict modes.
- Use the independently pinned management kit; never hand-edit lifecycle receipts.
- After any template edit regenerate adapters and plugin; never hand-edit derived files.
- No paid launch, new project access, external message, merge or publication is implied
  by this ticket. Reuse actual session decisions; obtain only missing execution inputs.
- Preserve historical frozen records and report changed execution/scoring under explicit
  cohort identity. New scenario scope or an unsupported design needs a recorded revision.
