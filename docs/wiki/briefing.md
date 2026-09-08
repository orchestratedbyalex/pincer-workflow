# Briefing

**pincer-workflow** — the public distribution of PINCER, a PRD-driven agentic
delivery workflow (Plan · Investigate · Narrow · Code · Evaluate · Release).
One repo, three channels: an npx installer ([[cli-installer]]), a Claude Code
plugin marketplace, and the raw kit files ([[template-kit]],
[[distribution-channels]]).

## Current state

**v0.3.0 is on npm and tagged on `main`. PRD v2 is implemented on branch
`feat/prd-v2` (2026-09-08), tickets T-11..T-21 all done, `npm test` green.**
The first evaluation candidate (2952e62) was rejected by its code-quality review
(six findings: subdirectory and non-ASCII paths made `notes_current` false-stale,
usage errors leaked as evidence verdicts, 64-hex mismatch, unchecked `base`,
whole-tree restores unguarded) and two trial scenarios were unobserved; T-21 fixed
the six and two focused trials covered the scenarios. The superseded record lives in
`.prd/evidence/prd-v2/2952e62…/` without a manifest.
PRD v2 ("Make requirements and release evidence reviewable", `.prd/prd-v2.md`)
is the bounded bridge toward M1/M2 of `docs/pincer-improvement-plan.md`:
stable requirement IDs from plan to evaluation, `Proves:` behavioral checks,
`profile: small|standard`, one shared authorization rule
([[requirements-through-delivery]]); evidence schema 1 under
`.prd/evidence/prd-vN/<candidate>/` validated by the new
`template/scripts/pincer-evidence.cjs` ([[evidence-validator]]) and enforced by
`notes_current`, with the PRD built commit preceding the candidate
([[candidate-evidence]]); recovery and status fixes (T-17). Two live Sonnet
trials in print mode passed end to end (`docs/trial-2026-09-08-greenfield.md`,
`docs/trial-2026-09-08-brownfield.md`); their three findings were fixed in T-20.

## Active / next task

1. On `feat/prd-v2`: `PRD v2: built` commit → `/pincer-evaluate` on this repo
   (evidence under `.prd/evidence/prd-v2/<candidate>/`, NOTES.md with
   `evidence:`) → `/pincer-release` → merge to `main` → `npm version minor`
   (0.4.0; schema 1 evidence and the `profile` field are additive) → publish
   (user-run `! npm publish --otp=…`) → `git push --follow-tags`.
2. Update `docs/index.html` sheet text if the README install/usage story changed
   ([[github-pages-site]]); README already documents the evidence helper.
3. Still untested: Copilot prompt chain in VS Code, Codex full chain, public
   plugin install, an interactive (question-answering) trial.

## Recent decisions

- [[candidate-evidence]] — schema 1 manifest + artifacts per candidate; only NOTES.md and listed files may change after the candidate; legacy notes never release-ready
- [[requirements-through-delivery]] — `R-NN` IDs plan→narrow→evaluate; `Proves:` checks that fail on wrong behavior; `profile`; identical authorization block in four playbooks
- [[revocable-receipts]] — every verify attempt recorded; `done` re-runs the check; tickets and NOTES bound to a PRD revision

## Landmines

- After editing `template/`, run BOTH generators (`scripts/sync-prompts.sh`,
  `scripts/build-plugin.sh`); `test/distribution.test.js` fails on stale output.
  `build-plugin.sh` must copy any new script explicitly (it did for
  `pincer-evidence.cjs`), and `bin/pincer.js` `common` must list it.
- Any commit after the evaluated candidate other than NOTES.md + listed evidence
  makes status say `stale: candidate changed after evaluation: <path>` — wiki
  edits included. Do wiki `end` before the built commit, not after evaluate.
- `test/workflow.test.js` asserts the `## Authorization rule` block is
  byte-identical across plan/narrow/code/evaluate — edit it in all four.
- Never hand-edit `status`/`started`/`last_check`/`verified`/`finished` in
  tickets; the guard blocks `git checkout`/`restore` of ticket files from the
  assistant's shell on purpose (R-06) — the user repairs in their own terminal.
- Live trials: `claude -p --model sonnet --permission-mode bypassPermissions`
  with `env -u CLAUDECODE`, one session per stage, throwaway repo from the
  packed tarball (`npx --yes --package <tgz> pincer init --platform claude`).
  Brownfield init leaves `AGENTS.md.new`; merge it before the trial.
- npm: 2FA; expired token shows as `E404 … PUT`; `npm whoami` then `npm login`;
  publish needs `--otp=<code>`; registry lags ~20 s. The user runs publish.
- `template/.gitignore` would be stripped by npm — never ship one.
- Codex channel = `.agents/skills/*/SKILL.md` invoked as `$pincer-*`.
- Multi-line text pasted into Claude Code is sent at the first line break;
  write dry-run cheat instructions as single lines.
