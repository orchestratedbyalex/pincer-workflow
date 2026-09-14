# Independent delivery benchmark (PRD v6, R-10)

A reproducible, locally run comparison of delivering the same six task briefs with the
PINCER kit and with a plain agent. Its acceptance judgments come from evaluators that
are authored and frozen before any live implementation and are never present in the
workspace the implementing agent sees. This is process separation, not a security
claim against an adversarial agent: the evaluators live in this repository and a
determined agent with access to it could read them. The implementation's own passing
tests are never the only quality measure.

Everything is dependency-free Node. Nothing here calls an external service; nothing
outside the `--runs` directory is written by a run. Results stay local; sharing them
is a separate decision.

## Layout

| Path | Owns |
| --- | --- |
| `test/fixtures/delivery-benchmark/briefs/<id>/brief.md` | the human brief: `## Task` (copied into the workspace as `BRIEF.md`), `## Prompt N` (the session prompts, identical for both arms), operator steps, and the held-out acceptance in prose |
| `…/briefs/<id>/base.cjs` | creates the base repository (files, commits); `unrelated()` adds uncommitted edits that must survive; `between.S2()` is the scripted operator step before session 2 |
| `…/briefs/<id>/evaluator/` | the independent evaluator: `evaluate.cjs` returns the checks; hidden `node:test` files and protocol scripts decide them in child processes |
| `…/briefs/<id>/controls.cjs` | a correct control and the deliberately faulty candidates the evaluator must reject (`node test/delivery-benchmark.test.js`) |
| `test/fixtures/delivery-benchmark/frozen.json` | the freeze: digests of every brief file, of each evaluator, of the harness and of this document, with the freeze time and the previous freezes |
| `scripts/delivery-benchmark/` | the harness: `benchmark.cjs` (CLI), `lib.cjs`, `record.cjs` (run record schema 1 and validator), `evaluate.cjs`, `evaluator-kit.cjs`, `report.cjs` |
| `docs/delivery-benchmark.md` | this protocol |

Only `base.cjs` output and `BRIEF.md` reach a workspace. `prepare` refuses to continue
if any held-out file (`evaluator/`, `controls.cjs`, `base.cjs`) lands in it.

## Briefs

| Id | Kind | Sessions | Operator step | Evaluator decides |
| --- | --- | --- | --- | --- |
| `cli-greenfield` | greenfield CLI feature (todo list) | 1 | none | add/list/done behaviour, error paths, own tests, evidence binding |
| `bugfix-brownfield` | brownfield bugfix (`slugify`) with two unrelated uncommitted edits | 1 | none | general fix, `truncate` unchanged (regression), CHANGELOG convention, unrelated edits preserved and uncommitted, own tests, evidence binding |
| `integration-untested` | untested HTTP client gets retries and a timeout | 1 | none | success, retry-then-success, exhausted retries, no retry on 4xx, timeout within budget — each against the evaluator's fault-injecting server in a child process with a deadline |
| `ui-states` | sign-up form validation with error and accessibility states | 1 | none | validator messages, empty/error/submitting states, escaping, by structural markup inspection (no browser) |
| `scope-revision` | mid-build scope revision: R-03 appended to the brief after session 1 | 3 | before S2: append R-03 and commit | R-01..R-03 on the final candidate; `scope-approval`: R-03 must not pass at the last commit before S2 ended |
| `handoff-two-changes` | two changes, A set aside half-done, B completed, fresh-session handoff | 2 | none | A1, A2, B1 on the final candidate; `session-boundary`: at the end of S1, A1 and B1 pass and A2 does not |

Every evaluator also runs the candidate's own `npm test` as a regression signal
(`own-tests`, kind `regression`) and `evidence-binding`: a `NOTES.md`, evidence
manifest or evaluation locator in the candidate that names another commit as the
evaluated candidate rejects the run.

## Run records (schema 1)

One `record.json` per run under `<runs>/<brief>/pair-<n>/<arm>/`, next to the
`workspace/` and, after evaluation, `candidate/` (the exported commit) and
`evaluation.log`. Fields: `run`, `brief`, `arm` (`pincer` | `plain`), `pair`, `order`
(position in the schedule, `null` for a rerun), `created`, `status` (`pending` |
`valid` | `invalid` | `unavailable`) with `reason`, `environment` (`model`, `tool`,
`tool_version`, `node`, `os`, `kit` `{ source, digest }` or `null`, `caps`),
`workspace` (`base`, `project_base`, `candidate`, `unrelated_edits`), `sessions`
(`name`, `prompt`, `started`, `ended`, `exit`, `transcript`), `interventions`
(`type`, `session`, `at`, `note`), `effort` (`setup_minutes`, `review_minutes`,
`active_minutes`, `elapsed_minutes`, `tokens`, `cost_usd`, `unavailable` reasons) and
`evaluation` (`evaluator` `{ brief, digest }`, `at`, `candidate`, `outcome`, `checks`,
`regressions`, `log`).

