---
ticket: T-50
status: open
size: M
prd: .prd/prd-v5.md
depends_on: [T-49]
---

## Objective
Select changes explicitly per worktree so PRD v5 can be implemented and reviewed without losing work or trusting stale state.

## Context
- Relevant files: template/scripts/pincer-runtime/identity.cjs; state.cjs; pincer-runtime.cjs; test/change-selection.test.js.
- PRD: [Preserve changes, authorization, and resume context](../.prd/prd-v5.md), sections 5–8.
- Implements: R-02.
- Scenarios: S-04, S-05, S-06.
- Build order and coverage: [PRD v5 ticket map](../docs/prd-v5-ticket-map.md).

## Requirements
- Implement change select using a worktree-local ignored pointer and the transaction API. Inspecting an explicit other ID must not change the pointer.
- Require explicit selection on a fresh clone; absent or dangling pointers report selection diagnostics without choosing the highest PRD or only record.
- Provide reusable execution-context validation for PRD/revision presence, ticket ownership and recorded-base ancestry. Branch names are hints, not proof of intended work or authorization.
- Selection must preserve HEAD, index, tracked files and unrelated untracked edits. No checkout/stash/reset/commit/worktree creation.
- Use real linked worktrees to verify independent pointers and attempt stores. Starting the wrong change is finally wired in T-54.

## Acceptance Criteria
- [ ] Selecting A with staged, unstaged and untracked user edits changes only its local pointer.
- [ ] Missing/deleted selection refuses resolution without fallback; a fresh clone requires explicit selection.
- [ ] Two linked worktrees retain independent selection/state, and incompatible repository views receive actionable diagnostics.

## Verification
Proves: Compares Git/index/file state around selection, exercises fresh clones and real worktrees, and rejects missing/wrong repository contexts.
```bash
node test/change-selection.test.js
```

## Constraints
- Selection does not grant approval or activate work. Do not add automatic Git operations.
- Implement the new tests named below as part of this ticket and add them to `npm test`; these are planned test paths, not tests that already pass. Reuse existing fixture helpers. After any `template/` edit, run both generators and include the generated changes. Keep existing ticket history untouched; use a pinned released kit to manage this work.

