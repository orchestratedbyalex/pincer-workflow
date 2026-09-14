# Delivery benchmark

An independent, reproducible comparison of delivering the same task with the PINCER kit
and with a plain agent. Added by PRD v6 R-10 (T-76 built it, T-77 ran it). Protocol:
`docs/delivery-benchmark.md`. Related: [[strict-coverage]], [[template-kit]].

## Shape

- Six frozen briefs under `test/fixtures/delivery-benchmark/briefs/<id>/`: greenfield CLI,
  brownfield bugfix with unrelated uncommitted edits, untested HTTP integration, UI
  error/accessibility states, a mid-build scope revision, a two-change fresh-session
  handoff. Each has `brief.md` (the task and the verbatim session prompts), `base.cjs`
  (the starting repository, plus the scripted operator step between sessions),
  `controls.cjs` (a correct control and the deliberately faulty candidates) and a
  held-out `evaluator/`.
- Only `base.cjs` output and a `BRIEF.md` reach the implementation workspace. `prepare`
  aborts if any held-out file lands in it. This is process separation, not a defence
  against an adversarial agent with repo access.
- `scripts/delivery-benchmark/benchmark.cjs` drives everything: `freeze`/`check-freeze`,
  `schedule` (36 slots, three pairs per brief, balanced first arms), `prepare`, `session`,
  `stage`, `intervene`, `effort`, `mark`, `evaluate`, `validate`, `report`.
- Run records are schema 1 (`record.cjs`). Only `evaluate` may write an acceptance; the
  validator refuses an accepted outcome whose checks did not all pass, a passed check
  without a real process exit status, an unfrozen evaluator digest, a candidate mismatch,
  and a null token or cost value without a reason.

## What it found (2026-09-12, 36 runs, Sonnet, Claude Code print mode)

Acceptance 17/18 per arm (34/36 overall); the kit arm cost about 4.7x the money and 3.9x
the session time. The only behavioural difference was the changed-scope brief: the kit
arm surfaced the revision instead of building it in 3 of 3 runs, the plain arm in 2 of 3.
**No parity or superiority claim is supported at n=3 per cell.** Full record:
`docs/trial-prd-v6.md`; artifacts under `docs/prd-v6-artifacts/benchmark/`.

**"Zero escaped regressions" is weaker than it reads** (corrected by T-82). Only
`bugfix-brownfield` carries an independent hidden regression test. For the other five
briefs the sole regression check is the candidate's own `npm test`, so for 30 of the 36
runs the figure is self-reported, and an agent that broke pre-existing behaviour *and*
weakened its own suite would still score 0. `docs/delivery-benchmark.md` describes the
measure as the stronger thing; it is inside the freeze, so it was not edited — correcting
it would re-freeze the benchmark and destroy the provenance the freeze exists to
establish. Fix the wording the next time the protocol is legitimately revised.

## What T-82 corrected in the trial record (2026-09-13)

An independent recomputation from the 42 saved `record.json` files reproduced every
headline number exactly, and found six statements the data did not support: the
escaped-regression claim above; the reason recorded on one invalidated run; the
undisclosed ambient agent configuration both arms ran under; the freeze's coverage of
the live driver; two runs whose recorded minutes exceed the tool's own session duration;
and an operator-intervention count that disagreed with the table beside it. The numbers
survived; the claims about them did not. **When a benchmark's headline figures are
reproducible, that is not evidence its prose is accurate — recompute the prose too.**

## Gotchas

- No live run adopted strict coverage — adoption is opt-in and five of the six briefs are
  single-change (`handoff-two-changes` is the exception: two independent changes, each
  with its own tests and commits), so the live runs exercised the v6 runtime in its
  v5-compatible mode.
- An account usage limit will otherwise turn the rest of the schedule into one-turn
  failures. The driver (`docs/prd-v6-artifacts/benchmark/run-live.sh`) now marks the run
  invalid and stops; invalid runs are kept and rerun at pair numbers above the schedule
  with an operator note naming what they replace.
- Re-freezing mid-benchmark invalidates the comparison unless every completed run is
  re-evaluated with the new harness and the freeze history is cited. That happened once,
  for the `evidence-binding` correction; every completed run was re-evaluated and every
  outcome held **except run #7**, which the correction turned from `rejected` to
  `accepted`.
- **`check-freeze` green does not mean the sessions were driven identically.** The freeze
  covers the briefs, the evaluators, the harness and the protocol document — not the live
  driver (`run-live.sh`, `session.cjs`, `effort.cjs`), which delivers the prompts, sets
  the turn and wall-clock caps and derives the effort figures. That driver changed during
  this benchmark and `check-freeze` reported no difference either side of it.
- Both arms ran under whatever skills, plugins, MCP servers and user `CLAUDE.md` were
  active on the machine; the saved logs keep tool names only, so it cannot be
  reconstructed. The "plain" arm is a plain *workspace*, not a bare agent, and neither
  arm reproduces exactly on another machine.
- `test/delivery-benchmark.test.js` is the slowest suite in `npm test` (it spawns many
  processes and runs `npm test` inside generated candidates) and needs `git` and `npm`.
