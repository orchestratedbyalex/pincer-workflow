# Briefing

**pincer-workflow** — the public distribution of PINCER, a PRD-driven agentic
delivery workflow (Plan · Investigate · Narrow · Code · Evaluate · Release).
One repo, three channels: an npx installer ([[cli-installer]]), a Claude Code
plugin marketplace, and the raw kit files ([[template-kit]],
[[distribution-channels]]).

## Current state

**PRD v5 ("Preserve changes, authorization, and resume context", `.prd/prd-v5.md`)
is fully implemented and built on `feat/prd-v5` (2026-09-11/12, T-47..T-62, base
`9bcf8df` = main at v0.5.0). Not evaluated, not merged, not released.** The runtime
([[runtime]], decision [[explicit-change-lifecycle]]) now keeps one schema 2 change
record per change under `.prd/changes/` (agreements `G-NN`, authorizations `A-NN`,
decisions `D-NN`, lifecycle events, evaluation references) written only in journaled
transactions; every worktree selects its change (`change select`); an agreement is an
exact projection digest that a `user` or `delegated` authorization is recorded against;
execution is gated (records → selection → wrong change → lifecycle → base → decision →
authorization); attempts and candidate checks are change-scoped; `resume` prints the
fresh-session report with one next action; legacy and v0.5.0 projects keep working until
`migrate --apply`. Review material for the user's check: `docs/prd-v5-review-packet.md`
(R/S traceability with `S-NN` tags in the tests, eight executable replay cases in
`docs/prd-v5-artifacts/replay.sh`, sanitized records), `docs/trial-prd-v5.md`
(greenfield/brownfield A/B/A handoffs pass; changed-scope block held, agent residual
disclosed; interruption recovered; v0.5.0 baseline needed 2 binding deletions and 2
re-typed approvals where the runtime needed none). Full `npm test` (36 suites) green
locally through the pinned v0.5.0 kit; generators in parity; CI not run on the branch.

Before PRD v5: 0.5.0 (`2d244eb`, tag `v0.5.0`, published 2026-09-11) shipped PRD v4's
Node runtime ([[runtime-owned-verification]]: source-bound attempts, evidence schema 2,
explicit migration; `docs/prd-v4-review-packet.md`, `docs/trial-2026-09-11-prd-v4.md`).
Earlier: v0.4.x PRD v2/v3 ([[requirements-through-delivery]], [[candidate-evidence]],
[[revocable-receipts]]).

## Active / next task

1. User actions on `feat/prd-v5`: read the review packet; `/pincer-evaluate` with the
   pinned v0.5.0 kit (this repo stays legacy; schema 2 manifest under
   `.prd/evidence/prd-v5/<candidate>/`); push for CI (ubuntu/macOS × Node 18/22); then
   release (fast-forward to main, `npm version` by hand as before, publish with 2FA).
   Findings from review go through new tickets (T-63+), never edits to done tickets.
2. Open runtime follow-ups: the trial residual (an agent recorded an authorization from
   a generic instruction before raising the decision) and the guard's heredoc false
   positive — see [[open-threads]].

## Recent decisions

- [[explicit-change-lifecycle]] — retained change records, explicit selection, agreement digests + user/delegated authorization, journaled transitions, change-scoped evidence, `resume` (PRD v5)
- [[runtime-owned-verification]] — Node runtime records source-bound attempts; `done` consumes the current pass; evidence schema 2; explicit migration (PRD v4)
- [[candidate-evidence]] — schema 1 manifest + artifacts per candidate; only NOTES.md and listed files may change after the candidate (PRD v2)

## Landmines

- The repo's own tickets are verified with a pinned released kit in the session scratchpad (v0.5.0 from tag `v0.5.0`: `pincer-ticket.sh`, `pincer-status.sh`, `pincer-runtime.cjs`, `pincer-evidence.cjs`, `pincer-runtime/*.cjs`, recreated with `git show v0.5.0:template/scripts/<file>`). Never export `CLAUDE_PROJECT_DIR` in the shell (`test/ticket.test.js` inherits it) and never pipe `verify`/`done` or a test run through `tail` before a `git commit` (the pipe masks the exit code). Run suites with output redirected to a file and check `$?`.
- Any commit after the evaluated candidate other than NOTES.md + listed evidence makes status say `stale: candidate changed after evaluation` — wiki edits and the version bump included. Do wiki `end` before the built commit; the built commit precedes the candidate.
- After editing `template/`, run BOTH generators (`template/scripts/sync-prompts.sh`, `scripts/build-plugin.sh`); `test/distribution.test.js` fails on stale output. `build-plugin.sh` copies `pincer-runtime.cjs` and `pincer-runtime/*.cjs`; a new module elsewhere must be added explicitly, and `bin/pincer.js` `common` must list it. `npm version` alone leaves `plugin/.claude-plugin/plugin.json` stale — bump with `--no-git-tag-version`, rebuild, then commit and tag by hand.
- Changes mode is per project: old migrated-mode suites build fixtures with `test/helpers.js` `bindV050()` (hand-written schema 1 binding) because `register` writes schema 2; a fake changes-mode attempt must be schema 2 with `context.agreement` and a stored source manifest, or readiness reports `HISTORICAL_EVIDENCE`. Attempt records are validated field by field (`state.validateAttempt`).
- Contract tests (`test/contracts.test.js`, `test/change-contracts.test.js`) pin phrases of `template/docs/runtime-contracts.md`, some across line breaks; the review-packet test pins `S-NN` tags in test sources and runs `replay.sh all` (~1 min); the trial-record test pins scenario rows and artifact names.
- A check that writes untracked non-ignored files ends `error` (`SOURCE_CHANGED`); a kit update inside a project makes every done ticket `SOURCE_CHANGED` until re-verified; a check that exits 0 leaving a background child on the pipes is `timed_out`. `test/runtime-runner.test.js` needs `perl`.
- `test/workflow.test.js` asserts the `## Authorization rule` block is byte-identical across plan/narrow/code/evaluate — edit it in all four — and pins the T-62 sentences in `pincer-code.md`.
- Never hand-edit `status`/`started`/`last_check`/`verified`/`finished` in tickets; the guard blocks `git checkout`/`restore`/`reset --hard`/`stash` touching `tickets/` from the assistant's shell on purpose. The guard also refuses a compound `git add <protected path> && git commit -m "$(cat <<'EOF' … <email> EOF)"` (lexer false positive): split add and commit.
- Live trials: `env -u CLAUDECODE claude -p --model sonnet --permission-mode bypassPermissions --output-format text "<prompt>" < /dev/null`, one session per stage, fixture from the packed tarball (`npx --yes --package <tgz> pincer init|update --platform claude`; remove `AGENTS.md.new`). Use `"test": "node --test"` (a bare `test/` dir arg fails on Node 22.23) and never pre-author a later ticket's test file. Verify a repack landed (`grep -c` a new sentence) before rerunning a scenario; a zsh glob with no match aborts the whole command line. Transcripts under `~/.claude/projects/<fixture slug>/`.
- In the Bash sandbox, `node <script> <argv ≥ ~1 KB>` is SIGKILLed (exit 137); `node -e` is not; tests exercise long-input bounds through the module API.
- npm: 2FA; expired token shows as `E404 … PUT`; `npm whoami` then `npm login`; publish needs `--otp=<code>`; registry lags ~20 s. The user runs publish. `template/.gitignore` would be stripped by npm — never ship one.
- Codex channel = `.agents/skills/*/SKILL.md` invoked as `$pincer-*`. Multi-line text pasted into Claude Code is sent at the first line break.
