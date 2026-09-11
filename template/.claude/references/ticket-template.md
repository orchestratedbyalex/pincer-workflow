# Ticket Template

Used by `/pincer-narrow` for every file in `tickets/`. Filename: `T-{NN}-{slug}.md`.

```markdown
---
ticket: T-{NN}
status: open        # open | in_progress | done
size: S             # S | M | L, relative scope; split when it improves verification
prd: .prd/prd-v{N}.md # the selected PRD, never inferred from ticket numbering
depends_on: []      # e.g. [T-01]
timeout: 600        # optional, seconds (default 600); part of the check identity
---

## Objective
One sentence: what to build and why.

## Context
- Relevant files: `src/path/to/file.ts` (what's there / what to follow)
- PRD section: which part of the PRD this implements
- Implements: R-01, R-03 (requirement IDs from the PRD; enabling work that
  implements no requirement states its purpose in the Objective instead)

## Requirements
- Concrete, checkable requirements. No vague "handle errors properly" —
  say which errors and what the user sees.

## Acceptance Criteria
- [ ] Observable behavior 1
- [ ] Observable behavior 2

## Verification
Proves: one line — what this check establishes and which regression it detects.
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
- `status` and the attempt/stamp fields `started`, `last_check`, `verified`, `finished` are written only by
  `scripts/pincer-ticket.sh` (`start` / `verify` / `done`). `verify` runs the
  Verification block verbatim and writes a receipt only on exit 0; `done`
  requires that receipt to match the current block. Never write these by hand.
  On a migrated project (`.prd/changes/` holds a change binding) `verify` records
  attempts under `.pincer/runtime/` instead of `verified`/`last_check`, and `done`
  consumes the current passing attempt against the current source.
- The Verification block is a fenced `bash` block that exits 0 only when the
  ticket is done — non-interactive, no "check by hand".
- The Verification section opens with a one-line `Proves:` statement: what the
  check establishes and which regression it detects. Executable changes need
  checks that exercise observable behavior — including relevant rejection paths
  and, in brownfield work, preservation of existing behavior. Reuse adequate
  focused tests rather than inventing ad-hoc commands. A build, a syntax check, or
  an identifier grep alone does not prove a feature works: the check must fail
  when the behavior is wrong, not only when a name is renamed. Static assertions
  may be primary evidence for static contracts (generated files, adapter wording)
  when `Proves:` explains that fit.
- Manual visual judgment is recorded separately during evaluation, never as the
  Verification command. When a tool the check needs is unavailable, the result is
  an explicit `unverified`, never fabricated output or a silent waiver.
- Every ticket must be verifiable without human judgment where possible.
- If the ticket's surface accepts external input (HTTP, form, file, LLM output),
  Requirements must state the validation and the rejection behavior, and
  Acceptance Criteria must include the reject path as an observable behavior.
- Use a walking skeleton for greenfield work when it reduces integration risk. In
  brownfield work, protect the smallest useful vertical change and characterize
  uncovered load-bearing behavior before modifying it.
- Split a ticket when it contains separate dependencies, owners, or verification paths.
