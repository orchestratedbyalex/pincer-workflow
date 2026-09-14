# Briefing

**pincer-workflow** — the public distribution of PINCER, a PRD-driven agentic
delivery workflow (Plan · Investigate · Narrow · Code · Evaluate · Release).
One repo, three channels: an npx installer ([[cli-installer]]), a Claude Code
plugin marketplace, and the raw kit files ([[template-kit]],
[[distribution-channels]]).

## Current state

**0.6.0 is released and fully on `main` at `715853d`.** The earlier handover claim that
the evaluation, bump and tag were local-only is **wrong for this checkout** and is
corrected in `docs/prd-v7-protocol.md` §2: `350823e`, `566b553` and `694241c` are all
ancestors of HEAD, `package.json` says 0.6.0, `NOTES.md` carries the v5+v6 evaluation,
and the tag exists locally. *Remote* state was never checked against the server — say
"the local checkout contains them", not "they are pushed".

**PRD v7 is implemented as far as it can be without spending money.** The engineering
is done and tested; every live observation is outstanding. In detail:

- **Shipped:** `coverage scaffold --change <id> [--json]` and
  `resume --brief [--change <id>] [--json]` — both read-only projections
  ([[read-only-projections]]), documented in `template/docs/runtime-contracts.md` under
  "Coverage draft" and "Brief resume".
- **Built:** the frozen protocol (`docs/prd-v7-protocol.md`), the preservation matrix,
  the v7 effort record and execution freeze, the v7 benchmark edition with eight briefs
  and a 72-run schedule, the observation record validators, six replay cases, and the
  review packet ([[v7-measured-friction]]).
- **Outstanding, and it is the user's call:** three baseline pilots (T-89), two platform
  journeys and the handoff (T-93), 72 benchmark runs and timed reviews by two
  non-implementing people (T-95). All need project selection, project access, a costed
  spending cap and reviewers. 10 of 30 scenarios are `outstanding`; three more are
  partly so. `docs/prd-v7-review-packet.md` §6 lists exactly what each needs.
- **T-97** was created from an observed failure and fixed: `REVISION_CHANGED` advised
  `register --rebind`, which changes mode refuses.

Before that: 0.6.0 (`694241c`, tag `v0.6.0`) shipped PRD v5+v6 evaluated as one
candidate `ce98abd`; 0.5.0 shipped PRD v4's Node runtime ([[runtime-owned-verification]]).

## Active / next task

1. **Decide the live work.** Nothing else in v7 can proceed without: the three pilot
   projects, project-access decisions, a costed spending cap and wall-clock cap, two
   non-implementing reviewers, and the Codex CLI pinned. The 72-run schedule is
   substantive spending — cost it before running it; a smaller study needs a recorded
   scope revision, not fewer cells.
2. **Push, then CI.** The Ubuntu/macOS × Node 22/24 matrix has not run on this work.
3. **Evaluate.** No candidate is selected and no v7 evidence exists; `NOTES.md` still
   names the v6 evaluation. Authored docs and metadata are finished, so the candidate
   can be chosen cleanly.
4. Other parked items are in [[open-threads]].

## Recent decisions

- [[read-only-projections]] — both v7 surfaces project computed state; the draft's
  *missing* `schema` key is what stops it being a map, and grouping never collapses a
  blocker category (PRD v7, T-90/T-91)
- [[v7-measured-friction]] — measurement is an event log with merged intervals; `null`
  keeps its reason; a changed input starts a new cohort rather than re-dating the study
- [[one-next-action-precedence]] — two views of the same state drift; delete one (T-80)
- [[coverage-is-authored-and-bound]] — one authored map, the PRD prose as inventory,
  both inside the agreement digest (PRD v6)

## Landmines

- **Never add a file under `scripts/delivery-benchmark/`.** `benchmark.cjs:56` digests
  that whole directory (`treeDigest(__dirname)`), so any addition breaks the v6 freeze.
  V7 lives at `scripts/delivery-benchmark-v7/` for exactly this reason.
