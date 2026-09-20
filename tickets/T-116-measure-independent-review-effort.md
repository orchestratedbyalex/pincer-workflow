---
ticket: T-116
status: open
size: L
prd: .prd/prd-v8.md
depends_on: [T-115]
timeout: 900
---

## Objective
Establish whether Pincer helps people make accurate review decisions with less effort.

## Context
- PRD: [Prove reliable delivery with less effort](../.prd/prd-v8.md).
- Implements: R-17.
- Scenarios: S-49, S-50, S-51.
- Relevant paths: `docs/prd-v8-artifacts/reviews/`, `docs/prd-v8-comparison.md`, `scripts/delivery-benchmark-v7/observations.cjs`.
- Source: [readiness assessment](../docs/pincer-readiness-2026-09-15.md).
- Order, predecessor obligations and verification limits: [v8 ticket map](../docs/prd-v8-ticket-map.md).

## Current scope amendment

"Total delivery cost" alongside review effort follows the [native-tool contracts](../docs/prd-v8-native-tool-contracts.md) (T-120) §3.4: estimates are labelled, unavailable subscription billing is unavailable, and dollar comparisons are withheld unless every cell has evidenced API billing.

## Requirements
- At least two non-implementing human reviewers inspect matched tasks under a predeclared rubric, with arm blinding where feasible and recorded order, exposure, decision, confidence, elapsed minutes and missed seeded faults.
- Missing/zero-as-placeholder review time, implementing reviewers, fabricated identities or absent candidate links cannot satisfy completion; actual review records and inspected artifacts support each observation.
- Results compare review accuracy and effort with denominators and limitations alongside total delivery cost; automation-only validation never stands in for human judgment and unfavorable results remain visible.

Reviewer availability and access are settled in T-109; no external invitations/messages are sent without instruction. Include real independent reviewers in the acceptance record, not the implementing agent under a different label. Freeze the review subset/task assignment before outcomes are visible; T-115 dependency means candidates are available, not that the rubric may be chosen afterward.

## Acceptance Criteria
- [ ] S-49: At least two non-implementing human reviewers inspect matched tasks under a predeclared rubric, with arm blinding where feasible and recorded order, exposure, decision, confidence, elapsed minutes and missed seeded faults.
- [ ] S-50: Missing/zero-as-placeholder review time, implementing reviewers, fabricated identities or absent candidate links cannot satisfy completion; actual review records and inspected artifacts support each observation.
- [ ] S-51: Results compare review accuracy and effort with denominators and limitations alongside total delivery cost; automation-only validation never stands in for human judgment and unfavorable results remain visible.

## Verification
Proves: The command validates retained real observation records and required references; actual agent behavior and reviewer judgment require inspecting the linked evidence. It must fail when the observation section is absent or outstanding.
```bash
set -e
node test/improvement-trial-records.test.js
node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/study.json --section reviews --require-observed
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
