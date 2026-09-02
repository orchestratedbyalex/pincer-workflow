# Briefing

**pincer-workflow** — the public distribution of PINCER, a PRD-driven agentic
delivery workflow (Plan · Investigate · Narrow · Code · Evaluate · Release).
One repo, three channels: an npx installer ([[cli-installer]]), a Claude Code
plugin marketplace, and the raw kit files ([[template-kit]],
[[distribution-channels]]).

## Current state

v0.1.0 is **live on npm** (published 2026-09-01, verified end-to-end from the
registry: `npx pincer-workflow init` + `doctor` pass). The plugin channel is
built and committed (`plugin/` generated from `template/`, marketplace.json at
root) but **not yet public — the GitHub push to
`orchestratedbyalex/pincer-workflow` is pending** (repo URL already updated in
package.json/README/CLI). Smoke test green (`npm test`). Extracted from the
private `lead-engineer-role-alexander` repo, minus the confidential brief and
the personal /llm-wiki section.

## Active / next task

User pushes to GitHub (`gh repo create pincer-workflow --public --source .
--push`), then: test the public plugin install, optionally a GitHub Actions
trusted-publishing workflow, and `npm version patch && npm publish` to fix the
stale repository URL inside the published 0.1.0 metadata.

## Recent decisions

- [[single-source-template]] — template/ is canonical; adapters and plugin are generated
- [[never-clobber-updates]] — hash manifest in .pincer.json; edited files get `.new` sidecars

## Landmines

- npm publishing requires 2FA on the account (403 otherwise) — enabled 2026-09-01.
- The bare npm name `pincer` is taken; the package is `pincer-workflow`, the
  plugin (and its command namespace) is `pincer` → `/pincer:plan`.
- Dot-directories inside `template/` DO survive `npm pack`, but a
  `template/.gitignore` would be silently stripped by npm — never ship one;
  `init` writes .gitignore lines programmatically instead ([[cli-installer]]).
- After editing `template/`, always run BOTH generators:
  `scripts/sync-prompts.sh` and `scripts/build-plugin.sh` — the smoke test
  does not catch stale generated output.
- The private lead-engineer-role-alexander repo still holds its own copy of
  the kit; no back-sync mechanism exists yet ([[template-kit]]).
