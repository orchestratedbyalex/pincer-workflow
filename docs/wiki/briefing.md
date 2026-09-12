# Briefing

**pincer-workflow** — the public distribution of PINCER, a PRD-driven agentic
delivery workflow (Plan · Investigate · Narrow · Code · Evaluate · Release).
One repo, three channels: an npx installer ([[cli-installer]]), a Claude Code
plugin marketplace, and the raw kit files ([[template-kit]],
[[distribution-channels]]).

## Current state

**PRD v6 ("Complete requirement coverage and explain change impact", `.prd/prd-v6.md`)
is fully implemented and built on `feat/prd-v6` (2026-09-12, T-66..T-78, base `07b2210`).
Not evaluated, not merged, not released.** Strict coverage ([[strict-coverage]]) is opt-in
per change: the PRD's own `R-NN`/`S-NN` prose is the inventory, `.prd/coverage/<id>.json`
is the one authored map, the agreement digest covers both, `coverage` and `impact` are
read-only reports, strict `check C-NN` runs only the map's declaration, and evidence
schema 3 derives every scenario and requirement row from the map snapshot and the
outcomes. `coverage adopt --apply` is the only way in; a project that never adopts is
untouched and labelled `unverified`. The 36-run paired delivery benchmark
([[delivery-benchmark]]) shipped with it. Review material: `docs/prd-v6-review-packet.md`
(R/S traceability, gate results, eight executable replay cases in
`docs/prd-v6-artifacts/replay.sh`, sanitized records under
`docs/prd-v6-artifacts/records/`) and `docs/trial-prd-v6.md` (the live runs). Full
`npm test` (50 suites) green locally through the pinned v0.5.0 kit; both generators in
parity; **CI not run on the branch and Node 18 unverified anywhere.**

**PRD v5 ("Preserve changes, authorization, and resume context") is built on
`feat/prd-v5` (T-47..T-65, base `9bcf8df`), not evaluated, not merged, not released.**
It gave the runtime one schema 2 change record per change ([[explicit-change-lifecycle]],
[[runtime]]): agreements `G-NN`, authorizations `A-NN`, decisions `D-NN`, journaled
transitions, explicit `change select`, gated execution, change-scoped attempts and
evidence, and the `resume` report. v6 sits on top of it. Its own re-review, evaluation
and CI remain separate gates.

Before that: 0.5.0 (`2d244eb`, tag `v0.5.0`, published 2026-09-11) shipped PRD v4's Node
runtime ([[runtime-owned-verification]]); v0.4.x shipped PRD v2/v3
([[requirements-through-delivery]], [[candidate-evidence]], [[revocable-receipts]]).

## Active / next task

1. **Evaluate v6.** Nothing on `feat/prd-v6` has been evaluated: choose the candidate,
   run `/pincer-evaluate`, write `NOTES.md`. The packet deliberately does not choose it.
2. **Run the CI matrix** ({ubuntu, macos} × Node {18, 22}) on the chosen candidate before
   anyone calls the branch green. Node 18 has never run this code anywhere.
3. **Two built, unreleased branches.** v5 and v6 both await evaluation, merge, version
   bump and publish, and those are four separate gates. v6 builds on v5, so decide their
   order before merging either.
4. The live benchmark is honest about showing overhead with no acceptance advantage at
   n=3 per cell; do not quote it as evidence that the workflow wins. Other parked items
   are in [[open-threads]].

## Recent decisions

- [[coverage-is-authored-and-bound]] — one authored map, the PRD prose as the inventory, both inside the agreement digest; structure is reported, adequacy is judged (PRD v6)
- [[explicit-change-lifecycle]] — retained change records, explicit selection, agreement digests + user/delegated authorization, journaled transitions, change-scoped evidence, `resume` (PRD v5)
- [[runtime-owned-verification]] — Node runtime records source-bound attempts; `done` consumes the current pass; evidence schema 2; explicit migration (PRD v4)

## Landmines

