# Briefing

**pincer-workflow** — the public distribution of PINCER, a PRD-driven agentic
delivery workflow (Plan · Investigate · Narrow · Code · Evaluate · Release).
One repo, three channels: an npx installer ([[cli-installer]]), a Claude Code
plugin marketplace, and the raw kit files ([[template-kit]],
[[distribution-channels]]).

## Current state

**0.6.0 is released and pushed.** Verified against the server, not inferred: `350823e`,
`566b553` and `694241c` are all ancestors of `origin/main`, `main`'s `package.json` says
0.6.0, `NOTES.md` carries the v5+v6 evaluation, and the tag `v0.6.0` resolves on the
remote to `694241c`. The older handover claim that these were local-only is wrong and
those threads are closed.

**PRD v7 is merged and on `main` at `0534ea2`** — PR #3 (`ae796d6`) carried the PRD and
T-87..T-97, PR #4 (`0534ea2`) carried T-98. The CI matrix ran green on the merge commit
(run 34930700263, 4/4). Implemented as far as money-free work goes.

- **Shipped:** `coverage scaffold --change <id> [--json]` and
  `resume --brief [--change <id>] [--json]` — both read-only projections
  ([[read-only-projections]]), documented in `template/docs/runtime-contracts.md`.
- **Built:** the frozen protocol, the preservation matrix, the v7 effort record and
  execution freeze, the benchmark edition with eight briefs and a 72-run schedule, the
  observation validators, six replay cases, the review packet ([[v7-measured-friction]]).
- **T-98** fixed the benchmark edition before its first run: the frozen driver placed and
  capped nothing and there was no run loop at all ([[fix-the-driver-before-run-one]]).
  Cohort re-minted openly, `eef74402…` → `6de061ec…`, at zero cost because no run existed.
- **T-99 closed five more, found by the 2026-09-15 assessment and verified independently**
  ([[v7-execution-gaps]]): the strict arm was byte-identical to the default arm, no record
  passed `effort.problems()`, the preservation check was dead, a crash repeated a cell’s
  paid sessions and poisoned its base, and execution inputs were never reconciled with the
  freeze. Cohort `6de061ec…` → `47dedc0a…`, still free because no run exists. The
  orchestrator now has an operator entry point. None of it ships to users.
- **Outstanding, and the user's call:** every live observation. Three baseline pilots
  (T-89), two platform journeys and the handoff (T-93), 72 benchmark runs and timed
  reviews (T-95). 7 of 30 scenarios are `outstanding`, three more partly so;
  `docs/prd-v7-review-packet.md` §6 lists what each needs.

## Active / next task

1. **The decisions nothing can proceed without.** A costed spending cap (~$181 central,
   $215-220 realistic, over five or six account reset windows — see
   [[v7-measured-friction]]), a wall-clock cap, three pilot projects and their access,
   and **two non-implementing human reviewers**. The last one is not a budget problem: an
   agent that implemented the candidate is `REVIEW_NOT_INDEPENDENT` by construction.
2. **Codex is now pinned** (`codex-cli 0.153.4`, authenticated) — one prerequisite off
   section 9 without spending anything. Both CLIs work headless on this host.
3. **Evaluate.** No v7 candidate is selected and no v7 evidence exists; `NOTES.md` still
   names the v6 evaluation. Authored docs and metadata are finished, so the candidate can
   be chosen cleanly.
4. **A browser adapter.** The orchestrator takes `--browser <module>` and warns without
   one, but nobody has written or chosen an adapter, so nine of the 72 runs would be
   `unavailable` ([[v7-execution-gaps]]).
5. Other parked items are in [[open-threads]].

## Recent decisions

- [[fix-the-driver-before-run-one]] — fix a frozen input and re-mint the cohort while
  zero runs exist; put the run loop in the tree so provenance describes what ran (T-98)
- [[read-only-projections]] — both v7 surfaces project computed state; the draft's
  *missing* `schema` key is what stops it being a map (T-90/T-91)
- [[v7-measured-friction]] — measurement is an event log with merged intervals; `null`
  keeps its reason; a changed input starts a new cohort rather than re-dating the study
- [[one-next-action-precedence]] — two views of the same state drift; delete one (T-80)

## Landmines

- **Never add a file under `scripts/delivery-benchmark/`.** `benchmark.cjs:56` digests
  that whole directory, so any addition breaks the v6 freeze. V7 is a sibling at
  `scripts/delivery-benchmark-v7/` for exactly this reason.
