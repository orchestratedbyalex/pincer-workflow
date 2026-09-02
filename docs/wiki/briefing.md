# Briefing

**pincer-workflow** — the public distribution of PINCER, a PRD-driven agentic
delivery workflow (Plan · Investigate · Narrow · Code · Evaluate · Release).
One repo, three channels: an npx installer ([[cli-installer]]), a Claude Code
plugin marketplace, and the raw kit files ([[template-kit]],
[[distribution-channels]]).

## Current state

v0.1.0 is **live on npm** (published 2026-09-01, verified end-to-end from the
registry: `npx pincer-workflow init` + `doctor` pass). The repo is **public on
GitHub** (`orchestratedbyalex/pincer-workflow`, pushed 2026-09-02), so the
plugin marketplace channel is reachable. The **website is live** at
https://orchestratedbyalex.github.io/pincer-workflow/ (GitHub Pages from
`main:/docs`, linked from README, set as repo homepage — [[github-pages-site]]). Smoke + ticket lifecycle tests green (`npm test`). **v0.2.0 is tagged and pushed** (2026-09-02:
ticket state machine, status report, guard hook, `/pincer-status`) but
**`npm publish` is pending** — the registry still serves 0.1.0 until the user
publishes with their 2FA code. Extracted from the
private `lead-engineer-role-alexander` repo, minus the confidential brief and
the personal /llm-wiki section.

## Active / next task

User runs `npm publish` (2FA) for the already-tagged v0.2.0 so npx users get
the state machine — this also fixes the stale repository URL in 0.1.0 metadata.
Then a dry run of the full chain on a toy repo to shake out the new loop, test
the public plugin install, and consider items 3–5 of the improvement list
(size tracks, test-first tickets, learning loop back into AGENTS.md).

## Recent decisions

- [[mechanical-done]] — `done` needs a script-stamped receipt from a green check; hook enforces on Claude Code ([[ticket-state-machine]])
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
- Ticket state fields are hook-protected: never hand-edit `status`/`started`/
  `verified`/`finished` in tickets — use `scripts/pincer-ticket.sh`. The
  ticket template must not contain those keys ([[ticket-state-machine]]).
- `docs/index.html` is the website source now, not the Claude artifact it
  came from. Sheet 112 (installation) must be kept in step with the README's
  install instructions ([[github-pages-site]]).
