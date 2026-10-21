# Roster

Propose, do not ask from scratch: apply `.claude/skills/pincer-blueprint/formats/roster-rules.md`
to the answers and recon, then present the result for confirmation.

---
From what you told me, I propose these agents per stage:

{{roster_table}}

Each agent has one point of view and returns findings in one fixed shape, so adding
or dropping one changes nothing else. The two reviewers everyone gets are code
quality and silent failures; {{conditional_reasons}}. Confirm, or add and remove by name.
---

Options the person may not know: `implementer` builds each ticket in a fresh context
instead of the main session (slower, cleaner); `fix-agent` turns review findings into
fixes, which still go through new tickets.

Returns: `roster.plan`, `roster.narrow`, `roster.code`, `roster.evaluate` as lists of agent names.
