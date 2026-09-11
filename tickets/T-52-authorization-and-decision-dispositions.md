---
ticket: T-52
status: done
size: M
prd: .prd/prd-v5.md
depends_on: [T-51]
started: 2026-09-11T21:09:55Z
last_check: 2026-09-11T21:17:50Z passed f31247b9fac4
verified: 2026-09-11T21:17:50Z f31247b9fac4
finished: 2026-09-11T21:17:50Z
---

## Objective
Record authorization and disposition agreement changes so PRD v5 can be implemented and reviewed without losing work or trusting stale state.

## Context
- Relevant files: new authorization/decision module; template/scripts/pincer-runtime.cjs; agreement module; test/change-authorization.test.js.
- PRD: [Preserve changes, authorization, and resume context](../.prd/prd-v5.md), sections 5–8.
- Implements: R-04, R-05, R-09.
- Scenarios: S-11, S-12, S-15, S-16, S-28.
- Build order and coverage: [PRD v5 ticket map](../docs/prd-v5-ticket-map.md).

## Requirements
- Record current agreement digest, recoverable reviewed inputs, faithful user instruction/reference, constraints/delegation, timestamp and decision linkage. Validate the reference chain and change identity.
- Support new authorization and within-existing-delegation dispositions as distinct records. A delegation disposition includes the original authorization and a reviewable explanation; its semantic adequacy remains explicit reviewer judgment.
- Old free text, built/ticketed status, a passing test or registration cannot prove authorization. A matching genuine prior instruction can be recorded without another prompt.
- Return reusable current/missing/wrong-change/unmatched/unresolved-decision verdicts for T-54. New authorized agreements never reuse old check evidence when inputs changed.
- Reject duplicate conflicting decisions, dangling references, invalid schemas and stale agreement commits. Repeating the identical valid record is idempotent.

## Acceptance Criteria
- [x] Existing exact user authorization enables the agreement once, with no duplicate event on repeat; wrong-change/missing/mismatched references remain blocked.
- [x] A delegated regression-check improvement records its original basis against the new digest without a new user approval and still requires fresh verification.
- [x] Changed behavior and unresolved consequential decisions cannot be silently approved or presented as delivered; historical free text alone is insufficient.

## Verification
Proves: Exercises concrete authorization/disposition records and rejection paths, including prior instructions and legacy text. Tests validate structure and enforcement, not human intent.
```bash
node test/change-authorization.test.js
```

## Constraints
- Do not infer independent human identity, weaken acceptance to bypass failure, or hold locks while requesting a decision.
- Implement the new tests named below as part of this ticket and add them to `npm test`; these are planned test paths, not tests that already pass. Reuse existing fixture helpers. After any `template/` edit, run both generators and include the generated changes. Keep existing ticket history untouched; use a pinned released kit to manage this work.

