---
ticket: T-87
status: done
size: M
prd: .prd/prd-v7.md
depends_on: []
timeout: 600
started: 2026-09-14T14:40:24Z
last_check: 2026-09-14T14:40:34Z passed 0ead453ac561
verified: 2026-09-14T14:40:34Z 0ead453ac561
finished: 2026-09-14T14:40:34Z
---

## Objective
Define the experiment and the two additive product interfaces before measurement or implementation, and make the current handover accurate.

## Context
- PRD: [Make trusted delivery easier and cheaper](../.prd/prd-v7.md).
- Implements: R-01.
- Scenarios: S-01, S-02, S-03.
- Relevant files: new docs/prd-v7-protocol.md; docs/wiki/briefing.md; docs/wiki/open-threads.md; template/docs/runtime-contracts.md; new test/improvement-contracts.test.js.
- Build order, verification limits and shared constraints: [v7 ticket map](../docs/prd-v7-ticket-map.md).

## Requirements
- Freeze the baseline commit/package digest, three-project selection rules, event metrics, reviewer rubric, run validity/exclusion rules, cohort identity, configuration isolation and 72-run comparison design. Select exact projects, reviewers and spending caps before live collection, leaving unresolved prerequisites explicit.
- Specify coverage scaffold and resume --brief command grammar, stdout schemas, unresolved-draft representation, full/brief compatibility, error/exit behavior and immutable-input examples. Keep drafts distinct from valid coverage maps and all new commands read-only.
- Map each preserved runtime guarantee to existing suites; define controlled counterexamples for the new surfaces and the complete execution freeze.
- Reconcile the wiki's missing-evaluation/version claims against local history, distinguish historical evidence from current readiness, and retain all v6 frozen files and records unchanged. Do not assert unverified remote publication state.

## Acceptance Criteria
- [x] S-01: A dated, versioned protocol names the baseline, schedule, metrics, review rubric and pending access/cap decisions; no live collection starts on an unspecified protocol.
- [x] S-02: Contract examples and a preservation matrix cover all PRD invariants and opt-in compatibility, including incomplete drafts, stale agreement, malformed input and complete piped output.
- [x] S-03: Handover statements agree with available repository history and evidence, and a byte comparison confirms v6 study artifacts are unchanged.

## Verification
Proves: static protocol/interface contracts and historical preservation; exact project suitability, reviewer independence and spending decisions remain explicit execution prerequisites.
```bash
set -e
node test/improvement-contracts.test.js
node test/change-contracts.test.js
node test/coverage-contracts.test.js
```

## Constraints
- Contract review settles names and shapes, not new runtime state machinery. If the two product improvements do not address observed pilot friction, revise their scope before implementing substitutes.
- Keep this distribution repository in legacy management mode. Use an independently pinned released 0.6.0 management kit outside the tree when implementing; do not manage tickets with runtime code being edited.
- New test files named here are implementation deliverables, not existing evidence. Add implemented executable suites to `npm test`; never create placeholder passes or hand-authored attempt/receipt metadata.
- After any `template/` edit run `bash template/scripts/sync-prompts.sh` and `bash scripts/build-plugin.sh`, and include generated outputs. Preserve prior PRDs, ticket history and unrelated user work.

