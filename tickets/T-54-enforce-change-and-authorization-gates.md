---
ticket: T-54
status: open
size: M
prd: .prd/prd-v5.md
depends_on: [T-53]
---

## Objective
Apply selection, lifecycle, and authorization gates to commands so PRD v5 can be implemented and reviewed without losing work or trusting stale state.

## Context
- Relevant files: template/scripts/pincer-runtime/lifecycle.cjs; readiness.cjs; status.cjs; pincer-runtime.cjs; test/change-command-gates.test.js.
- PRD: [Preserve changes, authorization, and resume context](../.prd/prd-v5.md), sections 5–8.
- Implements: R-02, R-03, R-04, R-05, R-08.
- Scenarios: S-04, S-08, S-09, S-11, S-12, S-13, S-14, S-15, S-16, S-26.
- Build order and coverage: [PRD v5 ticket map](../docs/prd-v5-ticket-map.md).

## Requirements
- Route ticket start/done, activation/resume/reopen and candidate execution/export through common identity, lifecycle, agreement and decision guards. Check/write operations use transactional expected-state validation.
- Allow ticket verify for authorized active or completed changes. Refuse execution for planned, paused, cancelled, superseded or wrong-selected changes before spawning or writing ticket lifecycle.
- Read-only readiness/release gates must report non-ready for missing authorization without hiding historical evidence. Inspection, registration, revision preparation and explicit crash recovery remain available.
- Use marker-emitting commands to prove refused operations never launch, and file snapshots to prove they never mutate lifecycle state.
- Preserve released legacy/v0.5.0 behavior until migration; new-schema errors cannot switch to permissive fallback.

## Acceptance Criteria
- [ ] Every executable/mutating entry point rejects wrong selection, invalid lifecycle, stale agreement and unresolved decisions before side effects.
- [ ] Unchanged authorization survives ordinary start/verify/done and fresh-session resume; delegated revisions require new verification but no redundant user approval.
- [ ] Historical inspection and explicit recovery remain usable while execution is blocked; human/JSON/gate reason codes agree.
- [ ] Existing legacy regression suites remain green.

## Verification
Proves: Tests the public command boundary with execution markers, unchanged-file assertions and matching readiness verdicts; catches unguarded alternate entry points.
```bash
node test/change-command-gates.test.js
node test/ticket.test.js
node test/verification.test.js
```

## Constraints
- Do not treat stored authorization as authenticated identity or retrofit the new contract onto unmigrated projects.
- Implement the new tests named below as part of this ticket and add them to `npm test`; these are planned test paths, not tests that already pass. Reuse existing fixture helpers. After any `template/` edit, run both generators and include the generated changes. Keep existing ticket history untouched; use a pinned released kit to manage this work.

