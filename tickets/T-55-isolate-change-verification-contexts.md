---
ticket: T-55
status: done
size: M
prd: .prd/prd-v5.md
depends_on: [T-54]
started: 2026-09-11T21:34:43Z
last_check: 2026-09-11T21:42:44Z passed 263d71580859
verified: 2026-09-11T21:42:44Z 263d71580859
finished: 2026-09-11T21:42:44Z
---

## Objective
Isolate attempts and candidate checks by change and revision so PRD v5 can be implemented and reviewed without losing work or trusting stale state.

## Context
- Relevant files: template/scripts/pincer-runtime/state.cjs; runner.cjs; readiness.cjs; lifecycle.cjs; evidence.cjs; pincer-runtime.cjs; test/change-evidence-context.test.js.
- PRD: [Preserve changes, authorization, and resume context](../.prd/prd-v5.md), sections 5–8.
- Implements: R-07.
- Scenarios: S-20, S-21.
- Build order and coverage: [PRD v5 ticket map](../docs/prd-v5-ticket-map.md).

## Requirements
- Namespace ticket/candidate pointers and attempts by change and revision in addition to ticket/check/candidate identity. Validate the complete context when reading, closing and exporting.
- Prove A and B can reuse C-01 and a candidate without exchanging pass/failure records. Build each context through supported lifecycle commands, with no hand-authored fake pass.
- Retain conservative whole-source freshness. A's unchanged agreement can stay authorized after B changes source while A's verification becomes stale.
- Preserve v4 complete-attempt validation, artifact digests, source checks, latest-failure ordering and bounded subprocess cleanup.
- Keep old attempts inspectable with their historical identity; never relabel them as new-schema current evidence.

## Acceptance Criteria
- [x] Same-candidate C-01 attempts for two changes yield separate verdicts; wrong-change/revision pointers refuse.
- [x] B's source change invalidates A's verification without revoking otherwise matching authorization.
- [x] Incomplete/corrupt attempt, altered stdout/stderr, failed recheck and background-child timeout regressions remain blocked/bounded.

## Verification
Proves: Creates colliding check/candidate identifiers through the runtime and injects stale/malformed evidence; prevents cross-change success and reintroduction of v4 review defects.
```bash
node test/change-evidence-context.test.js
node test/runtime-runner.test.js
```

## Constraints
- No scoped hashing optimization; snapshots and exclusions retain conservative correctness.
- Implement the new tests named below as part of this ticket and add them to `npm test`; these are planned test paths, not tests that already pass. Reuse existing fixture helpers. After any `template/` edit, run both generators and include the generated changes. Keep existing ticket history untouched; use a pinned released kit to manage this work.

