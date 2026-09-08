---
ticket: T-20
status: done
size: S
prd: .prd/prd-v2.md
depends_on: [T-19]
started: 2026-09-08T15:05:03Z
last_check: 2026-09-08T15:05:10Z passed 4465b6064934
verified: 2026-09-08T15:05:10Z 4465b6064934
finished: 2026-09-08T15:05:10Z
---

## Objective
Apply the three kit findings from the 2026-09-08 acceptance trials so a PRD-following breakdown is finalized without asking, supplied requirement IDs survive into evidence, and the reviewer's output is persisted.

## Context
- Trial records: `docs/trial-2026-09-08-greenfield.md` (finding 1), `docs/trial-2026-09-08-brownfield.md` (findings 1 and 2). Implements: R-05 (approval rule), R-01 and R-03 (supplied IDs in evidence), R-03 (review evidence).
- `template/.claude/commands/pincer-narrow.md` step 5 ("Once authorized …") and the paragraph above it.
- `template/scripts/pincer-evidence.cjs` `REQ_ID` regex; `test/evidence.test.js`.
- `template/.claude/commands/pincer-evaluate.md` steps 2 and 9; `test/workflow.test.js`.

## Requirements
- Narrow step 5 is unconditional for a breakdown that follows the PRD: set `status: ticketed`, stage and commit; the playbook says explicitly not to ask in that case and to ask first only when step 4 surfaced a newly discovered consequential choice or a scope change. The phrase "Once authorized" is removed.
- The evidence validator accepts requirement IDs of the form `<UPPERCASE PREFIX>-<digits>` (for example `R-01`, `REQ-1`, `AC-12`) so a supplied PRD's IDs are used verbatim; malformed IDs (lowercase, no dash, no digits) are still rejected. `test/evidence.test.js` covers an accepted `REQ-1` and a rejected `req1`.
- Evaluate persists the code-quality review: the reviewer's findings, or its explicit no-findings statement, are saved as `review/code-quality.md` and recorded as a `review` kind check referenced by the requirements it covers; the manifest field list in the playbook says so.
- `test/workflow.test.js` asserts the narrow wording (no "Once authorized", explicit "do not ask" for a PRD-following breakdown) and the evaluate review artifact wording.

## Acceptance Criteria
- [x] The narrow playbook finalizes a PRD-following breakdown without asking and reserves asking for a newly discovered consequential choice or scope change.
- [x] `pincer-evidence.cjs` accepts `REQ-1` style IDs and rejects malformed ones, with tests.
- [x] The evaluate playbook saves the reviewer output as a `review` check artifact.
- [x] Wording tests, validator tests and generated outputs pass.

## Verification
Proves: the validator accepts PRD-native IDs at runtime and the playbooks carry the corrected contracts (static); regression: a supplied-ID manifest rejected, or narrow wording reverting to a conditional finalization.
```bash
node test/evidence.test.js && node test/workflow.test.js && node test/distribution.test.js
```

## Constraints
- No other kit behavior changes; findings that need design (reviewer transcript format beyond a markdown file) go to the next PRD.