- Regenerate `test/fixtures/delivery-benchmark-v7/frozen.json` after editing the named
  execution path; the command is commented at the top of `freeze-spec.cjs`. Append to
  `SPEC.harness`, never prepend — `test/delivery-benchmark-v7.test.js` indexes `[2]`.
- **A backgrounded watchdog inherits the caller's stdout**, so its `sleep` holds a
  synchronous caller's pipe open long after the child exits. Redirect it to `/dev/null`.
  This was invisible in review and only a real end-to-end test caught it.
- **A benchmark case that only asserts orchestration proves nothing about the record.**
  T-99's cases drive the real loop with a stand-in and then assert on what landed on disk;
  keep it that way, and keep asserting BOTH directions of a check ([[v7-execution-gaps]]).
- Check objects use `id`, not `name` (`evaluator-kit.cjs:26`) — a `find` on `c.name`
  silently matches nothing and the assertion passes on `undefined`.
- `SPEC.harness` in `freeze-spec.cjs` is a **file list**, not a directory digest — so a new
  sibling module under `scripts/delivery-benchmark-v7/` does not change the cohort. That is
  the only way to correct anything mid-study without stranding the runs already paid for.
- `docs/prd-v7-artifacts/v6-preservation.json` digests 674 v6 files individually;
  `test/improvement-contracts.test.js` fails naming the file that moved. `docs/prd-v6-review-packet.md`'s
  stale "(51 suites)" must **stay** stale — correcting it fails that suite.
- The repo's own tickets are verified with a pinned released kit in the session
  scratchpad (v0.6.0, digest `cc8c11e0…`, recreated with `git show v0.6.0:template/scripts/<file>`).
  Never export `CLAUDE_PROJECT_DIR`, and never pipe `verify`/`done` or a test run through
  `tail` before a `git commit` — the pipe masks the exit code.
- **`npm version` alone breaks the build**: bump with `--no-git-tag-version`, run
  `scripts/build-plugin.sh`, then commit and tag by hand ([[distribution-channels]]).
- Any commit after the evaluated candidate other than NOTES.md + the named manifest's own
  listed files makes status say `stale: candidate changed after evaluation`
  ([[candidate-evidence]]).
- `npm test` is 63 suites and about fifteen minutes. `delivery-benchmark`,
  `delivery-benchmark-v7`, `benchmark-orchestrator` (a real 60-second wall-clock case) and
  `improvement-review-packet` (which runs `replay.sh all`) dominate. CI is
  {ubuntu,macos} × Node {22,24}. Adding a suite means updating `package.json` **and** the
  packet rows that pin the count.
- **Every CLI write goes through `pincer-runtime/io.cjs`**; do not turn `process.exit(N)`
  into `process.exitCode = N` ([[runtime]]).
- **Any report that renders a next action must consume `routing.cjs`**
  ([[one-next-action-precedence]]).
- After editing `template/`, run BOTH generators; `test/distribution.test.js` compares the
  *plugin's* copy of `runtime-contracts.md`, so a doc edit alone breaks it.
  `test/change-distribution.test.js` pins the runtime usage string verbatim.
- Contract tests pin phrases of `template/docs/runtime-contracts.md`, some across line
  breaks — flatten whitespace when writing a new pin.
- `test/workflow.test.js` asserts the `## Authorization rule` block is byte-identical
  across plan/narrow/code/evaluate — edit it in all four.
- Never hand-edit `status`/`started`/`last_check`/`verified`/`finished` in tickets; the
  guard blocks `git checkout`/`restore`/`reset --hard`/`stash` touching `tickets/` and
  refuses a compound `git add <protected path> && git commit …` — split add and commit.
- Live runs go through `live-driver.sh`, which refuses without `--i-have-a-spending-cap`.
  That flag asserts a human agreed a cap; it is not the agent's to pass.
- In the Bash sandbox, `node <script> <argv ≥ ~1 KB>` is SIGKILLed (exit 137); `node -e`
  is not. zsh does not word-split an unquoted `$VAR`. Neither `timeout` nor `gtimeout`
  exists on this host.
- A shell redirect onto a file a command also reads truncates it first — write via a
  temp file and `mv` (this bit `replay.sh`).
- npm: 2FA; expired token shows as `E404 … PUT`; publish needs `--otp=<code>`; registry
  lags ~20 s. The user runs publish. `template/.gitignore` would be stripped by npm.
- Codex channel = `.agents/skills/*/SKILL.md` invoked as `$pincer-*`.
