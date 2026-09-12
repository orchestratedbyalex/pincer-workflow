---
ticket: T-66
status: done
size: M
prd: .prd/prd-v6.md
depends_on: []
started: 2026-09-12T08:15:55Z
last_check: 2026-09-12T08:27:04Z passed 17c159fd8f79
verified: 2026-09-12T08:27:04Z 17c159fd8f79
finished: 2026-09-12T08:27:04Z
---

## Objective
Freeze coverage, impact and compatibility contracts, as specified in PRD v6, so coverage and delivery claims remain reviewable.

## Context
- PRD: [Complete requirement coverage and explain change impact](../.prd/prd-v6.md).
- Implements: R-01, R-02, R-03, R-04, R-05, R-06, R-07, R-08, R-09.
- Scenarios: Contract/integration support for every scenario; primary owners are in the ticket map.
- Relevant files: template/docs/runtime-contracts.md; template/scripts/pincer-runtime/{parse,agreement,changes,evidence,locator}.cjs; test/fixtures/prd-v6/.
- Build order and shared constraints: [v6 ticket map](../docs/prd-v6-ticket-map.md).

## Requirements
- Freeze the supported Markdown definition grammar (including supplied IDs, fenced examples, empty/malformed definitions and source spans), normalized digests and strict JSON map schema with representative valid/invalid examples.
- Specify exact new change/evidence schemas, agreement projection version and adoption/rollback rules. Older runtimes must reject new persisted formats; old projects report coverage unverified until adoption.
- Specify map ownership, scenario/check/ticket links, enabling tickets, tombstones, decision references, declared commands/reviews, evidence completeness and phase-specific gates. Close the candidate/completion and decision/authorization circularity questions with executable examples.
- Specify human/JSON commands, deterministic codes/ordering, path validation, under-lock digest checks, and exact listed evaluation artifacts. Record compatibility fixtures from the fixed v5 source at 00aad6d with provenance.

## Acceptance Criteria
- [x] The contract and fixtures cover valid/invalid inputs and each phase, including authorized non-delivery and deletion from both prose and map.
- [x] Schema/ownership/version decisions are settled before implementation writers change; no second editable requirement inventory is introduced.
- [x] Static checks validate fixture structure/provenance and contract consistency; they make no claim about runtime behavior.

## Verification
Proves: the frozen static contracts/examples are internally consistent and preserve v5 guarantees; behavior is proved by later tickets.
```bash
node test/coverage-contracts.test.js
node test/change-contracts.test.js
```

## Constraints
- Keep prior tickets and user work intact. Use the independent pinned management kit described in the PRD; do not adopt strict coverage in this distribution repository as a side effect.
- New test files above are implementation deliverables, not existing evidence. Add executable suites to `npm test` when implemented; do not create placeholder passes or receipts during planning.
- After a `template/` edit regenerate adapters and plugin using both repository generators. Never hand-edit generated outputs. Preserve v5 regression coverage.
