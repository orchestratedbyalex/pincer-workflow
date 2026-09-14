---
ticket: T-94
status: done
size: L
prd: .prd/prd-v7.md
depends_on: [T-87, T-88]
timeout: 600
started: 2026-09-14T14:43:23Z
last_check: 2026-09-14T14:47:08Z passed 62c9c9a564ec
verified: 2026-09-14T14:47:08Z 62c9c9a564ec
finished: 2026-09-14T14:47:08Z
---

## Objective
Create a fully frozen comparison that distinguishes plain, default and strict workflows and tests continuity and preservation independently.

## Context
- PRD: [Make trusted delivery easier and cheaper](../.prd/prd-v7.md).
- Implements: R-08.
- Scenarios: S-22, S-23, S-24.
- Relevant files: scripts/delivery-benchmark/ (versioned v7 path); new test/fixtures/delivery-benchmark-v7/; new test/delivery-benchmark-v7.test.js; docs/prd-v7-protocol.md.
- Build order, verification limits and shared constraints: [v7 ticket map](../docs/prd-v7-ticket-map.md).

## Requirements
- Build a separate v7 edition retaining the six bounded task types and adding two three-or-more-session/two-change briefs for revision/recovery and brownfield maintenance/review. Preserve the original v6 edition and raw records.
- Give every brief independent held-out acceptance and preservation checks, working controls and meaningful injected faults; the candidate's own test suite is supplementary. Evidence-binding checks reject unlisted artifacts and stale/wrong-change candidates.
- Include real browser observation for UI behavior in live evaluation and a testable browser-evaluation adapter; missing browser tooling is unavailable, never an automatic acceptance.
- Create a balanced 72-run schedule: eight briefs, three matched repetitions and three arms. Isolate and record configuration, equalize task/base/model/tool/caps, and verify actual strict adoption separately from outcomes.
- Freeze all execution/evaluation inputs including driver and collector before candidate tasks begin; retain old cohorts on protocol changes. Default tests use controlled offline drivers and make no paid model calls.
- Document validity, exclusions, partial-work evaluation and arm-label mismatch consistently with T-87/T-88. Validate config contamination and absent adoption as protocol failures.

## Acceptance Criteria
- [x] S-22: All eight working controls pass held-out checks; each meaningful omitted-behavior, preservation, evidence-binding and UI fault fails its intended evaluator.
- [x] S-23: A deterministic schedule covers all 72 unique cells in balanced arm order, with matched inputs and required observed strict adoption.
- [x] S-24: Changed execution inputs create a new cohort, old records remain unchanged, invalid/partial cases retain reasons and reports distinguish independent tests from own-tests.

## Verification
Proves: schedule/protocol integrity and evaluator sensitivity against independently faulty/working controls, while preserving the old benchmark; actual model/browser observations belong to T-95.
```bash
set -e
node test/delivery-benchmark-v7.test.js
node test/execution-freeze.test.js
node test/delivery-benchmark.test.js
```

## Constraints
- Freeze evaluators before measured implementation work. Never edit v6 frozen files to retroactively repair its methodology, and do not equate metadata-valid with independently accepted.
- Keep this distribution repository in legacy management mode. Use an independently pinned released 0.6.0 management kit outside the tree when implementing; do not manage tickets with runtime code being edited.
- New test files named here are implementation deliverables, not existing evidence. Add implemented executable suites to `npm test`; never create placeholder passes or hand-authored attempt/receipt metadata.
- After any `template/` edit run `bash template/scripts/sync-prompts.sh` and `bash scripts/build-plugin.sh`, and include generated outputs. Preserve prior PRDs, ticket history and unrelated user work.

