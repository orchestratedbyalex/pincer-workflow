---
ticket: T-67
status: done
size: M
prd: .prd/prd-v6.md
depends_on: [T-66]
started: 2026-09-12T08:28:14Z
last_check: 2026-09-12T08:32:09Z passed bb382d6ad107
verified: 2026-09-12T08:32:09Z bb382d6ad107
finished: 2026-09-12T08:32:09Z
---

## Objective
Parse the complete PRD requirement and scenario inventory, as specified in PRD v6, so coverage and delivery claims remain reviewable.

## Context
- PRD: [Complete requirement coverage and explain change impact](../.prd/prd-v6.md).
- Implements: R-01.
- Scenarios: S-01, S-02, S-03.
- Relevant files: template/scripts/pincer-runtime/parse.cjs; new template/scripts/pincer-runtime/requirements.cjs; test/coverage-inventory.test.js.
- Build order and shared constraints: [v6 ticket map](../docs/prd-v6-ticket-map.md).

## Requirements
- Implement the frozen bounded grammar and normalized per-definition identity, source locations and owning requirement links.
- Distinguish definitions from cross-references, tables and fenced code; refuse duplicate/orphan/empty/unsupported definitions and malformed fences without returning a usable partial inventory.
- Keep old PRD parsing available and labelled unverified for strict coverage. Do not silently renumber supplied IDs or infer requirements from arbitrary prose.

## Acceptance Criteria
- [x] S-01..S-03 execute against real Markdown files, with exact inventory membership and source spans.
- [x] Malformed inputs have actionable locations/codes and no mutation; lifecycle/checkbox-only changes normalize while behavior changes do not.
- [x] Legacy parser fixtures and existing PRD files remain readable.

## Verification
Proves: definitions cannot silently vanish or be invented by examples, and malformed inventories never count as complete.
```bash
node test/coverage-inventory.test.js
node test/runtime-parse.test.js
```

## Constraints
- Keep prior tickets and user work intact. Use the independent pinned management kit described in the PRD; do not adopt strict coverage in this distribution repository as a side effect.
- New test files above are implementation deliverables, not existing evidence. Add executable suites to `npm test` when implemented; do not create placeholder passes or receipts during planning.
- After a `template/` edit regenerate adapters and plugin using both repository generators. Never hand-edit generated outputs. Preserve v5 regression coverage.
