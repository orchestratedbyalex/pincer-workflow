---
ticket: T-117
status: open
size: M
prd: .prd/prd-v8.md
depends_on: [T-114]
timeout: 900
---

## Objective
Observe Pincer maintaining Pincer through a supported strict/multi-change journey without trusting the runtime under modification.

## Context
- PRD: [Prove reliable delivery with less effort](../.prd/prd-v8.md).
- Implements: R-18.
- Scenarios: S-52, S-53, S-54.
- Relevant paths: `docs/prd-v8-dogfood.md`, `docs/prd-v8-artifacts/dogfood/`, `docs/kit-maintenance-checklist.md`.
- Source: [readiness assessment](../docs/pincer-readiness-2026-09-15.md).
- Order, predecessor obligations and verification limits: [v8 ticket map](../docs/prd-v8-ticket-map.md).

## Requirements
- A genuine bounded future maintenance change in a disposable checkout is managed with a recorded independent released or evaluated kit outside the edited tree, using explicit change selection, reviewed strict adoption and retained history for two changes.
- Pause, revised scope, new-session continuation and candidate evaluation preserve unrelated files and old authorization/history; stale or absent local attempts require explicit fresh verification.
- The report distinguishes a successful disposable trial from migration of the live distribution checkout; rollback restores the disposable setup and leaves historical tickets, receipts and the current repository management mode unchanged.

Select actual maintenance work in the execution manifest rather than inventing a trivial fixture and calling it dogfooding. Choose a pinned evaluated management kit before the run. Live-checkout migration and historical backfill remain outside this ticket; propose them only after this observed trial supports them.

## Acceptance Criteria
- [ ] S-52: A genuine bounded future maintenance change in a disposable checkout is managed with a recorded independent released or evaluated kit outside the edited tree, using explicit change selection, reviewed strict adoption and retained history for two changes.
- [ ] S-53: Pause, revised scope, new-session continuation and candidate evaluation preserve unrelated files and old authorization/history; stale or absent local attempts require explicit fresh verification.
- [ ] S-54: The report distinguishes a successful disposable trial from migration of the live distribution checkout; rollback restores the disposable setup and leaves historical tickets, receipts and the current repository management mode unchanged.

## Verification
Proves: The command validates retained real observation records and required references; actual agent behavior and reviewer judgment require inspecting the linked evidence. It must fail when the observation section is absent or outstanding.
```bash
set -e
node test/dogfood-records.test.js
node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/study.json --section dogfood --require-observed
```

The named new command/test files are deliverables of this ticket or its predecessors,
not evidence that already exists. Add executable offline suites to the normal integration
chain. Do not create placeholder passes. A record validator is not proof of live behavior;
keep any observation criterion unchecked until its linked artifacts have been reviewed.

## Constraints
- Preserve existing authorization, source/evidence freshness, failure precedence,
  recovery, unrelated user work and all legacy/migrated/changes/strict modes.
- Use the independently pinned management kit; never hand-edit lifecycle receipts.
- After any template edit regenerate adapters and plugin; never hand-edit derived files.
- No paid launch, new project access, external message, merge or publication is implied
  by this ticket. Reuse actual session decisions; obtain only missing execution inputs.
- Preserve historical frozen records and report changed execution/scoring under explicit
  cohort identity. New scenario scope or an unsupported design needs a recorded revision.
