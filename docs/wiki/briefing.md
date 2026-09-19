# Briefing

**pincer-workflow** — the public distribution of PINCER, a PRD-driven agentic
delivery workflow (Plan · Investigate · Narrow · Code · Evaluate · Release).
One repo, three channels: an npx installer ([[cli-installer]]), a Claude Code
plugin marketplace, and the raw kit files ([[template-kit]],
[[distribution-channels]]).

## Current state

The [v8 obligation overlay](../prd-v8-obligation-map.md) is the current account,
reviewed at `c7cb6bc9906ecd418e9edddfc08d3bdd353f8aab` on 2026-09-19.
Registry and checkout metadata say 0.6.0; main contains later scaffold/brief and
runner changes. Historical v6 NOTES/evidence do not evaluate current source.

V7 has five done tickets and eight open, including implemented but dependency-blocked
work. Its real strict pilots, platform journeys/handoff, comparison and human reviews
remain unfinished. Packaged artifacts establish installation, not observed live support.
The original S-09 pilot-before-code ordering remains unsatisfied; later pilots cannot
backdate it. The overlay proposes a disposition, not an invented user waiver.

## Active / next task

T-100 establishes [v8 contracts](../prd-v8-contracts.md) and historical obligations.
T-101–T-108 then repair provenance, isolation, ownership, restart, usage, terminal
records, real-browser evaluation and release preparation before T-109's readiness gate.
Only later do actual capped observations gate new usability implementation and studies.
No spending allocation, project access or reviewer identity is inferred from this plan.
Preserve historical frozen files, unrelated user work and legacy management mode.

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
