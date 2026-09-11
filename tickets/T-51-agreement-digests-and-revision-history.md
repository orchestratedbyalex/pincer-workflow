---
ticket: T-51
status: done
size: M
prd: .prd/prd-v5.md
depends_on: [T-49]
started: 2026-09-11T21:04:12Z
last_check: 2026-09-11T21:09:15Z passed 017a041d7a2b
verified: 2026-09-11T21:09:15Z 017a041d7a2b
finished: 2026-09-11T21:09:15Z
---

## Objective
Identify agreements and retain their authored revisions so PRD v5 can be implemented and reviewed without losing work or trusting stale state.

## Context
- Relevant files: template/scripts/pincer-runtime/parse.cjs; new agreement module; pincer-runtime.cjs; test/change-agreement.test.js.
- PRD: [Preserve changes, authorization, and resume context](../.prd/prd-v5.md), sections 5–8.
- Implements: R-04, R-05.
- Scenarios: S-13, S-14.
- Build order and coverage: [PRD v5 ticket map](../docs/prd-v5-ticket-map.md).

## Requirements
- Compute the versioned agreement digest from change ID, authored PRD revision, authored breakdown and consequential decisions, using T-47's fixed normalization.
- Include ticket IDs, associations, dependency/scope/acceptance text and check definitions. Exclude only lifecycle fields and checkbox marks; implementation source and attempt records do not change authorization.
- Retain old/current authored inputs via snapshots or resolvable committed references; refuse missing historical inputs rather than offering a digest-only review.
- Produce structural artifact differences for a changed PRD under the same filename or changed breakdown. Do not attempt semantic impact inference.
- Write revision preparation through T-48 with expected-version comparison; preparation itself authorizes no execution.

## Acceptance Criteria
- [x] Lifecycle/checkbox changes keep the agreement digest stable; PRD body, acceptance, dependencies and check changes each alter it.
- [x] Old and new agreement inputs remain recoverable and inspectable, including same-filename PRD revisions.
- [x] Malformed authored input, missing historical references and stale revision writes refuse without losing earlier history.

## Verification
Proves: Mutates each included/excluded field and verifies digest changes, revision reconstruction and rejected invalid/stale updates.
```bash
node test/change-agreement.test.js
node test/runtime-parse.test.js
```

## Constraints
- No broad field exclusions; no dependency-scoped source hashing or semantic requirement-impact engine.
- Implement the new tests named below as part of this ticket and add them to `npm test`; these are planned test paths, not tests that already pass. Reuse existing fixture helpers. After any `template/` edit, run both generators and include the generated changes. Keep existing ticket history untouched; use a pinned released kit to manage this work.

