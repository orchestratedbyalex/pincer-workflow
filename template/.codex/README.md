# PINCER on Codex CLI

Codex reads `AGENTS.md` at the repo root natively — the project rules apply
with no setup. The workflow commands need one install step, because Codex
loads custom prompts from your home directory, not the repo:

```bash
cp .codex/prompts/*.md ~/.codex/prompts/
```

Then `/pincer-plan`, `/pincer-narrow`, `/pincer-code`, `/pincer-evaluate`,
and `/pincer-release` are available in any Codex session. These files are
generated from `.claude/commands/` by `scripts/sync-prompts.sh` — edit the
source playbooks, not these copies, and re-copy after a re-sync.

## Recommended posture (`~/.codex/config.toml`)

Codex has no PreToolUse hooks, so PINCER's guardrail posture is expressed
through the sandbox and approval policy instead:

```toml
approval_policy = "on-request"     # agent asks before escalating
sandbox_mode   = "workspace-write" # writes confined to the repo; no network by default
```

Never run with approvals disabled. The destructive-command rule in `AGENTS.md`
(no force-pushes, absolute-path deletes, or `curl | sh` by an agent) applies as
a standing instruction here; `/pincer-release` audits the git artifacts
afterwards, which is platform-independent by design.