- Regenerate `test/fixtures/delivery-benchmark-v7/frozen.json` after editing the named
  execution path; the command is commented at the top of `freeze-spec.cjs`.
- `docs/prd-v7-artifacts/v6-preservation.json` digests 674 v6 files individually;
  `test/improvement-contracts.test.js` fails naming the file that moved. Do not edit a
  v6 artifact — fixing v6 methodology means a new study.
- The repo's own tickets are verified with a pinned released kit in the session
  scratchpad (v0.6.0 from tag `v0.6.0`, digest `cc8c11e0…`, recreated with
  `git show v0.6.0:template/scripts/<file>`). Never export `CLAUDE_PROJECT_DIR`
  (`test/ticket.test.js` inherits it) and never pipe `verify`/`done` or a test run
  through `tail` before a `git commit` — the pipe masks the exit code. Redirect to a
  file and check `$?`.
- **`npm version` alone breaks the build**: bump with `--no-git-tag-version`, run
  `scripts/build-plugin.sh`, then commit and tag by hand ([[distribution-channels]]).
- Any commit after the evaluated candidate other than NOTES.md + the named manifest's
  own listed files makes status say `stale: candidate changed after evaluation`. **The
  allowed set is the manifest's listed files, never a directory** ([[candidate-evidence]]).
- `npm test` is 62 suites and about fifteen minutes. `test/delivery-benchmark.test.js`,
  `test/delivery-benchmark-v7.test.js` and `test/improvement-review-packet.test.js`
  (which runs `replay.sh all`) dominate. CI is {ubuntu,macos} × Node {22,24}.
- **Every CLI write goes through `pincer-runtime/io.cjs`**; `test/runtime-output.test.js`
  asserts nothing else writes to a standard stream. Do not turn `process.exit(N)` into
  `process.exitCode = N` ([[runtime]]).
- **Any report that renders a next action must consume `routing.cjs`** ([[one-next-action-precedence]]).
- After editing `template/`, run BOTH generators (`template/scripts/sync-prompts.sh`,
  `scripts/build-plugin.sh`); `test/distribution.test.js` fails on stale output — and it
  compares the *plugin's* copy of `runtime-contracts.md`, so a doc edit alone breaks it.
- `test/change-distribution.test.js` pins the runtime usage string verbatim; adding a
  CLI flag makes it stale.
- Contract tests pin phrases of `template/docs/runtime-contracts.md`, some across line
  breaks — flatten whitespace when writing a new pin rather than pinning where the line
  happened to wrap. Adding a suite means updating `package.json` and the relevant packet.
- A check that writes untracked non-ignored files ends `error` (`SOURCE_CHANGED`); a kit
  update inside a project makes every done ticket `SOURCE_CHANGED` until re-verified.
- `test/workflow.test.js` asserts the `## Authorization rule` block is byte-identical
  across plan/narrow/code/evaluate — edit it in all four.
- Never hand-edit `status`/`started`/`last_check`/`verified`/`finished` in tickets; the
  guard blocks `git checkout`/`restore`/`reset --hard`/`stash` touching `tickets/` and
  refuses a compound `git add <protected path> && git commit …` — split add and commit.
- Live runs: `env -u CLAUDECODE claude -p --model sonnet --permission-mode bypassPermissions --output-format json "<prompt>" < /dev/null`,
  one session per stage. An account usage limit turns every later session into a
  one-turn failure — stop rather than recording them.
- In the Bash sandbox, `node <script> <argv ≥ ~1 KB>` is SIGKILLed (exit 137); `node -e`
  is not. zsh does not word-split an unquoted `$VAR` holding a command — write multi-step
  shell work as a `bash -c` script or a file.
- A shell redirect onto a file a command also reads truncates it first — write via a
  temp file and `mv` (this bit `replay.sh`).
- npm: 2FA; expired token shows as `E404 … PUT`; publish needs `--otp=<code>`; registry
  lags ~20 s. The user runs publish. `template/.gitignore` would be stripped by npm.
- Codex channel = `.agents/skills/*/SKILL.md` invoked as `$pincer-*`. Multi-line text
  pasted into Claude Code is sent at the first line break.
