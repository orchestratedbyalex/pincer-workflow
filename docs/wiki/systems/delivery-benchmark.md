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

Acceptance 17/18 per arm, zero escaped regressions; the kit arm cost about 4.7x the money
and 3.9x the session time. The only behavioural difference was the changed-scope brief:
the kit arm surfaced the revision instead of building it in 3 of 3 runs, the plain arm in
2 of 3. **No parity or superiority claim is supported at n=3 per cell.** Full record:
`docs/trial-prd-v6.md`; artifacts under `docs/prd-v6-artifacts/benchmark/`.

## Gotchas

- No live run adopted strict coverage — the briefs are single-change tasks and adoption is
  opt-in, so the live runs exercised the v6 runtime in its v5-compatible mode.
- An account usage limit will otherwise turn the rest of the schedule into one-turn
  failures. The driver (`docs/prd-v6-artifacts/benchmark/run-live.sh`) now marks the run
  invalid and stops; invalid runs are kept and rerun at pair numbers above the schedule
  with an operator note naming what they replace.
- Re-freezing mid-benchmark invalidates the comparison unless every completed run is
  re-evaluated with the new harness and the freeze history is cited. That happened once,
  for the `evidence-binding` correction, and every run was re-evaluated unchanged.
- `test/delivery-benchmark.test.js` is the slowest suite in `npm test` (it spawns many
  processes and runs `npm test` inside generated candidates) and needs `git` and `npm`.
