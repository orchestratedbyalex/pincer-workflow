# Simplify

Offer one simplification at a time and name what it would still have to preserve
before the person accepts it. The aim is to drop the steps that cost re-explaining
and produce records nobody reads, not the protection they gave.

For each stage in turn, plan, narrow, code, evaluate, release:
---
**{{stage}}** today: {{stage_default}}. Keep it as it is, switch it off, or change its gate?
- keep (recommended when {{keep_when}})
- off: then {{off_preserve}} must still be preserved somewhere; where?
- change the gate: to what, and who gives it?
- open
---

What each stage preserves, to name when offering `off`:
- plan: the written statement of what and why. Off means the ticket is the spec; fine for small changes.
- narrow: one change per ticket with a runnable check. Off means one ticket per change, written from the brief.
- code: a receipt per ticket from a passing check. This is the floor; do not offer `off` here. Its branch, PR and implementer choices are asked under Repo and Roster.
- evaluate: a review by someone other than the author, and the evidence that the checks ran. Off means the PR review is the evaluation.
- release: a read-only audit and the person's recorded acceptance. Off means acceptance happens at merge, in the PR.

Write every `off` with its reason in `stages.<name>.reason`; the agreement shows it
under Simplify so the next reader knows what was traded.

Returns: `stages.<name>.on` and `stages.<name>.reason` for each stage, and `stages.plan.gate` when the gate changed.
