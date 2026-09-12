---
ticket: T-70
status: open
size: M
prd: .prd/prd-v6.md
depends_on: [T-69]
---

## Objective
Compute structural and implementation coverage, as specified in PRD v6, so coverage and delivery claims remain reviewable.

## Context
- PRD: [Complete requirement coverage and explain change impact](../.prd/prd-v6.md).
- Implements: R-05.
- Scenarios: S-13, S-14, S-15.
- Relevant files: template/scripts/pincer-runtime/{coverage,readiness,transitions,status}.cjs; test/coverage-readiness.test.js.
- Build order and shared constraints: [v6 ticket map](../docs/prd-v6-ticket-map.md).

## Requirements
- Compute structural completeness, implementation readiness and candidate delivery as separate states over the validated graph.
- Require current complete mapped work at change complete, while preserving v5 ticket criteria, source identity, latest-failure and dependency rules.
- Allow implementation completion before candidate evidence exists; never turn a linked check, passing syntax check or a done ticket into a candidate delivery/adequacy verdict.

## Acceptance Criteria
- [ ] S-13..S-15 cover missing/open/stale/red/interrupted work, a missing row, and valid pre-evaluation completion.
- [ ] Coverage output retains explicit non-delivery dispositions and labels absent adequacy/candidate evidence.
- [ ] Completion refuses without writes on structural/readiness failures, and v5 lifecycle regressions stay green.

## Verification
Proves: the completion gate consumes real ticket readiness without confusing planned links with candidate delivery.
```bash
node test/coverage-readiness.test.js
node test/change-lifecycle.test.js
```

## Constraints
- Keep prior tickets and user work intact. Use the independent pinned management kit described in the PRD; do not adopt strict coverage in this distribution repository as a side effect.
- New test files above are implementation deliverables, not existing evidence. Add executable suites to `npm test` when implemented; do not create placeholder passes or receipts during planning.
- After a `template/` edit regenerate adapters and plugin using both repository generators. Never hand-edit generated outputs. Preserve v5 regression coverage.
