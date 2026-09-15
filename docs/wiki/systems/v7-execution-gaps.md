# The v7 execution path, and the five gaps between it and a reportable study

The 2026-09-15 assessment (`docs/pincer-assessment-2026-09-15.md`) raised five P1 findings
against the v7 benchmark orchestrator. All five were re-verified independently on
2026-09-15 with stand-in CLIs and zero paid sessions. **Four confirmed as written; one
(F-04) is real but its stated consequence does not occur, because a larger defect masks
it.** None touches shipped code: `package.json` ships `bin` and `template` only, and
nothing under `scripts/delivery-benchmark-v7/` reaches a user. See [[v7-measured-friction]]
and [[fix-the-driver-before-run-one]] for what the edition is and why T-98 fixed the
driver first.

## Why they block the first paid run

Not because the records are unrecoverable — four of the five backfill from retained logs.
They block because **the fix is unapplicable later**. `freeze-spec.cjs` lists
`orchestrator.cjs` in `SPEC.harness` and names `effort.cjs` as `SPEC.collector`, so editing
either changes the cohort, and `effort.cjs:145` then refuses every earlier record with
`COHORT_CHANGED`. Fixing at run 0 costs about a day. Fixing at run 30 costs those 30 runs —
roughly $80 — because they can never be pooled with what follows.

One escape hatch worth knowing: `SPEC.harness` is a **file list**, not a directory digest
(unlike v6, which digested its directory whole). A new sibling module inside
`scripts/delivery-benchmark-v7/` therefore does *not* change the cohort. If a defect
surfaces mid-study, put the correction in an unfrozen sibling rather than patching
`orchestrator.cjs`.

## The five, in the order they matter

**The strict arm is not an arm.** `loadBrief(id, dir)` takes no arm, so `brief.prompts` is
arm-independent; `installKit` branches on arm exactly once (`plain` gets nothing); the
`pincer` and `strict` workspaces are byte-identical under `diff -r`, and the captured argv
was byte-identical across all three arms. `adoption.required` exists only in the record.
A third of the schedule buys a duplicate of another arm, and the headline claim the study
exists to test is untestable by this harness. `harness.cjs:72-74` *says* "the arm decides …
whether strict coverage is to be adopted" — `prepare` destructures `arm` and echoes it back
without acting on it.

**Every record fails its own validator.** `driveRun` sets status from the evaluator and
writes, never calling `effort.problems()`. `reported.{tokens,cost_usd,provider_minutes}`
stay null while `effort.cjs:174` demands a reason for each; adoption is never observed while
`effort.cjs:155` fails any strict run that cannot show it. `claimRerun` sets `record.reason`
on a `pending` record, which `effort.cjs:124` rejects outright — a rerun is invalid the
instant it is created. The cost column fails loudly (`unmeasured: 72`); the 24 strict runs
fail silently, stamped `valid` with adoption unverified.

**The preservation check is dead, and the kit install would contaminate it.** The real
finding is bigger than the assessment's. `evaluator-kit.cjs:81` reads
`ctx.record.workspace.unrelated_edits`; `effort.empty()` has no `workspace` key,
`orchestrator.cjs:232` discards `prepare`'s return value, and no v7 brief supplies edits at
all. So all 72 runs print `0 unrelated edit(s) intact` — a fabricated pass on one of the
three headline check kinds, on briefs whose own text tells the agent "leave them alone".
Separately, `prepare` applies edits *before* `installKit`, whose final act is `commitAll`
(`git add -A`) — the exact behaviour `harness.cjs:47-49` names as what the checks exist to
catch. v6 ordered it correctly and v7 inverted it. **Fix both together or neither**: wiring
the record on without reordering fails 12 of 72 cells against the kit arms, which is wrong
in the direction that discredits the product.

**A crash inside a cell repeats its paid sessions and contaminates the base.** Verified by
kill test, not inspection. On the success path nothing is written between `plan` and the
final `writeRecord` — the four in-loop writes are all terminal aborts. A killed cell's
record reads `status: pending, events: []` after two completed sessions. Restart re-drove
all three prompts (6 stand-in sessions for a 3-session cell) and overwrote `logs/S1.json`.
Worse: `harness.prepare` never wipes, so `commitAll` swept the dead attempt's commits into
the restarted run's `provenance.base` — the resulting record looks clean and no reader or
validator can detect it. The per-cell checkpoint itself works; the defect is strictly
intra-cell.

**Execution inputs are never reconciled with the freeze.** `driveRun` takes cohort, model
and caps from its caller and compares them with nothing; `freeze.compute` is not called at
execution time at all. Plan under cohort A, drive with cohort B and a different model, and
the record keeps A while the driver gets B. Smallest of the five, and the cheap half
(a cohort/caps preflight) is worth having; the assessment's second half — sandboxing the
inherited environment — is a separate project and unnecessary here, since the environment
is constant across arms and so cannot confound the comparison.

## Three gaps the assessment did not raise

- **No operator entry point.** No `require.main`, no shebang, no npm script, no mention in
  `docs/` or `README.md`; the only callers are the test suite. An operator must hand-write
  the unfrozen caller the freeze exists to eliminate — the irony of T-98's own rationale.
- **`ui-states` is structurally `unavailable`.** `browser` defaults to `null` and
  `driveSchedule` has no parameter to supply an adapter, so 9 of 72 runs can never be
  accepted whatever the agent writes.
- **A cap-less dry run strands a cell permanently.** The refusal writes `outstanding`,
  `driveRun:223` then skips any non-`pending` cell forever, and `claimRerun` replaces only
  `invalid` runs. `effort.cjs:298` counts `complete` over `valid|invalid|unavailable`, so
  the study can never read complete. Recovery is deleting `record.json` by hand.

## The suite gap underneath all of it

`test/benchmark-orchestrator.test.js` asserts orchestration behaviour — stop, resume,
rerun, cap — and `test/delivery-benchmark-v7.test.js` asserts the validator's opinions on
hand-built records. **No test anywhere feeds an orchestrator-produced record to
`effort.problems()`**, and the preservation test hand-wires `record.workspace` and never
calls `installKit`. That is why `npm test` is green over a dead check and an unreportable
record. One assertion — `problems(record).length === 0` on a stand-in-driven cell — catches
the whole of the first finding.

Related: [[v7-measured-friction]], [[fix-the-driver-before-run-one]], [[delivery-benchmark]].
