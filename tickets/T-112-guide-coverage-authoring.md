---
ticket: T-112
status: open
size: L
prd: .prd/prd-v8.md
depends_on: [T-110]
timeout: 900
---

## Objective
Reduce mapping effort by showing one unresolved decision and validating an authored proposal without taking over approval.

## Context
- PRD: [Prove reliable delivery with less effort](../.prd/prd-v8.md).
- Implements: R-13.
- Scenarios: S-37, S-38, S-39.
- Relevant paths: `template/scripts/pincer-runtime/coverage.cjs`, `template/scripts/pincer-runtime/scaffold.cjs`, `template/scripts/pincer-runtime/guide.cjs`, `template/scripts/pincer-runtime.cjs`, `template/docs/runtime-contracts.md`.
- Source: [readiness assessment](../docs/pincer-readiness-2026-09-15.md).
- Order, predecessor obligations and verification limits: [v8 ticket map](../docs/prd-v8-ticket-map.md).

## Requirements
- coverage guide --change <id> [--scenario <id>] [--proposal <path>] [--json] presents deterministic unresolved scenario context, relevant authored ticket/check text and an exact proposed map diff; no proposal is represented as reviewed coverage.
- Malformed/unsupported proposals, wrong-change references, duplicate or missing mappings, undeclared checks and traversal/symlink escapes produce actionable nonzero diagnostics; source changes while reviewing invalidate the proposal context.
- Whole-tree snapshots show guide writes no map, selection, authorization, attempt or lifecycle state and executes no proposed check; an authored accepted map still goes through the existing adoption/agreement gates and default/scaffold/brief contracts remain compatible.

Proceed only if T-110 supports the hypothesis. Otherwise record the findings and revise the proposed requirement before substituting another feature; do not implement it just to close this ticket. Reuse existing validators and authored schema-1 maps; --proposal accepts a complete authored map and emits diagnostics/diff, not a new runtime state store. Use candidate paths and declarations as context, never inferred semantic adequacy. The agent playbook performs the conversational loop; the runtime remains deterministic and read-only.

## Acceptance Criteria
- [ ] S-37: coverage guide --change <id> [--scenario <id>] [--proposal <path>] [--json] presents deterministic unresolved scenario context, relevant authored ticket/check text and an exact proposed map diff; no proposal is represented as reviewed coverage.
- [ ] S-38: Malformed/unsupported proposals, wrong-change references, duplicate or missing mappings, undeclared checks and traversal/symlink escapes produce actionable nonzero diagnostics; source changes while reviewing invalidate the proposal context.
- [ ] S-39: Whole-tree snapshots show guide writes no map, selection, authorization, attempt or lifecycle state and executes no proposed check; an authored accepted map still goes through the existing adoption/agreement gates and default/scaffold/brief contracts remain compatible.

## Verification
Proves: The focused checks exercise the stated controls and failure paths. Static assertions are sufficient only for authored contracts/generated artifacts; behavioral claims require observed outputs, side effects or refusal behavior.
```bash
set -e
node test/coverage-guide.test.js
node test/coverage-map.test.js
node test/coverage-adoption.test.js
node test/coverage-agreement.test.js
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
