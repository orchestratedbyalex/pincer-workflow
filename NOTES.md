---
prd: .prd/prd-v6.md
base: 9bcf8df4e7fbc46f298dd9cb11f1e806388d2967
candidate: ce98abdbc6edd4e8d4f5736fee35dd765b930452
evidence: .prd/evidence/prd-v6/ce98abdbc6edd4e8d4f5736fee35dd765b930452/manifest.json
---

# Evaluation — PRD v5 and PRD v6, evaluated together on one candidate

Two PRDs are evaluated here as a single change because v5 was never released and v6 is
built directly on it: `feat/prd-v6` carries T-47..T-65 (v5) and T-66..T-78 (v6) on top
of `9bcf8df`, and splitting them would mean evaluating a candidate that never existed.

There is one manifest, for the selected PRD, v6. A second manifest for v5 was written
and validated, then withdrawn: the runtime admits only the named manifest's own listed
artifacts as a change after the candidate — the rule T-64 tightened so that an
evaluation cannot quietly bless a whole directory — so a second manifest makes the
evaluation read `stale` against its own status command. Rather than weaken that check
to fit the shape I wanted, the v5 dispositions are recorded below and mapped per
scenario in `docs/prd-v5-review-packet.md`, whose validator now binds each citation to
the repository (T-86). PRD v5 therefore has an authored and reviewed disposition record
and a bound packet, but not a validator-checked manifest. That is a real difference in
the strength of the two records and it should not be read as equivalent.

## Requirement dispositions — PRD v5

All ten delivered. R-06, R-08 and R-09 were blocked when the review finished.

| Requirement | Tickets | Note |
| --- | --- | --- |
| R-01 retain multiple changes with explicit identity | T-49 | |
| R-02 select work explicitly without changing source | T-50, T-54 | |
| R-03 enforce the lifecycle and preserve history | T-53 | |
| R-04 bind authorization to the reviewed agreement | T-51, T-52 | eleven-mutation probe: no authored edit escapes reauthorization; receipts and checkbox ticks correctly do not move the digest |
| R-05 handle revisions and decisions without unnecessary questions | T-52, T-54 | |
| R-06 produce a deterministic resume report | T-57, **T-79**, **T-80** | the JSON is complete however it is consumed, and S-18 holds because coverage no longer contradicts resume or the gates |
| R-07 preserve verification and candidate identity across changes | T-55, T-56, T-64, **T-85** | migration no longer leaves a candidate pointer no attempt record can satisfy |
| R-08 make all lifecycle mutations atomic and recoverable | T-48, T-53, T-63, **T-85** | execution is refused in every mode while a committed transaction is unapplied, so `recover` cannot destroy work done since |
| R-09 migrate explicitly and preserve distribution compatibility | T-58, T-59, T-65, **T-79**, **T-85** | packed parity and generator parity clean; the supported Node floor is now stated correctly everywhere |
| R-10 observe the complete journey and start a delivery baseline | T-60 | `docs/trial-prd-v5.md` |

## Requirement dispositions — PRD v6

All ten delivered, recorded in the manifest. R-01, R-07, R-09 and R-10 were blocked
when the review finished; the manifest carries the per-requirement tickets and notes.

T-79..T-86 are this evaluation's own fix tickets. The review found thirty-two defects,
and the candidate moved to close them; the candidate evaluated here is the one after
those fixes, with the CI matrix passing on it.

## What was built

**PRD v5 — preserve changes, authorization and resume context.** One retained schema 2
change record per change under `.prd/changes/`, written only inside journaled
transactions with an explicit commit point and `recover`. Every worktree selects the
change it works on; selection is local, never inferred from a branch or the newest PRD.
An agreement is the exact projection of the PRD revision, the ticket texts and the
resolved decisions, and an authorization records the user's real instruction against
that digest. Execution passes one guard in a fixed order and refuses before any side
effect. `resume` is a deterministic report a fresh session can act on from the
repository alone.

**PRD v6 — complete requirement coverage and explain change impact.** Strict coverage
is opt-in per change. The PRD's own requirement and scenario prose is the inventory,
parsed under a bounded grammar; one authored coverage map owns links, ticket roles,
scope dispositions and declared check definitions, and both sit inside the agreement
digest. `coverage` and `impact` are read-only reports. A strict `check` runs only the
map's declaration. Evidence schema 3 derives every row from the map snapshot and the
outcomes and reconciles independently with the committed candidate. A project that
never adopts keeps its old behaviour and is labelled `unverified`.

Every requirement of both PRDs is **delivered**, and each of the seven that was
`blocked` when the review finished was unblocked by closing the defect rather than by
relabelling it a known limitation. The per-scenario tables are in
`docs/prd-v5-review-packet.md` and `docs/prd-v6-review-packet.md`.

## What was cut, and why

