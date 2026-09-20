---
ticket: T-110
status: open
size: L
prd: .prd/prd-v8.md
depends_on: [T-102, T-109]
timeout: 900
---

## Objective
Complete genuine strict-coverage pilots and measure the friction that should drive the next product design.

## Context
- PRD: [Prove reliable delivery with less effort](../.prd/prd-v8.md).
- Implements: R-11.
- Scenarios: S-31, S-32, S-33.
- Relevant paths: `docs/prd-v8-pilots.md`, `docs/prd-v8-artifacts/pilots/`, `docs/prd-v7-pilots.md`, `scripts/delivery-benchmark-v7/observations.cjs`.
- Source: [readiness assessment](../docs/pincer-readiness-2026-09-15.md).
- Order, predecessor obligations and verification limits: [v8 ticket map](../docs/prd-v8-ticket-map.md).

## Current scope amendment

Sessions use the host tool's own sign-in per the [native-tool contracts](../docs/prd-v8-native-tool-contracts.md) (T-120); no API key is requested. Elapsed time, operations and interventions are the primary observations; any dollar figure is a labelled estimate under the declared billing mode. Copilot stays unobserved.

## Requirements
- One greenfield and two brownfield projects complete pinned K0 and K1 journeys on matched disposable tasks, including adoption, actual revised-scope authorization, pause/recovery and candidate/schema 3 evaluation; one brownfield project preserves tracked and untracked unrelated work.
- All six baseline journey records retain real session/candidate evidence, failures, repairs, unavailable stages and interventions; generic continue never stands in for revised approval and fixtures cannot close the observations.
- A report ranks map authoring, repeated commands/reads/approvals, recovery and human effort, and makes an evidence-backed proceed/revise decision for guided authoring and the small-change path before their implementation.

K0 is released v0.6.0; K1 is the pinned pre-v8-usability kit already containing scaffold/brief. Freeze task matching, allocation/order and carryover limits in T-109. These six journeys supply the outstanding v7 baseline/improved comparison where its actual requirements are met; link evidence instead of rerunning solely for ticket numbering. Review temporal v7 requirements honestly. Create validate-study.cjs with fixture/missing-reference rejection tests; --require-observed must refuse absent stages, never merely run record unit tests.

## Acceptance Criteria
- [ ] S-31: One greenfield and two brownfield projects complete pinned K0 and K1 journeys on matched disposable tasks, including adoption, actual revised-scope authorization, pause/recovery and candidate/schema 3 evaluation; one brownfield project preserves tracked and untracked unrelated work.
- [ ] S-32: All six baseline journey records retain real session/candidate evidence, failures, repairs, unavailable stages and interventions; generic continue never stands in for revised approval and fixtures cannot close the observations.
- [ ] S-33: A report ranks map authoring, repeated commands/reads/approvals, recovery and human effort, and makes an evidence-backed proceed/revise decision for guided authoring and the small-change path before their implementation.

## Verification
Proves: The command validates retained real observation records and required references; actual agent behavior and reviewer judgment require inspecting the linked evidence. It must fail when the observation section is absent or outstanding.
```bash
set -e
node test/strict-pilot-records.test.js
node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/study.json --section baseline --require-observed
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
