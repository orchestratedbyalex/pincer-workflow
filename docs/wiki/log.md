# Log

## [2026-09-02] init | Wiki initialized

Scaffolded at extraction+publish time. Repo state: v0.1.0 live on npm
(verified from the registry), plugin channel built (`plugin/` generated,
marketplace.json at root), GitHub push pending. Seeded systems pages for the
CLI installer, the template kit, and the distribution channels, plus decision
pages for single-source generation and never-clobber updates. Files:
docs/wiki/* created; CLAUDE.md note appended.

## [2026-09-02] end | Website published via GitHub Pages
- What: converted the PINCER Claude artifact (12-sheet deck) into docs/index.html + docs/.nojekyll; enabled Pages (main:/docs); README links the site; repo homepage set.
- Why: user wanted the site public and discoverable from the repo.
- Files: docs/index.html, docs/.nojekyll, README.md (also pushed the 3 pending local commits).
- Outcome: https://orchestratedbyalex.github.io/pincer-workflow/ returns 200, Pages build status "built". Sheet 112 rewritten to the npx/plugin install path.

## [2026-09-02] end | Mechanical done + explicit state (improvement items 1 and 2)
- What: scripts/pincer-ticket.sh (start/verify/done, receipts), scripts/pincer-status.sh, .claude/hooks/ticket-guard.sh, /pincer-status command; code loop rewritten around them; every playbook opens with the status script; template, AGENTS.md, checklist, Codex README, installer, plugin builder, README, website updated.
- Why: "done" was an agent assertion and elapsed time a model estimate; now both come from the harness/clock.
- Files: template/scripts/*, template/.claude/hooks/ticket-guard.sh, template/.claude/commands/*.md, bin/pincer.js, scripts/build-plugin.sh, test/ticket.test.js, README.md, docs/index.html, plugin/ + adapters regenerated.
- Outcome: npm test green (smoke + lifecycle, incl. hook block/allow cases); not yet released to npm.
