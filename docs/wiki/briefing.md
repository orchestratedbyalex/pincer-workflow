# Briefing

**pincer-workflow** — the public distribution of PINCER, a PRD-driven agentic
delivery workflow (Plan · Investigate · Narrow · Code · Evaluate · Release).
One repo, three channels: an npx installer ([[cli-installer]]), a Claude Code
plugin marketplace, and the raw kit files ([[template-kit]],
[[distribution-channels]]).

## Current state

**v0.3.0 is tagged and pushed on `main` (2026-09-08); npm publish pending
(user runs `! npm publish --otp=<code>`).** `fix/m0-trust` is merged
(fast-forward). M0 is the
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
`docs/dry-run-2026-09-08-sonnet.md`. `.prd/prd-v2.md` (draft, 2026-09-08)
turns those findings into R-01..R-06; earlier tickets T-01..T-10 belong to
PRD v1 and show as history in `pincer-status.sh`.

## Active / next task

1. Publish 0.3.0 to npm (`npm whoami` → `npm publish --otp=…`, user-run),
   confirm the registry shows 0.3.0, confirm the CI matrix is green for the
   v0.3.0 commit (`gh run list --workflow=ci.yml`).
2. `/pincer-narrow` on `.prd/prd-v2.md`: behavioral verification blocks,
   `.prd/evidence/prd-vN/` for evaluate/release, one approval rule for
   plan/narrow, `profile: small|standard`, five small script/guard fixes,
   dry-run checklist rewrite.
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
