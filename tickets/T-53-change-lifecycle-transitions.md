---
ticket: T-53
status: open
size: L
prd: .prd/prd-v5.md
depends_on: [T-50, T-52]
---

## Objective
Implement the change lifecycle and preserve event history so PRD v5 can be implemented and reviewed without losing work or trusting stale state.

## Context
- Relevant files: new change lifecycle module; template/scripts/pincer-runtime.cjs; state.cjs; readiness.cjs; test/change-lifecycle.test.js.
- PRD: [Preserve changes, authorization, and resume context](../.prd/prd-v5.md), sections 5–8.
- Implements: R-03, R-08.
- Scenarios: S-07, S-08, S-09, S-10, S-24, S-25, S-26.
- Build order and coverage: [PRD v5 ticket map](../docs/prd-v5-ticket-map.md).

## Requirements
- Implement planned/active/paused/completed/cancelled/superseded and every transition from PRD section 4 through T-48. Enforce one active change per worktree.
- Activation/resume/reopen require selected identity, compatible repository view and applicable authorization; resume may show stale verification rather than execute checks.
- Complete requires all owned tickets done with checked criteria/current passing verification and no unresolved consequential decision. Completed means ready for evaluation, not release PASS.
- Pause preserves progress and authorization. Cancel and supersede require explicit decision references; terminal histories remain inspectable and cannot reopen. Validate existing replacement, self-reference and cycles.
- Reopen retains completion history; idempotent repetitions write no event. Running attempts block pause/cancel/supersede without killing them. Invalid transitions preserve files.

## Acceptance Criteria
- [ ] All valid/invalid transition pairs are covered by observable CLI tests, including idempotence and state/history agreement.
- [ ] Stale/red evidence, unfinished work or unresolved decisions block completion; reopened work retains historical events without inventing fresh evidence.
- [ ] Cancelled/superseded execution and cyclic supersession refuse; concurrent activation never leaves two active changes.
- [ ] Running-attempt races and transition crash points recover through the real transaction layer.

## Verification
Proves: Exercises the transition matrix and actual concurrency/recovery boundaries; detects false completion, lost history, invalid terminal execution and duplicate activation.
```bash
node test/change-lifecycle.test.js
node test/change-transactions.test.js
```

## Constraints
- No source restoration or branch switching; complete before candidate evaluation.
- Implement the new tests named below as part of this ticket and add them to `npm test`; these are planned test paths, not tests that already pass. Reuse existing fixture helpers. After any `template/` edit, run both generators and include the generated changes. Keep existing ticket history untouched; use a pinned released kit to manage this work.

