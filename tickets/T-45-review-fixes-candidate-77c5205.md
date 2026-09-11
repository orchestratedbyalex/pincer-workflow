---
ticket: T-45
status: open
size: M
prd: .prd/prd-v4.md
depends_on: [T-44]
---

## Objective
Fix the three findings of the external review of candidate `77c5205`: an incomplete attempt record still counts as a pass, a captured log modified after the run is still exported as validated runtime evidence, and the timeout is not enforced when the shell exits before a background child that keeps the output pipes open.

## Context
- Relevant files: `template/scripts/pincer-runtime/{readiness,state,runner,evidence,lifecycle,status}.cjs`, `template/docs/runtime-contracts.md`, tests `test/runtime-lifecycle.test.js`, `test/runtime-evidence.test.js`, `test/runtime-runner.test.js`, `test/contracts.test.js`.
- Source: the reviewer's report and reproduction script (run on 2026-09-11 against `77c5205`), recorded in `review/code-quality.md` in the evidence directory of the next candidate.
- Implements: R-03, R-04, R-05, R-07, R-08 (fixes within the PRD's scope; no new behavior)

## Requirements
- Attempt records: readiness validates the record's schema (`id`, `sequence`, `context`, `check`, `outcome`, `source`, `artifacts`, `runner`, `started`, `finished`) and that its context key matches the ticket or check it is read for before any outcome is honored; a malformed or mismatched record is `ATTEMPT_ERROR`, never ready; `done` refuses; `evidence export` refuses.
- Captured logs: readiness and export compare each captured log with the digest the attempt recorded; a log that differs is `EVIDENCE_MISSING` (named as altered) for tickets and a refusal for export; a missing log stays `EVIDENCE_MISSING`.
- Timeout and interruption: the runtime signals the child's process group whether or not the shell has already exited; after SIGKILL it waits a bounded time for the output pipes to close, then abandons capture and records the limitation; a check whose shell exits 0 leaving a background child finishes within the timeout plus the grace periods, and the child is dead.
- Contract: the Attempts rules, the reason-code table and the Timeout paragraph state the above.
- Assertions for every fix; generated outputs regenerated.

## Acceptance Criteria
- [ ] Every finding has a failing-before, passing-after assertion.
- [ ] Contract, readiness, export and runner agree.
- [ ] `npm test` passes and generators produce no diff.

## Verification
Proves: the three review findings are fixed and pinned; regression: an incomplete attempt record closing a ticket, a replaced captured log exported as runtime evidence or leaving readiness green, a background child outliving a one-second timeout, or stale generated output.
```bash
node test/runtime-lifecycle.test.js && node test/runtime-evidence.test.js && node test/runtime-runner.test.js && node test/runtime-status.test.js && node test/contracts.test.js && npm test && h() { find template/.agents template/.github plugin -type f | sort | xargs shasum -a 256 | shasum -a 256; } && before=$(h) && bash template/scripts/sync-prompts.sh >/dev/null && bash scripts/build-plugin.sh >/dev/null && [ "$(h)" = "$before" ]
```

## Constraints
- No new behavior beyond the findings; no new reason codes.
