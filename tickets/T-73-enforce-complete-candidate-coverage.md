---
ticket: T-73
status: done
size: L
prd: .prd/prd-v6.md
depends_on: [T-70, T-71, T-72]
started: 2026-09-12T09:27:47Z
last_check: 2026-09-12T11:25:48Z passed 14bd7ae4faac
verified: 2026-09-12T11:25:48Z 14bd7ae4faac
finished: 2026-09-12T11:25:48Z
---

## Objective
Reconcile full candidate coverage at export and release, as specified in PRD v6, so coverage and delivery claims remain reviewable.

## Context
- PRD: [Complete requirement coverage and explain change impact](../.prd/prd-v6.md).
- Implements: R-07.
- Scenarios: S-19, S-20, S-21.
- Relevant files: template/scripts/pincer-runtime/{evidence,locator,status,coverage}.cjs; template/scripts/pincer-runtime.cjs; test/coverage-evidence.test.js.
- Build order and shared constraints: [v6 ticket map](../docs/prd-v6-ticket-map.md).

## Requirements
- Export the new strict format with exact inventory/scenario membership, coverage/check identity, explicit dispositions and adequacy judgment. Reconcile independently against candidate-authored inputs during export and read-only release.
- Require passing linked/required checks and candidate-bound reviews for delivery; validate decision-backed non-delivery and never represent it as satisfying original behavior.
- Persist validated listed snapshots/artifacts and retain per-change locators without digest cycles or broad directory exemptions. Preserve fresh-clone provenance limits and newer local failure precedence.
- Add adversarial mutations for omitted rows, invented IDs, swapped map/inventory, false delivered rows, corrupt artifacts and same-candidate cross-change evidence.

## Acceptance Criteria
- [x] S-19..S-21 demonstrate both export and independent release reject tampered/incomplete evidence.
- [x] An honest complete evaluation works after implementation completion with no post-candidate authored lifecycle edits; authorized non-delivery stays visible.
- [x] Saved evidence validates without local attempts, while tampered logs/unlisted files/newer failures block and release writes nothing.

## Verification
Proves: the manifest cannot choose its own obligations or claim delivery from missing, substituted or failed evidence.
```bash
node test/coverage-evidence.test.js
node test/change-evaluations.test.js
node test/runtime-evidence.test.js
```

## Constraints
- Keep prior tickets and user work intact. Use the independent pinned management kit described in the PRD; do not adopt strict coverage in this distribution repository as a side effect.
- New test files above are implementation deliverables, not existing evidence. Add executable suites to `npm test` when implemented; do not create placeholder passes or receipts during planning.
- After a `template/` edit regenerate adapters and plugin using both repository generators. Never hand-edit generated outputs. Preserve v5 regression coverage.
