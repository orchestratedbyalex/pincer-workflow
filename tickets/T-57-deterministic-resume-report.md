---
ticket: T-57
status: done
size: M
prd: .prd/prd-v5.md
depends_on: [T-56]
started: 2026-09-11T21:50:17Z
last_check: 2026-09-11T21:57:10Z passed 270759d73793
verified: 2026-09-11T21:57:10Z 270759d73793
finished: 2026-09-11T21:57:10Z
---

## Objective
Render deterministic resume context and next actions so PRD v5 can be implemented and reviewed without losing work or trusting stale state.

## Context
- Relevant files: template/scripts/pincer-runtime/status.cjs; new resume rendering module; pincer-runtime.cjs; test/change-resume.test.js.
- PRD: [Preserve changes, authorization, and resume context](../.prd/prd-v5.md), sections 5–8.
- Implements: R-06, R-02, R-03, R-04, R-05, R-07.
- Scenarios: S-17, S-18, S-19.
- Build order and coverage: [PRD v5 ticket map](../docs/prd-v5-ticket-map.md).

## Requirements
- Implement read-only resume inspection separately from change resume activation, with human and versioned JSON outputs.
- Include selected identity, lifecycle, HEAD/base/dirty paths, authored outcome/constraints and references, agreement/decisions, tickets, attempts, candidate verdict, pause/reopen reason and optional labeled handoff.
- Compute next-action precedence exactly as the PRD specifies. Invalid state, unresolved runs, mismatched context and agreement gaps outrank ordinary implementation/evaluation advice.
- Summaries and handoff notes cannot override runtime facts. Render without an LLM, environment dump or whole transcript.
- Use a fresh subprocess with no prior conversation to inspect saved records; keep full machine-readable diagnostics behind concise human output.

## Acceptance Criteria
- [x] All required report fields and actionable blockers are available from files alone, including multiple simultaneous blockers with deterministic precedence.
- [x] A note claiming approval or success cannot override an unmatched agreement or failed/stale check.
- [x] Repeated reports create no writes, child verification, duplicate approvals or selection changes; human/JSON/command verdicts agree.

## Verification
Proves: Loads fresh-process state, injects misleading notes and competing blockers, and compares reports to gates while asserting zero inspection side effects.
```bash
node test/change-resume.test.js
node test/change-command-gates.test.js
```

## Constraints
- Do not create a general chat-memory feature or make narrative summaries authoritative.
- Implement the new tests named below as part of this ticket and add them to `npm test`; these are planned test paths, not tests that already pass. Reuse existing fixture helpers. After any `template/` edit, run both generators and include the generated changes. Keep existing ticket history untouched; use a pinned released kit to manage this work.

