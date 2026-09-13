---
ticket: T-79
status: done
size: M
prd: .prd/prd-v6.md
depends_on: []
started: 2026-09-13T19:18:41Z
last_check: 2026-09-13T19:25:30Z passed f8922e7f7b92
verified: 2026-09-13T19:25:30Z f8922e7f7b92
finished: 2026-09-13T19:25:30Z
---

## Objective
Fix review finding F-01 on the built candidate: every CLI command uses `process.exit()` as its return statement, and `process.stdout` is asynchronous when it is a pipe, so a report larger than one pipe buffer is truncated at the buffer boundary and the command still exits 0 with an empty stderr. `snapshot --json` on this repository emits 237,646 bytes and delivers 65,536 bytes of invalid JSON through a pipe, on Node 22 and Node 24 alike — The defect is present at the base commit and is not introduced by this change; what this change introduced is the misdescription. The boundary is the pipe buffer — 65,536 bytes, identical on Node 18, 20, 22 and 24, where 65,536 passes and 65,537 loses everything past it — so the `engines: >=22` floor raised in `5b0358b` did not fix it, and the sentence that commit added to the runtime contract is withdrawn. The floor itself is kept, justified by end of life rather than by this defect.

## Context
- Measured crossing points (output written to a file; the pipe caps at 65,536 bytes on every supported version): `snapshot --json` 237,646 B here and over the cap at ~390 tracked files; `coverage --json` ~670 B per scenario, over at ~98 scenarios; `status --json` ~390 B per ticket, over at ~160 tickets; `change show --json` ~311 B per lifecycle event, over at ~200 events; `validate` diagnostics 137,307 B of stderr for 300 malformed tickets, and that loop-shaped path truncates against a slow consumer rather than at a fixed size.
- Relevant files: template/scripts/pincer-runtime/io.cjs (new); template/scripts/pincer-runtime.cjs (62 stdout + 30 stderr writes); template/scripts/pincer-evidence.cjs (3 + 5); template/docs/runtime-contracts.md; test/runtime-output.test.js (new); package.json (test chain, engines); template/scripts/pincer-{status,ticket}.sh; docs/prd-v5-review-packet.md; docs/prd-v6-review-packet.md.
- PRD: [Complete requirement coverage and explain change impact](../.prd/prd-v6.md), R-09 (S-25); also PRD v5 R-06 (`resume` in "human and versioned JSON form") and R-04 of v6, which every `--json` consumer depends on.
- Source: `docs/pincer-assessment-2026-09-13.md` finding F-01 (P1), received 13 September 2026; confirmed during `/pincer-evaluate` of the combined v5+v6 candidate `5b0358b` and found to reproduce on Node 24 as well, which the assessment did not establish.
- Implements: R-09 ("read-only human and versioned JSON commands").

## Requirements
- A shared `io.cjs` writes to the file descriptor synchronously with `fs.writeSync`, looping over partial writes; EAGAIN and EINTR wait for the reader rather than spin; EPIPE and EBADF return silently so `pincer status | head -3` and `… 1>&-` stay quiet and keep the command's own exit code. Public API only — no `stream._handle` internals.
- Both CLI entry points route every write through it; zero direct `process.stdout.write` / `process.stderr.write` calls remain outside `io.cjs`, and a test asserts that so a new call site cannot reintroduce the defect.
- `test/runtime-output.test.js` proves completeness rather than asserting it: a command whose output exceeds one pipe buffer is captured through a pipe and through a file redirect, and the two are byte-identical and parse as JSON. It runs on whatever Node the suite runs on, so CI covers Linux and both matrix versions.
- The runtime contract states what the runtime guarantees about its own output, and no document claims Node 18+ anywhere it now means 22+: both wrappers, `runtime-contracts.md` line 4 and line 109, the two replay scripts and the Codex adapter README.
- `docs/prd-v5-review-packet.md` records the CI run that has since happened instead of "the branch has not been pushed", on the matrix that actually ran.

## Acceptance Criteria
- [x] `snapshot --json` through a pipe is byte-identical to the same command redirected to a file, on Node 22 and Node 24.
- [x] No source file outside `io.cjs` writes to stdout or stderr directly, enforced by a test.
- [x] Both generators run clean and the generated `plugin/` and adapter copies carry the change.
- [x] No document claims a Node floor the package does not enforce.

## Verification
Proves: a report larger than a pipe buffer arrives complete, and no call site bypasses the writer.
```bash
node test/runtime-output.test.js
node test/contracts.test.js
node test/distribution.test.js
node test/change-review-packet.test.js
node test/coverage-review-packet.test.js
```

## Constraints
- Findings on done tickets are fixed here, never by editing the ticket that introduced them. After any `template/` edit run both generators and include the generated files. Manage this ticket with the pinned released v0.5.0 kit.
- Do not restructure the `process.exit()` control flow. The exits are the CLI's return statements and the code below each one is the next branch of the same function, several of which write, so converting them to `process.exitCode` assignments would let a read-only command fall through into a writer — `test/coverage-reports.test.js:198-202` snapshots the tree across the read-only commands and would catch it, but the idiom is load-bearing and must stay. `check`/`verify`/`done` also leave detached children and timers that would keep a naturally-exiting process alive. Make the writes synchronous and leave every exit where it is.
