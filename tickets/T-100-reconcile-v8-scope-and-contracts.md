---
ticket: T-100
status: done
size: M
prd: .prd/prd-v8.md
depends_on: []
timeout: 900
started: 2026-09-19T06:32:21Z
last_check: 2026-09-19T06:37:43Z passed a8dfa97fda3d
verified: 2026-09-19T06:37:43Z a8dfa97fda3d
finished: 2026-09-19T06:37:43Z
---

## Objective
Create one current account of delivered code, unfinished observations and the contracts this increment must preserve.

## Context
- PRD: [Prove reliable delivery with less effort](../.prd/prd-v8.md).
- Implements: R-01.
- Scenarios: S-01, S-02, S-03.
- Relevant paths: `docs/wiki/`, `docs/prd-v7-review-packet.md`, `docs/prd-v8-contracts.md`, `docs/prd-v8-obligation-map.md`.
- Source: [readiness assessment](../docs/pincer-readiness-2026-09-15.md).
- Order, predecessor obligations and verification limits: [v8 ticket map](../docs/prd-v8-ticket-map.md).

## Requirements
- Current-state documentation identifies the reviewed SHA, published versus main versions, evidence candidate and open tickets; every carried v7 obligation has an explicit v8 owner without editing historical receipts or pretending later observations preceded earlier code.
- A preservation and contract document specifies effective execution identity, attempt ownership, complete measurements, guided-authoring grammar and release ordering; mutation cases identify how each guarantee can fail.
- Stale wiki recommendations and live-support claims are reconciled; the unproven runtime lock race, hook false positives and obsolete installed-file cleanup receive evidence-based reproduce/fix/defer dispositions with rationale and follow-up ownership, without asserting an unproven defect is fixed.

Create the focused static-contract suite as part of this ticket. Preserve all frozen v6 assets; use a current overlay when an old file is frozen. Remove the suggestion that an unfrozen helper can change measurement without a cohort change. Review the v7 S-09 temporal obligation explicitly: later pilots cannot retroactively satisfy its original ordering. This ticket records proposed historical dispositions, not invented user decisions.

## Acceptance Criteria
- [x] S-01: Current-state documentation identifies the reviewed SHA, published versus main versions, evidence candidate and open tickets; every carried v7 obligation has an explicit v8 owner without editing historical receipts or pretending later observations preceded earlier code.
- [x] S-02: A preservation and contract document specifies effective execution identity, attempt ownership, complete measurements, guided-authoring grammar and release ordering; mutation cases identify how each guarantee can fail.
- [x] S-03: Stale wiki recommendations and live-support claims are reconciled; the unproven runtime lock race, hook false positives and obsolete installed-file cleanup receive evidence-based reproduce/fix/defer dispositions with rationale and follow-up ownership, without asserting an unproven defect is fixed.

## Verification
Proves: The focused checks exercise the stated controls and failure paths. Static assertions are sufficient only for authored contracts/generated artifacts; behavioral claims require observed outputs, side effects or refusal behavior.
```bash
set -e
node test/readiness-contracts.test.js
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
