---
ticket: T-35
status: done
size: L
prd: .prd/prd-v4.md
depends_on: [T-32, T-34]
started: 2026-09-11T10:23:56Z
last_check: 2026-09-11T10:42:26Z passed 55b1eac2d419
verified: 2026-09-11T10:42:26Z 55b1eac2d419
finished: 2026-09-11T10:42:26Z
---

## Objective
Implement the verification runner: persist a `running` attempt before launch, snapshot inputs before and after, execute the check through `bash -eo pipefail` in its own process group with bounded sanitized capture, enforce the timeout with escalation, handle signals, and finalize the attempt from what actually happened.

## Context
- Relevant files: new `template/scripts/pincer-runtime/runner.cjs`, `template/scripts/pincer-runtime.cjs` (`verify T-NN` in migrated mode; `run --context <key> [--timeout N] -- <command>` for fixtures), `template/scripts/pincer-runtime/state.cjs`, `source.cjs`, `identity.cjs`, `template/docs/runtime-contracts.md` (`## Attempts`, `## Capture and sanitization`), new `test/runtime-runner.test.js`, fixtures under `test/fixtures/` (a grandchild spawner, a marker emitter, a source-mutating check).
- PRD section: R-03, R-04 (before/after snapshots, mutation), R-05 (timeout, termination, interruption), 5 (execution environment and output policy).
- Implements: R-03 (S-07, S-08, S-09, S-10), R-04 (S-11 dynamic, S-13), R-05 (S-16, S-17)

## Requirements
- `runAttempt({ root, context, check, timeoutSeconds, cwd })`: validates identity (binding present and revision current) and ticket input, takes the lock, allocates a sequence, snapshots source (a `SECRET_PATH` or `UNSUPPORTED_INPUT` problem aborts before launch with exit 4), writes the attempt as `running` and points `index.current[contextKey]` at it (so prior readiness is superseded immediately), releases the lock during execution, spawns `bash -eo pipefail -c <block>` with `detached: true` and `stdio` pipes, streams stdout and stderr into the attempt's log files through the sanitizer with the 1 MiB cap and a `[truncated: N more bytes]` marker, waits for exit or timeout, on timeout sends SIGTERM to the process group, waits a 5 s grace period, then SIGKILL, snapshots source again, re-takes the lock and finalizes: `passed` only when the exit code is 0, the block digest is unchanged and the before/after source digests are equal; `failed` with the exit code on nonzero; `timed_out` (exit 124); `interrupted` (exit 130) when the runtime receives SIGINT or SIGTERM (the child group is terminated the same way); `error` when the launch fails (missing executable is reported by bash as exit 127 and stays `failed`; an unwritable state directory or sanitizer failure is `error`) or when the source changed during the run (`SOURCE_CHANGED` detail names the first changed path). An attempt is never left `running` on any exit path the runtime controls.
- Each attempt records schema and runtime versions, id and sequence, context (`kind`, `change`, `prd`, `prd_revision`, `base`, `ticket`, `ticket_digest` or `candidate` and `check`), `check` (`digest`, `display` sanitized, `timeout_seconds`), outcome fields (`exit_code`, `signal`), `runner` (`shell` path and `bash --version` first line), `cwd`, `environment` (`os`, `node`, declared nonsecret context only), timestamps, `source` (`before`, `after`, `files`, `limitations`), `artifacts` (paths, sha256, bytes, `truncated`, `redactions`), `owner`, `limitations`, and `error` when applicable. No environment dump; no secret argument persisted: a block containing an inline secret-like assignment (`KEY=value` where the key matches the secret patterns) is refused before launch with a path-and-line diagnostic.
- `verify T-NN` in migrated mode runs the ticket's block as a ticket-context attempt and prints the same human lines as today (`── T-NN verification ──`, the commands, `✓ T-NN verified` or `✗ T-NN verification FAILED (exit N) — failure recorded …`) with the attempt id, then exits with the mapped code. It writes nothing to the ticket file. Legacy mode is untouched in this ticket.
- Tests (`test/runtime-runner.test.js`, added to `npm test`, each in a fresh registered fixture): S-07 a command printing distinct stdout and stderr markers then exiting 3 yields captured markers in the right logs and `failed` with `exit_code: 3`; S-08 green → running → red: after a pass, a second verify that fails leaves `current` pointing at the failed attempt and the passing record retained in history; while an attempt is running (fixture sleeps), `status --json` reports `ATTEMPT_RUNNING` and `ready` exits 1; S-09 a missing executable is `failed` with exit 127 and a log; an unwritable `.pincer/runtime` yields `error` with no fabricated log; output over the cap is truncated with the marker and `truncated: true`; S-10 `status`, `ready` and `snapshot` create no attempt and rewrite no timestamp, and a repeated `verify` always creates a new attempt with a higher sequence; S-11 dynamic: a source edit after a pass makes `status` report `SOURCE_CHANGED` naming the path and the check; S-13 a zero-exit block that writes to a tracked file is `error` with `SOURCE_CHANGED`; S-16 SIGINT and SIGTERM sent to the runtime during a sleeping check finalize `interrupted` and kill the child; a timeout of 1 s on a 30 s sleep yields `timed_out` within a few seconds; a forced kill of the runtime (SIGKILL) leaves `running`, `status` reports `ATTEMPT_INTERRUPTED`-pending as non-ready, and `recover` finalizes it as `interrupted`; S-17 a check that spawns a detached grandchild writing a heartbeat file stops writing after cancellation or timeout; a secret marker in output is redacted in the stored log and counted.

## Acceptance Criteria
- [x] Every attempt outcome is derived from actual execution; no pass survives a newer nonpassing attempt, a source mutation, or a launch or persistence failure.
- [x] Timeout, signals and forced termination leave no reusable prior success and are recoverable deterministically; process groups are terminated.
- [x] `npm test` passes with the new suite.

## Verification
Proves: the runner records what ran, against which inputs, and what happened, including failure injection for capture, mutation, timeout, signals and crashes; regression: a fabricated log, a pass after mutation, a running record promoted, or a surviving grandchild.
```bash
node test/runtime-runner.test.js && npm test
```

## Constraints
- POSIX process-group semantics only; do not claim Windows support.
- Do not split the Verification block into several checks; one block is one attempt.
