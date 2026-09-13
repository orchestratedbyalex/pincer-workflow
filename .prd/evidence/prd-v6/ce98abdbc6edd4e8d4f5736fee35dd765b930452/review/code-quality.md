# Code-quality review record — combined PRD v5 + v6 candidate

Candidate `5b0358b54c1e73a8e947bd6520e455558b0e2a2e`, base `9bcf8df4e7fbc46f298dd9cb11f1e806388d2967`
(1010 files, 48,234 insertions). Reviewed 13 September 2026 during `/pincer-evaluate`.

## Method

Ten reviewers over disjoint areas — the v5 runtime core, the v6 strict-coverage runtime, the test
suite's own rigour, docs/packaging/generated adapters, the delivery benchmark, evidence and
review-packet integrity, a mechanical security audit, and independent reproduction of the three
findings in `docs/pincer-assessment-2026-09-13.md`. Reviewers worked read-only on the repository
and built throwaway fixtures; findings had to be executed, not read. The top fourteen findings by
severity then went to two perspective-diverse adversarial verifiers each — one required to
reproduce from scratch, one required to check the PRDs, scenarios, Out-of-Scope text and the frozen
contract for whether the behaviour is specified as correct — with refutation as the default verdict.
38 agents, 4.25M tokens, 33 minutes, no agent errors.

## Outcome

32 findings, 30 of them reproduced with commands and output. 13 confirmed by both verifiers,
1 refuted, 18 not put through adversarial verification because they fell past the cap of 14
(four of those the evaluator reproduced personally: the hook redirect bypass, the stale Node
claims in the wrappers and replay scripts, the v5 packet's CI row, and the scenario
blank-line continuation).

### Refuted, and why it still mattered

`process.exit()` used as an exit-as-return was reported P1 on the grounds that the obvious fix for
the flush defect — assigning `process.exitCode` — would let read-only commands fall through into
writer branches. Both verifiers refuted it: `process.exit()` terminates unconditionally, the next
branches are unreachable on this candidate, every reproduction required stubbing `process.exit`,
and `test/coverage-reports.test.js:198-202` already byte-snapshots the tree across the read-only
commands and asserts they write nothing, so the naive refactor would fail rather than ship. It is
not a defect; it is a constraint on how the flush defect must be fixed, and it is recorded as one.

### The reported findings from the 13 September assessment

- F-01 (piped output truncates) — confirmed, and wider than reported: it reproduces on Node 22 and
  24, not only 18/20. The boundary is the pipe buffer, 65,536 bytes, identical on all four versions;
  65,536 passes and 65,537 loses everything past it. The defect is present at the base commit. What
  this change introduced is the misdescription: the contract and both packets present the `>=22`
  floor as the remedy. `status --json` crosses the boundary at ~110 tickets — this repository has 78.
- F-02 (impact does not propagate requirement-body edits) — reproduced, but refuted as a defect.
  The contract frozen in T-66 (`98235f6`), before the T-71 implementation, already scopes `affected`
  to scenario-derived links; `test/coverage-impact.test.js:84` asserts it verbatim; and the edit does
  propagate — to the agreement digest, the authorization verdict, the execution gates and every bound
  attempt. Verified by running it.
- F-03 (coverage recommends execution on a paused change) — confirmed and widened from one state to
  five: planned, paused, cancelled, superseded, attempt-running and non-selected `--change` all
  produce a next action the runtime refuses. Following it started a second concurrent attempt.

## What held under attack

Recorded because a review that only lists defects misrepresents the candidate.

- The agreement projection covers every input R-04 claims: eleven mutations, all authored edits move
  the digest, checkbox ticks and lifecycle receipts do not. No edit escapes reauthorization.
- Transactions: manifest-as-commit-point is correct under process death; staged renames are
  idempotent; a projection is never observable without its event.
- Strict check gating: a supplied command, supplied timeout or undeclared ID is `CHECK_UNDECLARED`
  before anything is prepared; declarations are recomputed under the attempt lock.
- `pincer-evidence.cjs validate` rejected all five tampering vectors tried against it — digest
  mismatch, `..` escape, absolute path, symlinked artifact, passed-with-no-log, and a requirement
  citing a check that does not exist. Its two exit-0 acceptances are documented and the release gate
  catches both.
