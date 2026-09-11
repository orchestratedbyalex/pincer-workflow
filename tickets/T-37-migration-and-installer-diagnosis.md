---
ticket: T-37
status: done
size: M
prd: .prd/prd-v4.md
depends_on: [T-36]
started: 2026-09-11T10:57:00Z
last_check: 2026-09-11T11:02:04Z passed 2c481a54ef09
verified: 2026-09-11T11:02:04Z 2c481a54ef09
finished: 2026-09-11T11:02:04Z
---

## Objective
Provide read-only migration preview and explicit apply with backups, idempotent re-apply, fail-closed conflict handling, legacy receipt import as history, and installer diagnosis, so existing projects move to the runtime without losing user work.

## Context
- Relevant files: new `template/scripts/pincer-runtime/migrate.cjs`, `template/scripts/pincer-runtime.cjs` (`migrate --preview|--apply --prd .prd/prd-vN.md [--change <id>] [--authorization <text>]`), `bin/pincer.js` (`doctor` reports migration need and runtime presence; `init`/`update` deploy runtime files and never migrate), `template/docs/runtime-contracts.md` (`## Migration and rollback`), `test/installer.test.js`, `test/smoke.test.js`, new `test/runtime-migrate.test.js`.
- PRD section: R-09, R-06 (`verified`/`last_check` removed only by explicit migration), R-01 (after migration), 9 (migration failure).
- Implements: R-09 (S-27, S-29), R-06, R-01

## Requirements
- `migrate --preview --prd X` prints the plan: the binding it would write, each ticket of that PRD whose `verified`/`last_check` lines would be removed and recorded as `legacy_receipts`, the `.gitignore` line `.pincer/` it would add, and any conflict (existing binding for another PRD, malformed ticket, unsupported schema, a ticket of another PRD carrying the same ID, a partially applied earlier migration detected from a binding without the receipts removed or vice versa). It writes nothing and exits 0 when the plan is applicable, 1 when a conflict makes apply refuse.
- `migrate --apply` performs the plan atomically per file with a backup of every changed authored file under `.pincer/backups/<UTC timestamp>/<original path>`, then writes the binding last; repeated apply is a no-op that reports `already migrated`; any conflict fails closed before the first write. Legacy receipts land in the binding's `legacy_receipts` map and are labelled history; new verification starts as unverified (`status` shows `LEGACY_RECEIPT` on done tickets until a runtime attempt exists, without changing `finished`).
- Rollback guide in the contract document: how to restore from `.pincer/backups/`, remove the binding, and that an older runtime cannot enforce the new guarantees.
- Installer: `init` and `update` deploy `scripts/pincer-runtime.cjs`, `scripts/pincer-runtime/*.cjs` and the contract document; `doctor` reports `note  migration available: node scripts/pincer-runtime.cjs migrate --preview --prd <latest prd>` when tickets carry legacy receipts and no binding exists, and `FAIL runtime files present` when the manifest lists them but they are missing; neither `init` nor `update` migrates.
- Tests (`test/runtime-migrate.test.js`, added to `npm test`): clean (no tickets), customized (user edits in ticket bodies and AGENTS.md preserved byte for byte), ambiguous (two PRDs, `--prd` required and the other binding refused without `--replace`), partly migrated (binding present, receipts still there → preview names it, apply completes it), and legacy (receipts on done tickets) fixtures; preview writes nothing (snapshot equality); apply then re-apply are idempotent; the backup restores the original ticket byte for byte; a malformed ticket makes apply fail before any write; existing installer conflict tests stay green.

## Acceptance Criteria
- [x] Preview is read-only and names every change and conflict; apply backs up, migrates once, and re-apply is idempotent.
- [x] Legacy receipts become history, never source-bound evidence; user files are preserved in every fixture.
- [x] `npm test` passes with the new suite and the installer suites.

## Verification
Proves: migration preserves user work and fails closed on conflicts; regression: a lost user edit, a receipt relabelled as runtime evidence, a partial migration reported as complete, or an installer that migrates silently.
```bash
node test/runtime-migrate.test.js && node test/installer.test.js && npm test
```

## Constraints
- Never delete user data as repair; conflicts stop the migration.
