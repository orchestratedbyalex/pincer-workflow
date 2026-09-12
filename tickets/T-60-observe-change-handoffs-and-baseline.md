---
ticket: T-60
status: done
size: M
prd: .prd/prd-v5.md
depends_on: [T-59]
started: 2026-09-12T00:12:58Z
last_check: 2026-09-12T01:16:35Z passed 2398cefbedc1
verified: 2026-09-12T01:16:35Z 2398cefbedc1
finished: 2026-09-12T01:16:35Z
---

## Objective
Observe live change handoffs and record the baseline so PRD v5 can be implemented and reviewed without losing work or trusting stale state.

## Context
- Relevant files: docs/trial-prd-v5.md (new); docs/prd-v5-artifacts/ (new); test/change-trial-record.test.js (new); packed artifact and isolated fixtures.
- PRD: [Preserve changes, authorization, and resume context](../.prd/prd-v5.md), sections 5–8.
- Implements: R-10, R-06, R-02, R-04, R-05, R-08.
- Scenarios: S-30, S-31, S-32.
- Build order and coverage: [PRD v5 ticket map](../docs/prd-v5-ticket-map.md).

## Requirements
- Run the packed kit on a greenfield project and a brownfield project with unrelated edits. Observe A active → pause → B complete → fresh-session select/resume A, with original authorization retained and evidence freshness reported.
- Observe a consequential scope change blocking until the actual decision is recorded, and interruption of verification followed by explicit recovery and correct resume.
- Record kit digest, repository bases, model/tool versions, exact prompts, actual commands/outcomes, artifact references and operator interventions. Use current host permissions; do not assume permission bypass.
- Collect wrong-change actions, repeated unchanged approvals, manual repairs, time to identify next action and unnecessary evaluations. Use the same bounded v0.5.0 baseline where supported; record unsupported steps explicitly.
- Add a record-format validator that checks all required scenario dispositions, artifact references and counts, rejecting missing/outstanding required observations for ticket closure. It validates evidence completeness, not whether an agent genuinely complied; inspect transcripts separately.

## Acceptance Criteria
- [x] S-30 is observed on both project types in fresh sessions, with no lost unrelated edits and no repeated approval of unchanged scope.
- [x] S-31 changed-scope and interruption/recovery observations have actual transcripts/artifacts; failed findings remain visible and route through fix tickets.
- [x] S-32 baseline counts and limitations are recorded, with no unsupported parity/superiority claim.
- [x] Any unavailable required trial remains outstanding and this ticket stays open until observed or explicitly re-scoped by the user.

## Verification
Proves: Checks completeness and resolvability of recorded live evidence and replays deterministic gates. Agent compliance is established by the referenced observations and reviewer inspection, not a prose-matching test.
```bash
node test/change-trial-record.test.js
node test/change-resume.test.js
node test/change-command-gates.test.js
```

## Constraints
- Do not fabricate transcripts or close on 'outstanding'. A runtime trial defect needs a separate fix ticket and revised evidence.
- Implement the new tests named below as part of this ticket and add them to `npm test`; these are planned test paths, not tests that already pass. Reuse existing fixture helpers. After any `template/` edit, run both generators and include the generated changes. Keep existing ticket history untouched; use a pinned released kit to manage this work.

