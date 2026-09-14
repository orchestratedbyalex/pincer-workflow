---
ticket: T-58
status: done
size: L
prd: .prd/prd-v5.md
depends_on: [T-57]
started: 2026-09-11T21:58:00Z
last_check: 2026-09-11T23:56:47Z passed 469e8487d7ba
verified: 2026-09-11T23:56:47Z 469e8487d7ba
finished: 2026-09-11T23:56:47Z
---

## Objective
Migrate v0.5.0 change state explicitly with backups so PRD v5 can be implemented and reviewed without losing work or trusting stale state.

## Context
- Relevant files: template/scripts/pincer-runtime/migrate.cjs; identity.cjs; state.cjs; pincer-runtime.cjs; test/change-migration.test.js; test/fixtures/prd-v5/.
- PRD: [Preserve changes, authorization, and resume context](../.prd/prd-v5.md), sections 5–8.
- Implements: R-09.
- Scenarios: S-27, S-28, S-29.
- Build order and coverage: [PRD v5 ticket map](../docs/prd-v5-ticket-map.md).

## Requirements
- Provide preview/apply and tested rollback for legacy and released v0.5.0 fixtures. Preserve original tracked files and old attempts/evaluations; explicitly classify unusable old evidence as historical.
- Import prior free-text authorization only as an unvalidated reference; do not infer active execution from done/built status. Matching actual prior instructions use T-52 without a new approval request.
- Preview any local selection of the sole valid old binding. New clones still require selection; retain legacy behavior until explicit migration.
- Use atomic/journaled migration with backup of every altered tracked file, bounded locking, version checks and deterministic partial-apply recovery. Reapply is a no-op.
- Unknown schemas, conflicts and dirty customized records refuse or preserve according to the contract; never fall back to legacy or delete user data.

## Acceptance Criteria
- [x] Clean/customized/legacy/v0.5.0 fixtures migrate with correct preview, backups and preserved historical evidence.
- [x] Faults at each migration boundary recover safely; reapply is idempotent; tested rollback restores original files.
- [x] Old free-text approval alone never enables execution; new-schema unreadability and conflicting history fail closed.

## Verification
Proves: Uses pinned released records, customized files and migration fault injection to detect silent approval, lost work, partial-state fallback and broken rollback.
```bash
node test/change-migration.test.js
node test/runtime-migrate.test.js
node test/installer.test.js
```

## Constraints
- Do not migrate the distribution repository during implementation; use throwaway fixtures and a pinned released kit.
- Implement the new tests named below as part of this ticket and add them to `npm test`; these are planned test paths, not tests that already pass. Reuse existing fixture helpers. After any `template/` edit, run both generators and include the generated changes. Keep existing ticket history untouched; use a pinned released kit to manage this work.

