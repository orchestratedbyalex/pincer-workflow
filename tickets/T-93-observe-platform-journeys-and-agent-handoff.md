---
ticket: T-93
status: open
size: L
prd: .prd/prd-v7.md
depends_on: [T-92]
timeout: 600
---

## Objective
Demonstrate the shipped strict workflow on Claude Code and Codex and verify that a real agent handoff works from files.

## Context
- PRD: [Make trusted delivery easier and cheaper](../.prd/prd-v7.md).
- Implements: R-07.
- Scenarios: S-19, S-20, S-21.
- Relevant files: new docs/prd-v7-platforms.md; docs/prd-v7-artifacts/platforms/; new test/platform-trial-records.test.js; onboarding support links.
- Build order, verification limits and shared constraints: [v7 ticket map](../docs/prd-v7-ticket-map.md).

## Requirements
- Pin actual installed tool/model versions and allowlisted configurations; verify invocation and permission behavior against installed tools and current official documentation before freezing the sessions.
- Run a full strict journey on each surface with scope revision, pause, fresh-session recovery and schema 3 candidate evaluation. Use shipped instructions and record every repair/intervention and actual user scope decision.
- Start one real change on one surface and resume on the other without a conversational recap; references and recorded state supply context. Preserve existing authorization and explicitly reverify when local attempts are absent.
- Link every observed capability row to exact artifacts/version/configuration. Mark Copilot, plugin-only, Windows and other unobserved combinations accurately; packaged parity cannot close a live criterion.
- Implement validators for required session/artifact/candidate references, including refusal of fixture records mislabeled as live observations.

## Acceptance Criteria
- [ ] S-19: Both required surfaces have reviewed successful full-journey artifacts; failed attempts and repairs remain, and missing required environments remain open.
- [ ] S-20: The handoff recovers next work from files, respects old and revised authorization, handles missing local evidence correctly and reaches valid candidate evidence.
- [ ] S-21: The support matrix separates observed/versioned results from installed/tested and unobserved claims, with resolvable evidence for each observed row.

## Verification
Proves: record integrity and consistency of versioned capability claims; live compliance is established by the referenced session, evaluator and reviewer artifacts, not record shape.
```bash
set -e
node test/platform-trial-records.test.js
node test/strict-onboarding.test.js
```

## Constraints
- Do not expand platform support or weaken sandbox/approval settings to get a passing trial. Access and caps use the protocol's explicit prerequisites.
- Keep this distribution repository in legacy management mode. Use an independently pinned released 0.6.0 management kit outside the tree when implementing; do not manage tickets with runtime code being edited.
- New test files named here are implementation deliverables, not existing evidence. Add implemented executable suites to `npm test`; never create placeholder passes or hand-authored attempt/receipt metadata.
- After any `template/` edit run `bash template/scripts/sync-prompts.sh` and `bash scripts/build-plugin.sh`, and include generated outputs. Preserve prior PRDs, ticket history and unrelated user work.

