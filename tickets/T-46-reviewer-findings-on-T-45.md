---
ticket: T-46
status: done
size: S
prd: .prd/prd-v4.md
depends_on: [T-45]
started: 2026-09-11T15:11:42Z
last_check: 2026-09-11T15:22:23Z passed 51caaba6166b
verified: 2026-09-11T15:22:23Z 51caaba6166b
finished: 2026-09-11T15:22:23Z
---

## Objective
Fix the reviewer subagent's findings on the T-45 diff: the termination limitation names signals that were never delivered; records finalized by a pre-T-45 `recover` (no log digests) are reported as malformed instead of interrupted; the contract overstates which record fields are validated; a record copied over the one the index points at is not detected; the process-group reuse window is undocumented.

## Context
- Relevant files: `template/scripts/pincer-runtime/{state,runner,evidence,lifecycle,status,readiness}.cjs`, `template/docs/runtime-contracts.md`, tests `test/runtime-lifecycle.test.js`, `test/runtime-runner.test.js`, `test/runtime-evidence.test.js`.
- Source: section 2 of `review/code-quality.md` in the evidence directory of the next candidate (reviewer over `883ae14..2ff2b1a`).
- Implements: R-03, R-05, R-08 (fixes within the PRD's scope; no new behavior)

## Requirements
- The runner records only signals a `kill` actually delivered; when nothing in the group was reachable the limitation says so.
- `validateAttempt` accepts a missing log digest only on an `interrupted` record (the `recover` case); readiness reports such a record as `ATTEMPT_INTERRUPTED`; export refuses it because its logs have no recorded digest.
- `validateAttempt` also checks `runtime`, `signal`, `cwd`, `environment` and `context.base`, so the contract's "every field through `artifacts`" is true.
- The record the index points at must carry that id: `latestAttempt` callers pass the pointed id and a record with another id is `ATTEMPT_ERROR`; export refuses it.
- The contract names the process-group reuse window after the shell is reaped as a limit.
- Assertions for each runtime fix; generated outputs regenerated.

## Acceptance Criteria
- [x] Each finding has an assertion or a contract sentence.
- [x] `npm test` passes and generators produce no diff.

## Verification
Proves: the five reviewer findings are fixed or recorded; regression: a limitation claiming a signal that was not sent, an old interrupted record shown as malformed, a copied record accepted under another pointer, or stale generated output.
```bash
node test/runtime-lifecycle.test.js && node test/runtime-runner.test.js && node test/runtime-evidence.test.js && node test/runtime-state.test.js && node test/contracts.test.js && npm test && h() { find template/.agents template/.github plugin -type f | sort | xargs shasum -a 256 | shasum -a 256; } && before=$(h) && bash template/scripts/sync-prompts.sh >/dev/null && bash scripts/build-plugin.sh >/dev/null && [ "$(h)" = "$before" ]
```

## Constraints
- No new behavior beyond the findings; no new reason codes.
