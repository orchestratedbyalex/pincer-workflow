---
ticket: T-28
status: done
size: S
prd: .prd/prd-v3.md
depends_on: [T-27]
started: 2026-09-11T07:01:49Z
last_check: 2026-09-11T07:08:35Z passed 35973d4f1c49
verified: 2026-09-11T07:08:35Z 35973d4f1c49
finished: 2026-09-11T07:08:35Z
---

## Objective
Fix the evaluation findings on candidate 7c19e42: the recovery exception's second condition must exempt the ticket file being restored, and the PRD and T-27 texts must describe the trial as it happened.

## Context
- Relevant files: `template/.claude/commands/pincer-code.md` (recovery section, "tracked files match the evaluated candidate"), `.prd/prd-v3.md` (Problem paragraph, R-01 exception bullet, Success Criteria rows 4 and 5), `tickets/T-27-trial-record-prd-v3.md` (Objective and the negative-case requirement), `test/workflow.test.js`.
- Source: code-quality review of `d15933d..7c19e42`, findings 1–4 (saved as `review/code-quality.md` in the evidence directory for the next candidate).
- Implements: R-01

## Requirements
- The code playbook's second condition reads: tracked files other than the ticket file being restored match the evaluated candidate (or the candidate plus its evidence-only commit), with nothing untracked. The literal phrase `other than the ticket file being restored` appears and is asserted in `test/workflow.test.js`.
- The PRD's R-01 exception bullet carries the same condition; its Problem paragraph says the agent was asked to restore the ticket while the source fault was still in place, reverted the source itself, re-verified and committed the refresh; Success Criteria row 4 is marked `outstanding (see Out of Scope)` and row 5 says R-02 was observed as a by-product of the trial re-evaluation.
- T-27's Objective and negative-case requirement say the negative case was attempted and recorded honestly or as `outstanding`, matching its acceptance criteria; its Verification block is unchanged.
- Generated outputs regenerated; no other wording changes.

## Acceptance Criteria
- [x] The exception condition is satisfiable as written, in the code playbook, its generated copies and the PRD.
- [x] PRD Problem and Success Criteria and the T-27 body agree with `docs/trial-2026-09-10-prd-v3.md`.
- [x] `npm test` passes with the new assertion; generators produce no further diff.

## Verification
Proves: the corrected condition is present in source, plugin and test, the other assertions still hold, and generated output is current; regression: the phrase missing anywhere or stale generated output. Static assertions are primary evidence for this wording change.
```bash
npm test && grep -q 'other than the ticket file being restored' template/.claude/commands/pincer-code.md && grep -q 'other than the ticket file being restored' plugin/commands/code.md && grep -q 'other than the ticket file being restored' test/workflow.test.js && grep -q 'other than the ticket file being restored' .prd/prd-v3.md && grep -q 'outstanding (see Out of Scope)' .prd/prd-v3.md && ! grep -q 'negative case keeps the failure' tickets/T-27-trial-record-prd-v3.md && h() { find template/.agents template/.github plugin -type f | sort | xargs shasum -a 256 | shasum -a 256; } && before=$(h) && bash template/scripts/sync-prompts.sh >/dev/null && bash scripts/build-plugin.sh >/dev/null && [ "$(h)" = "$before" ]
```

## Constraints
- Do not touch T-24..T-27 lifecycle fields or T-27's Verification block.
- No other wording changes; the trial record stays as recorded.
