# Ticket Template

Used by `/pincer-narrow` for every file in `tickets/`. Filename: `T-{NN}-{slug}.md`.

```markdown
---
ticket: T-{NN}
status: open        # open | in_progress | done
size: S             # S (≤15 min) | M (≤30 min)
prd: .prd/prd-v{N}.md # the selected PRD, never inferred from ticket numbering
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
- New tickets always name their PRD with `prd: .prd/prd-vN.md`. The file must
  have matching version metadata and status `ticketed` or `built` before work
  starts. This status is a workflow precondition, not proof of user approval.
  Legacy tickets with one PRD are associated on start; with multiple PRDs, use
  `scripts/pincer-ticket.sh bind T-NN .prd/prd-vN.md` to resolve explicitly.
- Supported syntax is deliberately limited: closed `---` frontmatter with unique,
  unindented `key: value` fields; required `ticket`, `status`, `size`, and
  `depends_on`. IDs use `T-01` through `T-999999` and match the filename; dependencies
  use an inline list such as `[T-01, T-02]`, without duplicates or self references.
- Use exactly one `## Acceptance Criteria` section with nonempty checkboxes.
  Indentation and `-`, `+`, `*`, or numbered list markers are supported, with
  `[ ]`, `[x]`, or `[X]`. Every unchecked criterion blocks completion.
- Use exactly one `## Verification` section containing one closed fenced `bash`
  block with runnable commands. Missing sections, malformed metadata, duplicate
  ticket IDs, unsupported checkbox syntax, and invalid Bash fail before a transition.
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
