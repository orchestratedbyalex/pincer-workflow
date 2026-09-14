---
ticket: T-95
status: open
size: L
prd: .prd/prd-v7.md
depends_on: [T-93, T-94]
timeout: 600
---

## Objective
Measure whether the improved workflow saves effort while preserving quality, and publish a local result even when it is unfavorable.

## Context
- PRD: [Make trusted delivery easier and cheaper](../.prd/prd-v7.md).
- Implements: R-09.
- Scenarios: S-25, S-26, S-27.
- Relevant files: new docs/prd-v7-comparison.md; docs/prd-v7-artifacts/comparison/; docs/prd-v7-pilots.md; new test/improvement-trial-records.test.js.
- Build order, verification limits and shared constraints: [v7 ticket map](../docs/prd-v7-ticket-map.md).

## Requirements
- Prepare the concrete costed schedule and settle only missing caps/access decisions before running the frozen 72-run comparison. Retain all failures/invalid runs and evaluate usable partial candidates according to the protocol.
- Repeat the three baseline pilot task types on matched disposable snapshots with the improved strict kit; pin both kits, control ordering and record learning effects. These pairs supply baseline-versus-improved evidence independently of the three-arm comparison.
- Collect at least two non-implementing reviewers' timed decisions on matched candidate tasks using the frozen rubric, blinded to arm where feasible. Record reviewer identity pseudonyms, order, prior exposure, confidence, missed faults and minutes.
- Produce offline-recomputable per-task and per-arm reports with acceptance, independent regressions, stage effort, interventions, usage/cost, variation, denominators and null reasons.
- Assess half the avoidable workflow operations on paired pilots and reduced median short-task cost/time with quality and invariants intact. Report missed targets and uncertainty; do not require favorable numbers to satisfy honest measurement.
- Record real observations and independent review evidence; unavailable required runs/reviews keep criteria unchecked and cannot be replaced by synthetic data.

## Acceptance Criteria
- [ ] S-25: All 72 benchmark cells and three paired pilots have actual completed results, retained failures and inspectable raw-to-report provenance; missing required observations remain unfinished.
- [ ] S-26: Timed independent review records include actual decisions, mistakes/confidence and elapsed minutes on matched tasks; null is never rewritten to zero.
- [ ] S-27: The report evaluates each predeclared target using the correct baseline, reports unfavorable effects and quality separately, and supports no superiority claim beyond the evidence.

## Verification
Proves: observed-record completeness, candidate/evaluator provenance and recomputed comparisons; independent acceptance, live execution and reviewer judgments must be inspected separately.
```bash
set -e
node test/improvement-trial-records.test.js
node test/strict-pilot-records.test.js
node test/delivery-benchmark-v7.test.js
```

## Constraints
- No silent replacements, historical rerating, cherry-picking, pooled-arm shortcuts or weakening of evidence gates. If budget forces fewer runs, revise scope explicitly before treating a smaller study as complete.
- Keep this distribution repository in legacy management mode. Use an independently pinned released 0.6.0 management kit outside the tree when implementing; do not manage tickets with runtime code being edited.
- New test files named here are implementation deliverables, not existing evidence. Add implemented executable suites to `npm test`; never create placeholder passes or hand-authored attempt/receipt metadata.
- After any `template/` edit run `bash template/scripts/sync-prompts.sh` and `bash scripts/build-plugin.sh`, and include generated outputs. Preserve prior PRDs, ticket history and unrelated user work.

