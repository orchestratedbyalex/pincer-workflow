---
ticket: T-34
status: done
size: M
prd: .prd/prd-v4.md
depends_on: [T-31]
started: 2026-09-11T10:06:58Z
last_check: 2026-09-11T10:11:49Z passed 376d5fe206ca
verified: 2026-09-11T10:11:49Z 376d5fe206ca
finished: 2026-09-11T10:11:49Z
---

## Objective
Implement the local runtime state store with atomic replacement, a per-worktree exclusive lock with bounded waits and owner identity, sequence allocation, and deterministic crash diagnosis so records cannot be corrupted or lost by overlapping or interrupted writers.

## Context
- Relevant files: new `template/scripts/pincer-runtime/state.cjs`, `template/scripts/pincer-runtime.cjs` (`recover` command, `--json` state inspection via `status`), `template/docs/runtime-contracts.md` (`## Attempts`), new `test/runtime-state.test.js`, new `test/fixtures/hold-lock.cjs`.
- PRD section: R-05, R-06 (ignored `.pincer/runtime/`), 5 (local index/lock owned by the runtime).
- Implements: R-05 (S-15, S-17 write part), R-06 (state location)

## Requirements
- Layout under `<root>/.pincer/runtime/`: `index.json` (`{schema: 1, sequence, current: {<contextKey>: <attemptId>}, running: [<attemptId>]}`), `attempts/<attemptId>.json`, `attempts/<attemptId>/stdout.log` and `stderr.log`, `manifests/<digest>.json`, `lock/` (directory created with `mkdir`, containing `owner.json` `{pid, ppid, host, started, command}`), `journal/` for temp files. `.pincer/` is never read as source and must be gitignored (T-37 adds the line; this ticket documents it).
- `state.cjs` exports `withLock(root, fn, {waitMs = 10000})`, `readIndex`, `writeIndex`, `nextSequence`, `writeAttempt`, `readAttempt`, `listAttempts(contextKey)`, `latestAttempt(contextKey)`, `storeManifest`, `readManifest`. Every write goes to a temp file in `journal/` on the same filesystem and is renamed into place; a partially written temp file is ignored on read and reported by `recover`. Attempt IDs are `<sequence padded to 6>-<UTC compact timestamp>-<6 hex>`; the sequence in `index.json` is the authority for ordering.
- Lock semantics: acquisition polls every 100 ms up to `waitMs`, then fails with exit 3 `STATE_BUSY` naming the owner pid, host and start time. A lock whose owner pid is on this host and no longer alive is reclaimed with a diagnostic on stderr; a live owner is never stolen; a foreign host owner is never reclaimed automatically.
- `recover` takes the lock, finalizes every `running` attempt whose owner pid is dead on this host as `interrupted` (with `finished` and a `limitations` note), reports foreign-host or live-owner attempts as still running, removes orphaned journal files, and never promotes an unfinished record to `passed`. Separate worktrees have separate `.pincer/runtime/` directories because the root is the worktree; the contract says so.
- Tests (`test/runtime-state.test.js`, added to `npm test`): S-15 two writers, one holding the lock through `test/fixtures/hold-lock.cjs`, the second receives exit 3 within the bound and, after release, succeeds and both records exist; a crash-simulated stale lock (owner file with a dead pid) is reclaimed; a live owner is not; corrupt `index.json` yields exit 4 with a diagnostic and no overwrite; an interrupted write (a stray journal temp file plus a valid index) leaves the prior state readable and `recover` names the stray file; sequence numbers are strictly increasing across writers.

## Acceptance Criteria
- [x] Overlapping writers cannot corrupt or lose records; the second receives a bounded busy result or starts after the first completes.
- [x] Restart diagnosis is deterministic: a dead-owner running attempt becomes `interrupted` only through `recover`, and nothing is promoted to success.
- [x] `npm test` passes with the new suite.

## Verification
Proves: locking, atomic replacement and recovery behave as contracted under concurrent and interrupted writers; regression: a lost record, a stolen live lock, a promoted running attempt, or a corrupt index silently rewritten.
```bash
node test/runtime-state.test.js && npm test
```

## Constraints
- No command execution here; the runner (T-35) is the only caller that creates attempts.
