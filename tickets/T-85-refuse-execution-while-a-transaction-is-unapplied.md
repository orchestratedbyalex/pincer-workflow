---
ticket: T-85
status: done
size: M
prd: .prd/prd-v6.md
depends_on: []
started: 2026-09-13T19:46:31Z
last_check: 2026-09-13T19:52:58Z passed de4b47d8c0cc
verified: 2026-09-13T19:52:58Z de4b47d8c0cc
finished: 2026-09-13T19:52:58Z
---

## Objective
Migrated mode does not refuse execution while a committed transaction is unapplied, so work done after a killed `migrate --apply` is destroyed without warning by the `recover` that `status` itself recommends. `identity.loadBinding` never consults `transaction.pending`, and `runner.runAttempt` never calls `transaction.recoverPending` before taking the lock. Changes mode has the guard; migrated mode is the mode `migrate --apply` runs in, so it is the only mode in which this crash can happen.

## Context
- Relevant files: template/scripts/pincer-runtime/identity.cjs (`loadBinding`, the mode dispatch); template/scripts/pincer-runtime/transaction.cjs (`pending`, `recoverPending`); template/scripts/pincer-runtime/runner.cjs (`runAttempt` and its `state.withLock` block); template/scripts/pincer-runtime/changes.cjs (the equivalent guard that already exists); template/scripts/pincer-runtime/migrate.cjs (the candidate-pointer rewrite); test/change-migration.test.js (the crash loop at 158-189).
- PRD: [Preserve changes, authorization, and resume context](../.prd/prd-v5.md), R-08 ("On interruption, recover either the prior complete state or the committed transition with its matching event"; S-25 "Forced termination at each transition boundary is recoverable without invented authorization or success") and R-09 (S-27 "Clean, customized, legacy, single-binding v0.5.0, and interrupted migration fixtures preserve user work and evidence").
- Source: the v5 runtime-core review run during `/pincer-evaluate` of the combined v5+v6 candidate; reproduced by killing `migrate --apply` after the manifest rename, then running start/verify/done and recover.
- Implements: R-08 and R-09/S-27.

## Requirements
- A committed, unapplied transaction refuses execution in every mode, not only in changes mode: `start`, `verify`, `done`, `check` and `evidence export` report `STATE_INCOMPLETE` and name `recover`, before any ticket is written or any child is launched.
- No attempt record or index pointer is written against state a pending manifest will overwrite: the attempt path completes any pending transaction first, as `transaction.run` and `state.recover` already do.
- `recover` never silently replaces newer work: where the guard cannot prevent it, the operation says what it is about to overwrite.
- Migration does not leave candidate pointers whose key no attempt record can satisfy. A pre-migration attempt reads as absent ("run the check again"), not as a corrupted record, and the preview does not advertise a rewrite that cannot work.
- The interrupted-migration crash loop runs an execution command — `start`, `verify` and `check` — between the crash and the `recover`, at every journal boundary.

## Acceptance Criteria
- [x] After a crash at any journal boundary of `migrate --apply`, every execution command refuses with `STATE_INCOMPLETE` until `recover` runs.
- [x] No sequence rollback orphans an attempt, and no ticket loses a lifecycle field to `recover`.
- [x] Migration leaves no candidate pointer that no attempt record could satisfy, and keeps the attempt records themselves as history.

## Verification
Proves: an interrupted migration cannot lose work that was done after it.
```bash
node test/change-migration.test.js
node test/runtime-migrate.test.js
node test/change-transactions.test.js
node test/runtime-state.test.js
node test/recovery.test.js
```

## Constraints
- Findings on done tickets are fixed here, never by editing T-57 or T-60. After any `template/` edit run both generators and include the generated files. Manage this ticket with the pinned released v0.5.0 kit.
- Legacy projects keep their documented behaviour: the new refusal applies to a pending committed transaction, not to the absence of runtime state.
