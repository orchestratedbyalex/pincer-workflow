# ticket-state-machine

How a ticket moves `open → in_progress → done`, and why "done" is unreachable
without a passing check. Added 2026-09-02 ([[mechanical-done]]).

## Files (all in template/, generated into plugin/ by build-plugin.sh)

- `scripts/pincer-ticket.sh` — the ONLY writer of the state fields. Subcommands:
  - `start T-NN`: refuses while any `depends_on` ticket isn't `done`; sets
    `status: in_progress`, stamps `started:` (UTC ISO). Idempotent.
  - `verify T-NN`: auto-starts an open ticket; extracts the fenced block under
    `## Verification`; runs it with `bash -eo pipefail -c` from the repo root;
    on exit 0 writes `verified: <ts> <12-hex sha256 of the block>`. On a done
    ticket it re-checks without touching the receipt (used by /pincer-release).
  - `done T-NN`: needs `in_progress`, a receipt whose hash equals the current
    Verification block, and zero `- [ ]` under `## Acceptance Criteria`; sets
    `status: done`, stamps `finished:`. Prints the commit command.
- `scripts/pincer-status.sh` — read-only report: latest PRD + status, every
  ticket (state, size, started/finished, elapsed from the clock, blocked-by),
  WARN for done-without-receipt, build elapsed since the earliest `started`
  vs `PINCER_BUILD_BUDGET_MIN` (default 75), NOTES.md presence, and a `Next`
  line (plan → narrow → code/resume → evaluate → release).
- `.claude/hooks/ticket-guard.sh` — PreToolUse on `Edit|Write|MultiEdit|Bash`.
  Blocks (exit 2) any edit of `tickets/T-*.md` whose new content contains
  `status: in_progress|done`, `started:`, `verified:`, `finished:`; blocks Bash
  commands that write those into tickets unless the command mentions
  `pincer-ticket.sh`. `status: open` and ticking boxes pass. JSON parsed via jq
  → python3 → grep fallback. Registered in template settings.json and
  plugin/hooks/hooks.json.
- `.claude/commands/pincer-status.md` — thin wrapper; every other playbook now
  opens with "run scripts/pincer-status.sh".

## Invariants and gotchas

- Frontmatter helpers are awk-only (`fm_get` strips inline `# comments`,
  `fm_set` keeps them). Duplicated in both scripts on purpose — no lib file to
  install. Repo root = `$CLAUDE_PROJECT_DIR`, else `git rev-parse`, else pwd, so
  the scripts work from `${CLAUDE_PLUGIN_ROOT}/scripts/` in plugin mode.
- Portable across macOS/Linux: `shasum -a 256` fallback, `date -d` then
  `date -j -f` for ISO→epoch, temp-file+mv instead of `sed -i`.
- The ticket template must never contain the protected keys as `key:` lines
  (the narrow Write would be blocked). The regex anchors at line start.
- The guard is against habit, not adversaries: `bash pincer-ticket.sh; sed …`
  in one command passes. Documented in the hook header.
- Tests: `test/ticket.test.js` (lifecycle + hook, run via `npm test`).
  `test/smoke.test.js` checks the installer ships/chmods the new files.

Related: [[template-kit]], [[cli-installer]], [[distribution-channels]].
