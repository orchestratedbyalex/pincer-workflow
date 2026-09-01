# PINCER — PRD-Driven Agentic Delivery Workflow

**P**lan · **I**nvestigate · **N**arrow · **C**ode · **E**valuate · **R**elease

A lean, PRD-first workflow for AI coding agents — Claude Code, Codex CLI, and
GitHub Copilot. One idea goes from brief to reviewed, verified code through five
commands, and every step leaves an auditable artifact: a PRD, tickets, one
commit per ticket, review notes, and a pass/fail release audit.

## Install

```bash
cd your-project
npx pincer-workflow init     # asks which platform(s) you use
```

Then follow the chain — identical on every platform:

```
/pincer-plan <brief>  →  /pincer-narrow  →  /pincer-code  →  /pincer-evaluate  →  /pincer-release
```

Per-platform notes printed by `init`:

- **Claude Code** — works immediately; commands, subagents, permission deny
  rules, and a destructive-command hook install to `.claude/`.
- **Codex CLI** — rules load natively from `AGENTS.md`; copy the prompts once:
  `cp .codex/prompts/*.md ~/.codex/prompts/` (posture notes in `.codex/README.md`).
- **Copilot (VS Code)** — enable `"chat.promptFiles": true`, then run
  `/pincer-plan` in chat; `.github/copilot-instructions.md` is wired to `AGENTS.md`.

## Claude Code plugin (alternative)

Claude users can install PINCER as a plugin instead — commands arrive
namespaced (`/pincer:plan` … `/pincer:release`) and update automatically
through the marketplace:

```
/plugin marketplace add lexanderg/pincer-workflow
/plugin install pincer@pincer-workflow
```

Pick one channel per project: the plugin makes the commands, subagents, and
the guardrail hook available everywhere, while `npx pincer-workflow init`
installs everything project-locally *plus* the repo-side files (`AGENTS.md`
rules, `.env` deny rules in `.claude/settings.json`, the adapters for Codex
and Copilot). Installing both gives you duplicate commands. Plugin users who
want the repo-side rules too can copy `AGENTS.md` from the
[template](template/AGENTS.md).

## Update

```bash
npx pincer-workflow@latest update
```

Files you never touched are refreshed in place. Files you edited are left
alone — the new version lands next to them as `<file>.new` for a manual merge.
`npx pincer-workflow doctor` checks the health of an install (hook executable,
`.gitignore` covering `.env*`, no unmerged `*.new` files, version current).

## What you get

| Piece | Purpose |
| --- | --- |
| `AGENTS.md` | Project rules, single cross-platform source (workflow order, security defaults, secrets, untrusted-content and dependency rules) |
| `.claude/commands/` | The five playbooks (canonical — adapters are generated from them) |
| `.claude/agents/` | `codebase-explorer` and `code-quality-reviewer` subagents, with inline fallbacks for platforms without subagents |
| `.claude/hooks/` + `settings.json` | Mechanical guardrails: `.env` files unreadable, destructive commands blocked |
| `.codex/` · `.github/` | Generated Codex and Copilot adapters + platform wiring |
| `scripts/sync-prompts.sh` | Regenerates the adapters after you edit a playbook |
| `scripts/build-plugin.sh` | Regenerates the Claude Code plugin (`plugin/`) from the template |
| `docs/dry-run-checklist.md` | The workflow's own test — audited by `/pincer-release` |

## Design principles

- **Approval gates scale with decision cost** — a human owns every architecture,
  every scope, and every merge; autonomy runs only between gates, bounded by a
  timebox and one revision loop.
- **Nothing is done while its verification fails** — every ticket carries a
  runnable check.
- **Scope is a first-class artifact** — cuts are recorded, never silent.
- **Security is threaded through every stage** — designed in at Plan, specified
  as reject-path criteria at Narrow, enforced by a pre-commit sweep at Code,
  audited mechanically at Evaluate and Release.
- **Enforced beats aspirational** — where the platform allows (Claude Code),
  guardrails are hooks and deny rules, not instructions; everywhere else,
  `/pincer-release` audits the git artifacts after the fact.

## License

MIT
