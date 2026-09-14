---
ticket: T-72
status: done
size: M
prd: .prd/prd-v6.md
depends_on: [T-69, T-70]
started: 2026-09-12T09:17:49Z
last_check: 2026-09-12T09:27:40Z passed de3ab52236f5
verified: 2026-09-12T09:27:40Z de3ab52236f5
finished: 2026-09-12T09:27:40Z
---

## Objective
Execute agreement-bound candidate check definitions, as specified in PRD v6, so coverage and delivery claims remain reviewable.

## Context
- PRD: [Complete requirement coverage and explain change impact](../.prd/prd-v6.md).
- Implements: R-06.
- Scenarios: S-16, S-17, S-18.
- Relevant files: template/scripts/pincer-runtime.cjs; template/scripts/pincer-runtime/{runner,gates,state,evidence}.cjs; test/coverage-checks.test.js.
- Build order and shared constraints: [v6 ticket map](../docs/prd-v6-ticket-map.md).

## Requirements
- Execute strict command checks by declared ID/command/timeout and bind attempts to the frozen coverage/agreement identity. Preserve old CLI forms in non-strict modes.
- Reject supplied command/timeout substitutions and cross-change check borrowing. Revalidate declaration and gates under the attempt lock immediately before recording running state.
- Represent review obligations explicitly with candidate-bound artifact/result requirements for downstream export; require all declared required checks, including otherwise unused ones.

## Acceptance Criteria
- [x] S-16..S-18 include substitution, changed timeout, shared C-01, missing review and meaningful failed/unverified review cases.
- [x] Injected pause/reopen/definition change between preflight and lock either refuses without launch/write/output or records the newly validated authorized inputs.
- [x] Existing timeout, captured-log, failure and legacy invocation regressions remain valid.

## Verification
Proves: a reused check ID cannot launder a different command or race past changed authorization.
```bash
node test/coverage-checks.test.js
node test/change-command-gates.test.js
node test/runtime-runner.test.js
```

## Constraints
- Keep prior tickets and user work intact. Use the independent pinned management kit described in the PRD; do not adopt strict coverage in this distribution repository as a side effect.
- New test files above are implementation deliverables, not existing evidence. Add executable suites to `npm test` when implemented; do not create placeholder passes or receipts during planning.
- After a `template/` edit regenerate adapters and plugin using both repository generators. Never hand-edit generated outputs. Preserve v5 regression coverage.
