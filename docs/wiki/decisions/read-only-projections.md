# Both v7 product surfaces are read-only projections, not new records

**Decided:** 2026-09-14, implementing PRD v7 (T-90, T-91).

PRD v7 ships two additions: `coverage scaffold --change <id>` and `resume --brief`.
Both are **projections of state the runtime already computes**, and neither creates a
second authoritative record, caches a readiness value, executes a check, changes a
selection or widens an exemption.

## Why a projection and not a feature

The obvious version of each is a feature. A scaffold that *writes* the map; a brief
resume that *computes* what matters. Both were rejected for the same reason: a second
thing that decides is a second thing that can disagree with the first, and PRD v6
already paid for that once — two next-action computations drifted until `coverage`
recommended commands the gates refused ([[one-next-action-precedence]], T-80).

So:

- **The draft decides nothing.** It lists every live scenario exactly once, preserves
  authored content verbatim, and reports each ticket's own `Implements:` claim and
  Verification text as *material to read*, with the ticket's file. It never invents a
  link, a check command, a ticket role or a scope disposition. What it removes is
  transcription, which is measurable; what it leaves is judgment, which is not its job.
- **The brief recomputes nothing.** `next` is the full report's own object, copied.
  Grouping may collapse repetition; it may never collapse a blocker *category*, because
  a category is the reason a gate will refuse.

## The guard is the missing key

A draft written to disk must not be a coverage map. The envelope is `draft: 1` with
**no `schema` key**, so `coverage.validateMap` refuses it —
`COVERAGE_INVALID: unsupported coverage map schema undefined`. This is checked two
ways, because "it happens not to validate" is weaker than "it cannot": the draft is
driven through `readMap`, `load` and `coverage adopt --preview`, and separately a
minimal map is shown to validate and then to fail with exactly that message once
`schema` is removed. The missing key is the guard, not an accident of the other fields.

## Stale rows are preserved, never dropped

A map row naming a scenario the inventory no longer defines is authored content. The
draft keeps it and flags it `SCENARIO_STALE`. Deleting an obligation is a decision with
its own disposition and authorization ([[coverage-is-authored-and-bound]]); a tool that
quietly tidied it away would be making that decision silently.

## Determinism is a contract, not a property

The draft body carries **no timestamp**, so two calls on identical authored inputs are
byte-identical. That is asserted through the CLI, not just the module.

## What the measurements actually say

Measured across four change sizes ([[v7-measured-friction]]):

- `resume --brief` is **constant-size** (576–581 bytes) while the full report grows
  linearly — 52% fewer bytes at three scenarios, 85% at forty; the JSON saving reaches
  90%, and JSON is what an agent reads.
- The scaffold's byte saving is **real only at scale**: at three scenarios the draft is
  no smaller than reading the PRD and the tickets. On small changes its value is that
  membership is generated and therefore cannot be wrong.

Fewer bytes is not less effort, and none of this was measured on a live session. See
[[v7-measured-friction]].

Related: [[strict-coverage]], [[runtime]], [[one-next-action-precedence]],
[[coverage-is-authored-and-bound]].
