# PINCER — PRD-Driven Agentic Delivery Workflow

**P**lan · **I**nvestigate · **N**arrow · **C**ode · **E**valuate · **R**elease

A lean, PRD-first workflow for AI coding agents — Claude Code, Codex CLI, and
GitHub Copilot. One idea goes from brief to reviewed, verified code through five
commands, and every step leaves an auditable artifact: a PRD, tickets, one
commit per ticket, review notes, and a pass/fail release audit.

**Website:** [orchestratedbyalex.github.io/pincer-workflow](https://orchestratedbyalex.github.io/pincer-workflow/) —
a twelve-sheet walkthrough of the workflow: why it exists, each command, the
safety guardrails, and installation.

## Install

```bash
cd your-project
npx pincer-workflow init     # asks which platform(s) you use
```

Then follow the chain — the same five steps on every platform:

```
/pincer-plan <brief>  →  /pincer-narrow  →  /pincer-code  →  /pincer-evaluate  →  /pincer-release
```

`/pincer-status` shows where the workflow stands at any point (PRD, tickets,
receipts, elapsed time, next command) — run it first in a new session.

On Codex CLI the commands are skills, invoked by mention rather than slash:
`$pincer-plan <brief>` → `$pincer-narrow` → `$pincer-code` → `$pincer-evaluate`
→ `$pincer-release`, and `$pincer-status`.

### Claude Code

Works immediately: the commands, the two subagents, the `.env` deny rules and
the destructive-command and ticket-guard hooks install to `.claude/`. Start
`claude` in the repo and run `/pincer-plan <brief>`.

### Codex CLI

Works immediately as well: `AGENTS.md` loads natively, and the six commands
install as skills under `.agents/skills/`, which Codex discovers from the repo
(no copying into your home directory — Codex removed custom prompts and
`~/.codex/prompts/` in early 2026). Start `codex` in the repo, then type
`$pincer-plan <brief>`; `$` opens the skill picker and `/skills` lists what
loaded. Inside the Codex skills every cross-reference already reads
`$pincer-narrow`, `$pincer-status` and so on.

Pincer does not currently install a Codex hook adapter, so its Codex guardrail
posture uses `~/.codex/config.toml` — `approval_policy = "on-request"` and
`sandbox_mode = "workspace-write"`; never run with approvals disabled. The
ticket scripts (`scripts/pincer-ticket.sh`, `scripts/pincer-status.sh`) are
plain bash and work unchanged; the rule in `AGENTS.md` against hand-editing
ticket state carries the weight the hook carries on Claude Code, and
`$pincer-status` flags missing, failed, or stale ticket readiness.
Full notes in `.codex/README.md`.

### GitHub Copilot (VS Code)

Enable `"chat.promptFiles": true` in VS Code settings, then run `/pincer-plan`
in chat. `.github/copilot-instructions.md` is wired to `AGENTS.md`.

## Claude Code plugin (alternative)

Claude users can install PINCER as a plugin instead — commands arrive
namespaced (`/pincer:plan` … `/pincer:release`) and update automatically
through the marketplace. The plugin's structured hook parser requires Node.js 18+:

```
/plugin marketplace add orchestratedbyalex/pincer-workflow
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

Files you never touched are refreshed in place. (Installs older than v0.2.0 gain the ticket state machine, the status report and the ticket-guard hook on update; `.claude/settings.json` conflicts if you edited it — merge the new hook entry from the `.new` file. v0.2.2 replaces the Codex adapter: the commands are now skills in `.agents/skills/` invoked as `$pincer-*`, since Codex no longer loads `~/.codex/prompts/` — you can delete the copies there. v0.2.3 ships the playbooks, rubrics and templates under `.claude/` on every platform, which Codex- and Copilot-only installs were missing. v0.3.0 makes trust revocable: every verification attempt is recorded, `done` re-runs the check, tickets carry `prd:`, the release audit is read-only, and `.pincer.json` moves to schema 2 — an install from 0.2.x is treated as an untrusted baseline, so on the first update every changed file arrives as a `.new` proposal once; hooks now need Node 18+. v0.4.0 carries requirement IDs and `Proves:` checks from the PRD to evaluation, adds `profile: small|standard`, and saves candidate evidence under `.prd/evidence/`; the update is additive, but an existing `NOTES.md` without an `evidence:` manifest reads as stale until `/pincer-evaluate` is re-run.) Files you edited are left
alone — the new version lands next to them as `<file>.new` for a manual merge.
`npx pincer-workflow doctor` checks the health of an install (hook executable,
`.gitignore` covering `.env*`, no unmerged `*.new` files, version current).

## What you get

| Piece | Purpose |
| --- | --- |
| `AGENTS.md` | Project rules, single cross-platform source (workflow order, security defaults, secrets, untrusted-content and dependency rules) |
| `.claude/commands/` | The five playbooks plus `/pincer-status` (canonical — adapters are generated from them; ships on every platform together with `agents/` and `references/`) |
| `.claude/agents/` | `codebase-explorer` and `code-quality-reviewer` subagents, with inline fallbacks for platforms without subagents |
| `scripts/pincer-ticket.sh` | The ticket state machine: `start` (enforces dependency order) → `verify` (runs the ticket's check, stamps a receipt only on green) → `done` (refuses without a matching receipt or with unticked criteria) |
| `scripts/pincer-status.sh` | Read-only state report: current PRD and profile, associated tickets, wall-clock elapsed time while work is active or against an explicit budget, evidence verdict, warnings, and next command |
| `scripts/pincer-evidence.cjs` | Read-only validator for candidate evidence (schema 1): `/pincer-evaluate` writes `.prd/evidence/prd-vN/<candidate>/manifest.json` plus logs and screenshots; status and release validate schema, references, candidate association, required results, file containment and SHA-256 digests. Legacy `NOTES.md` without a manifest is readable but never release-ready; an older runtime does not enforce this contract |
| `.claude/hooks/` + `settings.json` | Claude guardrails for documented destructive command forms and ticket state writes; Node.js 18+ parses hook payloads structurally |
| `.agents/skills/` · `.codex/` · `.github/` | Generated Codex skills and Copilot prompt files + platform wiring (`.codex/README.md` covers the Codex posture) |
| `scripts/sync-prompts.sh` | Regenerates the adapters after you edit a playbook |
| `scripts/build-plugin.sh` | Regenerates the Claude Code plugin (`plugin/`) from the template |
| `docs/release-checklist.md` | General, read-only candidate audit used by `/pincer-release` |
| `docs/dry-run-checklist.md` | Separate manual platform trial for the Pincer kit |

## Design principles

- **Approval gates scale with decision cost** — a human owns architecture, scope,
  and merge decisions; unchanged authorization persists across resume and routine
  verification, while explicit budgets shape the depth of work.
- **Nothing is done while its verification fails** — every ticket carries a
  runnable check, and "done" is a state only a passing run of that check can
  unlock: the receipt is stamped by the script, never typed by the agent.
- **State lives in files, not in the conversation** — a new session runs
  `/pincer-status` and knows exactly where to resume; elapsed time comes from
  timestamps, not from the model's sense of time.
- **Evidence is saved, not narrated** — requirements carry stable IDs from the
  PRD through tickets to evaluation, and the evaluation writes a validated
  manifest under `.prd/evidence/` that release reads instead of trusting chat.
- **Scope is a first-class artifact** — cuts are recorded, never silent.
- **Security is threaded through every stage** — designed in at Plan, specified
  as reject-path criteria at Narrow, enforced by a pre-commit sweep at Code,
  audited mechanically at Evaluate and Release.
- **Layered guardrails** — Claude hooks cover documented high-risk command and
  ticket-state forms, while sandbox and approval controls remain the security
  boundary. Other platforms use their native controls plus `/pincer-release`.

## License

MIT
