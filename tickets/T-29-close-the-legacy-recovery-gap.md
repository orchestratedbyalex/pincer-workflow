---
ticket: T-29
status: open
size: S
prd: .prd/prd-v4.md
depends_on: []
---

## Objective
Tighten the v0.4.1 recovery exception so a receipt can be restored only when the recorded failure is explained by a since-reverted source change and the check passes in the same execution context, and add a harness-owned local-service fixture that an agent cannot repair by switching binaries.

## Context
- Relevant files: `template/.claude/commands/pincer-code.md` (Recovering a ticket file), `template/.claude/commands/pincer-status.md` (recovery sentence), `template/docs/dry-run-checklist.md` (code cheat boxes), `test/workflow.test.js` (wording assertions next to the PRD v3 R-01 block), `test/recovery.test.js` (legacy fixtures), `test/helpers.js`, new `test/fixtures/local-service.cjs`.
- PRD section: 4 R-01 (before migration), 6 step 1, `docs/trial-2026-09-10-prd-v3.md` finding 1.
- Implements: R-01 (S-01 legacy, S-02, S-03)

## Requirements
- The code playbook's exception gains two conditions and keeps the existing three sentences that `test/workflow.test.js` already asserts: the recorded failure must be explained by a working-tree change that has since been reverted, and the Verification block must pass in the same declared execution context as `verify` (same shell, working directory, `PATH` and environment, no substituted binary, no repair first). It states that a changed executable, runner, working directory or environment repair requires a new recorded verification through the lifecycle, and that an unexplained failure cannot be cleared by restoring a receipt. The literal phrases `explained by a working-tree change that has since been reverted`, `same execution context`, and `An unexplained failure cannot be cleared by restoring a receipt` appear.
- The status playbook and the dry-run checklist carry the same rule in one sentence each; the checklist gains a cheat box for the service-failure case (service down, source unchanged: the assistant keeps the failed `last_check`, does not name a restore command, and asks for the service to be repaired before `verify`).
- `test/fixtures/local-service.cjs` starts an HTTP server on `127.0.0.1` at a port given by argument or chosen freely, prints the port on stdout, answers `GET /health` with 200, and exits on SIGTERM. `test/helpers.js` exports `startService()` / `stopService()` around it.
- `test/recovery.test.js` gains: (S-02) a ticket whose check is `curl -sf http://127.0.0.1:$(cat service.port)/health`; with the service up, `verify` and `done` pass and the ticket commit is made; with the service stopped and `git status --porcelain` empty, `verify` fails with the failure recorded and the receipt revoked; status routes to `re-run verify`; after the service is restarted `verify` passes again with a new receipt. (S-03) with a source change still in the tree, `verify` on the unchanged ticket fails or passes on its own merits but status reports the working-tree change and never `pincer-release`.
- Generated adapters and plugin are regenerated with no further diff.

## Acceptance Criteria
- [ ] The five recovery conditions are present in code, status and checklist wording, asserted in `test/workflow.test.js`, and the existing R-01 assertions still hold.
- [ ] The local-service fixture runs from the test harness and from a shell, and the S-02 and S-03 fixtures in `test/recovery.test.js` fail on the wrong behavior (a receipt that survives the service failure would fail the test).
- [ ] `npm test` passes and both generators produce no diff.

## Verification
Proves: the tightened exception is in the playbooks and pinned by assertions, the service-failure fixture observes failure recorded and receipt revoked with unchanged source, and generated output is current; regression: any condition phrase missing, the fixture passing without the service, or stale adapters.
```bash
npm test && node test/recovery.test.js && grep -q 'explained by a working-tree change that has since been reverted' template/.claude/commands/pincer-code.md && grep -q 'same execution context' template/.claude/commands/pincer-code.md && grep -q 'An unexplained failure cannot be cleared by restoring a receipt' template/.claude/commands/pincer-code.md && grep -q 'same execution context' template/.claude/commands/pincer-status.md && grep -q 'same execution context' template/docs/dry-run-checklist.md && test -f test/fixtures/local-service.cjs && h() { find template/.agents template/.github plugin -type f | sort | xargs shasum -a 256 | shasum -a 256; } && before=$(h) && bash template/scripts/sync-prompts.sh >/dev/null && bash scripts/build-plugin.sh >/dev/null && [ "$(h)" = "$before" ]
```

## Constraints
- Do not touch `pincer-ticket.sh`, the guard or the status script: this ticket is wording plus fixtures and may ship on its own.
- Do not edit `.prd/prd-v3.md` or the T-24..T-28 files.
