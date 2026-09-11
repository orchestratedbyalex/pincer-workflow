# Briefing

**pincer-workflow** — the public distribution of PINCER, a PRD-driven agentic
delivery workflow (Plan · Investigate · Narrow · Code · Evaluate · Release).
One repo, three channels: an npx installer ([[cli-installer]]), a Claude Code
plugin marketplace, and the raw kit files ([[template-kit]],
[[distribution-channels]]).

## Current state

**v0.4.1 is bumped and tagged locally (2026-09-11) on top of the PRD v3
evaluation; `npm publish` and `git push --follow-tags` are pending, so the
registry still serves 0.4.0.** PRD v3 (`.prd/prd-v3.md`, `profile: small`,
T-24..T-28) shipped three wording fixes from the interactive trial: the code
playbook's recovery exception (tree back at the evaluated candidate, ticket
file excepted, check passes directly → the user restores the ticket, nothing
is verified or committed; [[revocable-receipts]] addendum), evaluate's one
check per command with the command line as run, and plan asking only the open
part of a partly answered question. The first candidate `7c19e42` was rejected
on four wording findings (the exception's second condition was literally
unsatisfiable); T-28 fixed them; candidate `a10358e` evaluated (`8cc6299`,
manifest `ok`) and passed release. `docs/trial-2026-09-10-prd-v3.md` records
the live eligible case (Sonnet `-p`, packed kit in a fixture copy) and the
negative case as outstanding: the injected `npm` shim was found and bypassed.
Because the bump commit follows the evaluation, `pincer-status` reports
`stale: candidate changed after evaluation: package.json` by design.

Before v0.4.1: PRD v2 ("Make requirements and release evidence reviewable", `.prd/prd-v2.md`,
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
passed (`docs/trial-2026-09-08-*.md`). The first interactive trial on the
published 0.4.0 package (2026-09-10, `docs/trial-2026-09-10-interactive.md`)
passed release: plan asked three real questions, narrow did not re-ask, the
reviewer's two bugs went through a fix ticket to a new candidate, and the
R-06 failed recheck and the evidence digest check were observed live. Its one
finding: after a hand repair the assistant committed a receipt refresh on its
own, which made a second evaluation necessary. `docs/index.html` no longer
claims a two-hour timebox and lists the evidence validator.

## Active / next task

1. Publish v0.4.1 (`npm publish --otp=<code>`, user-run) and `git push
   --follow-tags`; confirm CI. Then next PRD candidates
   (`docs/pincer-improvement-plan.md`): M1 runtime that absorbs `notes_current`,
   captures command logs itself and writes the reviewer transcript; a small
   follow-up tightening the recovery exception ("run directly" in which
   environment; the recorded failure must be explained by a since-reverted tree
   change) plus a fixture with an external dependency so the negative scenario
   can be observed; a Codex run of the full chain.
2. Still untested: interrupt-and-resume, a new decision during narrow, R-03
   live, the R-01 negative and remaining-source-changes scenarios, Copilot
   prompt chain in VS Code, public plugin install.

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
