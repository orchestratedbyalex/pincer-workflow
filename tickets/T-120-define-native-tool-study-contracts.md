---
ticket: T-120
status: done
size: M
prd: .prd/prd-v8.md
depends_on: []
timeout: 900
started: 2026-09-20T08:01:07Z
last_check: 2026-09-20T09:17:26Z passed 5ed85d4c3f23
finished: 2026-09-20T08:12:49Z
verified: 2026-09-20T09:17:26Z 5ed85d4c3f23
---

## Objective
Define native-login and subscription-aware study contracts.

## Context
- Implements: R-21.
- Scenarios: S-61, S-62, S-63.
- User-authorized planning revision: [native-tool plan](../docs/prd-v8-native-tool-plan.md).
- PRD: [v8](../.prd/prd-v8.md).

## Requirements
Revise the protocol, isolation, usage semantics, readiness contract, affected T-102/T-105/T-109 and measurement-ticket requirements, and execution-package design using the native-tool amendment. Preserve scenario IDs and old observations. Check official contracts for each intended surface; do not assume Claude-specific debug logs or CLI automation apply to Copilot. Use the openai-docs skill when researching Codex authentication. Specify schema/profile migration and rollback before implementation. Regenerate the frozen cohort for changed frozen docs.

Create test/native-tool-contracts.test.js to verify the authored schema examples reject ambiguous billing, missing mandatory observations and incompatible profiles; static assertions are appropriate for these declared contracts only. Add the suite to npm test and update current suite counts. Human review must assess the feasibility and honesty of the design; keyword tests alone cannot prove native login works.

## Acceptance Criteria
- [x] S-61: Document the host-tool boundary and exact supported platform/version login and capture contracts; no Pincer-managed provider keys or direct model API path.
- [x] S-62: Specify authenticated isolation without credential copying, with explicit blockers or declared controlled-host limits when isolation cannot be demonstrated.
- [x] S-63: Specify subscription-aware usage, allocation, readiness and comparison rules that distinguish expected unavailable billing from missing required evidence.

## Verification
Proves: The declared contract or fixture entry-point behavior matches the amended native-login design, including rejection paths. These commands do not prove actual account authentication or execute a live study.
```bash
set -e
node test/native-tool-contracts.test.js
node test/readiness-contracts.test.js
node test/execution-freeze.test.js
```

New test files are deliverables, not checks claimed to exist or pass today. Use meaningful behavior/schema cases, not placeholder success. Verify through the independent pinned management kit; never hand-edit lifecycle receipts.

## Authored contract — 20 September 2026

The contract is `docs/prd-v8-native-tool-contracts.md`; the protocol, isolation and usage documents carry the amendment and the frozen cohort was regenerated (`a6a6d474…`). Installed help for Claude Code 2.1.278 and Codex CLI 0.155.1 and the official pages were read on 20 September 2026; Copilot CLI is not installed and remains unobserved. The criteria are ticked as authored-contract deliverables; human review must still assess the feasibility and honesty of the design, and no login, isolation or subscription behavior has been observed.

## Constraints
- No provider key requirement, direct model API client, copied credential store, login-token extraction, inferred approval or automatic billing fallback.
- Preserve evidence freshness, prior failures, restart safety, unrelated work and historical cohort identities.
- No live model session, account access, spending, merge or publication is authorized by this planning ticket.
- Regenerate adapters/plugin after any template changes; regenerate the cohort after frozen-input changes.

## Technical review corrections — 20 September 2026

Corrected the cross-surface schema acceptance, removed the invented Codex hook prerequisite, restored Copilot VS Code as the shipped surface, and specified shared login-directory custody and interruption recovery. Authored-contract checks reject relabelled records and unknown Claude authentication providers/methods. T-121 carries the required runtime failure/concurrency tests. No native behavior is claimed.

The pinned legacy kit supports verification of completed tickets but has no ticket-reopen command (`start` rejects done tickets). Historical lifecycle fields were not edited by hand; correction verification is recorded through the kit. This is an assistant technical review, not a claimed independent human sign-off.
