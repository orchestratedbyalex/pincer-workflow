---
description: "Implement tickets sequentially with verification and one commit per ticket"
argument-hint: "Ticket numbers (optional — defaults to all open tickets in order)"
---

# /pincer-code — Ticket Implementation

You are implementing the tickets in `tickets/` sequentially. Mostly autonomous: after the
user confirms the starting point, run continuously and report progress between tickets.

**Initial request:** $ARGUMENTS

Ticket state lives in the ticket file's frontmatter and is written **only** by
`scripts/pincer-ticket.sh` (`start` → `verify` → `done`). `verify` runs the ticket's
Verification block and stamps a receipt only on a green exit; `done` refuses without a
receipt that matches the current check, or with unticked acceptance criteria. Never edit
`status`, `started`, `verified`, or `finished` by hand — on Claude Code a hook blocks it.

## Before the loop

Run `scripts/pincer-status.sh`. It lists every ticket's state, what is blocked, elapsed
build time from the clock, and the next action. If a ticket is `in_progress`, you are
resuming: read it, check `git status` / `git diff` for uncommitted work, and continue
from wherever the receipt says you are. Confirm the starting point with the user, then go.

## Loop (per ticket, in dependency order)

1. **Start:** `scripts/pincer-ticket.sh start T-{NN}` — refuses while a `depends_on` ticket
   isn't done, and stamps the start time. Read the ticket and the files it references.
   Announce: "Starting T-{NN}: {title}."
2. **Implement.** Follow the conventions in `AGENTS.md` and the PRD's architecture and
   visual direction. Installing a dependency not named in the PRD's architecture is a
   stop-and-ask: verify it's the real package on the registry (linked repo, downloads —
   hallucinated names get typosquatted), say why it earns its place, and wait for a yes.
   For an S ticket, implement directly. For an M ticket touching isolated files, you may
   dispatch a subagent with a clean prompt: paste the full ticket body, the relevant
   conventions, and nothing else.
3. **Verify:** `scripts/pincer-ticket.sh verify T-{NN}` — runs the Verification block and
   writes the receipt only if it exits 0. Red → fix and re-run; report the actual output,
   not assumptions. Green output is the definition of done, not your confidence.
4. **Self-review the diff** before committing: silent failures (empty catches,
   un-awaited promises), leftover debug code, drift from the ticket's acceptance criteria.
   Then a security sweep of the same diff:
   - No secret values: run
     `git diff | grep -iE '(api[_-]?key|secret|token|password)[[:space:]]*[:=]'`
     and treat any hit that isn't a `process.env` reference or a name in
     `.env.example` as a blocker.
   - External input touched by this diff is validated server-side, and untrusted
     content (user input, LLM output) is escaped where rendered — per the
     Security defaults in `AGENTS.md`.
   - No error path leaks internals (stack traces, key names with values) to the client.
   If the review changed code, run `verify` again — the receipt must match the code you commit.
5. **Close the ticket:** tick every verified acceptance-criteria checkbox (`- [ ]` → `- [x]`;
   editing the checkboxes is allowed), then `scripts/pincer-ticket.sh done T-{NN}`. A
   criterion that was cut is a scope change to record in the PRD, not a box to skip.
   Commit code and ticket file together: `git add -A && git commit -m "T-{NN}: {title}"`.
6. Give a one-line progress update using the elapsed figure from
   `scripts/pincer-status.sh` ("T-02 done, 3 remaining, 38m elapsed of 75m") and continue.

## Timebox rules

- The budget is ~75 minutes of build time, measured by `scripts/pincer-status.sh` from
  the first ticket's start stamp — never estimated. If the remaining tickets won't fit,
  stop and propose a scope cut: which remaining tickets to drop or shrink. Cutting scope
  deliberately beats an unfinished mess — record the cut in the PRD's Out of Scope.
- If a ticket reveals the plan was wrong, stop and say so rather than silently diverging.
  Update the ticket/PRD, then continue.

## When all tickets are done

Update the PRD to `status: built`, then finish with:
"All tickets built. Run `/pincer-evaluate` for a final quality pass."
