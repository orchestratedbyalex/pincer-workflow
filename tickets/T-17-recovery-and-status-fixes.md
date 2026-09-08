---
ticket: T-17
status: done
size: S
prd: .prd/prd-v2.md
depends_on: [T-15]
started: 2026-09-08T14:43:20Z
last_check: 2026-09-08T14:46:04Z passed a79ed746a38f
verified: 2026-09-08T14:46:04Z a79ed746a38f
finished: 2026-09-08T14:46:04Z
---

## Objective
Fix the misleading verify-failure text, duplicated readiness warnings and noisy elapsed line, and document ticket recovery that never revives stale success.

## Context
- PRD: `.prd/prd-v2.md`, requirement R-06. Implements: R-06.
- Dry-run findings 5 to 8 in `docs/dry-run-2026-09-08-sonnet.md`.
- `template/scripts/pincer-ticket.sh` `cmd_verify` failure message; `template/scripts/pincer-status.sh` per-ticket warning block and Build line; `template/.claude/commands/pincer-code.md` (recovery guidance); `template/.claude/hooks/hook-policy.cjs` (keep `checkout`/`restore` of ticket paths blocked).
- `test/recovery.test.js`, `test/ticket.test.js`, `test/hooks.test.js`.

## Requirements
- Failed `verify` prints that the failure was recorded in `last_check` and any prior successful receipt was revoked, and names the file.
- Status emits each readiness problem once: the failed-attempt warning and `ticket_readiness` no longer duplicate; distinct problems on different tickets are all shown.
- The Build elapsed line appears only when a ticket is `in_progress` or `PINCER_BUILD_BUDGET_MIN` is set, and is labelled wall-clock elapsed, not active execution time. Fixed-timebox prose is removed from status and the code playbook where the user supplied no budget.
- Code playbook recovery section: raw `git checkout`/`git restore` of ticket files stays blocked by the guard because restoring HEAD can erase a newer failure and revive an old passing receipt; the assistant preserves malformed contents, reports the validation error, and the user repairs in their own terminal; work then returns through `start`/`verify`/`done` with fresh verification. Do not recommend restoring source or unrelated edits as routine ticket repair. Automated recovery preserving attempt history is M1.
- Tests: failed verify output text; two done tickets with distinct problems produce two distinct warnings and a single failed-attempt ticket produces exactly one warning; elapsed line present with an in-progress ticket or budget, absent on a finished PRD; the hook still blocks `git checkout -- tickets/T-01-*.md` and `git restore` after a failed recheck (existing hook payload plus a lifecycle scenario in `test/recovery.test.js`).

## Acceptance Criteria
- [x] Failed verification output states the failure was recorded and the prior receipt revoked.
- [x] Status prints one warning per distinct readiness problem and none twice.
- [x] Elapsed time appears only for active work or an explicit budget and is labelled wall-clock elapsed.
- [x] Ticket checkout/restore remains blocked after a failed recheck, and the code playbook documents user-performed repair followed by fresh verification.

## Verification
Proves: the runtime scripts emit the corrected failure text, one warning per problem and elapsed only when active, and the hook keeps blocking ticket restores; regression: a duplicated warning, a revived receipt, or the misleading message returning.
```bash
node test/recovery.test.js && node test/ticket.test.js && node test/hooks.test.js && node test/workflow.test.js && node test/distribution.test.js
```

## Constraints
- Do not add automated ticket repair or attempt-history restoration.
- Do not loosen the guard for any ticket path.
