---
ticket: T-104
status: open
size: M
prd: .prd/prd-v8.md
depends_on: [T-103]
timeout: 900
---

## Objective
Recover interrupted study work without duplicate event IDs, overwritten evidence or a contaminated candidate base.

## Context
- PRD: [Prove reliable delivery with less effort](../.prd/prd-v8.md).
- Implements: R-05.
- Scenarios: S-13, S-14, S-15.
- Relevant paths: `scripts/delivery-benchmark-v7/orchestrator.cjs`, `scripts/delivery-benchmark-v7/effort.cjs`, `test/benchmark-orchestrator.test.js`.
- Source: [readiness assessment](../docs/pincer-readiness-2026-09-15.md).
- Order, predecessor obligations and verification limits: [v8 ticket map](../docs/prd-v8-ticket-map.md).

## Requirements
- Restarting at persisted setup, session-start, session-end and pre-evaluation boundaries yields validator-valid records with unique attempt/session/event identities, including the reproduced duplicate setup/S1 case.
- Real stand-in process kill/restart tests preserve completed session payloads and clearly label missing in-flight data; restart uses a clean disposable workspace and excludes the interrupted attempt commit from the new base.
- Every discarded attempt remains linked with immutable logs and effort; terminal cells are not rerun, concurrent recovery is refused, and a new attempt cannot overwrite or silently drop prior history.

Keep the conservative clean-workspace restart policy for indeterminate in-flight state. Use explicit attempt identity, preserving legacy record readability with a versioned measurement migration if needed. Persist a launch intent before invoking the driver and capture output durably as it arrives. Do not convert the previously event-empty interruption fixture into the only regression case.

## Acceptance Criteria
- [ ] S-13: Restarting at persisted setup, session-start, session-end and pre-evaluation boundaries yields validator-valid records with unique attempt/session/event identities, including the reproduced duplicate setup/S1 case.
- [ ] S-14: Real stand-in process kill/restart tests preserve completed session payloads and clearly label missing in-flight data; restart uses a clean disposable workspace and excludes the interrupted attempt commit from the new base.
- [ ] S-15: Every discarded attempt remains linked with immutable logs and effort; terminal cells are not rerun, concurrent recovery is refused, and a new attempt cannot overwrite or silently drop prior history.

## Verification
Proves: The focused checks exercise the stated controls and failure paths. Static assertions are sufficient only for authored contracts/generated artifacts; behavioral claims require observed outputs, side effects or refusal behavior.
```bash
set -e
node test/benchmark-restart.test.js
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