- Eleven attempted mutations of the coverage rules were killed by the suites. The `change-*` suites
  drive real subprocesses and assert on real state.
- Security: no credentials anywhere in 49,022 added lines across all 43 commits; no command injection
  (every launch is an argv array with a constant argv[0]; anchored ID patterns refused every
  metacharacter probe and left no canary files); no path traversal; genuinely dependency-free;
  0 vulnerabilities.
- Packaging and generators: no drift from either generator in a fresh clone; `npm pack` ships
  everything the installed kit loads; every playbook command line names a real command and flag.
- The benchmark data: every headline number recomputes exactly from the 42 saved records; the kit
  tarball digest reproduces from `git archive 3ecb531 | npm pack`; all 60 prompts are byte-identical
  to the briefs; `validate` 42/42; `report` reproduces `report.md`; `check-freeze` verifies.

## Confirmed defects, grouped by the ticket that fixes them

- T-79 — output larger than one pipe buffer is lost with exit 0, and the documents that describe it.
- T-80 — `coverage`'s next action does not implement the documented precedence (5 states).
- T-81 — the ticket guard ignores redirection operators behind an allowlisted runtime verb.
- T-82 — the trial record claims more than the saved runs support (6 items).
- T-83 — three paths by which the independent evidence validator returns a false `ok`.
- T-84 — a blank line inside a scenario item moves its later paragraphs to the requirement.
- T-85 — after an interrupted `migrate --apply`, execution is not refused and `recover` destroys
  the work done since, silently.
- T-86 — the two review-packet validators do not bind the packets to reality.

## Disposition of every confirmed defect

All eight tickets are closed through the pinned v0.5.0 kit, each with a regression test
that was mutation-checked against its own fix rather than accepted because the suite
was green.

| Ticket | Commit | What it closed | The mutation that fails without it |
| --- | --- | --- | --- |
| T-79 | complete output on every exit path | piped output truncated at 65,536 bytes with exit 0, on every supported Node; the false Node 18/20 framing in the contract, README, both packets, both wrappers, the Codex adapter and both replay scripts | routing io back through the async streams: `65536 of 90150 bytes` |
| T-84 | scenario continuation across a blank line | a scenario's behaviour could be inverted without its digest moving | S-01's digest stops moving with its second paragraph |
| T-83 | reconcile strict evidence against the candidate | three manifests the independent validator certified: an undeclared check link, an unreadable PRD blob hiding a substituted map, an invented authorization | each of the three reverted separately fails its own case and only its own |
| T-85 | refuse execution while a transaction is unapplied | after an interrupted `migrate --apply`, execution was allowed and `recover` destroyed it silently | `verify … (exit 0)` at the `manifest` crash point |
| T-80 | one next action precedence | `coverage` recommended commands the runtime refuses on paused, planned, cancelled, superseded, attempt-running and non-selected changes | coverage `start T-01 → verify → done` against resume `change resume prd-v1` |
| T-81 | the ticket guard ignores redirection | an allowlisted runtime verb carried a shell write into tickets and change records; four shapes were allowed at the base commit too | 7 of 296 hook payloads |
| T-82 | correct the trial record | six claims the saved runs do not support, including a regression measure that exists for one brief of six and an invalidated run that was not empty | numbers re-derived from the 42 records |
| T-86 | bind the packet validators | both packet validators were vacuous in ways the other had fixed; two citations named artifacts that do not exercise what they are cited for | all nineteen v5 citations at the base commit; a scenario row citing nothing |

Two findings were not fixed as defects and are recorded instead. The `process.exit`
exit-as-return idiom is not a defect on this candidate — both verifiers refuted it, and
`test/coverage-reports.test.js` already guards the invariant — but it is a real
constraint on how the flush defect had to be fixed, and T-79 states it. The
over-general escaped-regression sentence in `docs/delivery-benchmark.md` is inside the
freeze; correcting it would re-freeze the benchmark and destroy the provenance the
freeze exists to establish, so the trial record carries the discrepancy.

The stale-lock reclaim race (state.cjs) was reported but could not be reproduced —
20 x 8 and 25 x 32 concurrent writers, every run clean — and is carried as an open
thread rather than a finding.
