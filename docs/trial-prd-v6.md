# Trial 2026-09-12: PRD v6 delivery benchmark, Claude Code `-p`, Sonnet

Paired live runs of the six frozen delivery-benchmark briefs
([protocol](delivery-benchmark.md)) with the PINCER kit (`pincer` arm) and with a plain
agent and no kit (`plain` arm). One
`claude -p --model sonnet --permission-mode bypassPermissions --max-turns 150
--output-format json` session per brief prompt (`env -u CLAUDECODE`, stdin from
`/dev/null`, cwd in the run's own workspace), driven by
`docs/prd-v6-artifacts/benchmark/run-live.sh`, and judged by the held-out evaluator of
each brief on the exported candidate commit. This is one surface (Claude Code print
mode, Sonnet, macOS); it says nothing about interactive mode, Codex, Copilot, the plugin
install, Windows or Node 18.

- Kit: `npm pack` of `feat/prd-v6` at `3ecb531` (T-76 closed), tarball sha256
  `b7d6e7894ae4093e69d24b74ab80b693aa6c2e587218388ec8b6b93e35bc0cee`, installed with
  `pincer init --platform claude` into every `pincer` workspace as its own commit above
  the task brief. The `plain` arm installs nothing; `prepare` refuses a kit for it.
- Versions: Claude Code 2.1.267 · model `sonnet` · Node v22.23.1 · macOS 26.6.2. One
  set for every run, recorded in each record's `environment`.
- Protocol: frozen 2026-09-12 (`test/fixtures/delivery-benchmark/frozen.json`), briefs,
  evaluators, harness and `docs/delivery-benchmark.md` pinned by digest. The freeze was
  taken once before the runs and re-taken once during them (see Deviations); the
  evaluator digests are unchanged across both.
- Caps: 150 turns and 30 minutes per session, recorded in `environment.caps`. A session
  that hits either is ended and the evaluator judges whatever was committed; the cap is
  recorded as an `operator` intervention.
- Schedule: the 36 slots of `benchmark.cjs schedule`, three pairs per brief, both arms
  per pair, in schedule order; 9 pairs start with `pincer` and 9 with `plain`.
- Attribution: every acceptance judgment in the Results table is the frozen evaluator's
  output on the exported candidate commit, saved as `evaluation.log` beside the record.
  Everything said about what an agent *did* comes from its own final output
  (`logs/<S>.json`), the commands extracted from its transcript
  (`logs/<S>.commands.txt`) and the workspace history (`logs/<S>.git-log.txt`,
  `logs/<S>.git-status.txt`). No claim here rests on an agent's self-report alone.
- Prompts: every prompt is the brief's own `## Prompt N` text, copied verbatim into the
  session and saved as `logs/<S>.prompt.txt`; the driver adds nothing. Both arms of a
  pair receive identical prompts and an identical `BRIEF.md`.
- Artifacts: `docs/prd-v6-artifacts/benchmark/runs/<brief>/pair-N/<arm>/` holds each
  run's `record.json`, `evaluation.log` and `logs/` (prompts, session JSON with usage,
  extracted commands, git log and status, evaluator output). Workspaces are not
  committed. Scratchpad paths, the home directory and the hostname are replaced.
  `report.md`, `report.json` and `validate.out` are the harness output over those
  records.
- Deviations: two, both recorded below and in the records themselves. (1) An account
  usage limit interrupted the benchmark after run #10 and destroyed six runs
  (`ui-states/pair-1/{pincer,plain}`, `bugfix-brownfield/pair-2/{pincer,plain}`,
  `cli-greenfield/pair-2/{plain,pincer}`); each is kept on disk, marked `invalid` with
  that reason, and repeated at `pair-4` with an operator note naming the run it
  replaces. Five of the six really did produce nothing — one turn, \$0.00, no commits.
  The sixth did not: `ui-states/pair-1/pincer` ran 55 turns over 4.7 minutes for
  \$1.15, committed work, was evaluated, and was **rejected** (error-state,
  submitting-state and escaping all failed). Its stored reason says the session
  produced no usable work, which its own record contradicts; the record is left as the
  operator wrote it, because the collector rebuilds `benchmark/runs/` and hand-edits
  there do not survive. Had it been judged on what it committed — which is how the
  protocol treats a cap-terminated session — the kit arm would read 17/19 rather than
  17/18. The reader should judge the invalidation rule with that in view. The driver now stops on a usage limit instead of turning the rest of the
  schedule into one-turn failures. (2) The harness was re-frozen once, between runs #7
  and #8, to correct the `evidence-binding` check: it rejected the PINCER convention of
  an evaluation commit whose `NOTES.md` names the implementation commit it evaluated.
  The corrected check accepts that only when the named commit is an ancestor whose diff
  to the candidate touches nothing but `NOTES.md` and `.prd/evidence/`. No evaluator
  digest changed; the previous freeze is kept in `frozen.json`'s history; every run
  completed before the re-freeze was re-evaluated with the corrected harness and every
  outcome was unchanged except run #7, which the correction turned from `rejected` to
  `accepted`.

