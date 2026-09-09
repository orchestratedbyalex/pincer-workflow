# Briefing

**pincer-workflow** — the public distribution of PINCER, a PRD-driven agentic
delivery workflow (Plan · Investigate · Narrow · Code · Evaluate · Release).
One repo, three channels: an npx installer ([[cli-installer]]), a Claude Code
plugin marketplace, and the raw kit files ([[template-kit]],
[[distribution-channels]]).

## Current state

**v0.4.0 is published on npm, tagged and pushed on `main` (2026-09-09);
CI is green for both the `main` and `v0.4.0` runs.**
PRD v2 ("Make requirements and release evidence reviewable", `.prd/prd-v2.md`,
`profile: standard`) shipped as T-11..T-23: stable `R-NN` requirement IDs from
plan to evaluation, `Proves:` behavioral checks, `profile: small|standard`, one
shared authorization rule ([[requirements-through-delivery]]); evidence schema 1
under `.prd/evidence/prd-vN/<candidate>/` validated by
`template/scripts/pincer-evidence.cjs` ([[evidence-validator]]) and enforced by
`notes_current`; a read-only release audit ([[candidate-evidence]]); recovery
and status fixes plus a normalized whole-tree restore guard in
`hook-policy.cjs` (233 payloads under test). The first candidate (2952e62) was
rejected on review; T-21..T-23 fixed the findings from two saved review
artifacts. Candidate `72d2d8b` was evaluated (`6518cfb`, manifest `ok`) and
passed the release audit; the v0.4.0 bump commit sits on top of it, so
`pincer-status` now reports `stale: candidate changed after evaluation:
package.json` by design. Two live Sonnet trials plus two focused follow-ups
passed (`docs/trial-2026-09-08-*.md`). `docs/index.html` no longer claims a
two-hour timebox and lists the evidence validator.

## Active / next task

1. Nothing in flight. Next PRD candidates (`docs/pincer-improvement-plan.md`): M1 runtime that
   absorbs `notes_current` and writes the reviewer transcript itself; an
   interactive (question-answering) trial; a Codex run of the full chain.
2. Still untested: Copilot prompt chain in VS Code, public plugin install.

## Recent decisions

- [[candidate-evidence]] — schema 1 manifest + artifacts per candidate; only NOTES.md and listed files may change after the candidate; legacy notes never release-ready
- [[requirements-through-delivery]] — `R-NN` IDs plan→narrow→evaluate; `Proves:` checks that fail on wrong behavior; `profile`; identical authorization block in four playbooks
- [[revocable-receipts]] — every verify attempt recorded; `done` re-runs the check; tickets and NOTES bound to a PRD revision

## Landmines

- After editing `template/`, run BOTH generators (`scripts/sync-prompts.sh`,
  `scripts/build-plugin.sh`); `test/distribution.test.js` fails on stale output.
  `build-plugin.sh` must copy any new script explicitly, and `bin/pincer.js`
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
  must precede variadic flags such as `--mcp-config`.
- npm: 2FA; expired token shows as `E404 … PUT`; `npm whoami` then `npm login`;
  publish needs `--otp=<code>`; registry lags ~20 s. The user runs publish.
- `template/.gitignore` would be stripped by npm — never ship one.
- Codex channel = `.agents/skills/*/SKILL.md` invoked as `$pincer-*`.
- Multi-line text pasted into Claude Code is sent at the first line break;
  write dry-run cheat instructions as single lines.
