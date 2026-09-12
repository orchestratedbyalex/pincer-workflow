---
ticket: T-76
status: open
size: M
prd: .prd/prd-v6.md
depends_on: [T-66]
---

## Objective
Build independent delivery benchmark fixtures and harness, as specified in PRD v6, so coverage and delivery claims remain reviewable.

## Context
- PRD: [Complete requirement coverage and explain change impact](../.prd/prd-v6.md).
- Implements: R-10.
- Scenarios: S-28.
- Relevant files: new test/fixtures/delivery-benchmark/; scripts/delivery-benchmark/; docs/delivery-benchmark.md; test/delivery-benchmark.test.js.
- Build order and shared constraints: [v6 ticket map](../docs/prd-v6-ticket-map.md).

## Requirements
- Define and freeze six task briefs, base repositories and independent evaluators specified by R-10, with version/digest provenance before live implementations begin.
- Keep evaluator assets outside the implementation agent workspace; build isolated runs, candidate evaluation and bounded structured run records without altering the main repository.
- Define matched model/tool versions, resource caps, paired/balanced order and metrics, including manual intervention definitions, invalid-run rules and unavailable cost fields.
- Exercise good controls and intentionally faulty candidates for missing behavior, false success and stale/wrong-change evidence. Missing tools/evaluator errors are unverified/errors, never successful acceptance.

## Acceptance Criteria
- [ ] S-28 proves evaluator sensitivity to the specified controlled faults and acceptance of correct controls.
- [ ] The documented harness recreates inputs and validates run records with captured real outcomes; it does not expose held-out acceptance to the implementation workspace.
- [ ] Metric definitions and live protocol are frozen before T-77, and methodology makes no unsupported parity/superiority claim.

## Verification
Proves: the independent evaluator detects faulty output and the harness cannot manufacture a pass from absent execution.
```bash
node test/delivery-benchmark.test.js
```

## Constraints
- Keep prior tickets and user work intact. Use the independent pinned management kit described in the PRD; do not adopt strict coverage in this distribution repository as a side effect.
- New test files above are implementation deliverables, not existing evidence. Add executable suites to `npm test` when implemented; do not create placeholder passes or receipts during planning.
- After a `template/` edit regenerate adapters and plugin using both repository generators. Never hand-edit generated outputs. Preserve v5 regression coverage.
