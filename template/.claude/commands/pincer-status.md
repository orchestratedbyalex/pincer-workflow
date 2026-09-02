---
description: "Where the workflow stands — PRD, tickets, receipts, elapsed time, next action"
argument-hint: "[none]"
---

# /pincer-status — Where are we?

You are orienting in a repo that uses PINCER, typically after a context reset or at the
start of a session. Read-only: change nothing.

## Steps

1. Run `scripts/pincer-status.sh`. It reads the artifacts on disk (`.prd/`, `tickets/`,
   `NOTES.md`) and prints the PRD state, every ticket with its state and clock-based
   elapsed time, what is blocked, build time against the budget, any warnings (a ticket
   marked done without a verification receipt), and the next command to run.
2. Report in three lines: where the workflow is, what is in progress or blocked, and the
   next command. Quote the `Next` line as-is.
3. If a ticket is `in_progress`, read it and `git status`, then offer to resume it with
   `/pincer-code T-{NN}`. If the script printed a warning, surface it — a done ticket
   without a receipt was marked by hand and needs `scripts/pincer-ticket.sh verify T-{NN}`.