Nothing was cut from either PRD's scope. Two review findings were deliberately not
fixed, and both are recorded rather than quietly dropped:

- The `process.exit()` exit-as-return idiom was reported as a P1 and refuted by both
  verifiers: it terminates unconditionally, so the writer branches below each exit are
  unreachable, and `test/coverage-reports.test.js` already asserts the read-only
  commands write nothing. It is real as a constraint on *how* the output defect had to
  be fixed, and T-79 states it. It is not a defect in this candidate.
- `docs/delivery-benchmark.md` describes the escaped-regression measure more broadly
  than the evaluators implement. Correcting it would re-freeze the benchmark and
  destroy the provenance the freeze exists to establish, so `docs/trial-prd-v6.md`
  records the discrepancy instead.

## Known issues

- **Piped output was truncated on every supported Node version** until T-79, at exactly
  65,536 bytes, with exit 0 and empty stderr. Fixed by writing the file descriptor
  synchronously. The claim in `5b0358b` that this was a Node 18/20 defect cured by
  `engines: >=22` was wrong and is withdrawn everywhere it appeared; the floor stays,
  justified by end of life.
- **The stale-lock reclaim window** in `state.cjs` was reported by review and could not
  be reproduced under 20x8 and 25x32 concurrent writers. It is an open thread, not a
  verified defect, and the analysis is in the review record.
- **The delivery benchmark measures what it measures.** n=3 per cell, one model, one
  tool, one operating system, one day. Only `bugfix-brownfield` has an independent
  hidden regression test. Both arms ran inside the operator's personal Claude Code
  configuration, which the records do not capture, so the "plain" arm is a plain
  workspace rather than a bare agent. The freeze does not cover the live driver, which
  changed mid-benchmark. No parity or superiority claim is made or supported.
- **The ticket guard is defence in depth on one agent surface**, not a security
  boundary, and its redirect hole predated this branch.
- **Authorization records are local provenance**, not authenticated human identity.
- **No live session exercised the strict coverage path.** The benchmark briefs are
  single-change tasks and adoption is opt-in, so the strict path rests on the suites
  and the eight replay cases.

## What I would do next with more time

1. A strict-coverage pilot on real projects — one greenfield, two existing — observing
   adoption, a scope revision, paused work and fresh-session recovery, with ordinary
   users following the shipped instructions rather than the author steering around
   failures. This is the one claim the suites cannot establish.
2. Freeze the live driver, so `check-freeze` covers the whole evaluation path rather
   than the briefs, evaluators, harness and protocol.
3. Record the agent configuration each benchmark run executes under, and re-run the
   comparison with it disabled, so "plain" means what the write-up says it means.
4. Give the remaining reports the shared routing that `coverage` and `resume` now use,
   and look for the next place two views of the same state can drift.

## Handover

**Read this first, then `docs/runtime-contracts.md`.** That contract is the authority
on what the runtime writes, what each exit code means, and what every schema contains;
the playbooks under `template/.claude/commands/` describe the workflow that uses it.
The two review packets map every requirement and scenario to the commit and the test
block that exercises it, and their validators now bind those citations to the
repository, so a packet that lies fails `npm test`.

**How the pieces fit.** `template/` is the single source of truth. `template/.codex/`,
`template/.agents/skills/` and `template/.github/prompts/` are generated by
`template/scripts/sync-prompts.sh`; `plugin/` is generated by `scripts/build-plugin.sh`.
Edit `template/`, run both, commit the outputs — `test/distribution.test.js` fails on
stale generated output, which is the guard that keeps them honest.

**Dependencies: there are none, deliberately.** The runtime is dependency-free CommonJS
under `template/scripts/pincer-runtime/`, and every `require` is either `node:` or a
relative sibling. That is not minimalism for its own sake: the kit is copied into other
people's repositories, so anything it depends on becomes something they inherit.
`package.json` declares no dependencies at all, which is why `npm audit` cannot run and
is recorded as `unverified` rather than passed.

**What breaks first as this ages.** The riskiest assumption is that a report and the
gate that follows it agree. They are computed by different code from the same state,
and they have drifted once already — that was T-80, and the shared `routing.cjs` exists
because of it. Any new report that renders a next action should consume that module
rather than deciding for itself.

The least-tested path is strict coverage in a live session. Every mechanical guarantee
has a fault-injection case, and the eight replay cases run the real runtime on fresh
projects, but no agent has adopted strict coverage and carried a change through
revision, pause and evaluation outside a fixture. The second-least-tested is every
surface except Claude Code print mode on macOS: Codex, Copilot, the plugin install,
interactive mode and Windows are packaged and unit-tested but not observed.

The subtlest hazard is the one T-79 fixed and the one T-85 fixed, and they share a
shape: the failure was silent and the exit code said success. When changing this
runtime, the question worth asking is not "does it work" but "if it stops working, will
anything say so".
