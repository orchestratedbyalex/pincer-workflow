---
ticket: T-77
status: open
size: L
prd: .prd/prd-v6.md
depends_on: [T-75, T-76]
---

## Objective
Observe paired delivery trials and revised-scope decisions, as specified in PRD v6, so coverage and delivery claims remain reviewable.

## Context
- PRD: [Complete requirement coverage and explain change impact](../.prd/prd-v6.md).
- Implements: R-09, R-10.
- Scenarios: S-27, S-29, S-30.
- Relevant files: new docs/trial-prd-v6.md; docs/prd-v6-artifacts/benchmark/; test/coverage-trial-record.test.js.
- Build order and shared constraints: [v6 ticket map](../docs/prd-v6-ticket-map.md).

## Requirements
- Run at least three matched Pincer/plain-agent pairs for each of the six frozen briefs (36 runs), with fresh workspaces, balanced order and declared tool/model/cap settings. Pin actual kit digest.
- Observe generic-continue revised scope explicitly: no authorization for new scope until an actual user decision. Record any false authorization as an agent failure even if a later runtime gate blocks; do not erase failed/invalid runs.
- Record independent acceptance and all R-10 metrics, interventions, exclusions and variation. Keep unavailable tools/runs outstanding and optional cost data null with reason; report results locally.
- If a required trial fails, create a follow-up ticket and valid rerun while retaining original evidence; a record-shape validator cannot establish agent compliance or close missing live work.

## Acceptance Criteria
- [ ] S-27/S-29/S-30 have inspectable per-run prompts, provenance, real evaluator outputs and denominators, including the changed-scope approval transcript review.
- [ ] The paired comparison uses independent acceptance and reports quality/overhead honestly even when Pincer shows no advantage.
- [ ] Required unavailable/failed behavior is explicitly blocked or fixed and rerun; no missing run is counted passed.

## Verification
Proves: the trial record is complete/resolvable and its evaluator executable; actual agent compliance and observation truth require transcript/evaluator review.
```bash
node test/coverage-trial-record.test.js
node test/delivery-benchmark.test.js
```

## Constraints
- Keep prior tickets and user work intact. Use the independent pinned management kit described in the PRD; do not adopt strict coverage in this distribution repository as a side effect.
- New test files above are implementation deliverables, not existing evidence. Add executable suites to `npm test` when implemented; do not create placeholder passes or receipts during planning.
- After a `template/` edit regenerate adapters and plugin using both repository generators. Never hand-edit generated outputs. Preserve v5 regression coverage.
