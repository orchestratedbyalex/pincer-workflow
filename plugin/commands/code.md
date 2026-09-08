---
description: "Implement tickets sequentially with verification and one commit per ticket"
argument-hint: "Ticket numbers (optional — defaults to all open tickets in order)"
---

# /pincer:code — Ticket Implementation

You are implementing the tickets in `tickets/` sequentially. The approved PRD, ticket
breakdown, and existing session authorization define the work; run continuously and report
progress between tickets unless a material scope or design decision appears.

**Initial request:** $ARGUMENTS

Ticket state lives in the ticket file's frontmatter and is written **only** by
`${CLAUDE_PLUGIN_ROOT}/scripts/pincer-ticket.sh` (`start` → `verify` → `done`). `verify` runs the ticket's
Verification block and stamps a receipt only on a green exit; `done` refuses without a
receipt that matches the current check, or with unticked acceptance criteria. Never edit
`status`, `started`, `last_check`, `verified`, or `finished` by hand — on Claude Code a hook blocks it.

## Before the loop

Run `${CLAUDE_PLUGIN_ROOT}/scripts/pincer-status.sh`. It lists every ticket's state, what is blocked, elapsed
build time from the clock, and the next action. If a ticket is `in_progress`, you are
resuming: read it, check `git status` / `git diff` for uncommitted work, and continue
from wherever the receipt says you are. Do not ask the user to reconfirm unchanged,
previously authorized work.

## Loop (per ticket, in dependency order)

1. **Start:** `${CLAUDE_PLUGIN_ROOT}/scripts/pincer-ticket.sh start T-{NN}` — refuses while a `depends_on` ticket
   isn't done, and stamps the start time. Read the ticket and the files it references.
   Announce: "Starting T-{NN}: {title}."
2. **Implement.** Follow the conventions in `AGENTS.md` and the PRD's architecture and
   visual direction. Installing a dependency not named in the PRD's architecture is a
   stop-and-ask: verify it's the real package on the registry (linked repo, downloads —
   hallucinated names get typosquatted), say why it earns its place, and wait for a yes.
   For an S ticket, implement directly. For an M ticket touching isolated files, you may
   dispatch a subagent with a clean prompt: paste the full ticket body, the relevant
   conventions, and nothing else.
3. **Verify:** `${CLAUDE_PLUGIN_ROOT}/scripts/pincer-ticket.sh verify T-{NN}` — runs the Verification block and
   writes the receipt only if it exits 0. Red → fix and re-run; report the actual output,
   not assumptions. Green output is the definition of done, not your confidence. If the
   check only validated syntax or a build, say so — that is not behavioral proof. A
   visual judgment is recorded separately in evaluation, not as the receipt, and a tool
   the check needs but cannot run yields an explicit `unverified` result, never
   fabricated output.
4. **Self-review the diff** before committing: silent failures (empty catches,
   un-awaited promises), leftover debug code, drift from the ticket's acceptance criteria.
   Then a security sweep of the same diff:
   - Check for secret-like assignments without printing values. If a scanner reports a
     possible secret, report only its file and line until the value is safely redacted;
     environment references and names in `.env.example` are allowed.
   - External input touched by this diff is validated server-side, and untrusted
     content (user input, LLM output) is escaped where rendered — per the
     Security defaults in `AGENTS.md`.
   - No error path leaks internals (stack traces, key names with values) to the client.
   If the review changed code, run `verify` again — the receipt must match the code you commit.
5. **Close the ticket:** tick every verified acceptance-criteria checkbox (`- [ ]` → `- [x]`;
   editing the checkboxes is allowed), then `${CLAUDE_PLUGIN_ROOT}/scripts/pincer-ticket.sh done T-{NN}`. A
   criterion that was cut is a scope change to record in the PRD, not a box to skip.
   Inspect `git status --short`, preserve pre-existing staged work, and stage only the
   explicit paths changed for this ticket plus its ticket file. Review `git diff --cached`
   before committing as `T-{NN}: {title}`.
6. Give a one-line progress update using the elapsed figure from
   `${CLAUDE_PLUGIN_ROOT}/scripts/pincer-status.sh` ("T-02 done, 3 remaining, 38m elapsed") and continue.

## Budget rules

- If the user set `PINCER_BUILD_BUDGET_MIN` or stated another budget, use the elapsed
  figure from `${CLAUDE_PLUGIN_ROOT}/scripts/pincer-status.sh` rather than estimating. If the remaining tickets won't fit,
  stop and propose a scope cut: which remaining tickets to drop or shrink. Cutting scope
  deliberately beats an unfinished mess — record the cut in the PRD's Out of Scope.
- If a ticket reveals the plan was wrong, stop and say so rather than silently diverging.
  Update the ticket/PRD, then continue.

## When all tickets are done

Update the PRD to `status: built` and commit that change on its own (`PRD vN: built`).
The built transition is part of the candidate that `/pincer:evaluate` reviews; it is
never moved into a later evidence-only commit. Then finish with:
"All tickets built. Run `/pincer:evaluate` for a final quality pass."
