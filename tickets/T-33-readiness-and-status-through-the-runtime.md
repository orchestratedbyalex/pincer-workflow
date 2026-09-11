---
ticket: T-33
status: open
size: M
prd: .prd/prd-v4.md
depends_on: [T-32]
---

## Objective
Implement the pure readiness computation and the human and JSON status report in the runtime, and make `pincer-status.sh` a wrapper that delegates to it, so both modes are explained without an LLM and the Bash status implementation disappears.

## Context
- Relevant files: new `template/scripts/pincer-runtime/readiness.cjs`, new `template/scripts/pincer-runtime/status.cjs`, `template/scripts/pincer-runtime.cjs` (`status [--json]`, `ready [T-NN]`), `template/scripts/pincer-status.sh` (becomes `exec node … status "$@"`), `template/scripts/pincer-ticket-lib.sh` (`notes_current`, `ticket_readiness`, `latest_prd` are ported; the file stays until T-36 removes it), `template/docs/runtime-contracts.md` (`## Readiness and reason codes`), tests `test/ticket.test.js`, `test/recovery.test.js`, `test/candidate.test.js`, `test/validation.test.js` (all existing status assertions must keep passing), new `test/runtime-status.test.js`.
- PRD section: R-08, 5 (status is a computed projection).
- Implements: R-08 (S-25 static, S-26 human/JSON agreement), R-02 (shell entry points delegate)

## Requirements
- `readiness.cjs` exports `computeTicketReadiness({ ticket, mode, binding, attempts, currentSource })` and `computeCandidateReadiness(...)` returning `{ ready, reasons: [{code, detail}], next }`. Legacy mode reproduces today's rules exactly: latest `last_check` must be `passed` with the current block hash, `verified` must match, no unticked criteria; the reason codes are `CHECK_CHANGED`, `CHECK_FAILED`, `EVIDENCE_MISSING`, `ATTEMPT_RUNNING`, `ATTEMPT_INTERRUPTED`, `LEGACY_RECEIPT` and `MIGRATION_REQUIRED` as the contract defines. Migrated mode reads the latest attempt for the ticket context (attempt records arrive in T-35; this ticket consumes the contract shape) and adds `SOURCE_CHANGED`, `REVISION_CHANGED`, `ATTEMPT_TIMED_OUT`, `STATE_BUSY`.
- `status.cjs` prints the existing human format line for line (`PINCER status`, `PRD`, `History`, `Tickets`, rows, `WARN`, `Build`, `Notes`, `Evidence`, `Next`) so the current test assertions hold, plus a `Runtime` line: `Runtime  legacy · no change binding · migrate with node scripts/pincer-runtime.cjs migrate --preview --prd <prd>` or `Runtime  change <id> · revision <12 hex> · base <short sha>`. `--json` emits one status JSON schema 1 object on stdout and nothing else there; diagnostics go to stderr. `status` exits 0 whenever inspection succeeded, 4 on invalid input (today's exit 1 cases become 4; the `Next repair …` line stays), and never executes a check or writes.
- `ready [T-NN]` is the read-only gate: exit 0 when ready, 1 when not, printing the reason codes; with no ticket it gates the candidate (notes current, evidence ok, no ticket warnings).
- The `notes_current` rules are ported verbatim (PRD match, 40-hex IDs, ancestry, manifest validates for candidate/base/PRD, listed files tracked, only NOTES.md and listed files changed, clean tree apart from NOTES.md, subdirectory projects, non-ASCII paths) and reuse `pincer-evidence.cjs` through a module import, not a subprocess.
- `pincer-status.sh` keeps its name, arguments and `PINCER_BUILD_BUDGET_MIN`, and delegates; it requires Node 18+ with a clear message otherwise.
- `test/runtime-status.test.js` (added to `npm test`): the JSON object parses, contains no progress text, and agrees with the human `Next`/`WARN` lines on the same fixtures; every failure fixture yields a stable reason code and a concrete next action; the status exit codes match the contract; `ready` exits 1 for a failed, running, stale and unticked ticket and 0 for a current one (legacy fixtures).

## Acceptance Criteria
- [ ] All existing status assertions pass unchanged through the wrapper; the human output keeps its format and gains the `Runtime` line.
- [ ] JSON and human output agree because both consume the same readiness computation; `ready` gates read-only.
- [ ] `npm test` passes with the new suite.

## Verification
Proves: the Node status reproduces every pinned legacy verdict and adds machine-readable reasons; regression: any existing status assertion failing, JSON disagreeing with the human next action, or status writing to the tree.
```bash
node test/runtime-status.test.js && npm test
```

## Constraints
- Do not switch `pincer-ticket.sh` yet; legacy receipts remain the writer's contract until T-36.
