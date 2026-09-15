---
ticket: T-105
status: open
size: M
prd: .prd/prd-v8.md
depends_on: [T-104]
timeout: 900
---

## Objective
Ensure cost, tokens and provider time include all attempts and never disguise partial observations as totals.

## Context
- PRD: [Prove reliable delivery with less effort](../.prd/prd-v8.md).
- Implements: R-06.
- Scenarios: S-16, S-17, S-18.
- Relevant paths: `scripts/delivery-benchmark-v7/orchestrator.cjs`, `scripts/delivery-benchmark-v7/effort.cjs`.
- Source: [readiness assessment](../docs/pincer-readiness-2026-09-15.md).
- Order, predecessor obligations and verification limits: [v8 ticket map](../docs/prd-v8-ticket-map.md).

## Requirements
- One complete payload plus one missing, malformed or metric-incomplete payload produces a null aggregate with a specific reason, while retaining any clearly labelled measured subtotal; the $1.25/120-token reproduction no longer reports a complete total.
- Usage across all completed, failed and discarded attempts is counted once with provider duration distinct from wall-clock/active intervals; all-null, explicitly reported zero and missing values remain distinguishable.
- Negative, nonfinite, inconsistent or unsupported provider fields are rejected or labelled unavailable; report regeneration from stored payloads needs no model call and never silently omits an attempt or double-counts cache usage.

Freeze provider-field semantics before collection. Incomplete metrics must not block recording that a candidate was independently accepted or rejected. Preserve original payloads securely; reports contain sanitized metadata. Any measurement schema change requires versioned readers and explicit old-record limitations.

## Acceptance Criteria
- [ ] S-16: One complete payload plus one missing, malformed or metric-incomplete payload produces a null aggregate with a specific reason, while retaining any clearly labelled measured subtotal; the $1.25/120-token reproduction no longer reports a complete total.
- [ ] S-17: Usage across all completed, failed and discarded attempts is counted once with provider duration distinct from wall-clock/active intervals; all-null, explicitly reported zero and missing values remain distinguishable.
- [ ] S-18: Negative, nonfinite, inconsistent or unsupported provider fields are rejected or labelled unavailable; report regeneration from stored payloads needs no model call and never silently omits an attempt or double-counts cache usage.

## Verification
Proves: The focused checks exercise the stated controls and failure paths. Static assertions are sufficient only for authored contracts/generated artifacts; behavioral claims require observed outputs, side effects or refusal behavior.
```bash
set -e
node test/benchmark-usage-completeness.test.js
node test/effort-records.test.js
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
