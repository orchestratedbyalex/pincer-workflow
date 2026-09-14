# Briefing

**pincer-workflow** — the public distribution of PINCER, a PRD-driven agentic
delivery workflow (Plan · Investigate · Narrow · Code · Evaluate · Release).
One repo, three channels: an npx installer ([[cli-installer]]), a Claude Code
plugin marketplace, and the raw kit files ([[template-kit]],
[[distribution-channels]]).

## Current state

**PRD v5 and PRD v6 are built, evaluated, merged and published as 0.6.0 — but the
release is split across refs and nothing since the merge is pushed.** The code of both
PRDs is on `main` (`8a0610d`, PR #1, tree byte-identical to the evaluated candidate
`ce98abd`), and `0.6.0` is on npm (2026-09-14). What is *not* public:

- **The evaluation.** PR #1 merged the branch at `ce98abd`, before the evaluate commit
  was pushed, so `main` carries v5+v6 code under **PRD v4's** NOTES.md. The real record —
  `NOTES.md` and `.prd/evidence/prd-v6/ce98abd…/` (12 checks, two review artifacts) —
  is only in local commit `350823e`.
- **The version.** `main`'s `package.json` says 0.5.0; the bump commit `566b553` and the
  tag `v0.6.0` are local-only. The published tarball *is* reproducible from main —
  unpacking `pincer-workflow@0.6.0` and diffing against `git archive origin/main` shows
  `bin/`, `template/`, README and LICENSE byte-identical, with `version` the only
  difference. So the code is public; the commit it was cut from is not.

Both PRDs were evaluated as one change on one candidate because v5 was never released and
v6 builds directly on it. The review was ten subagents over disjoint areas, each required
to reproduce a finding before reporting it, the fourteen most severe put to two
adversarial verifiers apiece. Thirty-two findings, thirty reproduced; thirteen confirmed
and closed by **T-79..T-86**, each with a regression test mutation-checked against its own
fix. The serious ones: piped `--json` truncated at 65,536 bytes with exit 0 on every
supported Node ([[runtime]]); the independent validator certifying three manifests it
should have refused ([[evidence-validator]]); an interrupted `migrate --apply` leaving
execution unguarded while `recover` destroyed the work done since; `coverage`
recommending commands the runtime refuses ([[one-next-action-precedence]]); the ticket
guard ignoring redirection ([[ticket-state-machine]]); and both review-packet validators
vacuous ([[delivery-benchmark]] for the trial-record corrections).

Before that: 0.5.0 (`2d244eb`, tag `v0.5.0`, 2026-09-11) shipped PRD v4's Node runtime
([[runtime-owned-verification]]); v0.4.x shipped PRD v2/v3
([[requirements-through-delivery]], [[candidate-evidence]], [[revocable-receipts]]).

## Active / next task

1. **Get the evaluation and the version onto main.** The two local commits
   (`350823e`, `566b553`) plus this session's `plugin/` rebuild need to reach `main`,
   and the tag `v0.6.0` needs pushing. Until then main's release record is PRD v4's and
   its `package.json` disagrees with npm. Local `main` is 54 commits behind
   `origin/main` — fetch before doing anything with it.
2. **Expect `stale`.** `status` reads `stale: candidate changed after evaluation:
   package.json` and will keep doing so: the bump is a post-candidate commit, and so is
   every wiki edit. The evaluated candidate `ce98abd` and its record are unaffected.
   Whether the rule should exempt a version bump is an open thread, not a thing to fix by
   loosening `notes_current` ([[candidate-evidence]]).
3. The live benchmark is honest about showing overhead with no acceptance advantage at
   n=3 per cell; do not quote it as evidence that the workflow wins. Other parked items
   are in [[open-threads]].

## Recent decisions

- [[one-next-action-precedence]] — rules 2 and 3 of the next-action precedence live in
  one module; two views of the same state drift, so delete one rather than sync them (T-80)
- [[coverage-is-authored-and-bound]] — one authored map, the PRD prose as the inventory, both inside the agreement digest; structure is reported, adequacy is judged (PRD v6)
- [[explicit-change-lifecycle]] — retained change records, explicit selection, agreement digests + user/delegated authorization, journaled transitions, change-scoped evidence, `resume` (PRD v5)

## Landmines

- The repo's own tickets are verified with a pinned released kit in the session scratchpad (v0.5.0 from tag `v0.5.0`: `pincer-ticket.sh`, `pincer-status.sh`, `pincer-runtime.cjs`, `pincer-evidence.cjs`, `pincer-runtime/*.cjs`, recreated with `git show v0.5.0:template/scripts/<file>`). Never export `CLAUDE_PROJECT_DIR` in the shell (`test/ticket.test.js` inherits it) and never pipe `verify`/`done` or a test run through `tail` before a `git commit` (the pipe masks the exit code). Run suites with output redirected to a file and check `$?`.
- **`npm version` alone breaks the build**: it bumps `package.json` only, and
  `test/distribution.test.js` asserts `plugin/.claude-plugin/plugin.json` matches. Bump
  with `--no-git-tag-version`, run `scripts/build-plugin.sh`, then commit and tag by hand.
  This bit 0.6.0 ([[distribution-channels]]).