- The repo's own tickets are verified with a pinned released kit in the session scratchpad (v0.5.0 from tag `v0.5.0`: `pincer-ticket.sh`, `pincer-status.sh`, `pincer-runtime.cjs`, `pincer-evidence.cjs`, `pincer-runtime/*.cjs`, recreated with `git show v0.5.0:template/scripts/<file>`). Never export `CLAUDE_PROJECT_DIR` in the shell (`test/ticket.test.js` inherits it) and never pipe `verify`/`done` or a test run through `tail` before a `git commit` (the pipe masks the exit code). Run suites with output redirected to a file and check `$?`.
- `npm test` is now 50 suites and about ten minutes; `verify`/`done` on a ticket whose check is `npm test` runs it twice. `test/delivery-benchmark.test.js` dominates (it spawns many processes and runs `npm test` inside generated candidate projects) and needs `git` and `npm` on PATH.
- Any commit after the evaluated candidate other than NOTES.md + listed evidence makes status say `stale: candidate changed after evaluation` — wiki edits and the version bump included. Do wiki `end` before the built commit; the built commit precedes the candidate.
- After editing `template/`, run BOTH generators (`template/scripts/sync-prompts.sh`, `scripts/build-plugin.sh`); `test/distribution.test.js` fails on stale output. `build-plugin.sh` copies `pincer-runtime.cjs` and `pincer-runtime/*.cjs`; a new module elsewhere must be added explicitly, and `bin/pincer.js` `common` must list it. `npm version` alone leaves `plugin/.claude-plugin/plugin.json` stale — bump with `--no-git-tag-version`, rebuild, then commit and tag by hand.
- Changes mode is per project: old migrated-mode suites build fixtures with `test/helpers.js` `bindV050()` (hand-written schema 1 binding) because `register` writes schema 2; a fake changes-mode attempt must be schema 2 with `context.agreement` and a stored source manifest, or readiness reports `HISTORICAL_EVIDENCE`. Attempt records are validated field by field (`state.validateAttempt`).
- Contract tests (`test/contracts.test.js`, `test/change-contracts.test.js`, `test/coverage-contracts.test.js`) pin phrases of `template/docs/runtime-contracts.md`, some across line breaks. Both review-packet tests pin `S-NN` tags in test sources and run their `replay.sh all`; the trial-record tests pin scenario rows and artifact names. Adding a suite means updating `package.json` and the v5 packet's suite row (`sync-packet-suites.cjs` in the scratchpad).
- A check that writes untracked non-ignored files ends `error` (`SOURCE_CHANGED`); a kit update inside a project makes every done ticket `SOURCE_CHANGED` until re-verified; a check that exits 0 leaving a background child on the pipes is `timed_out`. `test/runtime-runner.test.js` needs `perl`.
- `test/workflow.test.js` asserts the `## Authorization rule` block is byte-identical across plan/narrow/code/evaluate — edit it in all four — and pins the T-62 sentences in `pincer-code.md`.
- Never hand-edit `status`/`started`/`last_check`/`verified`/`finished` in tickets; the guard blocks `git checkout`/`restore`/`reset --hard`/`stash` touching `tickets/` from the assistant's shell on purpose. The guard also refuses a compound `git add <protected path> && git commit -m "$(cat <<'EOF' … <email> EOF)"` (lexer false positive): split add and commit.
- Live runs: `env -u CLAUDECODE claude -p --model sonnet --permission-mode bypassPermissions --output-format json "<prompt>" < /dev/null`, one session per stage. An account usage limit turns every later session into a one-turn failure — the benchmark driver now marks the run invalid and stops; do the same by hand elsewhere. Transcripts under `~/.claude/projects/<slug>/`; `docs/prd-v6-artifacts/benchmark/extract-commands.cjs` turns one into a command list.
- In the Bash sandbox, `node <script> <argv ≥ ~1 KB>` is SIGKILLed (exit 137); `node -e` is not; tests exercise long-input bounds through the module API. zsh does not word-split an unquoted `$VAR` holding a command — write multi-step shell work as a `bash -c` script or a file.
- npm: 2FA; expired token shows as `E404 … PUT`; `npm whoami` then `npm login`; publish needs `--otp=<code>`; registry lags ~20 s. The user runs publish. `template/.gitignore` would be stripped by npm — never ship one.
- Codex channel = `.agents/skills/*/SKILL.md` invoked as `$pincer-*`. Multi-line text pasted into Claude Code is sent at the first line break.
