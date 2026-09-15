---
ticket: T-115
status: open
size: L
prd: .prd/prd-v8.md
depends_on: [T-114]
timeout: 900
---

## Objective
Complete the already planned three-arm experiment with honest accounting of acceptance, preservation and total effort.

## Context
- PRD: [Prove reliable delivery with less effort](../.prd/prd-v8.md).
- Implements: R-16.
- Scenarios: S-46, S-47, S-48.
- Relevant paths: `docs/prd-v8-comparison.md`, `docs/prd-v7-comparison.md`, `docs/prd-v8-artifacts/comparison/`, `scripts/delivery-benchmark-v7/`.
- Source: [readiness assessment](../docs/pincer-readiness-2026-09-15.md).
- Order, predecessor obligations and verification limits: [v8 ticket map](../docs/prd-v8-ticket-map.md).

## Requirements
- Eight briefs times plain/default-Pincer/strict-Pincer times three matched repetitions produce 72 accounted scheduled cells under a frozen K2 cohort, with balanced order and observed strict adoption; reruns are separately linked and never replace originals invisibly.
- Held-out acceptance/preservation/browser checks judge exported candidates independently of candidate-authored tests; cost, time, tokens, interventions, retry burden, exclusions, spread and per-brief/arm denominators recompute from retained records.
- Account limits, missing capability, incomplete required observations and configuration drift stop or disposition work under the frozen rules; missing required cells keep measurement unfinished, and adverse outcomes are reported without a superiority or equivalence claim from three repetitions.

This is the existing v7 72-cell obligation continued under repaired, explicitly frozen execution inputs, not a second 72-run study. A kit change must change identity without losing the original arm comparison design. Preserve all v6 files. Freeze K2 and study helpers before the first cell; if inputs later change, retain and report separate cohorts without pooling silently. Check remaining allocation between cells.

## Acceptance Criteria
- [ ] S-46: Eight briefs times plain/default-Pincer/strict-Pincer times three matched repetitions produce 72 accounted scheduled cells under a frozen K2 cohort, with balanced order and observed strict adoption; reruns are separately linked and never replace originals invisibly.
- [ ] S-47: Held-out acceptance/preservation/browser checks judge exported candidates independently of candidate-authored tests; cost, time, tokens, interventions, retry burden, exclusions, spread and per-brief/arm denominators recompute from retained records.
- [ ] S-48: Account limits, missing capability, incomplete required observations and configuration drift stop or disposition work under the frozen rules; missing required cells keep measurement unfinished, and adverse outcomes are reported without a superiority or equivalence claim from three repetitions.

## Verification
Proves: The command validates retained real observation records and required references; actual agent behavior and reviewer judgment require inspecting the linked evidence. It must fail when the observation section is absent or outstanding.
```bash
set -e
node test/delivery-benchmark-v7.test.js
node test/improvement-trial-records.test.js
node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/study.json --section three-arm --require-observed
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
