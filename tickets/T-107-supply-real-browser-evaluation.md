---
ticket: T-107
status: done
size: M
prd: .prd/prd-v8.md
depends_on: [T-101]
timeout: 900
started: 2026-09-19T06:49:06Z
last_check: 2026-09-19T07:18:30Z passed d8228b8033f8
verified: 2026-09-19T07:18:30Z d8228b8033f8
finished: 2026-09-19T07:18:30Z
---

## Objective
Make UI acceptance depend on actual browser behavior through the existing evaluator seam.

## Context
- PRD: [Prove reliable delivery with less effort](../.prd/prd-v8.md).
- Implements: R-08.
- Scenarios: S-22, S-23, S-24.
- Relevant paths: `scripts/delivery-benchmark-v7/harness.cjs`, `scripts/delivery-benchmark-v7/evaluator-kit.cjs`, `test/fixtures/delivery-benchmark-v7/briefs/ui-states/`.
- Source: [readiness assessment](../docs/pincer-readiness-2026-09-15.md).
- Order, predecessor obligations and verification limits: [v8 ticket map](../docs/prd-v8-ticket-map.md).

## Requirements
- A pinned real browser/adapter observes the working UI control and rejects deliberately broken loading, empty, error or interaction behavior that markup-only checks miss; screenshots and observation artifacts identify the tested candidate.
- Missing browser tooling, launch failure, timeout or absent observations yields unavailable/error with reasons and never acceptance; the preflight refuses a full UI study schedule when required browser capability is absent.
- Browser/adapter version and implementation digests participate in execution provenance; candidate servers use disposable local workspaces and are stopped after success, failure and interruption without accessing production data.

Choose, verify and pin an existing supported browser automation tool during this ticket; keep it in maintainer-only tooling and out of the dependency-free distributed runtime. Prepare any new dependency decision concretely before installation. The real-browser suite is offline with respect to models, uses local fixtures and fails explicitly when its required browser is missing. Keep seam-unit checks in normal tests and document/provision the real-browser integration gate separately.

## Acceptance Criteria
- [x] S-22: A pinned real browser/adapter observes the working UI control and rejects deliberately broken loading, empty, error or interaction behavior that markup-only checks miss; screenshots and observation artifacts identify the tested candidate.
- [x] S-23: Missing browser tooling, launch failure, timeout or absent observations yields unavailable/error with reasons and never acceptance; the preflight refuses a full UI study schedule when required browser capability is absent.
- [x] S-24: Browser/adapter version and implementation digests participate in execution provenance; candidate servers use disposable local workspaces and are stopped after success, failure and interruption without accessing production data.

## Verification
Proves: The focused checks exercise the stated controls and failure paths. Static assertions are sufficient only for authored contracts/generated artifacts; behavioral claims require observed outputs, side effects or refusal behavior.
```bash
set -e
node test/benchmark-browser.test.js
node test/benchmark-browser-live.test.js
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
