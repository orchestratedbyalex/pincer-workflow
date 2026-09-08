# Briefing

**pincer-workflow** — the public distribution of PINCER, a PRD-driven agentic
delivery workflow (Plan · Investigate · Narrow · Code · Evaluate · Release).
One repo, three channels: an npx installer ([[cli-installer]]), a Claude Code
plugin marketplace, and the raw kit files ([[template-kit]],
[[distribution-channels]]).

## Current state

**Published: v0.2.3 on npm and `main` (2026-09-04).** **Unpublished: branch
`fix/m0-trust`, 16 commits ahead of main, version still 0.2.3.** M0 is the
"repair trust" milestone from `docs/pincer-assessment-2026-09-05.md` and
`docs/pincer-improvement-plan.md`: revocable verification receipts and PRD
binding ([[revocable-receipts]]), manifest schema 2 with untrusted legacy
baselines ([[never-clobber-updates]]), a Node shell lexer behind both hooks,
a read-only release audit with a general checklist
([[release-audit-read-only]]), playbooks that reuse existing authorization
and stage only explicit paths, CI on ubuntu/macos × Node 18/22, and
generated-parity plus packed-tarball tests ([[ticket-state-machine]]).
`npm test` green. Site live at https://orchestratedbyalex.github.io/pincer-workflow/
([[github-pages-site]]).

**Dry run 2026-09-08 (Sonnet, brownfield CRA repo) passed end to end**,
including every cheat that reached the kit: receipt revocation, hand-edited
status caught by validation, second PRD demoting the old candidate, update
preserving a local AGENTS.md edit. Findings and verdict in
`docs/dry-run-2026-09-08-sonnet.md` (uncommitted as of this briefing).

## Active / next task

1. Commit the dry-run doc and this wiki update on `fix/m0-trust`; merge to
   main; release as **0.3.0** via `docs/kit-maintenance-checklist.md`
   (regenerate adapters + plugin, `npm test`, `npm version minor`,
   `npm publish --otp=…` run by the user, `git push --follow-tags`).
2. Next PRD for the kit, from the dry-run findings: verification blocks must
   test behavior not identifiers; a home for visual evidence; one approval
   rule for plan/narrow; PRD weight scaled to change size (M3 small-fix
   profile). Small fixes to bundle: ticket-file restore blocked by the guard,
   "no receipt written" wording, duplicate WARN, elapsed noise on built PRDs.
3. Still untested: Copilot prompt chain in VS Code, Codex full chain, public
   plugin install.

## Recent decisions

- [[revocable-receipts]] — every verify attempt recorded; `done` re-runs the check; tickets and NOTES bound to a PRD revision
- [[release-audit-read-only]] — release reads the general checklist, runs the gate directly, never calls the ticket script
- [[never-clobber-updates]] — manifest schema 2; legacy baselines untrusted → `.new` proposals

## Landmines

- After editing `template/`, run BOTH generators (`scripts/sync-prompts.sh`,
  `scripts/build-plugin.sh`); `test/distribution.test.js` now fails on stale
  output, so `npm test` catches it before CI does.
- Hooks need Node ≥18; `block-dangerous.sh`/`ticket-guard.sh` are thin
  wrappers around `.claude/hooks/hook-policy.cjs`.
- Never hand-edit `status`/`started`/`last_check`/`verified`/`finished` in
  tickets; the guard also blocks `git checkout` of ticket files from the
  assistant's shell — the user runs repairs in their own terminal.
- Installing an unpublished build: `npx --yes --package <tgz> pincer init`;
  `npx <tgz> init` fails with "Permission denied" (bin is `pincer`).
- npm: 2FA required; an expired token shows as `E404 … PUT` — run
  `npm whoami`, then `npm login`; publish needs `--otp=<code>` from inside
  Claude Code and the registry lags ~20 s. The user runs publish (`! npm …`).
- `template/.gitignore` would be stripped by npm — never ship one.
- Codex channel = `.agents/skills/*/SKILL.md` invoked as `$pincer-*`; custom
  prompts are dead. Verify Codex features against openai/codex, not memory.
- Multi-line text pasted into Claude Code is sent at the first line break;
  write dry-run cheat instructions as single lines.
- `docs/index.html` is the website source; keep sheet 12 in step with README
  install instructions ([[github-pages-site]]).
