---
ticket: T-56
status: done
size: M
prd: .prd/prd-v5.md
depends_on: [T-55]
started: 2026-09-11T21:43:19Z
last_check: 2026-09-11T21:49:16Z passed 20a43d2ec53d
verified: 2026-09-11T21:49:16Z 20a43d2ec53d
finished: 2026-09-11T21:49:16Z
---

## Objective
Retain per-change evaluation references and release verdicts so PRD v5 can be implemented and reviewed without losing work or trusting stale state.

## Context
- Relevant files: template/scripts/pincer-runtime/evidence.cjs; status.cjs; pincer-runtime.cjs; runtime contracts; test/change-evaluations.test.js.
- PRD: [Preserve changes, authorization, and resume context](../.prd/prd-v5.md), sections 5–8.
- Implements: R-07, R-04.
- Scenarios: S-22, S-23.
- Build order and coverage: [PRD v5 ticket map](../docs/prd-v5-ticket-map.md).

## Requirements
- Implement the explicit per-change evaluation locator frozen in T-47; replacing root NOTES with B's summary cannot lose A's saved evaluation.
- Save evaluation references as validated listed artifacts, avoiding circular digests and source-exclusion expansion. Retain historical schema inspection and local-history availability labels.
- Require completion/authored lifecycle changes before candidate selection. Authored changes after evaluation require a new candidate; do not exempt all .prd/changes.
- Release reads current authorization, candidate identity and latest applicable attempts without selecting/completing a change, executing checks or writing records.
- Reject malformed/dangling/cross-change references and unknown schemas before updating the locator; coordinate reference writes through T-48.

## Acceptance Criteria
- [x] Evaluate A then B; each remains addressable despite root NOTES naming only one, with historical/current provenance accurately distinguished.
- [x] Complete then evaluate then audit succeeds without a follow-up lifecycle commit; release preserves files, selection and attempt count.
- [x] Later source/agreement changes or a newer applicable failure block current readiness; missing/cross-change/corrupt references cannot revive a pass.

## Verification
Proves: Exercises retained evaluations, candidate ordering and read-only release, including corruption and newer-failure checks.
```bash
node test/change-evaluations.test.js
node test/runtime-evidence.test.js
```

## Constraints
- No merge/publish actions and no broad post-candidate file exemptions.
- Implement the new tests named below as part of this ticket and add them to `npm test`; these are planned test paths, not tests that already pass. Reuse existing fixture helpers. After any `template/` edit, run both generators and include the generated changes. Keep existing ticket history untouched; use a pinned released kit to manage this work.

