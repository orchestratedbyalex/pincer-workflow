# PINCER on Codex CLI

Codex reads `AGENTS.md` at the repository root natively, so the agreement and the
standing rules apply with no setup. The stages ship as skills under `.agents/skills/`,
which Codex discovers from the repository (custom prompts under `~/.codex/prompts/`
were removed in early 2026, openai/codex#16115; there is nothing to copy home).

Skills are invoked by mention: type `$` and pick from the list, or write the name:

```
$pincer-blueprint     first: recon, the interview, the agreement
$pincer-status        any time: where the work stands, the next command
```

Until the blueprint has run, only these two exist. The agreement switches the other
stages on, and `scripts/pincer-blueprint.cjs write` generates their skills here
(`$pincer-plan`, `$pincer-narrow`, `$pincer-code`, `$pincer-evaluate`,
`$pincer-release`) from the project copies under `.claude/skills/`, which ship on
every platform. Edit the project copy and run `scripts/sync-prompts.sh`; never edit
the generated file, as the comment on its first line says. `/skills` lists what
Codex has loaded.

## Recommended posture (`~/.codex/config.toml`)

This kit installs no Codex hook. Codex's sandbox, approval policy and the rules in
`AGENTS.md` are the guardrail posture:

```toml
approval_policy = "on-request"     # the agent asks before escalating
sandbox_mode   = "workspace-write" # writes confined to the repository; no network by default
```

The scripts work here unchanged: `scripts/pincer-ticket.sh start|verify|done|accept T-NN`,
`scripts/pincer-status.sh` and `scripts/pincer-blueprint.cjs`; Node.js 22 or newer is
required. Without a hook, the rule in `AGENTS.md` carries the weight of stopping
hand-edited ticket fields; `$pincer-status` warns about a ticket marked done without a
receipt and about acceptance missing where the agreement expects it.

Never run with approvals disabled. The destructive-command rule in `AGENTS.md` (no
force-pushes, absolute-path deletes or `curl | sh` by an agent) is a standing
instruction here; `$pincer-release` audits the artifacts afterwards, the same on
every platform.
