# The v7 measurement tooling, and what it can and cannot show

PRD v7's question is whether the workflow can be made cheaper without weakening it.
Answering it needs measurement, and the measurement needs to be honest about its own
limits. Three pieces, all under `scripts/delivery-benchmark-v7/` (a **sibling** of the
v6 harness, not a child — see the landmine below).

## The pieces

| File | What it does |
| --- | --- |
| `baseline-journey.cjs` | drives a pinned released kit through a complete strict journey in a disposable project, recording every command with its exit code, byte counts and wall-clock, plus every byte a human authored |
| `scale-measure.cjs` | repeats the two measurements that matter at 3, 10, 20 and 40 scenarios, because a toy fixture cannot show how either surface behaves on real work |
| `effort.cjs` | the v7 run record (schema 7) as an **event log**, with every total recomputed from it offline |
| `freeze.cjs` | the cohort identity: a digest over everything that determines what a session sees or how its result is judged |
| `observations.cjs` | the pilot / platform / comparison record schemas and their validator |
| `live-driver.sh` | the one file that spends money; refuses without an explicit spending-cap assertion, enters the workspace, enforces the wall clock |
| `orchestrator.cjs` | the run loop: stop-on-limit, per-cell checkpoint and resume, reruns above the schedule, per-arm kit install ([[fix-the-driver-before-run-one]]) |

## What the baseline measured

A complete journey on a three-scenario change: **35 runtime commands, 21,654 bytes of
stdout, 3,006 bytes authored by hand.** Two stages dominate, and they are exactly the
two the product work addressed:

- **fresh-session context loading, 8,224 bytes across five commands** — four of which
  report the same computed state. `resume --json` alone is 4,818 bytes to answer a
  question whose answer is ~120 bytes, and it grows with the change while the answer
  does not.
- **coverage-map authoring, 809 bytes / 53 lines** — 49% of everything authored in the
  first pass, and all of it transcription of IDs the runtime had already parsed.

It also found a real defect, which became T-97: `readiness.cjs` emitted the remedy
`register --rebind, then verify` for `REVISION_CHANGED` in every mode, and changes mode
refuses that command outright. A report recommending a refusal is the defect class T-80
closed for the coverage report ([[one-next-action-precedence]]); the remedy is now
mode-aware.

## What it cannot show, and this matters

The baseline is **operator-driven**. It counts commands, bytes and authored lines. It
cannot show whether an agent understands the instructions, where it goes wrong, what it
asks the user for, which approvals it repeats, or what a human spends reviewing the
result. It is the design basis PRD v7 S-09 asks for; it is **not** the three agent
pilots S-07 and S-08 ask for, and `docs/prd-v7-pilots.md` §5 says so at length.

**Fewer bytes is not less effort.** Every number here is output size.

## The three rules the record shape enforces

1. **`null` is not zero.** Every metric is measured, or null *with a reason*. The v6
   study recorded automated setup as zero and did not measure review time at all;
   `effort.problems()` refuses a reportable record whose null has no reason, and refuses
   a review whose elapsed time is zero.
2. **Overlapping intervals are merged, never summed.** Two sessions in the same
   wall-clock minute are one minute. The naive sum is reported *beside* the union, not
   instead of it, so a reader can see how much concurrency there was.
3. **The checks decide the outcome**, not the record's author. An outcome its own checks
   contradict is `OUTCOME_DISPUTED`; an acceptance resting only on the candidate's own
   tests is refused, because a held-out check is what makes it independent.

## Cohorts replace re-freezing

The v6 study re-froze its harness mid-run and re-evaluated earlier runs under the new
freeze — disclosed in `docs/trial-prd-v6.md`, and the specific hole v7 closes. In v7 a
changed input does not re-date the study: it **starts a new cohort**, and records keep
the cohort they ran under. There is no re-freeze-and-re-evaluate path.

Secrets never reach a record. Configuration capture is an allowlist; a secret-looking
key or value is *refused*, not redacted and carried, because a hash of a secret is still
an oracle for it. Environment variables contribute names only — and an entry that is not
a bare name is refused **without being echoed**, since the usual way this goes wrong is
someone passing `NAME=value`.

## The validator is not the observation

`observations.cjs` checks record *properties*. Two rules stop it being read as more:
`observed: false` forces `status: outstanding`, and `fixture: true` with
`observed: true` is `FIXTURE_MISLABELLED`. Its verdict says `RECORD_VALID` and carries
a note disclaiming observation — deliberately, so nobody can quote it as proof a session
happened.

## Landmine: never nest v7 inside the v6 directory

`scripts/delivery-benchmark/benchmark.cjs:56` computes its harness digest as
`lib.treeDigest(__dirname)` — the **whole directory**. Any file added under
`scripts/delivery-benchmark/` breaks the v6 freeze with
`drift: scripts/delivery-benchmark/ changed since the freeze`. That is why the v7 code
lives at `scripts/delivery-benchmark-v7/`. The alternative was editing a frozen v6 file.

Also: regenerate `test/fixtures/delivery-benchmark-v7/frozen.json` after any edit to the
named execution path; the command is in a comment at the top of `freeze-spec.cjs`, and
the suite fails when tree and manifest disagree. The cohort is **`6de061ec…`** since
T-98; `eef74402…` was the pre-T-98 identity and no run was ever executed under it.

## What the study would cost

Re-derived from v6's 42 run records and 60 session JSONs, not its summary prose: plain
$0.51/run and 2.4 active minutes, kit $2.41/run and 9.3 minutes — 4.7x the money and
3.85x the time, on 36 runs for $52.54. v7 is **72 runs and 126 live sessions** across
three arms, so roughly **$181 central, $215-220 with reruns**, x1.28 if billed metered.
It does not fit one sitting: v6 hit an account limit after $15.77 of continuous spend
65 minutes in, which puts v7 at five or six reset windows — days, not hours. The strict
arm has no measured precedent and is the widest term in the estimate.

Related: [[delivery-benchmark]], [[read-only-projections]], [[strict-coverage]].
