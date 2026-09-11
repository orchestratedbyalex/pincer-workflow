---
ticket: T-49
status: done
size: M
prd: .prd/prd-v5.md
depends_on: [T-48]
started: 2026-09-11T20:42:01Z
last_check: 2026-09-11T20:55:14Z passed 7d8793264538
verified: 2026-09-11T20:55:14Z 7d8793264538
finished: 2026-09-11T20:55:14Z
---

## Objective
Retain and validate multiple change records so PRD v5 can be implemented and reviewed without losing work or trusting stale state.

## Context
- Relevant files: template/scripts/pincer-runtime/identity.cjs; parse.cjs; pincer-runtime.cjs; test/change-registry.test.js.
- PRD: [Preserve changes, authorization, and resume context](../.prd/prd-v5.md), sections 5–8.
- Implements: R-01, R-09.
- Scenarios: S-01, S-02, S-03.
- Build order and coverage: [PRD v5 ticket map](../docs/prd-v5-ticket-map.md).

## Requirements
- Implement register/list/show for the new schema, preserving all prior change records and histories. Registration writes through T-48.
- Require unique change IDs and a unique owning change for each PRD; ticket IDs remain repository-wide and each ticket resolves through its PRD association.
- Validate fields, contained paths, recoverable revision references, schema versions and duplicate associations before writes or child execution.
- Refuse the old migrated register --replace deletion behavior with explicit select/supersede guidance. Do not silently convert a v0.5.0 binding.
- Keep legacy and v0.5.0 inspection behavior until explicit migration; unreadable new records never trigger legacy fallback.

## Acceptance Criteria
- [x] Register A then B retains A's identity, ticket association, history and evaluation references.
- [x] Duplicate IDs/PRD ownership, malformed JSON, unresolved references, path escapes and unknown schemas refuse without mutation.
- [x] New-schema --replace cannot remove A; list/show are read-only and report all retained changes.

## Verification
Proves: Registers and resolves multiple real change records, injects duplicate/malformed input, and verifies preservation and non-destructive replacement refusal.
```bash
node test/change-registry.test.js
node test/runtime-identity.test.js
```

## Constraints
- Do not introduce per-change ticket numbering or implicit activation/authorization.
- Implement the new tests named below as part of this ticket and add them to `npm test`; these are planned test paths, not tests that already pass. Reuse existing fixture helpers. After any `template/` edit, run both generators and include the generated changes. Keep existing ticket history untouched; use a pinned released kit to manage this work.

