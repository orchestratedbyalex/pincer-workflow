---
ticket: T-71
status: done
size: M
prd: .prd/prd-v6.md
depends_on: [T-69]
started: 2026-09-12T09:11:59Z
last_check: 2026-09-12T09:17:41Z passed aaf5a971c7ae
verified: 2026-09-12T09:17:41Z aaf5a971c7ae
finished: 2026-09-12T09:17:41Z
---

## Objective
Explain structural requirement and verification impact, as specified in PRD v6, so coverage and delivery claims remain reviewable.

## Context
- PRD: [Complete requirement coverage and explain change impact](../.prd/prd-v6.md).
- Implements: R-04.
- Scenarios: S-10, S-11, S-12.
- Relevant files: new template/scripts/pincer-runtime/impact.cjs; agreement.cjs; coverage.cjs; test/coverage-impact.test.js.
- Build order and shared constraints: [v6 ticket map](../docs/prd-v6-ticket-map.md).

## Requirements
- Compare current inputs to explicit retained agreement, defaulting as specified, and report additions/removals/content/link/check changes with reasons.
- Resolve direct affected tickets/checks and separately labelled dependency dependents; report unscoped changes to constraints and unsupported/missing history honestly.
- Keep impact read-only and separate from conservative whole-source evidence freshness; never auto-approve, rewrite or launch checks.

## Acceptance Criteria
- [x] S-10..S-12 include a one-scenario change, graph-only change, removed definition, unscoped prose and unavailable history.
- [x] An A/B/A fixture retains unchanged agreement while source-changed evidence stays stale.
- [x] Repeated human/JSON input computation leaves tracked and runtime files unchanged.

## Verification
Proves: impact names the correct direct/dependent links without reviving stale evidence or hiding unscoped changes.
```bash
node test/coverage-impact.test.js
node test/change-evidence-context.test.js
```

## Constraints
- Keep prior tickets and user work intact. Use the independent pinned management kit described in the PRD; do not adopt strict coverage in this distribution repository as a side effect.
- New test files above are implementation deliverables, not existing evidence. Add executable suites to `npm test` when implemented; do not create placeholder passes or receipts during planning.
- After a `template/` edit regenerate adapters and plugin using both repository generators. Never hand-edit generated outputs. Preserve v5 regression coverage.
