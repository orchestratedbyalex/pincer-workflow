# Handoff artifacts

Wherever work changes hands, between people, between a person and the agent,
between tools, something travels with it. If it travelled only as speech, the next
session starts without it. For each artifact ask where it lives and who reads it.

---
For each thing the pipeline passes along, tell me where it lives and who reads it. I
propose a default each time; `open` is fine.

- Spec, what we build and why: {{spec_default}}. A file under `specs/`, a forge issue, or no spec at all (plan switched off)?
- Tickets, one change each with a check: {{tickets_default}}. Files under `tickets/`, or forge issues with a local pointer?
- Summary, what a change did, for the person who accepts it: the ticket's own text, the PR body, or a note in chat that we then write down?
- Evidence, the logs and manifest showing the checks ran: {{evidence_default}}. Kept under `evidence/<candidate>/`, or skipped because the PR's checks are the evidence?
---

After each answer ask: "Who opens this later, and where would you look for it?" A
record nobody reads is a candidate for Simplify. A handoff that is only verbal is
the one to fix; count them.

Returns: `stages.plan.spec`, `stages.narrow.tickets`, `stages.evaluate.evidence`, `homes.specs`, `homes.tickets`, `homes.evidence`, and the verbal handoffs for `open`.
