---
ticket: T-63
status: done
size: M
prd: .prd/prd-v5.md
depends_on: []
started: 2026-09-12T06:25:18Z
last_check: 2026-09-12T06:32:26Z passed 523c99f990e4
verified: 2026-09-12T06:32:26Z 523c99f990e4
finished: 2026-09-12T06:32:26Z
---

## Objective
Fix review finding 1 on the built PRD v5 candidate: `verify` and `check` evaluate the command gates before the runner acquires the worktree lock and never look again, so a transition committed in between (a `change pause` injected between the guard and the lock) lets a verification run and pass while the change is paused. Gate validation and attempt registration must happen under the same lock.

## Context
- Relevant files: template/scripts/pincer-runtime/runner.cjs; template/scripts/pincer-runtime/lifecycle.cjs; template/scripts/pincer-runtime.cjs (`check`); template/docs/runtime-contracts.md ("Command gates", "Transactions and recovery"); test/change-command-gates.test.js; test/change-contracts.test.js; a new fixture test/fixtures/attempt-race.cjs.
- PRD: [Preserve changes, authorization, and resume context](../.prd/prd-v5.md), R-08 (S-24), R-04.
- Source: the user's review of `feat/prd-v5` at `1a5cbc5`, finding 1 (P1).
- Implements: R-08 (S-24: a check/transition race refuses or serializes in the documented order).

## Requirements
- The runner accepts a revalidation callback and invokes it inside the lock, immediately before the `running` record is written; the attempt context (change, agreement, revision) is taken from the fresh guard result, not from the pre-lock one.
- A gate refusal at revalidation returns the gate's code and exit (1 for lifecycle/authorization refusals, 4 for unreadable state, 3 busy) with nothing written: no attempt record, no index change, no child launched.
- `verify` (changes mode) and `check` pass the callback; migrated and legacy modes are unchanged.
- The contract states that the gates run again under the lock and that a transition committed between the first evaluation and the lock is seen and refused; `test/change-contracts.test.js` pins it.
- A subprocess fixture injects a `change pause` between the pre-lock guard and the runner's lock for both `verify` and `check`; the test asserts the refusal, that the change is still paused, that no attempt exists and the check never launched (marker), and that the same injection of a harmless command still lets the attempt run.

## Acceptance Criteria
- [x] Injected `change pause` between guard and lock refuses `verify` with `LIFECYCLE_BLOCKED`, records no attempt and launches nothing; same for `check` on a completed change with an injected `change reopen`.
- [x] The attempt record's context is the one computed under the lock.
- [x] Contract text and its pin cover the second evaluation; generated adapters and plugin regenerated.

## Verification
Proves: the race the reviewer reproduced now refuses at the lock, and the unraced path still records attempts.
```bash
node test/change-command-gates.test.js
node test/change-contracts.test.js
node test/change-transactions.test.js
```

## Constraints
- Findings on done tickets are fixed here, never by editing T-48/T-54/T-55. After any `template/` edit run both generators and include the generated files. Manage this ticket with the pinned released v0.5.0 kit.
