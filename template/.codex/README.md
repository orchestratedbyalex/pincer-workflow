# PINCER on Codex CLI

Codex reads `AGENTS.md` at the repo root natively — the project rules apply
with no setup. The workflow commands need one install step, because Codex
loads custom prompts from your home directory, not the repo:

```bash
mkdir -p ~/.codex/prompts && cp .codex/prompts/*.md ~/.codex/prompts/
```

(`mkdir -p` matters: Codex does not create `~/.codex/prompts/` on its own, and
`cp` into a missing directory fails with "Not a directory".) Codex exposes custom
prompts under a `/prompts:` prefix, so the commands are `/prompts:pincer-plan`,
`/prompts:pincer-narrow`, `/prompts:pincer-code`, `/prompts:pincer-evaluate`,
`/prompts:pincer-release` and `/prompts:pincer-status` in any Codex session.
The playbooks refer to each other by their short names (`/pincer-narrow` etc.);
read those as `/prompts:pincer-narrow` here.

The copy is not tracked by `pincer update`: after `npx pincer-workflow@latest update`
(or after editing a playbook and re-running `scripts/sync-prompts.sh`), run the
`mkdir -p … && cp …` line again so `~/.codex/prompts/` matches the repo. These files are
generated from `.claude/commands/` by `scripts/sync-prompts.sh` — edit the
source playbooks, not these copies, and re-copy after a re-sync.

## Recommended posture (`~/.codex/config.toml`)

Codex has no PreToolUse hooks, so PINCER's guardrail posture is expressed
through the sandbox and approval policy instead:

```toml
approval_policy = "on-request"     # agent asks before escalating
sandbox_mode   = "workspace-write" # writes confined to the repo; no network by default
```

The ticket scripts are plain bash and work here unchanged:
`scripts/pincer-ticket.sh start|verify|done T-NN` and `scripts/pincer-status.sh`.
What Codex lacks is the hook that stops an agent hand-editing ticket state, so the
rule in `AGENTS.md` carries that weight; `/pincer-status` warns about any ticket
marked done without a receipt.

Never run with approvals disabled. The destructive-command rule in `AGENTS.md`
(no force-pushes, absolute-path deletes, or `curl | sh` by an agent) applies as
a standing instruction here; `/pincer-release` audits the git artifacts
afterwards, which is platform-independent by design.
