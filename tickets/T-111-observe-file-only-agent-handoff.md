---
ticket: T-111
status: open
size: L
prd: .prd/prd-v8.md
depends_on: [T-110]
timeout: 900
---

## Objective
Prove that a real strict change can move between Claude Code and Codex using the shipped artifacts.

## Context
- PRD: [Prove reliable delivery with less effort](../.prd/prd-v8.md).
- Implements: R-12.
- Scenarios: S-34, S-35, S-36.
- Relevant paths: `docs/prd-v8-platforms.md`, `docs/prd-v8-artifacts/platforms/`, `docs/prd-v7-platforms.md`, `template/.claude/commands/`.
- Source: [readiness assessment](../docs/pincer-readiness-2026-09-15.md).
- Order, predecessor obligations and verification limits: [v8 ticket map](../docs/prd-v8-ticket-map.md).

## Current scope amendment

Tool invocation contracts are the [native-tool contracts](../docs/prd-v8-native-tool-contracts.md) (T-120): Claude Code and Codex CLI use their own sign-in; GitHub Copilot has no study profile and remains unobserved until exercised through its actual supported interface, never simulated with an API client.

## Requirements
- Each platform completes an actual strict journey with install, revision, pause/resume and evaluated candidate under recorded exact versions/configuration; overlapping T-110 sessions may be reused with explicit stage references.
- A change begun on Claude Code resumes on Codex from files without conversational recap, preserving current authorization and requiring fresh verification when worktree-local attempt evidence is unavailable.
- Wrong selection, changed agreement and unavailable tools remain explicit blockers; support documentation distinguishes installed, observed and unobserved surfaces and retains failures before repairs.

Reuse genuinely equivalent evidence for T-93 without changing old receipts or inventing compliance. Review tool invocation contracts at execution time. Copilot, plugin-only and native Windows stay unobserved unless separately studied. Human inspection of linked sessions is required in addition to the record gate.

## Acceptance Criteria
- [ ] S-34: Each platform completes an actual strict journey with install, revision, pause/resume and evaluated candidate under recorded exact versions/configuration; overlapping T-110 sessions may be reused with explicit stage references.
- [ ] S-35: A change begun on Claude Code resumes on Codex from files without conversational recap, preserving current authorization and requiring fresh verification when worktree-local attempt evidence is unavailable.
- [ ] S-36: Wrong selection, changed agreement and unavailable tools remain explicit blockers; support documentation distinguishes installed, observed and unobserved surfaces and retains failures before repairs.

## Verification
Proves: The command validates retained real observation records and required references; actual agent behavior and reviewer judgment require inspecting the linked evidence. It must fail when the observation section is absent or outstanding.
```bash
set -e
node test/platform-trial-records.test.js
node scripts/delivery-benchmark-v7/validate-study.cjs --manifest docs/prd-v8-artifacts/execution/study.json --section platforms --require-observed
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
