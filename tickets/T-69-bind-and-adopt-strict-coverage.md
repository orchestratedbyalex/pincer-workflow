---
ticket: T-69
status: done
size: L
prd: .prd/prd-v6.md
depends_on: [T-68]
started: 2026-09-12T08:36:48Z
last_check: 2026-09-12T09:01:59Z passed 7f919dd3e94d
verified: 2026-09-12T09:01:59Z 7f919dd3e94d
finished: 2026-09-12T09:01:59Z
---

## Objective
Bind strict coverage, dispositions and explicit adoption, as specified in PRD v6, so coverage and delivery claims remain reviewable.

## Context
- PRD: [Complete requirement coverage and explain change impact](../.prd/prd-v6.md).
- Implements: R-03, R-08.
- Scenarios: S-07, S-08, S-09, S-22, S-23.
- Relevant files: template/scripts/pincer-runtime/{agreement,authorization,changes,transaction,migrate}.cjs; new coverage adoption module; test/coverage-{agreement,adoption}.test.js.
- Build order and shared constraints: [v6 ticket map](../docs/prd-v6-ticket-map.md).

## Requirements
- Bind normalized inventory, coverage map, candidate definitions and dispositions into retained agreement snapshots using the frozen new schema; adoption is a retained capability that cannot be disabled by deleting a flag.
- Enforce resolved same-change decisions and current user authorization for scope deferral/removal; retain tombstones tied to historical inventory. Reject disappearance from both PRD and map and retain open-decision blocking even on a reverted digest.
- Provide read-only preview and atomic idempotent apply with backups; validate expected input digests under the shared lock. Preserve legacy/v0.5.0/v5 behavior until explicit adoption and never infer approval from historical free text.
- Implement literal source-specific rollback fixtures and process-death/concurrent-edit/running-attempt tests. Old runtime fixtures must reject the new record schema.

## Acceptance Criteria
- [x] S-07..S-09 prove changed coverage invalidates authorization, delegated check strengthening preserves its basis, and missing/wrong/open decisions cannot waive scope.
- [x] S-22/S-23 prove preview preservation, idempotence, explicit activation, old/new recovery and rollback that retains restored bindings/indexes/evidence.
- [x] Concurrent input change refuses stale disposition/adoption commits; unsupported/downgraded/missing strict state never falls back to legacy.

## Verification
Proves: strict coverage cannot be silently disabled, obligations cannot be erased and adoption/recovery preserve prior state.
```bash
node test/coverage-agreement.test.js
node test/coverage-adoption.test.js
node test/change-transactions.test.js
node test/change-migration.test.js
```

## Constraints
- Keep prior tickets and user work intact. Use the independent pinned management kit described in the PRD; do not adopt strict coverage in this distribution repository as a side effect.
- New test files above are implementation deliverables, not existing evidence. Add executable suites to `npm test` when implemented; do not create placeholder passes or receipts during planning.
- After a `template/` edit regenerate adapters and plugin using both repository generators. Never hand-edit generated outputs. Preserve v5 regression coverage.
