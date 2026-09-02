# mechanical-done

**Decided 2026-09-02.** A ticket's `done` state is a property of the system,
not an assertion by the agent: it can only be reached through
`scripts/pincer-ticket.sh done`, which requires a receipt that
`scripts/pincer-ticket.sh verify` writes only on a green run of the ticket's
own Verification block. On Claude Code a PreToolUse hook makes the script
the only door; elsewhere it's a standing rule plus a status warning.

**Why:** the old loop said "never mark done on a red check" but nothing
verified it — the differentiator of PINCER over prompt-only kits (Spec Kit,
BMAD, Kiro-style specs) is harness enforcement, so extend it to the one
claim that matters most. Also: elapsed time is now read from `started:`
stamps, because models estimate time badly.

**Alternatives rejected:**
- Enforcing commit-message format via hook — the hook runs before staging,
  so it can't see which ticket a commit closes; the release audit still
  checks the format after the fact.
- A separate log file per verification — noise; the receipt (timestamp +
  hash of the check) is enough evidence and lives in the ticket itself.
- Per-ticket TDD or parallel worktrees — deferred (items 3–5 of the
  2026-09-02 improvement list) to keep the kit lightweight.

Implementation: [[ticket-state-machine]]. Related: [[single-source-template]].
