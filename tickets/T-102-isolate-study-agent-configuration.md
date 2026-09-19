---
ticket: T-102
status: in_progress
size: M
prd: .prd/prd-v8.md
depends_on: [T-101]
timeout: 900
started: 2026-09-19T06:49:06Z
last_check: 2026-09-19T07:30:56Z passed 42cb37f26796
verified: 2026-09-19T07:30:56Z 42cb37f26796
---

## Objective
Make the plain baseline and kit arms reproducible under an explicit, observed host configuration.

## Context
- PRD: [Prove reliable delivery with less effort](../.prd/prd-v8.md).
- Implements: R-03.
- Scenarios: S-07, S-08, S-09.
- Relevant paths: `scripts/delivery-benchmark-v7/live-driver.sh`, `scripts/delivery-benchmark-v7/harness.cjs`, `scripts/delivery-benchmark-v7/effort.cjs`.
- Source: [readiness assessment](../docs/pincer-readiness-2026-09-15.md).
- Order, predecessor obligations and verification limits: [v8 ticket map](../docs/prd-v8-ticket-map.md).

## Requirements
- A controlled host containing synthetic personal instructions, hooks, plugins and environment settings launches each arm without those settings leaking into the measured session; intended arm instructions and required authentication remain functional.
- Every launched record captures actual model/tool/version, OS/platform, Node, effective permission posture and allowlisted configuration; missing required metadata or an unverifiable isolation boundary prevents a reportable launch.
- Secret canaries, unrelated environment values and private instruction text appear in neither records nor fingerprints; fresh sessions and handoffs preserve the host approval/sandbox policy and never use disabled approvals to overcome isolation failures.

Use dedicated per-study configuration and explicit environment construction. Verify installed CLI configuration/authentication contracts against current official docs before implementation; do not copy private home directories or credentials. Authentication material stays outside captures. If the chosen CLI cannot provide the intended isolation, record a blocked prerequisite and propose a named configured baseline before running, not a silent relaxation.

## Acceptance Criteria
- [ ] S-07: A controlled host containing synthetic personal instructions, hooks, plugins and environment settings launches each arm without those settings leaking into the measured session; intended arm instructions and required authentication remain functional.
- [ ] S-08: Every launched record captures actual model/tool/version, OS/platform, Node, effective permission posture and allowlisted configuration; missing required metadata or an unverifiable isolation boundary prevents a reportable launch.
- [ ] S-09: Secret canaries, unrelated environment values and private instruction text appear in neither records nor fingerprints; fresh sessions and handoffs preserve the host approval/sandbox policy and never use disabled approvals to overcome isolation failures.

## Verification
Proves: The focused checks exercise the stated controls and failure paths. Static assertions are sufficient only for authored contracts/generated artifacts; behavioral claims require observed outputs, side effects or refusal behavior.
```bash
set -e
node test/benchmark-environment.test.js
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

## Implementation evidence — 19 September 2026

The isolated native launcher and offline environment/custody/capture controls are
implemented and the focused verification passes. No actual CLI session was launched.
Acceptance remains unchecked pending observed native authentication, kit discovery and
managed-policy isolation. The current session has no API key; an environment-based
credential decision and separately capped operational launch remain pending. Synthetic
process records are explicitly fixture/unreportable and do not close this observation.
See `docs/prd-v8-agent-isolation.md` for the reviewed profile and retained evidence format.
