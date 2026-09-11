# Briefing

**pincer-workflow** — the public distribution of PINCER, a PRD-driven agentic
delivery workflow (Plan · Investigate · Narrow · Code · Evaluate · Release).
One repo, three channels: an npx installer ([[cli-installer]]), a Claude Code
plugin marketplace, and the raw kit files ([[template-kit]],
[[distribution-channels]]).

## Current state

**PRD v4 ("Record verification automatically and invalidate stale evidence",
`.prd/prd-v4.md`, `profile: standard`) is fully implemented on `feat/prd-v4`
(2026-09-11, T-29..T-44) and built (`PRD v4: built`); the review of the first
candidate `7b561b1` produced T-44 (eighteen fixes), and the final candidate is the
wiki commit on top of it. Evaluation evidence (schema 1 via the pinned v0.4.1 kit),
NOTES.md and the release audit follow; then merge, the 0.5.0 bump and publish; v0.4.1
is still unpublished.** The kit now has a Node runtime
([[runtime]], decision [[runtime-owned-verification]]): `scripts/pincer-runtime.cjs`
+ `scripts/pincer-runtime/` own the ticket lifecycle, readiness, status (`--json`),
change registration (`.prd/changes/<id>.json`), the SHA-256 source manifest,
verification attempts with sanitized captured logs under the ignored
`.pincer/runtime/`, locking and `recover`, explicit `migrate --preview|--apply` with
backups, candidate `check`s and evidence schema 2 export. `pincer-ticket.sh` and
`pincer-status.sh` are wrappers; `pincer-ticket-lib.sh` is gone. Unmigrated projects
keep the v0.4.1 receipt contract. The contract is `template/docs/runtime-contracts.md`;
the review packet for the user's later check is `docs/prd-v4-review-packet.md` with
`docs/prd-v4-artifacts/`; the live trial is `docs/trial-2026-09-11-prd-v4.md`
(greenfield chain on the runtime passed release with schema 2 evidence; migration,
repair, interruption and service-failure scenarios observed; v0.4.1 baseline for two
scenarios). Two trial findings became T-42 (register/migrate steps in the playbooks)
and T-43 (`register` ignores `.pincer/`).

Before PRD v4: v0.4.1 (`1cb5ab4`, tagged locally, unpublished) shipped PRD v3's wording
fixes; PRD v2 (v0.4.0) shipped requirement IDs, behavioral checks, candidate evidence
schema 1 and the read-only release audit ([[requirements-through-delivery]],
[[candidate-evidence]], [[revocable-receipts]]).

## Active / next task

1. Evaluation of the final candidate with the pinned v0.4.1 kit (this repo is
   deliberately not migrated, PRD v4 §9): schema 1 manifest under
   `.prd/evidence/prd-v4/<candidate>/`, `review/code-quality.md` (two subagent
   reports with dispositions), NOTES.md, the evidence commit; then `/pincer-release`.
2. Merge `feat/prd-v4` into main, bump 0.5.0 (`--no-git-tag-version`, rebuild plugin,
   commit, annotated tag), publish (user runs `npm publish --otp`), push
   `--follow-tags`, confirm CI on ubuntu/macOS × Node 18/22.
3. Follow-ups (PRD v4 §10): lifecycle/resume, coverage impact, platform parity; trial the
   runtime on Codex, Copilot and the plugin.

## Recent decisions

- [[runtime-owned-verification]] — Node runtime records source-bound attempts; `done` consumes the current pass; evidence schema 2 exported from attempts; explicit migration
- [[candidate-evidence]] — schema 1 manifest + artifacts per candidate; only NOTES.md and listed files may change after the candidate; legacy notes never release-ready
- [[requirements-through-delivery]] — `R-NN` IDs plan→narrow→evaluate; `Proves:` checks that fail on wrong behavior; `profile`; identical authorization block in four playbooks
- [[revocable-receipts]] — every verify attempt recorded; `done` re-runs the check; tickets and NOTES bound to a PRD revision

## Landmines

- The repo's own tickets (T-29..T-43) were verified with a pinned v0.4.1 kit copied from `1cb5ab4` into the session scratchpad; recreate it with `git show 1cb5ab4:template/scripts/<file>`. Never export `CLAUDE_PROJECT_DIR` in the shell (`test/ticket.test.js` inherits it) and never pipe `verify`/`done` through `tail` before a `git commit` (the pipe masks the exit code).
- A check that writes untracked non-ignored files ends `error` (`SOURCE_CHANGED`); a kit update inside a migrated project makes every done ticket `SOURCE_CHANGED` until re-verified.
- After editing `template/`, run BOTH generators (`scripts/sync-prompts.sh`,
  `scripts/build-plugin.sh`); `test/distribution.test.js` fails on stale output.
  `build-plugin.sh` copies `pincer-runtime.cjs` and `pincer-runtime/*.cjs`; a new module elsewhere must be added explicitly, and `bin/pincer.js`
  `common` must list it. `npm version` alone leaves `plugin/.claude-plugin/
  plugin.json` stale — bump with `--no-git-tag-version`, rebuild, then commit
  and tag by hand (`v0.N.0: …`, annotated tag), as v0.3.0 and v0.4.0 did.
- Any commit after the evaluated candidate other than NOTES.md + listed evidence
  makes status say `stale: candidate changed after evaluation: <path>` — wiki
  edits and the version bump included. Do wiki `end` before the built commit.
- `test/workflow.test.js` asserts the `## Authorization rule` block is
  byte-identical across plan/narrow/code/evaluate — edit it in all four.
- Never hand-edit `status`/`started`/`last_check`/`verified`/`finished` in
  tickets; the guard blocks `git checkout`/`restore`/`reset --hard`/`stash` and
  wrapped forms touching `tickets/` from the assistant's shell on purpose (R-06)
  — the user repairs in their own terminal.
- Live trials: `claude -p --model sonnet --permission-mode bypassPermissions`
  with `env -u CLAUDECODE`, one session per stage, throwaway repo from the
  packed tarball (`npx --yes --package <tgz> pincer init --platform claude`).
  Brownfield init leaves `AGENTS.md.new`; merge it before the trial. The prompt
  must precede variadic flags such as `--mcp-config`. Interactive variant: the
  user drives `claude --model sonnet` in the fixture; audit from a second
  terminal with `npm test` and `pincer-status.sh`, never `pincer-ticket.sh
  verify` (it re-stamps receipts on success too); the fixture's session
  transcript under `~/.claude/projects/` answers most record questions.
- npm: 2FA; expired token shows as `E404 … PUT`; `npm whoami` then `npm login`;
  publish needs `--otp=<code>`; registry lags ~20 s. The user runs publish.
- `template/.gitignore` would be stripped by npm — never ship one.
- Codex channel = `.agents/skills/*/SKILL.md` invoked as `$pincer-*`.
- Multi-line text pasted into Claude Code is sent at the first line break;
  write dry-run cheat instructions as single lines.
