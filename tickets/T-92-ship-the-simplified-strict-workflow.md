---
ticket: T-92
status: open
size: M
prd: .prd/prd-v7.md
depends_on: [T-90, T-91]
timeout: 600
---

## Objective
Make strict adoption and recovery follow a short, coherent shipped journey grounded in the baseline observations.

## Context
- PRD: [Make trusted delivery easier and cheaper](../.prd/prd-v7.md).
- Implements: R-06.
- Scenarios: S-16, S-17, S-18.
- Relevant files: template/.claude/commands/ and references; template/docs/runtime-contracts.md; README.md; generated adapters/plugin; new test/strict-onboarding.test.js.
- Build order, verification limits and shared constraints: [v7 ticket map](../docs/prd-v7-ticket-map.md).

## Requirements
- Lead README onboarding with install, coverage choice, scaffold/author/review, actual authorization, code, brief recovery and evaluation. Move historical update detail to a linked migration/changelog document while preserving its useful instructions.
- Integrate scaffold and brief commands into canonical guidance. Remove demonstrated redundant context reads and lifecycle instructions without skipping reviewed agreement, material decisions or necessary verification.
- Preserve existing explicit approval across unchanged continuation, name the exact missing decision on scope changes, and distinguish draft completeness, structural coverage and delivered evidence.
- Add a packed-install scripted walkthrough that follows the documented commands through unresolved mapping, reviewed adoption, paused recovery and stale-authorization refusal; retain installer preservation cases.
- Regenerate every adapter/plugin and document management-kit pinning plus installation-tested versus live-observed support. Live support claims are updated only from T-93 evidence.

## Acceptance Criteria
- [x] S-16: The packed walkthrough reaches strict adoption using an authored reviewed scaffold and resumes via brief output; missing mappings and stale authorization produce actionable refusals.
- [x] S-17: Instructions reuse unchanged authorization and require actual revised-scope decisions; generated parity and repeated-update preservation pass.
- [x] S-18: The first-use journey is visible before historical migration detail, baseline modes and kit pinning are documented, and no installation check is presented as a live platform trial.

## Verification
Proves: documented command usability in packed fixtures, static authorization-guidance contracts, preservation and generated parity; T-93 verifies actual agent behavior.
```bash
set -e
node test/strict-onboarding.test.js
node test/workflow.test.js
node test/installer.test.js
node test/distribution.test.js
node test/coverage-distribution.test.js
```

## Constraints
- Do not modify runtime authorization policy merely to simplify prose, install new platform hooks, or hand-edit generated artifacts.
- Keep this distribution repository in legacy management mode. Use an independently pinned released 0.6.0 management kit outside the tree when implementing; do not manage tickets with runtime code being edited.
- New test files named here are implementation deliverables, not existing evidence. Add implemented executable suites to `npm test`; never create placeholder passes or hand-authored attempt/receipt metadata.
- After any `template/` edit run `bash template/scripts/sync-prompts.sh` and `bash scripts/build-plugin.sh`, and include generated outputs. Preserve prior PRDs, ticket history and unrelated user work.

