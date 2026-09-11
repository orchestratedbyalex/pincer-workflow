---
ticket: T-61
status: open
size: M
prd: .prd/prd-v5.md
depends_on: [T-60]
---

## Objective
Assemble the implementation review packet and final gates so PRD v5 can be implemented and reviewed without losing work or trusting stale state.

## Context
- Relevant files: docs/prd-v5-review-packet.md (new); docs/prd-v5-artifacts/; docs/prd-v5-ticket-map.md; test/change-review-packet.test.js (new); wiki handoff.
- PRD: [Preserve changes, authorization, and resume context](../.prd/prd-v5.md), sections 5–8.
- Implements: R-01, R-02, R-03, R-04, R-05, R-06, R-07, R-08, R-09, R-10.
- Scenarios: enabling contract/review work; scenario implementation owners are in the ticket map.
- Build order and coverage: [PRD v5 ticket map](../docs/prd-v5-ticket-map.md).

## Requirements
- Map all ten requirements and 32 scenarios to actual implementation, executed tests/live observations, dispositions and remaining limitations; do not turn the planned map into a claim of delivery.
- Include final contracts, migration preview/backups/rollback examples, agreement/decision/history examples, blocked/current resume JSON, trial counts and approved deviations.
- Run all required local verification and record supported CI results when available. Pending CI or unavailable live evidence is outstanding, not passed. Do not publish/merge or trigger external actions merely to complete the packet.
- Prepare final authored docs and lifecycle metadata before the candidate. Record the candidate in the subsequent evaluation artifacts or an allowed evidence-only locator so updating the packet cannot recursively invalidate its own candidate.
- Provide independent replay instructions for A/B/A, same-filename scope revision, delegated check change, wrong-change execution, shared C-01/candidate, transition process death, no-selection clone, and conflicting history.

## Acceptance Criteria
- [ ] Packet has complete requirement/scenario mapping with valid references and honest dispositions; each required acceptance claim has inspectable evidence.
- [ ] Full local suite and distribution parity pass; supported CI matrix results are recorded or explicitly outstanding, with release readiness blocked until required checks pass.
- [ ] Representative artifacts are sanitized and documented, and all eight independent replay cases have concrete fixture/command instructions.
- [ ] No merge, bump, publish, implementation-complete or release-PASS claim is made merely by preparing this packet.

## Verification
Proves: Checks review-packet completeness/references and runs the full regression/distribution suite. It does not replace independent code review, live-observation judgment, or remote CI.
```bash
node test/change-review-packet.test.js
npm test
```

## Constraints
- This ticket prepares review; evaluation/release remain separate. Add fix tickets for findings rather than editing history or silently cutting scope.
- Implement the new tests named below as part of this ticket and add them to `npm test`; these are planned test paths, not tests that already pass. Reuse existing fixture helpers. After any `template/` edit, run both generators and include the generated changes. Keep existing ticket history untouched; use a pinned released kit to manage this work.

