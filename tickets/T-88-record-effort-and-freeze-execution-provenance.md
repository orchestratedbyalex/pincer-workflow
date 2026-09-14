---
ticket: T-88
status: done
size: M
prd: .prd/prd-v7.md
depends_on: [T-87]
timeout: 600
started: 2026-09-14T14:40:50Z
last_check: 2026-09-14T14:43:22Z passed 1b39526c9467
verified: 2026-09-14T14:43:22Z 1b39526c9467
finished: 2026-09-14T14:43:22Z
---

## Objective
Make effort and acceptance records reproducible without mistaking missing data or a changed driver for a valid run.

## Context
- PRD: [Make trusted delivery easier and cheaper](../.prd/prd-v7.md).
- Implements: R-02.
- Scenarios: S-04, S-05, S-06.
- Relevant files: scripts/delivery-benchmark/ (versioned additions); new test/fixtures/delivery-benchmark-v7/; new test/effort-records.test.js; new test/execution-freeze.test.js.
- Build order, verification limits and shared constraints: [v7 ticket map](../docs/prd-v7-ticket-map.md).

## Requirements
- Implement the v7 event/run record and offline report projection with timestamps and interval semantics for setup, authoring, verification, recovery, review, active session and elapsed time. Preserve provider duration separately; deduplicate events and overlapping intervals under the frozen rules.
- Bind each run to base/kit, prompts, model/tool/OS versions, cap settings, evaluator, live driver, effort collector and an allowlisted configuration inventory. Keep raw private captures outside tracked artifacts and persist sanitized provenance sufficient for review.
- Freeze every executable/input that determines a session or verdict. Changed fingerprints require a new cohort; malformed records, duplicate IDs, missing mandatory provenance and traversal/symlink escapes fail nonzero.
- Use controlled subprocess fixtures to record real outcomes, partial work, errors, timeout and interruption. Unknown cost/time is null with a reason. Report regeneration makes no network or model calls.
- Make default test execution offline: live collection must be an explicit command outside npm test.

## Acceptance Criteria
- [x] S-04: A two-session fixture links real commands, intervention events, candidate and evaluator results; report totals recompute without double-counting concurrent intervals.
- [x] S-05: Missing provenance or evaluators cannot yield accepted; null metrics stay distinguishable from measured zero, and a usable cap-terminated candidate is evaluated under the protocol.
- [x] S-06: Mutation of each frozen driver/configuration/prompt/cap/evaluator input is detected; secret canaries and unsafe references are rejected or redacted, and offline report replay is deterministic.

## Verification
Proves: collection, aggregation, invalid-input refusal, execution identity and redaction against controlled subprocess outcomes; no live delivery benefit is inferred.
```bash
set -e
node test/effort-records.test.js
node test/execution-freeze.test.js
node test/delivery-benchmark.test.js
```

## Constraints
- Preserve v6 record reading and its original freeze. Do not collect full environments, credential values or secret-value hashes.
- Keep this distribution repository in legacy management mode. Use an independently pinned released 0.6.0 management kit outside the tree when implementing; do not manage tickets with runtime code being edited.
- New test files named here are implementation deliverables, not existing evidence. Add implemented executable suites to `npm test`; never create placeholder passes or hand-authored attempt/receipt metadata.
- After any `template/` edit run `bash template/scripts/sync-prompts.sh` and `bash scripts/build-plugin.sh`, and include generated outputs. Preserve prior PRDs, ticket history and unrelated user work.

