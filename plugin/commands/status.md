---
description: "Where the workflow stands — PRD, tickets, receipts, elapsed time, next action"
argument-hint: "[none]"
---

# /pincer:status — Where are we?

You are orienting in a repo that uses PINCER, typically after a context reset or at the
start of a session. Read-only: change nothing.

## Steps

1. Run `${CLAUDE_PLUGIN_ROOT}/scripts/pincer-status.sh`. It reads the artifacts on disk (`.prd/`, `tickets/`,
   `NOTES.md`) and prints the PRD state and profile, every ticket with its state and
   clock-based elapsed time, what is blocked, wall-clock build time while a ticket is in
   progress or against an explicit user budget, the `Runtime` line (legacy receipts or
   the registered change), the evidence verdict and `Provenance` line for the evaluated
   candidate, any warnings (each readiness problem once), and the next command to run.
   `${CLAUDE_PLUGIN_ROOT}/scripts/pincer-status.sh --json` prints one status object with reason codes and the
   next action for tooling; `node ${CLAUDE_PLUGIN_ROOT}/scripts/pincer-runtime.cjs ready [T-NN]` is the
   read-only gate. On a project with change records (`Runtime  changes …`) run
   `node ${CLAUDE_PLUGIN_ROOT}/scripts/pincer-runtime.cjs resume` as well: it reports the selected change, its
   lifecycle, agreement and authorization, decisions, references, tickets, attempts,
   candidate, the authored handoff note and the next command, and never writes;
   `change list` shows every retained change, `status --change <id>` and
   `resume --change <id>` inspect another one without selecting it. `resume` is the
   report; `change resume <id>` is the lifecycle operation.
2. Report in three lines: where the workflow is, what is in progress or blocked, and the
   next command. Quote the `Next` line as-is. When the `Runtime` line says `legacy`,
   add the register or migrate command it names as the step that precedes the next
   ticket (fresh project → `register`, legacy receipts → `migrate --preview`, a v0.5.0
   binding → `migrate --preview`, no selection → `change select <id>`).
3. If a ticket is `in_progress`, read it and `git status`, then offer to resume it with
   `/pincer:code T-{NN}`. If the script printed a warning, surface it — a done ticket
   without a receipt was marked by hand and needs `${CLAUDE_PLUGIN_ROOT}/scripts/pincer-ticket.sh verify T-{NN}`.
   Never restore a ticket file from git to clear a warning; a failed attempt is a record.
   The one exception is the tree-back-at-candidate case in the recovery section of
   `/pincer:code`: the user restores the ticket file, and nothing is verified or committed.
   It applies only when the recorded failure is explained by a since-reverted source
   change and the block passes in the same execution context as `verify`; an
   unexplained failure (a service down, a missing dependency) stays a failure until the
   environment is repaired and `verify` passes again. After migration never restore a
   ticket file or delete `.pincer/runtime` to clear a warning: repair the cause and run
   `verify` again; a dead session's `running` attempt is finalized by
   `node ${CLAUDE_PLUGIN_ROOT}/scripts/pincer-runtime.cjs recover`.
