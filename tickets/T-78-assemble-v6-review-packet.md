---
ticket: T-78
status: done
size: M
prd: .prd/prd-v6.md
depends_on: [T-77]
started: 2026-09-12T21:50:02Z
last_check: 2026-09-12T22:48:03Z passed 0f5fd3132c8e
verified: 2026-09-12T22:48:03Z 0f5fd3132c8e
finished: 2026-09-12T22:48:03Z
---

## Objective
Assemble v6 traceability, replay cases and final gates, as specified in PRD v6, so coverage and delivery claims remain reviewable.

## Context
- PRD: [Complete requirement coverage and explain change impact](../.prd/prd-v6.md).
- Implements: R-01, R-02, R-03, R-04, R-05, R-06, R-07, R-08, R-09, R-10.
- Scenarios: Contract/integration support for every scenario; primary owners are in the ticket map.
- Relevant files: new docs/prd-v6-review-packet.md; docs/prd-v6-artifacts/replay.sh; test/coverage-review-packet.test.js; .github/workflows/ci.yml.
- Build order and shared constraints: [v6 ticket map](../docs/prd-v6-ticket-map.md).

## Requirements
- Map R-01..R-10 and S-01..S-30 to implementation, meaningful checks/trial evidence and explicit dispositions. Record base/final implementation reference, schema/migration examples and all deviations.
- Provide scratch-project executable review cases for omitted obligations, scenario revision/impact, decision-backed removal, substituted check, gate race, shared candidate, adoption rollback and fresh-clone evidence.
- Run full suites, both generators with no drift, packed parity and the supported macOS/Linux Node matrix on the final implementation candidate. Missing required CI remains outstanding; do not claim green from a prior candidate.
- Finalize authored review/completion material before evaluation candidate selection. Retain benchmark limitations and open findings; do not evaluate/merge/publish as a side effect of packet assembly.

## Acceptance Criteria
- [x] Every scenario maps to inspectable evidence and an actual disposition; replay cases detect the injected fault and include working controls.
- [x] Required local, generated, packed and CI gates pass on the identified implementation; unavailable gates prevent claiming completion.
- [x] Packet clearly separates planned coverage, mechanical evidence and reviewer judgments, and records any unresolved limitations.

## Verification
Proves: the review packet is complete/resolvable and its independent replay cases execute; reviewer judgment and external CI evidence remain separately identified.
```bash
node test/coverage-review-packet.test.js
npm test
```

## Constraints
- Keep prior tickets and user work intact. Use the independent pinned management kit described in the PRD; do not adopt strict coverage in this distribution repository as a side effect.
- New test files above are implementation deliverables, not existing evidence. Add executable suites to `npm test` when implemented; do not create placeholder passes or receipts during planning.
- After a `template/` edit regenerate adapters and plugin using both repository generators. Never hand-edit generated outputs. Preserve v5 regression coverage.
