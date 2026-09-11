---
ticket: T-48
status: open
size: L
prd: .prd/prd-v5.md
depends_on: [T-47]
---

## Objective
Add atomic change transactions and recovery so PRD v5 can be implemented and reviewed without losing work or trusting stale state.

## Context
- Relevant files: template/scripts/pincer-runtime/state.cjs; template/scripts/pincer-runtime/fsutil.cjs; new change transaction module; test/change-transactions.test.js; subprocess fixtures.
- PRD: [Preserve changes, authorization, and resume context](../.prd/prd-v5.md), sections 5–8.
- Implements: R-08.
- Scenarios: S-24, S-25, S-26.
- Build order and coverage: [PRD v5 ticket map](../docs/prd-v5-ticket-map.md).

## Requirements
- Introduce the shared transaction API for registration, selection, agreement binding, lifecycle events and evaluation references. Lock the complete validate-and-write operation and compare expected revision/sequence at commit.
- Journal coordinated writes and validate projections against event history; a forced kill must leave recoverable old state or a complete committed transition, not half of each.
- Check relevant running attempts under the same lock. Expose a refusal usable by pause/cancel/supersede; never terminate an attempt silently.
- Keep bounded acquisition, owner checks and explicit recovery. Exercise the actual stale-lock contention path with coordinated competing subprocesses, not only a static lock fixture.
- Do not hold locks across user interaction; stale prepared decisions refuse when their expected agreement changed.

## Acceptance Criteria
- [ ] Overlapping writers cannot lose events, overwrite a newer revision, or admit conflicting state; real process barriers make contested interleavings reproducible.
- [ ] Forced termination at each journal boundary produces diagnosed and recoverable state; read-only inspection leaves journal and authored files unchanged.
- [ ] Live attempts block conflicting transitions; dead-owner recovery preserves interrupted evidence and allows a subsequent transaction.

## Verification
Proves: Injects concurrent writers, stale-owner contention, stale revisions, running checks and process death to detect lost or partially committed state.
```bash
node test/change-transactions.test.js
node test/runtime-state.test.js
```

## Constraints
- No cross-machine or cross-worktree locking service; callers in later tickets must use this API rather than bypass it.
- Implement the new tests named below as part of this ticket and add them to `npm test`; these are planned test paths, not tests that already pass. Reuse existing fixture helpers. After any `template/` edit, run both generators and include the generated changes. Keep existing ticket history untouched; use a pinned released kit to manage this work.