- Any commit after the evaluated candidate other than NOTES.md + the named manifest's own listed files makes status say `stale: candidate changed after evaluation` — wiki edits and the version bump included. **The allowed set is the manifest's listed files, never a directory**, so one candidate carries one manifest; a second PRD evaluated on the same candidate puts its dispositions in NOTES.md and its own packet ([[candidate-evidence]]).
- `npm test` is 51 suites and about ten minutes; `verify`/`done` on a ticket whose check is `npm test` runs it twice. `test/delivery-benchmark.test.js` dominates (it spawns many processes and runs `npm test` inside generated candidate projects) and needs `git` and `npm` on PATH. CI is {ubuntu-latest, macos-latest} × Node {22, 24} with `fetch-depth: 0`; Node 18 and 20 are end of life, not untested.
- **Every CLI write goes through `pincer-runtime/io.cjs`** and must keep doing so; `test/runtime-output.test.js` asserts nothing else writes to a standard stream. Do not "fix" an exit path by turning `process.exit(N)` into `process.exitCode = N` — the exits are the CLI's return statements and the code below each one is the next branch of the same function ([[runtime]]).
- **Any report that renders a next action must consume `routing.cjs`**, not decide for itself ([[one-next-action-precedence]]).
- After editing `template/`, run BOTH generators (`template/scripts/sync-prompts.sh`, `scripts/build-plugin.sh`); `test/distribution.test.js` fails on stale output. `build-plugin.sh` copies `pincer-runtime.cjs` and `pincer-runtime/*.cjs`; a new module elsewhere must be added explicitly, and `bin/pincer.js` `common` must list it.
- A tree-deep scrub is not a scrub: `bdad2e0` sanitized the benchmark artifacts in the tree only and the pre-image stayed reachable from four pushed commits; history was rewritten in `2599576`. Check `git log -p`, not just the tip, before publishing collected artifacts.
- **The rewrite renamed every SHA from T-77 onward**, so any pre-rewrite SHA quoted in prose is now dead — it resolves locally only as a dangling object and not at all in a fresh clone. Two were found in this wiki (`5b0358b`→`e07faca`, `307792d`→`bdad2e0`). Re-check cited SHAs with `git merge-base --is-ancestor <sha> HEAD` rather than `git cat-file -e`, which still succeeds for unreachable objects.
- Changes mode is per project: old migrated-mode suites build fixtures with `test/helpers.js` `bindV050()` (hand-written schema 1 binding) because `register` writes schema 2; a fake changes-mode attempt must be schema 2 with `context.agreement` and a stored source manifest, or readiness reports `HISTORICAL_EVIDENCE`. Attempt records are validated field by field (`state.validateAttempt`).
- Contract tests (`test/contracts.test.js`, `test/change-contracts.test.js`, `test/coverage-contracts.test.js`) pin phrases of `template/docs/runtime-contracts.md`, some across line breaks. Both review-packet tests pin `S-NN` tags in test sources and run their `replay.sh all`; the trial-record tests pin scenario rows and artifact names. Adding a suite means updating `package.json` and the v5 packet's suite row.
- A check that writes untracked non-ignored files ends `error` (`SOURCE_CHANGED`); a kit update inside a project makes every done ticket `SOURCE_CHANGED` until re-verified; a check that exits 0 leaving a background child on the pipes is `timed_out`. `test/runtime-runner.test.js` needs `perl`.
- `test/workflow.test.js` asserts the `## Authorization rule` block is byte-identical across plan/narrow/code/evaluate — edit it in all four — and pins the T-62 sentences in `pincer-code.md`.
- Never hand-edit `status`/`started`/`last_check`/`verified`/`finished` in tickets; the guard blocks `git checkout`/`restore`/`reset --hard`/`stash` touching `tickets/` from the assistant's shell on purpose. The guard also refuses a compound `git add <protected path> && git commit -m "$(cat <<'EOF' … <email> EOF)"` (lexer false positive): split add and commit.
- Live runs: `env -u CLAUDECODE claude -p --model sonnet --permission-mode bypassPermissions --output-format json "<prompt>" < /dev/null`, one session per stage. An account usage limit turns every later session into a one-turn failure — the benchmark driver marks the run invalid and stops; do the same by hand elsewhere.
- In the Bash sandbox, `node <script> <argv ≥ ~1 KB>` is SIGKILLed (exit 137); `node -e` is not. zsh does not word-split an unquoted `$VAR` holding a command — write multi-step shell work as a `bash -c` script or a file.
- npm: 2FA; expired token shows as `E404 … PUT`; `npm whoami` then `npm login`; publish needs `--otp=<code>`; registry lags ~20 s. The user runs publish. `template/.gitignore` would be stripped by npm — never ship one.
- Codex channel = `.agents/skills/*/SKILL.md` invoked as `$pincer-*`. Multi-line text pasted into Claude Code is sent at the first line break.
