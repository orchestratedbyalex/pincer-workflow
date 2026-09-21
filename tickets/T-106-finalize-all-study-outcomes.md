---
ticket: T-106
status: done
size: M
prd: .prd/prd-v8.md
depends_on: [T-105]
timeout: 900
started: 2026-09-19T07:41:26Z
last_check: 2026-09-19T07:50:47Z passed ce88400fe405
verified: 2026-09-19T07:50:47Z ce88400fe405
finished: 2026-09-19T07:50:47Z
---

## Objective
Give success, rejection, limits and errors one complete recording path without conflating candidate quality and experiment validity.

## Context
- PRD: [Prove reliable delivery with less effort](../.prd/prd-v8.md).
- Implements: R-07.
- Scenarios: S-19, S-20, S-21.
- Relevant paths: `scripts/delivery-benchmark-v7/orchestrator.cjs`, `scripts/delivery-benchmark-v7/effort.cjs`, `scripts/delivery-benchmark-v7/harness.cjs`.
- Source: [readiness assessment](../docs/pincer-readiness-2026-09-15.md).
- Order, predecessor obligations and verification limits: [v8 ticket map](../docs/prd-v8-ticket-map.md).

## Requirements

Scheduling correction, 19 September 2026: T-102's isolated launcher implementation is
verified, but its native observation remains open. This offline ticket may proceed;
T-110 now depends on both T-102 and T-109. No observation acceptance is waived.

- Actual orchestrator output validates for accepted and rejected candidates, account limits, capped sessions, ambiguous exits, evaluator exceptions, missing browser capability and unavailable results; every terminal record includes reasons for missing metrics.
- A usable capped candidate receives the predeclared independent evaluation, account limits stop the schedule, refusal before launch leaves a cell runnable, and session/provider error payloads cannot masquerade as normal completion.
- Injected finalization/write failures retain recoverable raw artifacts and report failure; reruns preserve original terminal outcomes, and missing evidence never yields acceptance or a fabricated zero.

Feed real output records into the real validator on every branch. Validation failure needs a valid diagnostic envelope with retained raw record, not an invalid record labelled valid. Do not suppress rejected candidates or unavailable runs to improve rates.

## Acceptance Criteria
- [x] S-19: Actual orchestrator output validates for accepted and rejected candidates, account limits, capped sessions, ambiguous exits, evaluator exceptions, missing browser capability and unavailable results; every terminal record includes reasons for missing metrics.
- [x] S-20: A usable capped candidate receives the predeclared independent evaluation, account limits stop the schedule, refusal before launch leaves a cell runnable, and session/provider error payloads cannot masquerade as normal completion.
- [x] S-21: Injected finalization/write failures retain recoverable raw artifacts and report failure; reruns preserve original terminal outcomes, and missing evidence never yields acceptance or a fabricated zero.

## Verification
Proves: The focused checks exercise the stated controls and failure paths. Static assertions are sufficient only for authored contracts/generated artifacts; behavioral claims require observed outputs, side effects or refusal behavior.
```bash
set -e
node test/benchmark-terminal-records.test.js
node test/benchmark-orchestrator.test.js
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
