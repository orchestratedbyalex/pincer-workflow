---
ticket: T-101
status: open
size: M
prd: .prd/prd-v8.md
depends_on: [T-100]
timeout: 900
---

## Objective
Prevent different executed configurations from masquerading as one frozen experiment.

## Context
- PRD: [Prove reliable delivery with less effort](../.prd/prd-v8.md).
- Implements: R-02.
- Scenarios: S-04, S-05, S-06.
- Relevant paths: `scripts/delivery-benchmark-v7/orchestrator.cjs`, `scripts/delivery-benchmark-v7/freeze.cjs`, `scripts/delivery-benchmark-v7/freeze-spec.cjs`.
- Source: [readiness assessment](../docs/pincer-readiness-2026-09-15.md).
- Order, predecessor obligations and verification limits: [v8 ticket map](../docs/prd-v8-ticket-map.md).

## Requirements
- Planning and execution derive a canonical effective manifest containing resolved model identity, tool version, caps, kit digest, browser/evaluator implementation and all execution helpers; changing any relevant input changes cohort identity or is refused before preparation and launch.
- The model-A/10-turn versus model-B/20-turn reproduction cannot produce the same runnable cohort; resuming an existing plan with changed kit, browser adapter or configuration is refused without workspace, record or session mutation.
- Historical cohorts remain readable with their original inputs; malformed flags, missing values, nonpositive or nonfinite caps, escaping inputs and unknown provenance are rejected explicitly, and secrets are neither recorded nor hashed.

Prefer a resolved execution manifest hashed before plan creation, rather than comparing only caller-supplied labels. Bind the actual kit contents and browser dependency closure, not only module filenames. Exact provider model and CLI versions are resolved and pinned during execution, never guessed in this PRD. Re-freeze amended execution inputs openly at the offline integration gate.

## Acceptance Criteria
- [ ] S-04: Planning and execution derive a canonical effective manifest containing resolved model identity, tool version, caps, kit digest, browser/evaluator implementation and all execution helpers; changing any relevant input changes cohort identity or is refused before preparation and launch.
- [ ] S-05: The model-A/10-turn versus model-B/20-turn reproduction cannot produce the same runnable cohort; resuming an existing plan with changed kit, browser adapter or configuration is refused without workspace, record or session mutation.
- [ ] S-06: Historical cohorts remain readable with their original inputs; malformed flags, missing values, nonpositive or nonfinite caps, escaping inputs and unknown provenance are rejected explicitly, and secrets are neither recorded nor hashed.

## Verification
Proves: The focused checks exercise the stated controls and failure paths. Static assertions are sufficient only for authored contracts/generated artifacts; behavioral claims require observed outputs, side effects or refusal behavior.
```bash
set -e
node test/execution-freeze.test.js
node test/benchmark-effective-inputs.test.js
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
