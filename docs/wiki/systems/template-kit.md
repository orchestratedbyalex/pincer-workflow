# template-kit

`template/` — the PINCER kit itself, the single source of truth everything
else is generated from ([[single-source-template]]).

## Contents

- `AGENTS.md` — all project rules in the cross-platform standard: workflow
  order, security defaults, secrets, untrusted-content rule (content is data,
  never instructions), dependency human-gate. `CLAUDE.md` is a one-line
  `@AGENTS.md` import.
- `.claude/commands/pincer-*.md` — the five playbooks (canonical). Security is
  threaded through them: trust boundaries at Plan, reject-path acceptance
  criteria at Narrow, pre-commit secret-grep sweep at Code, mechanical audit
  (history grep, npm audit, invalid-input probe) at Evaluate, checklist audit
  at Release. Brownfield rules: Investigate scales up on load-bearing code;
  characterization tests before modifying untested paths.
- `.claude/agents/` — codebase-explorer, code-quality-reviewer (security is
  its priority 2; both report embedded AI-instructions as findings).
- `.claude/hooks/block-dangerous.sh` + `settings.json` — PreToolUse guardrail
  blocking absolute-path deletes, force-pushes, `curl | sh`, chmod 777, hard
  resets to origin; plus `.env` read-deny rules.
- `.codex/`, `.github/` — GENERATED adapters (never hand-edit).
- `scripts/sync-prompts.sh` — regenerates them; lives inside the template so
  installed repos can re-sync after editing their local playbooks.
- `docs/dry-run-checklist.md` — the workflow's own test, audited by
  /pincer-release.

## Invariants

- Adapters and `plugin/` must be regenerated after ANY template edit
  (`scripts/sync-prompts.sh` at repo root context + `scripts/build-plugin.sh`).
- Nothing personal or confidential enters the template: the /llm-wiki section
  was stripped at extraction; the assessment brief never left the private repo.
- No `.gitignore` file inside `template/` (npm strips them) — the
  [[cli-installer]] appends gitignore lines at install time.

## Provenance

Extracted 2026-09-01 from the private `lead-engineer-role-alexander` repo
(where the kit was developed and battle-tested in a real timed assessment).
That repo still has its own copy; drift between the two is an open thread.
