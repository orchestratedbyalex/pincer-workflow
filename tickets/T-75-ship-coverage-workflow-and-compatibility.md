---
ticket: T-75
status: open
size: M
prd: .prd/prd-v6.md
depends_on: [T-74]
---

## Objective
Ship strict coverage through every layout and playbook, as specified in PRD v6, so coverage and delivery claims remain reviewable.

## Context
- PRD: [Complete requirement coverage and explain change impact](../.prd/prd-v6.md).
- Implements: R-08, R-09.
- Scenarios: S-24.
- Relevant files: template/.claude/commands/*; template/.claude/references/*; template/AGENTS.md; template/docs/*; bin/pincer.js; generated plugin and adapters; test/coverage-distribution.test.js.
- Build order and shared constraints: [v6 ticket map](../docs/prd-v6-ticket-map.md).

## Requirements
- Update canonical plan/narrow/code/evaluate/release to author the map once, inspect computed coverage/impact and disposition changed scope before recording authorization; generic continue never approves revised scope.
- Ship adoption/rollback and declared-check guidance, guard new runtime-owned snapshots without blocking authored map edits, and retain installer preservation/diagnosis.
- Regenerate both adapter/plugin outputs. Test full strict journeys from every packed layout and plugin runtime, old-runtime rejection and unknown schemas; distinguish packaged parity from live platform observation.

## Acceptance Criteria
- [ ] S-24 runs strict register/adopt/authorize/complete/check/export/report journeys against packed copies and asserts equal runtime digests.
- [ ] Generated instructions consistently route through coverage/impact and distinguish structural checks from adequacy judgment; installed user files survive updates.
- [ ] Full local suite and generator parity pass; supported CI results are recorded by T-78.

## Verification
Proves: packed copies implement the same behavior and generated playbooks preserve decisions, old projects and installation rules.
```bash
node test/coverage-distribution.test.js
node test/workflow.test.js
npm test
```

## Constraints
- Keep prior tickets and user work intact. Use the independent pinned management kit described in the PRD; do not adopt strict coverage in this distribution repository as a side effect.
- New test files above are implementation deliverables, not existing evidence. Add executable suites to `npm test` when implemented; do not create placeholder passes or receipts during planning.
- After a `template/` edit regenerate adapters and plugin using both repository generators. Never hand-edit generated outputs. Preserve v5 regression coverage.