Only `evaluate` writes `evaluation`, from a real evaluator execution. `validate`
refuses: an `accepted` outcome whose checks are not all `passed`; a `passed` or
`failed` check without the integer exit status of the process that decided it; an
evaluator digest other than the frozen one (`EVALUATOR_UNFROZEN`); an evaluation
candidate that differs from the workspace candidate; a `valid` status without an
evaluation or with an unfinished session; a `null` token or cost value without a
reason. Strings are bounded (prompt 8000, notes 2000, check detail 4000 characters);
records hold summaries and paths, never transcripts or secrets.

Outcome per run: `accepted` (every check passed), `rejected` (a check failed),
`unverified` (a tool could not run or a protocol check had no inputs, and nothing
failed), `error` (the evaluator itself failed). Only `accepted` on a `valid` run judged
by the frozen evaluator counts as an acceptance. A missing tool, an evaluator error or
a run that never happened can therefore not become a pass.

## Metrics and their denominators

All per brief and arm, over `valid` runs unless stated; the report prints every
denominator and lists outstanding, invalid and unavailable runs separately.

- **Independent acceptance** — `accepted / valid`. The judgment is the frozen
  evaluator's on the exported candidate commit, never the agent's summary or its own
  tests.
- **Escaped regressions** — the number of failed checks of kind `regression` (the
  candidate's own `npm test`, and hidden tests of behaviour the brief said not to
  change), summed and per run.
- **Interventions**, counted from the record, each with its session and a note:
  - *clarification* — the agent stopped to ask about the task and the operator
    answered (the answer is quoted in the note).
  - *reapproval* — the operator had to restate an approval already given (for example
    the agent asked again whether previously approved scope may be built).
  - *repair* — the operator changed state by hand so the session could continue: git
    operations, file edits, runtime state, restarting a crashed tool.
  - *operator* — a scripted protocol step (the scope revision, a rerun note). Not
    counted against either arm.
- **Setup effort** — operator minutes from starting `prepare` to launching the first
  session (kit installation included for the pincer arm).
- **Review effort** — operator minutes spent reading the session output, transcript
  and workspace to fill the record before `evaluate`.
- **Active time** — the sum of session wall-clock durations (`started` → `ended`).
- **Elapsed time** — first `started` to last `ended`, operator steps included.
- **Tokens and cost** — from the tool's own usage report when it is available for the
  run; otherwise `null` with the reason in `effort.unavailable`. They are never
  estimated.
- **Variation** — min, median and max of every numeric metric across the valid runs
  of a cell, with `n`.

The report (`benchmark.cjs report --runs <dir> [--json]`) makes no parity or
superiority claim and states so; a result showing overhead or no quality advantage is
valid data. No threshold is required for PRD v6 completion.

## Invalid, unavailable and rerun rules

- A run is **invalid** when its protocol was broken: a wrong prompt or kit, an
  operator mistake, a tool crash before the first agent action, a cap exceeded, an
  evaluator that was not the frozen one. It is marked with `mark --status invalid
  --reason`, keeps its record, workspace and evaluation, is listed in the report and
  excluded from every denominator. It is never deleted or overwritten: `prepare`
  refuses an existing run id.
- A rerun of an invalid run takes the next pair number above the schedule
  (`pair-4` …) with `--rerun <invalid run id>`, which records an operator note; it
  has no schedule order and is reported next to its brief and arm.
- A run is **unavailable** when the tool, model or environment could not be obtained
  (`mark --status unavailable --reason`). Unavailable required runs keep the trial
  ticket open; they are reported as outstanding, never as passed.
- A **pending** run (prepared, not evaluated, or sessions incomplete) is outstanding.
- Records are validated (`validate`) before a report is read; a malformed record is
  listed and excluded.

## Live protocol (frozen before the T-77 runs)

- **Runs**: the 36 slots of `benchmark.cjs schedule`: three pairs per brief, both
  arms per pair, run in schedule order (round 1 of every brief, then round 2, then
  round 3). The first arm of a pair alternates with the brief and the round, so every
  brief starts with both arms and 9 pairs are pincer-first and 9 plain-first.
- **Matched versions**: one model, one tool version, one Node version, one OS for all
  36 runs, recorded in every record; one kit tarball (`npm pack` of the implementation
  candidate) with its sha256 for every pincer run. A change of any of these starts a
  new benchmark; records from different environments are reported separately.
