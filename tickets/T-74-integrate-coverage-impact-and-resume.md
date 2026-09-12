---
ticket: T-74
status: open
size: M
prd: .prd/prd-v6.md
depends_on: [T-71, T-73]
---

## Objective
Expose coverage, impact and actionable resume reports, as specified in PRD v6, so coverage and delivery claims remain reviewable.

## Context
- PRD: [Complete requirement coverage and explain change impact](../.prd/prd-v6.md).
- Implements: R-09.
- Scenarios: S-25, S-26.
- Relevant files: template/scripts/pincer-runtime.cjs; template/scripts/pincer-runtime/{status,resume,coverage,impact}.cjs; test/coverage-reports.test.js.
- Build order and shared constraints: [v6 ticket map](../docs/prd-v6-ticket-map.md).

## Requirements
- Expose read-only human and versioned JSON coverage/impact with explicit change/baseline selection, current/reviewed identities and exact affected IDs.
- Integrate concise summaries and one next action into status/resume using existing precedence; distinguish structural completeness, freshness and adequacy.
- Support compact small-fix inputs and normal resumed work without duplicate authorization, check launches or report writes. Keep old-mode coverage honestly unverified.

## Acceptance Criteria
- [ ] S-25/S-26 verify human/JSON parity, concrete next ticket/check/decision, malformed-state diagnostics and read-only snapshots.
- [ ] A fresh-session fixture locates its next action from report/references; small fixes do not need redundant authored tables.
- [ ] Existing resume and status contracts still pass.

## Verification
Proves: sessions get a consistent next action and coverage report without hidden execution or inferred approval.
```bash
node test/coverage-reports.test.js
node test/change-resume.test.js
node test/runtime-status.test.js
```

## Constraints
- Keep prior tickets and user work intact. Use the independent pinned management kit described in the PRD; do not adopt strict coverage in this distribution repository as a side effect.
- New test files above are implementation deliverables, not existing evidence. Add executable suites to `npm test` when implemented; do not create placeholder passes or receipts during planning.
- After a `template/` edit regenerate adapters and plugin using both repository generators. Never hand-edit generated outputs. Preserve v5 regression coverage.
