---
ticket: T-68
status: done
size: M
prd: .prd/prd-v6.md
depends_on: [T-67]
started: 2026-09-12T08:32:16Z
last_check: 2026-09-12T08:36:40Z passed d4ad7b47e1b0
verified: 2026-09-12T08:36:40Z d4ad7b47e1b0
finished: 2026-09-12T08:36:40Z
---

## Objective
Validate authored coverage links and check definitions, as specified in PRD v6, so coverage and delivery claims remain reviewable.

## Context
- PRD: [Complete requirement coverage and explain change impact](../.prd/prd-v6.md).
- Implements: R-02.
- Scenarios: S-04, S-05, S-06.
- Relevant files: new template/scripts/pincer-runtime/coverage.cjs; requirements.cjs; parse.cjs; test/coverage-map.test.js.
- Build order and shared constraints: [v6 ticket map](../docs/prd-v6-ticket-map.md).

## Requirements
- Load one explicit change/PRD map; validate exact live inventory membership, unique entries, same-change ticket ownership and complete ticket classification.
- Resolve scenario links to implementation tickets and declared candidate checks; allow shared work/checks and enabling tickets with a rationale. Keep declarations separate from observed results.
- Validate command/timeout versus review obligations, bounded strings, unknown schema/keys, duplicate JSON keys and safe paths including symlink escapes. Reject errors before launch or mutation.

## Acceptance Criteria
- [x] S-04..S-06 exercise omitted/invented rows, missing and cross-change references, duplicate/unsafe input and valid shared coverage.
- [x] A scenario with no work/check and an unclassified ticket fail with exact IDs; an explicit enabling rationale is accepted.
- [x] The module exposes one validated graph for all consumers and writes no computed report.

## Verification
Proves: coverage resolves actual authored artifacts and rejects omissions, ambiguity and unsafe references.
```bash
node test/coverage-map.test.js
node test/change-registry.test.js
```

## Constraints
- Keep prior tickets and user work intact. Use the independent pinned management kit described in the PRD; do not adopt strict coverage in this distribution repository as a side effect.
- New test files above are implementation deliverables, not existing evidence. Add executable suites to `npm test` when implemented; do not create placeholder passes or receipts during planning.
- After a `template/` edit regenerate adapters and plugin using both repository generators. Never hand-edit generated outputs. Preserve v5 regression coverage.