- **Equivalent intent**: both arms receive the same `BRIEF.md` and the same prompts,
  verbatim from `brief.md`. The pincer arm's workspace has the kit installed (its
  `AGENTS.md` and playbooks are how the workflow is followed); the plain arm has no
  kit and no agent instructions file. The operator adds nothing to either prompt.
- **Fresh workspaces**: every run is prepared from scratch by `prepare`; nothing is
  reused between runs, and the operator never edits a workspace except through the
  scripted step of `stage`.
- **Sessions**: one non-interactive session per prompt (`claude -p` with the pinned
  model, stdin from `/dev/null`, `env -u CLAUDECODE`, the session's cwd in the
  workspace), started and ended with `session`, its output saved next to the record
  and its transcript path recorded. Multi-session briefs run their sessions in order
  with the scripted operator step between them.
- **Caps**: a wall-clock cap per session and a turn cap, recorded in
  `environment.caps`; a session that hits a cap is ended and the run continues (the
  evaluator judges whatever was committed), with a `repair` intervention only if the
  operator had to intervene.
- **Interventions**: the operator answers a clarification only with information
  already in `BRIEF.md` or the prompt, and records it; the operator never implements,
  fixes or hints. Reapprovals restate the recorded prompt's approval and nothing more.
- **Evaluation**: after the last session, `evaluate` on the workspace `HEAD`
  (uncommitted work is not judged; the brownfield preservation check reads the
  workspace). The candidate, the evaluator digest and the log are recorded.
- **Provenance**: `check-freeze` must pass before the first run and after the last;
  a re-freeze during the benchmark invalidates the comparison unless every run is
  re-evaluated with the new evaluator and the history entry is cited.
- **Reporting**: `report` is the local review artifact; the trial record
  (`docs/trial-prd-v6.md`) cites it with every denominator, unavailable value and
  limitation, and the per-run prompts, interventions and evaluator outputs.

## Commands

```
node scripts/delivery-benchmark/benchmark.cjs freeze            # after editing briefs, evaluators, harness or this file
node scripts/delivery-benchmark/benchmark.cjs check-freeze      # exit 1 on drift
node scripts/delivery-benchmark/benchmark.cjs schedule
node scripts/delivery-benchmark/benchmark.cjs prepare --runs runs --run cli-greenfield/pair-1/pincer --kit pincer-workflow-0.6.0.tgz --model sonnet --tool claude-code --tool-version 2.1.267 --cap wall_clock_minutes=30
node scripts/delivery-benchmark/benchmark.cjs session --runs runs --run cli-greenfield/pair-1/pincer --name S1 --start
node scripts/delivery-benchmark/benchmark.cjs session --runs runs --run cli-greenfield/pair-1/pincer --name S1 --end --exit 0 --transcript logs/S1.out
node scripts/delivery-benchmark/benchmark.cjs stage --runs runs --run scope-revision/pair-1/plain --name S2
node scripts/delivery-benchmark/benchmark.cjs intervene --runs runs --run … --session S1 --type clarification --note "…"
node scripts/delivery-benchmark/benchmark.cjs effort --runs runs --run … --set setup_minutes=4 --set unavailable.tokens="print mode reports no usage"
node scripts/delivery-benchmark/benchmark.cjs evaluate --runs runs --run cli-greenfield/pair-1/pincer
node scripts/delivery-benchmark/benchmark.cjs validate --runs runs
node scripts/delivery-benchmark/benchmark.cjs report --runs runs [--json]
```

`node test/delivery-benchmark.test.js` recreates every brief's inputs, runs the
frozen evaluator on the correct control and on each faulty candidate (omitted
behaviour, a false-success path, stale or wrong-change evidence, and the
protocol faults of the multi-session briefs), and checks that a missing tool, an
evaluator error, an unfrozen evaluator and an absent trial are never accepted.

## Limitations

- Six briefs, three pairs each, one model and one tool: enough to see gross
  differences and the variation between repetitions, not to establish a general
  effect. The report says what was observed for these runs.
- The evaluators were written by the people who built PINCER, before the live runs;
  they are independent of the implementation agent, not of the project.
- `ui-states` is judged by markup inspection in Node, not by a browser or assistive
  technology. `integration-untested` uses a local scripted server, not the flaky
  service. Timing checks have generous margins and can still be perturbed by a loaded
  machine; a timing failure on the control is an evaluator error to investigate, not
  a finding against the candidate.
- Interventions and effort are operator-recorded; they carry the operator's judgment
  and are reported as such.
- Tokens and cost depend on what the tool reports; when it reports nothing they are
  null with a reason, not estimated.
