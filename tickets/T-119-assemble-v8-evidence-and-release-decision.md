---
ticket: T-119
status: open
size: M
prd: .prd/prd-v8.md
depends_on: [T-116, T-117, T-118]
timeout: 1800
---

## Objective
Give reviewers a reproducible, candidate-bound account of every requirement and the evidence for the next product decision.

## Context
- PRD: [Prove reliable delivery with less effort](../.prd/prd-v8.md).
- Implements: R-20.
- Scenarios: S-58, S-59, S-60.
- Relevant paths: `docs/prd-v8-review-packet.md`, `NOTES.md`, `.prd/evidence/prd-v8/`, `docs/kit-maintenance-checklist.md`.
- Source: [readiness assessment](../docs/pincer-readiness-2026-09-15.md).
- Order, predecessor obligations and verification limits: [v8 ticket map](../docs/prd-v8-ticket-map.md).

## Requirements
- Every v8 scenario and carried v7 obligation maps to implementation plus actual evidence or an explicit unfinished disposition; absent sessions/reviews, forged links and wrong candidates fail the completion gate, and historical build-order deviations are never rewritten as success.
- Final version metadata, authored docs and generated outputs precede candidate selection; full regression, real-browser gate, generator/packed parity and Ubuntu/macOS by Node 22/24 CI pass for the selected implementation candidate.
- Evaluation and a read-only release audit bind the selected candidate with the unchanged evidence allowlist; later changes stale it normally, measured targets have honest met/missed dispositions, and merging/tagging/publishing remain separate authorized actions.

Create the final packet validator and include executable offline suites in npm test; live models never run there. New implementation defects discovered in review get linked fix tickets before candidate reselection. A future scope split can release a bounded subset only through an explicit PRD disposition and separate candidate evaluation; it cannot label this whole programme complete. Keep frozen inputs and evaluated source unchanged while gathering external/private review data; finalize authored reports before final candidate selection and retain exact study-kit identities.

## Acceptance Criteria
- [ ] S-58: Every v8 scenario and carried v7 obligation maps to implementation plus actual evidence or an explicit unfinished disposition; absent sessions/reviews, forged links and wrong candidates fail the completion gate, and historical build-order deviations are never rewritten as success.
- [ ] S-59: Final version metadata, authored docs and generated outputs precede candidate selection; full regression, real-browser gate, generator/packed parity and Ubuntu/macOS by Node 22/24 CI pass for the selected implementation candidate.
- [ ] S-60: Evaluation and a read-only release audit bind the selected candidate with the unchanged evidence allowlist; later changes stale it normally, measured targets have honest met/missed dispositions, and merging/tagging/publishing remain separate authorized actions.

## Verification
Proves: The focused checks exercise the stated controls and failure paths. Static assertions are sufficient only for authored contracts/generated artifacts; behavioral claims require observed outputs, side effects or refusal behavior.
```bash
set -e
npm test
node test/benchmark-browser-live.test.js
node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/study.json --section all --require-observed
node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/competitive.json --section competitive --require-observed
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
