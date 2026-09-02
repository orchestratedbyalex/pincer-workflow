# Ticket Template

Used by `/pincer-narrow` for every file in `tickets/`. Filename: `T-{NN}-{slug}.md`.

```markdown
---
ticket: T-{NN}
status: open        # open | in_progress | done
size: S             # S (≤15 min) | M (≤30 min)
depends_on: []      # e.g. [T-01]
---

## Objective
One sentence: what to build and why.

## Context
- Relevant files: `src/path/to/file.ts` (what's there / what to follow)
- PRD section: which part of the PRD this implements

## Requirements
- Concrete, checkable requirements. No vague "handle errors properly" —
  say which errors and what the user sees.

## Acceptance Criteria
- [ ] Observable behavior 1
- [ ] Observable behavior 2

## Verification
```bash
# command(s) the builder runs to prove the criteria — tests, build, curl, etc.
```

## Constraints
- What NOT to do (out-of-scope temptations adjacent to this ticket).
```

Rules:
- `status` and the stamps `started`, `verified`, `finished` are written only by
  `scripts/pincer-ticket.sh` (`start` / `verify` / `done`). `verify` runs the
  Verification block verbatim and writes a receipt only on exit 0; `done`
  requires that receipt to match the current block. Never write these by hand.
- The Verification block is a fenced `bash` block that exits 0 only when the
  ticket is done — non-interactive, no "check by hand".
- Every ticket must be verifiable without human judgment where possible.
- If the ticket's surface accepts external input (HTTP, form, file, LLM output),
  Requirements must state the validation and the rejection behavior, and
  Acceptance Criteria must include the reject path as an observable behavior.
- Ticket T-01 is the walking skeleton: scaffold + thin end-to-end slice that runs.
- If a ticket needs more than ~30 minutes, split it before writing it.
