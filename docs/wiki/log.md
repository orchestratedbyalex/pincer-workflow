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

## [2026-09-02] end | v0.2.0 bump, README/site refreshed, publish left to user
- What: package.json 0.1.0 -> 0.2.0, plugin.json rebuilt at 0.2.0, marketplace.json description updated, README (six playbooks, update note) and website (release stamp v0.2.0, command/BOM wording) refreshed; commit tagged v0.2.0 and pushed with tags.
- Why: ship items 1 and 2 to npx users; publish needs the user's 2FA, and the classifier blocked `npm publish` from this session.
- Outcome: `npm pack --dry-run` shows all new files (37 files, 28 kB). Registry still at 0.1.0 until `npm publish` runs.

## [2026-09-02] end | v0.2.0 published to npm; publish-failure diagnosis
- What: user's `npm publish` failed with E404 on PUT; root cause was an expired session token (`npm whoami` → 401), fixed by `npm login` + republish. 0.2.0 now on the registry with the correct repository URL.
- Why: durable gotcha — npm reports auth failure on publish as 404, not 401.
- Files: docs/wiki only (briefing, systems/distribution-channels, open-threads).
- Outcome: stale-URL thread closed; remaining threads: dry run of the new loop, plugin install test, CI publishing, kit upstream decision, roadmap items 3–5.

## [2026-09-02] end | Codex install hint fixed after first clean dry run
- What: user's clean `npx pincer-workflow init` (Codex) failed at the printed next step — `cp` into a missing `~/.codex/prompts/` ("Not a directory"). Hint now `mkdir -p … && cp …` via a shared `CODEX_INSTALL` const; Codex docs also corrected to `/prompts:pincer-*` invocation.
- Why: Codex never creates its prompts dir, and exposes custom prompts under a `/prompts:` prefix.
- Files: bin/pincer.js, template/.codex/README.md, template/scripts/sync-prompts.sh, README.md, docs/index.html (sheet 112), test/smoke.test.js, wiki cli-installer page.
- Outcome: tests green, commit dbfa2a5; NOT yet released to npm (see open-threads).

## [2026-09-02] end | v0.2.1 bump + README per-platform sections
- What: version 0.2.1 in package.json, plugin.json (via build-plugin), website stamp; README gained Claude Code / Codex CLI / Copilot subsections with the full Codex install, `/prompts:` naming, posture and re-copy-on-update notes; `.codex/README.md` says the copy must be redone after `update`.
- Why: 0.2.0 on npm still prints the broken Codex `cp` step.
- Files: package.json, plugin/.claude-plugin/plugin.json, docs/index.html, README.md, template/.codex/README.md, wiki.
- Outcome: tests green, tag v0.2.1 created locally; publish + push left to the user (2FA).

## [2026-09-02] end | Codex adapter re-done as skills (v0.2.2)
- What: second clean Codex dry run — install ran, but `/pincer-status` was "Unrecognized". Investigation: openai/codex#16115 (2026-03-28) removed custom prompts entirely; the binary has no `/prompts:` and no prompts dir. Codex now loads `.agents/skills/<name>/SKILL.md` from the repo, invoked as `$name`.
- Why: 0.2.0 and 0.2.1 both pointed at a feature that no longer exists.
- Files: template/scripts/sync-prompts.sh (emits .agents/skills, rewrites $ARGUMENTS and /pincer-*→$pincer-*), template/.agents/skills/* (new), template/.codex/prompts/ (deleted), bin/pincer.js (codex root adds .agents, copy hint gone), template/.codex/README.md, template/AGENTS.md, dry-run-checklist, README, site sheet 112, CLAUDE.md, tests, wiki.
- Outcome: tests green, v0.2.2 tagged; publish/push left to the user.

## [2026-09-02] end | v0.2.3: canonical kit on all platforms, AGENTS.md wording
- What: user asked to fix `pincer-code` pointing at CLAUDE.md (absent on Codex-only installs); while checking, found Codex-/Copilot-only installs got none of `.claude/` although plan/narrow/evaluate load `.claude/references/*` and `.claude/agents/*` and the shipped sync script reads `.claude/commands/`. `PLATFORM_ROOTS.common` now includes those three dirs; `claude` keeps CLAUDE.md, settings.json, hooks.
- Files: template/.claude/commands/pincer-code.md, bin/pincer.js, test/smoke.test.js (codex-only tree asserted), template/.codex/README.md, README, site stamp, wiki.
- Outcome: tests green, v0.2.3 tagged; publish/push left to the user.
