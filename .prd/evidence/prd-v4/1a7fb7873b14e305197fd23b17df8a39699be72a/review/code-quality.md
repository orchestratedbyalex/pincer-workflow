# Code-quality review — PRD v4 candidate 1a7fb78 (base 6771fbc)

This candidate follows three earlier ones. Candidate 1 `7b561b1` was reviewed by two
subagents (eighteen findings, fixed in T-44); that record is
`.prd/evidence/prd-v4/77c5205ccf5d0c2723fcd0eb8471401c3d7ff0bb/review/code-quality.md`
and is not repeated here. Candidate 2 `77c5205` was evaluated (`883ae14`) and then
reviewed externally with a reproduction script against the runtime; the three
findings in section 1 became T-45 (`2ff2b1a`). The T-45 diff was sent to one reviewer
subagent; its five findings in section 2 became T-46 (`21b5d26`). Candidate 4
`1a7fb78` is T-46 plus the wiki and packet commit; the evaluator checked the T-46 diff
against each section 2 finding rather than re-dispatching the reviewer. Dispositions
are the evaluator's.

## 1. External review of candidate 77c5205 (reproduced, fixed in T-45)

1. `template/scripts/pincer-runtime/readiness.cjs` — every field check was guarded
   (`attempt.check && …`, `attempt.context && …`, `attempt.source && …`,
   `attempt.artifacts && …`), so a record reduced to `{"id": "…", "outcome": "passed"}`
   satisfied readiness and `done` closed the ticket. High. **Fixed in T-45:**
   `state.validateAttempt(record, contextKey)` checks record schema 1 (id, sequence,
   context, check, outcome, exit_code, runner, started, finished, source, artifact
   paths and digests) and that the record's context key equals the key it was read
   for; readiness reports `ATTEMPT_ERROR`, `done` refuses, `evidence export` refuses.
   Assertions: `test/runtime-lifecycle.test.js` (stripped record; record for another
   ticket), `test/runtime-evidence.test.js` (stripped record; record for another check).
2. `template/scripts/pincer-runtime/evidence.cjs` (export) and readiness — captured
   logs were read without comparing them with the `sha256` the attempt recorded; a
   replaced `stdout.log` was exported as `provenance: runtime` and readiness stayed
   green. High. **Fixed in T-45:** `state.inspectArtifacts` marks `missing` and
   `altered` logs for readiness (`EVIDENCE_MISSING`, naming the stream) and export
   compares before writing anything (refusal names the log); `recover` now records the
   digests of the logs a dead runner captured so its finalized records are bound like
   every other. Within the contract's stated limit (mistake detection, not
   attestation: a rewrite of both record and log is undetectable). Assertions in the
   same two suites.
3. `template/scripts/pincer-runtime/runner.cjs` — `terminate()` returned early once
   the shell had exited, so `sleep 9 & exit 0` under a 1 s timeout ran 9.2 s and a
   persistent child could hold the run open indefinitely. Medium. **Fixed in T-45:**
   the process group is signalled whether or not the shell exited (the bare-pid
   fallback is used only while the shell is known alive), SIGKILL follows after the
   5 s grace period, and capture is abandoned 2 s after SIGKILL with the limitation
   naming the signals delivered. Assertions: `test/runtime-runner.test.js`
   (background child terminated at the timeout, run under 5 s; SIGTERM-ignoring child
   killed after the grace period, run under 12 s).

Contract (`template/docs/runtime-contracts.md`): the Attempts section states the
record-validation and log-digest rules, the Timeout paragraph states the group
termination and drain bound, and the reason-code table names malformed records
(`ATTEMPT_ERROR`) and altered logs (`EVIDENCE_MISSING`). The reviewer's reproduction
script, re-run against T-45, shows `ready` exit 1, `done` refused with
`ATTEMPT_ERROR`, export refused naming the altered log, and the background-child run
ending in 1.2 s.

## 2. Reviewer subagent over the T-45 diff (883ae14..2ff2b1a), fixed in T-46

One general-purpose subagent applied `template/.claude/agents/code-quality-reviewer.md`
to the T-45 commit, ran the three changed suites read-only and modified nothing. Five
findings, all Low; dispositions by the evaluator, fixes in T-46.

1. `runner.cjs` — `sent.push(signal)` ran before the `kill` calls, so a record could
   say "sent SIGTERM then SIGKILL" when both group kills failed (`setsid` descendant),
   contradicting the contract's "names the signals actually sent". Low. **Fixed in
   T-46:** only a delivered kill is recorded; otherwise the limitation says no
   reachable process remained in the group. Assertion: `test/runtime-runner.test.js`
   (perl `setsid` child: run bounded at 8 s, `timed_out`, no signal claimed).
2. `state.cjs` / `readiness.cjs` — records finalized by a `recover` older than T-45
   carry `sha256: null` and were reclassified `ATTEMPT_ERROR` instead of
   `ATTEMPT_INTERRUPTED`. Low. **Fixed in T-46:** an `interrupted` record may lack
   digests; readiness reports it as interrupted; export refuses it because its logs
   have no recorded digest. Assertions in `runtime-lifecycle` and `runtime-evidence`.
3. `runtime-contracts.md` — "every field above up to `artifacts`" overstated the
   validator, which skipped `runtime`, `signal`, `cwd`, `environment`, `context.base`.
   Low. **Fixed in T-46:** those checks were added and the contract names the fields
   that are not checked (`owner`, `child`, `limitations`, `error`).
4. `state.cjs` `latestAttempt` — a passing record copied over the failed record the
   index points at validated (its own id, paths and logs are consistent) and readiness
   was green on the pointer. Low. **Fixed in T-46:** readiness and export receive the
   pointed id and a record with another id is `ATTEMPT_ERROR` / refused. Assertions in
   `runtime-lifecycle` (copied record blocks `done`) and `runtime-evidence` (export
   refuses).
5. `runner.cjs` — signalling `-pid` after the shell was reaped opens a group-id reuse
   window between the SIGTERM and SIGKILL attempts when the group is already empty
   (pid wraparound within 5 s). Low, no cheap airtight fix. **Disposition:** recorded
   as a limit in the contract's Timeout paragraph and in the code comment.

Verified by the reviewer (unchanged): the T-45 tests fail on the parent commit for the
right reasons (readiness had no reasons; elapsed 9 s and 30 s; export succeeded),
runner-written records pass the validator (integer timeout, hex or null source
digests, `RUNTIME_DIR` paths, digest computed after the truncation notice, `running`
exempt from the digest compare), promise settlement (`settle` assigned before any
timer, second SIGINT does not re-send), annotations never reach disk, `recover`
digests only what the dead runner wrote, template/plugin parity apart from the
documented path transform.
