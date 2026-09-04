# Briefing

**pincer-workflow** — the public distribution of PINCER, a PRD-driven agentic
delivery workflow (Plan · Investigate · Narrow · Code · Evaluate · Release).
One repo, three channels: an npx installer ([[cli-installer]]), a Claude Code
plugin marketplace, and the raw kit files ([[template-kit]],
[[distribution-channels]]).

## Current state

**v0.2.3 is live on npm and pushed (2026-09-04)** (0.2.0–0.2.2 went live 2026-09-02; 0.1.0 was verified
end-to-end from the registry the day before). The repo is **public on
GitHub** (`orchestratedbyalex/pincer-workflow`, pushed 2026-09-02), so the
plugin marketplace channel is reachable. The **website is live** at
https://orchestratedbyalex.github.io/pincer-workflow/ (GitHub Pages from
`main:/docs`, linked from README, set as repo homepage — [[github-pages-site]]). Smoke + ticket lifecycle tests green (`npm test`). 0.2.0 adds the ticket state
machine, status report, guard hook and `/pincer-status`; its metadata carries
the correct repository URL. Extracted from the
private `lead-engineer-role-alexander` repo, minus the confidential brief and
the personal /llm-wiki section.

## Active / next task

**Dry-run 0.2.3 on Copilot and Codex in a brownfield repo.** 0.2.3 was published and pushed on 2026-09-04
(publish needed `npm login` first — the npm token had lapsed, and npm reports an
unauthenticated publish as a 404 on the package; the registry took ~20 s to show
the new version after `PUT 202`). 0.2.2 made the Codex channel repo-local
skills (`.agents/skills/`, `$pincer-plan <brief>`) and the user confirmed
they load. 0.2.3 ships `.claude/commands|agents|references` on every
platform (Codex-only installs lacked the templates narrow/plan load) and
fixes `pincer-code` citing CLAUDE.md instead of AGENTS.md. The user is now
testing the Copilot channel in a brownfield repo (needs `npx pincer-workflow@latest update`
there, since it was installed from 0.2.2). Then continue the dry run of the full chain on a toy repo (Claude Code
and Codex), test the public plugin install, and consider items 3–5 of the
improvement list (size tracks, test-first tickets, learning loop into AGENTS.md).

## Recent decisions

- [[mechanical-done]] — `done` needs a script-stamped receipt from a green check; hook enforces on Claude Code ([[ticket-state-machine]])
- [[single-source-template]] — template/ is canonical; adapters and plugin are generated
- [[never-clobber-updates]] — hash manifest in .pincer.json; edited files get `.new` sidecars

## Landmines

- npm publishing requires 2FA on the account (403 otherwise) — enabled 2026-09-01.
  An **expired npm session token shows up as `E404 Not Found - PUT`** on publish,
  not as 401: check `npm whoami` first, then `npm login` (seen 2026-09-02).
  `npm publish` is also blocked by the Claude Code auto-mode classifier — the
  user runs it (`! npm login`, `! npm publish`).
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
- Ticket state fields are hook-protected: never hand-edit `status`/`started`/
  `verified`/`finished` in tickets — use `scripts/pincer-ticket.sh`. The
  ticket template must not contain those keys ([[ticket-state-machine]]).
- Codex has NO custom prompts any more (`~/.codex/prompts/`, `/prompts:` are
  dead since 2026-03); the channel is `.agents/skills/*/SKILL.md`, invoked as
  `$pincer-*`. Verify Codex features against the openai/codex repo, not memory
  or search snippets ([[cli-installer]]).
- `docs/index.html` is the website source now, not the Claude artifact it
  came from. Sheet 112 (installation) must be kept in step with the README's
  install instructions ([[github-pages-site]]).
