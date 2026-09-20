---
ticket: T-114
status: open
size: L
prd: .prd/prd-v8.md
depends_on: [T-111, T-113]
timeout: 900
---

## Objective
Compare the pre-v8-usability kit with the final improved kit on real matched work.

## Context
- PRD: [Prove reliable delivery with less effort](../.prd/prd-v8.md).
- Implements: R-15.
- Scenarios: S-43, S-44, S-45.
- Relevant paths: `docs/prd-v8-comparison.md`, `docs/prd-v8-artifacts/pilots/improved/`, `scripts/delivery-benchmark-v7/observations.cjs`.
- Source: [readiness assessment](../docs/pincer-readiness-2026-09-15.md).
- Order, predecessor obligations and verification limits: [v8 ticket map](../docs/prd-v8-ticket-map.md).

## Current scope amendment

"Total cost" follows the [native-tool contracts](../docs/prd-v8-native-tool-contracts.md) (T-120) §3.4: report tokens, provider time and labelled estimates under the declared billing mode; unavailable subscription billing is unavailable, never zero; a dollar-superiority claim needs evidenced API billing on every compared cell or is withheld.

## Requirements
- Three paired K1-versus-K2 pilot comparisons record task equivalence, arm order, prior exposure and all session/candidate evidence; unrelated behavior and authorization/evidence invariants are preserved.
- The report measures avoidable operations, map-authoring and recovery time, repeated approvals, active/provider time and total cost including retries; incomplete measurements remain explicitly unavailable and all failures stay in the denominator accounting.
- The predeclared target of halving avoidable operations and reducing authoring/recovery effort is reported as met or missed with spread and limitations; missed targets produce an explicit product disposition and cannot be hidden by selecting only favorable pairs.

K2 is the final prepared v8-usability kit, pinned before observation. Only reuse an earlier K1 run if T-109 predeclared the matching/exposure design; otherwise collect a fresh matched control and include its budget. Six runs are planned here, in addition to six T-110 baseline runs. Byte reductions are not human-time reductions. A measured negative outcome can complete measurement, but not support an improvement claim.

## Acceptance Criteria
- [ ] S-43: Three paired K1-versus-K2 pilot comparisons record task equivalence, arm order, prior exposure and all session/candidate evidence; unrelated behavior and authorization/evidence invariants are preserved.
- [ ] S-44: The report measures avoidable operations, map-authoring and recovery time, repeated approvals, active/provider time and total cost including retries; incomplete measurements remain explicitly unavailable and all failures stay in the denominator accounting.
- [ ] S-45: The predeclared target of halving avoidable operations and reducing authoring/recovery effort is reported as met or missed with spread and limitations; missed targets produce an explicit product disposition and cannot be hidden by selecting only favorable pairs.

## Verification
Proves: The command validates retained real observation records and required references; actual agent behavior and reviewer judgment require inspecting the linked evidence. It must fail when the observation section is absent or outstanding.
```bash
set -e
node test/improvement-trial-records.test.js
node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/study.json --section improved-pilots --require-observed
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
