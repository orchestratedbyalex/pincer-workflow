---
ticket: T-64
status: done
size: M
prd: .prd/prd-v5.md
depends_on: []
started: 2026-09-12T06:32:38Z
last_check: 2026-09-12T06:39:45Z passed 4debe0681d9b
verified: 2026-09-12T06:39:45Z 4debe0681d9b
finished: 2026-09-12T06:39:45Z
---

## Objective
Fix review finding 2 on the built PRD v5 candidate: release readiness accepts unvalidated files after the candidate. The locator's currency check allows whole `.prd/evidence/prd-v*/<candidate>/` directories and any locator-shaped filename under `.prd/evidence/changes/`, so an unlisted JavaScript file committed under another PRD's evidence directory plus an invalid JSON locator still leave `ready` at exit 0. Only validated, explicitly listed evaluation artifacts may follow the candidate, as R-07 requires.

## Context
- Relevant files: template/scripts/pincer-runtime/locator.cjs (`current`, a new `followers`); template/scripts/pincer-runtime.cjs (`requireCandidateView`); template/docs/runtime-contracts.md ("Evaluation locator", "Source manifest"); test/change-evaluations.test.js; test/change-contracts.test.js; docs/prd-v5-review-packet.md section 10 item 1.
- PRD: [Preserve changes, authorization, and resume context](../.prd/prd-v5.md), R-07 (S-22, S-23).
- Source: the user's review of `feat/prd-v5` at `1a5cbc5`, finding 2 (P1).
- Implements: R-07 ("Do not relax post-candidate commit checks for entire directories"; "saved as validated, listed evaluation artifacts").

## Requirements
- The set of paths that may differ from the candidate is computed, not pattern-matched: `NOTES.md`; every locator under `.prd/evidence/changes/` that parses and validates for its own id; and, for each locator entry naming this candidate whose manifest validates with file digests for its candidate, base and PRD, that manifest and the files it lists. Nothing else: not an unlisted file in a candidate's evidence directory, not an unreadable or misnamed locator.
- `ready`/status report `stale: candidate changed after evaluation: <path>` (committed) or `working tree has changes outside the candidate's evidence: <path>` (dirty) for any other path; `ready` exits 1.
- `check`/`evidence export` keep allowing the PRD's own `.prd/evidence/prd-vN/<candidate>/` directory while it is assembled, and use the same computed set for everything else.
- Evaluating a second change on the same candidate still works (S-22), since its manifest and listed files become followers once its locator is written.
- The contract and its pins say so; the packet's deviation 1 is rewritten to the new rule.

## Acceptance Criteria
- [x] An unlisted file committed under another PRD's evidence directory for the candidate makes the evaluated change stale and `ready` exit 1; so does a malformed locator file and an unlisted file inside the change's own evidence directory.
- [x] S-22 (two changes evaluated on one candidate) and S-23 still pass.
- [x] Contract, pins, packet deviation and generated copies updated.

## Verification
Proves: the reviewer's reproduction now fails readiness, and the legitimate second evaluation still passes.
```bash
node test/change-evaluations.test.js
node test/change-contracts.test.js
node test/runtime-evidence.test.js
```

## Constraints
- Findings on done tickets are fixed here, never by editing T-56. After any `template/` edit run both generators and include the generated files. Manage this ticket with the pinned released v0.5.0 kit.