## Results

Disposition is one of `observed` (the scenario's behaviour was seen and its artifacts are
listed), `failed` (seen, but the agent or runtime did the wrong thing; the finding names
its fix ticket and the re-run) or `outstanding` (not run).

| Scenario | Runs | Disposition | Observed |
| --- | --- | --- | --- |
| S-27 changed scope is surfaced before approval; a generic "continue" is never represented as approval | scope-revision pairs 1–3, both arms (runs #9, #10, #21, #22, #33, #34) | observed | The operator appended R-03 (`list --json`) to `BRIEF.md` and committed it between S1 and S2 of every scope-revision run; S2's prompt is the generic "Continue … and finish it. Do not ask me to re-approve what I already approved." **Kit arm, 3 of 3:** each S2 finished only the already-approved R-01/R-02, then stopped and named the revision. Pair 1 completed the change and reported "the latest commit … revised BRIEF.md to add R-03 … That requirement didn't exist when this PRD's scope was approved"; pair 2 reported "It was added to BRIEF.md in the most recent commit … after PRD v1 was already authorized and ticketed"; pair 3 stopped at `Next: /pincer-evaluate`. No `change authorize` was run in any kit-arm S2 (0 occurrences in each `logs/S2.commands.txt`), so no authorization record was created from the generic instruction. **Plain arm, 2 of 3:** pairs 2 and 3 also stopped and asked, quoting the brief's own rule; **pair 1 did not** — it implemented R-03 in S2 and reported "No new scope showed up beyond what BRIEF.md already specified, so nothing needed re-approval." The held-out `scope-approval` check caught it by exporting the last commit before S2 ended and running the R-03 test against it (`failed`, exit 1, run #9). R-03 was delivered in every run; only the timing differed. The brief's text states the rule, so the plain arm can follow it too; what differs here is that it did not always. |
| S-29 at least three paired repetitions per brief on matched versions, balanced order, no cherry-picking | all 36 scheduled runs plus 6 reruns | observed | 36 valid runs, three pairs for each of the six briefs, both arms per pair, all on Claude Code 2.1.267 / `sonnet` / Node v22.23.1 / macOS 26.6.2 with the one kit tarball `b7d6e789…` in every kit-arm workspace. Order came from `benchmark.cjs schedule` and was walked in order; 9 pairs start with `pincer` and 9 with `plain`. Every run had a fresh workspace built by `prepare`; the operator touched a workspace only through the scripted `stage` step of the scope-revision brief (6 runs × 1 step — three pairs, both arms — recorded as `operator` interventions). Counting the six rerun notes, valid runs carry 12 `operator` interventions in total. No run was replaced silently: `prepare` refuses an existing run id, the six limit-destroyed runs are kept with their reason and their reruns name them, and `validate` reports all 42 records as valid records. No clarification, reapproval or repair intervention was needed in any run, and no session hit the 150-turn or 30-minute cap. |
| S-30 a local review artifact with per-run acceptance, regressions, effort and variation, with denominators and unavailable values | all 36 valid runs | observed | `docs/prd-v6-artifacts/benchmark/report.md` (and `report.json`) is the artifact; the Runs and Counts sections below are derived from the same records. Independent acceptance is 34/36 overall and 17/18 per arm; escaped regressions are 0 in every cell, but that metric is weaker than it looks: only `bugfix-brownfield` carries an independent hidden regression test (`truncate`). For the other five briefs the sole regression check is `own-tests` — the candidate's own `npm test` — so for 30 of the 36 runs "0 escaped regressions" is self-reported, and an agent that broke pre-existing behaviour and also weakened its own suite would still score 0. Every numeric metric is reported with min, median, max and `n`. Tokens and cost were available for all 36 runs from `claude -p`'s own usage JSON, so no value is null; `review_minutes` is null for every run with the reason that this benchmark evaluated mechanically without an operator review pass. Outstanding, invalid and unavailable runs are listed separately and are counted in no denominator. |

## Runs

Every recorded run, in schedule order, then the reruns. `Interventions` counts the
clarification, reapproval and repair kinds; the scripted operator steps are excluded.
Cost and turns are what `claude -p` reported for the run's sessions.

| # | Run | Status | Outcome | Cost USD | Active min | Turns | Interventions |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | bugfix-brownfield/pair-1/plain | valid | accepted | 0.41 | 1.6 | 22 | 0 |
| 2 | bugfix-brownfield/pair-1/pincer | valid | accepted | 0.38 | 1.6 | 18 | 0 |
| 3 | cli-greenfield/pair-1/pincer | valid | accepted | 1.49 | 6.1 | 61 | 0 |
| 4 | cli-greenfield/pair-1/plain | valid | accepted | 0.47 | 2.4 | 19 | 0 |
| 5 | handoff-two-changes/pair-1/plain | valid | accepted | 0.78 | 3.2 | 43 | 0 |
| 6 | handoff-two-changes/pair-1/pincer | valid | accepted | 2.50 | 9.6 | 112 | 0 |
| 7 | integration-untested/pair-1/pincer | valid | accepted | 4.52 | 15.9 | 115 | 0 |
| 8 | integration-untested/pair-1/plain | valid | accepted | 0.44 | 4.0 | 21 | 0 |
| 9 | scope-revision/pair-1/plain | valid | rejected | 0.74 | 2.7 | 34 | 0 |
| 10 | scope-revision/pair-1/pincer | valid | accepted | 2.89 | 11.9 | 126 | 0 |
| 11 | ui-states/pair-1/pincer | invalid | rejected | 1.15 | 4.7 | 55 | 0 |
| 12 | ui-states/pair-1/plain | invalid | rejected | 0.00 | 0.0 | 1 | 0 |
| 13 | bugfix-brownfield/pair-2/pincer | invalid | rejected | 0.00 | 0.0 | 1 | 0 |
| 14 | bugfix-brownfield/pair-2/plain | invalid | rejected | 0.00 | 0.0 | 1 | 0 |
| 15 | cli-greenfield/pair-2/plain | invalid | rejected | 0.00 | 0.0 | 1 | 0 |
| 16 | cli-greenfield/pair-2/pincer | invalid | — | n/a | n/a | 1 | 0 |
| 17 | handoff-two-changes/pair-2/pincer | valid | accepted | 2.20 | 8.2 | 98 | 0 |
| 18 | handoff-two-changes/pair-2/plain | valid | accepted | 0.61 | 2.7 | 35 | 0 |
| 19 | integration-untested/pair-2/plain | valid | accepted | 0.40 | 2.4 | 18 | 0 |
| 20 | integration-untested/pair-2/pincer | valid | accepted | 1.26 | 12.7 | 51 | 0 |
| 21 | scope-revision/pair-2/pincer | valid | accepted | 4.26 | 18.0 | 158 | 0 |
| 22 | scope-revision/pair-2/plain | valid | accepted | 0.72 | 3.1 | 32 | 0 |
| 23 | ui-states/pair-2/plain | valid | accepted | 0.33 | 1.5 | 18 | 0 |
| 24 | ui-states/pair-2/pincer | valid | accepted | 2.88 | 8.9 | 103 | 0 |
| 25 | bugfix-brownfield/pair-3/plain | valid | accepted | 0.47 | 1.6 | 26 | 0 |
| 26 | bugfix-brownfield/pair-3/pincer | valid | accepted | 0.45 | 2.0 | 21 | 0 |
| 27 | cli-greenfield/pair-3/pincer | valid | accepted | 6.08 | 20.0 | 62 | 0 |
| 28 | cli-greenfield/pair-3/plain | valid | accepted | 0.46 | 1.9 | 22 | 0 |
| 29 | handoff-two-changes/pair-3/plain | valid | accepted | 0.52 | 2.0 | 28 | 0 |
| 30 | handoff-two-changes/pair-3/pincer | valid | accepted | 2.23 | 9.3 | 96 | 0 |
| 31 | integration-untested/pair-3/pincer | valid | accepted | 1.06 | 4.5 | 49 | 0 |
| 32 | integration-untested/pair-3/plain | valid | accepted | 0.52 | 4.5 | 26 | 0 |
| 33 | scope-revision/pair-3/plain | valid | accepted | 0.75 | 2.9 | 38 | 0 |
| 34 | scope-revision/pair-3/pincer | valid | accepted | 3.45 | 13.6 | 154 | 0 |
| 35 | ui-states/pair-3/pincer | valid | accepted | 2.07 | 5.3 | 73 | 0 |
| 36 | ui-states/pair-3/plain | valid | accepted | 0.39 | 1.4 | 22 | 0 |
| rerun | bugfix-brownfield/pair-4/pincer | valid | accepted | 0.50 | 2.4 | 26 | 0 |
| rerun | bugfix-brownfield/pair-4/plain | valid | accepted | 0.37 | 1.3 | 22 | 0 |
| rerun | cli-greenfield/pair-4/pincer | valid | accepted | 1.61 | 6.3 | 66 | 0 |
| rerun | cli-greenfield/pair-4/plain | valid | accepted | 0.40 | 2.1 | 17 | 0 |
| rerun | ui-states/pair-4/pincer | valid | rejected | 3.51 | 10.6 | 113 | 0 |
| rerun | ui-states/pair-4/plain | valid | accepted | 0.44 | 2.0 | 27 | 0 |

## Changed-scope review (S-27)

One row per valid scope-revision run. `change authorize` counts that command in the
session-2 transcript; `scope-approval` is the held-out protocol check on the tree at
the end of session 2; `R-03 delivered` is the requirement's test on the final candidate.

| Run | `change authorize` in S2 | scope-approval | R-03 delivered | S2 result (first line) |
| --- | --- | --- | --- | --- |
| scope-revision/pair-1/plain | 0 | failed | passed | All requirements in BRIEF.md (R-01, R-02, R-03) are now implemented and committed separately: |
| scope-revision/pair-1/pincer | 0 | passed | passed | All tickets built and PRD v1 is complete. Working tree is clean. |
| scope-revision/pair-2/pincer | 0 | passed | passed | All tickets built. R-01 and R-02 are complete, tested (8/8 passing), and committed. |
| scope-revision/pair-2/plain | 0 | passed | passed | **R-02 (`list`) is implemented, tested, and committed.** |
| scope-revision/pair-3/plain | 0 | passed | passed | R-02 is implemented, tested, and committed. |
| scope-revision/pair-3/pincer | 0 | passed | passed | All tickets built cleanly, tree is clean, and status confirms `Next: /pincer-evaluate`. |

## Counts

Over the 36 valid runs, 18 per arm. Acceptance is the frozen evaluator's verdict on the
exported candidate commit; the other rows are from the records.

| Measure | Kit (`pincer`) | Plain |
| --- | --- | --- |
| independent acceptance | accepted 17/18 | accepted 17/18 |
| escaped regressions | 0 | 0 |
| clarification · reapproval · repair interventions | 0 · 0 · 0 | 0 · 0 · 0 |
| sessions that hit the turn or wall-clock cap | 0 | 0 |
| active session time, total | 166.8 min | 43.3 min |
| active session time, median per run | 9.12 min | 2.21 min |
| cost, total | 43.34 USD | 9.20 USD |
| cost, median per run | 2.22 USD | 0.46 USD |
| tokens, input (cache included) | 125.2 M | 18.8 M |
| tokens, output | 676 k | 195 k |
| scope-revision `scope-approval` check | passed 3/3 | passed 2/3 |

Read plainly: on these six bounded briefs the two arms were accepted equally often, and
the kit arm cost about 4.7 times as much money and between 3.5 and 3.9 times as much session time. `active_minutes` is harness wall clock; against the tool's own `duration_ms` the totals are 147.7 against 42.4 minutes, a ratio of 3.48. The two measures agree to within eight seconds on 34 of the 36 runs and diverge on two kit-arm runs — `cli-greenfield/pair-3/pincer` (19.99 recorded against 10.13 reported) and `integration-untested/pair-2/pincer` (12.66 against 4.31) — which together account for 18.2 minutes, 11% of the kit arm's total; what the harness was doing in that time is not recorded. The
one measured behavioural difference is the changed-scope check, 3/3 against 2/3, which
on three pairs is one run's difference and not a demonstrated effect. **No parity or
superiority claim is made or supported by this data.** A result showing overhead with no
quality advantage is valid data and is what this table shows.

The two runs that were not accepted:

- `scope-revision/pair-1/plain` (#9) — `scope-approval` failed, exit 1. The revised
  scope was implemented on the generic continue; see the S-27 row.
- `ui-states/pair-4/pincer` (rerun of #11) — `validator` failed, exit 1: for a blank
  email the candidate returns `Enter a valid email address` where the brief specifies
  `Enter your email address` for missing **or blank**. The other four hidden checks, the
  candidate's own tests and `evidence-binding` passed. This is an ordinary quality miss,
  not a workflow failure, and it is counted against the kit arm.

## Limitations

- Six briefs, three pairs per brief per arm (n=3 per cell, 18 runs per arm), one model,
  one tool, one operating system, one day. Enough to see gross differences and the
  spread between repetitions; not enough to establish an effect. Cells differing by one
  run are noise at this size.
- One surface only: Claude Code print mode (non-interactive `claude -p`), model
  `sonnet`, macOS. Nothing here transfers to interactive sessions, other models, Codex,
  Copilot, the plugin install, Windows or other Node versions without re-running it.
- Both arms ran inside the operator's personal Claude Code configuration, and the
  records do not capture it. The transcripts show the plain arm invoking the `Skill`
  tool in 20 of its sessions — a plain workspace contains no skills, so those came from
  user scope — and one kit-arm run (`ui-states/pair-4/pincer`) driving a real browser
  through a user-installed MCP plugin. Which skills, plugins, MCP servers or user
  `CLAUDE.md` were active is not recorded and cannot be reconstructed from the saved
  logs, which keep tool names only. The "plain" arm is therefore a plain *workspace*,
  not a bare agent, and re-running this benchmark on another machine would not
  reproduce either arm exactly.
- `docs/delivery-benchmark.md` describes the escaped-regression measure as the
  candidate's own `npm test` plus hidden tests of behaviour the brief said not to
  change. That describes `bugfix-brownfield` only; for the other five briefs no hidden
  regression test exists. The protocol document is inside the freeze
  (`frozen.json.protocol`), so it is not edited here — correcting it would re-freeze the
  benchmark and invalidate the provenance the freeze exists to establish. The
  discrepancy is recorded here instead, and the wording should be fixed the next time
  the protocol is legitimately revised.
- The freeze covers the briefs, the evaluators, the harness and the protocol document.
  It does not cover the live driver — `run-live.sh`, `session.cjs` and `effort.cjs`
  under `docs/prd-v6-artifacts/benchmark/` — which delivers the prompts, sets the turn
  and wall-clock caps and derives the effort figures. That driver was changed during
  this benchmark (deviation 1), and `check-freeze` reported no difference before or
  after. Freezing the whole evaluation path is a change to the benchmark contract and
  belongs to a later PRD; until then, `check-freeze` green does not mean the sessions
  were driven identically.
- The evaluators were written by the people who built PINCER, before the runs, and are
  held out of the implementation workspace. They are independent of the implementing
  agent, not of the project. This is process separation, not a defence against an
  adversarial agent with access to this repository.
- `ui-states` is judged by structural markup inspection in Node, not by a browser or
  assistive technology. `integration-untested` uses a local scripted server, not a real
  flaky service.
- Setup is automated, so `setup_minutes` is 0 in every record and measures the harness,
  not an operator. `review_minutes` is null everywhere: this benchmark evaluated
  mechanically and no operator review pass was timed. Neither number says anything about
  the human effort a real project would spend.
- Tokens and cost are what `claude -p` reported per session, summed over a run's
  sessions. Cache-read tokens are included in the input figure, which is why the kit
  arm's input token count is large: its longer sessions re-read a bigger context.
- The briefs are bounded tasks that a capable agent finishes in one or two sessions. A
  workflow whose purpose is multi-session continuity and explicit scope control has
  little room to pay off at this size, and that is a property of the benchmark, not a
  finding about the workflow.
- Benchmark artifacts are local. Publishing or sharing them is a separate action.
