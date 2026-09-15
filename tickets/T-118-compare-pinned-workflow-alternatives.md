---
ticket: T-118
status: open
size: L
prd: .prd/prd-v8.md
depends_on: [T-116]
timeout: 900
---

## Objective
Test competitive value against relevant specification workflows before making a class-leading claim.

## Context
- PRD: [Prove reliable delivery with less effort](../.prd/prd-v8.md).
- Implements: R-19.
- Scenarios: S-55, S-56, S-57.
- Relevant paths: `docs/prd-v8-competitive-protocol.md`, `docs/prd-v8-competitive-comparison.md`, `docs/prd-v8-artifacts/competitive/`.
- Source: [readiness assessment](../docs/pincer-readiness-2026-09-15.md).
- Order, predecessor obligations and verification limits: [v8 ticket map](../docs/prd-v8-ticket-map.md).

## Requirements
- A separately frozen competitive protocol pins Pincer and two relevant alternatives, provisionally Spec Kit and OpenSpec, on three representative task types with three repetitions per tool (27 cells), matched model/caps, fair documented setup and held-out acceptance.
- After separate concrete access/spending approval, all scheduled cells retain actual outcomes, failures, setup/recovery/review effort and total cost; unavailable capabilities or changed versions remain explicit and cannot silently shrink the denominator.
- A comparative report cites exact versions and limitations, reports negative results and distinguishes exploratory differences from established superiority; a best-in-class claim is withheld when the measured evidence does not support it.

This later, separately budgeted 27-cell study does not replace or extend the 72-cell denominator. Verify current official installation/workflow contracts and pick immutable versions when preparing its protocol. No claim that the alternatives lack Pincer features is assumed. If relevance changes, revise the named comparators before freezing. Reuse the collection/evaluation infrastructure, not another benchmark engine; report capability differences rather than silently coach one arm.

## Acceptance Criteria
- [ ] S-55: A separately frozen competitive protocol pins Pincer and two relevant alternatives, provisionally Spec Kit and OpenSpec, on three representative task types with three repetitions per tool (27 cells), matched model/caps, fair documented setup and held-out acceptance.
- [ ] S-56: After separate concrete access/spending approval, all scheduled cells retain actual outcomes, failures, setup/recovery/review effort and total cost; unavailable capabilities or changed versions remain explicit and cannot silently shrink the denominator.
- [ ] S-57: A comparative report cites exact versions and limitations, reports negative results and distinguishes exploratory differences from established superiority; a best-in-class claim is withheld when the measured evidence does not support it.

## Verification
Proves: The command validates retained real observation records and required references; actual agent behavior and reviewer judgment require inspecting the linked evidence. It must fail when the observation section is absent or outstanding.
```bash
set -e
node test/competitive-study-records.test.js
node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/competitive.json --section competitive --require-observed
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
