---
ticket: T-15
status: done
size: M
prd: .prd/prd-v2.md
depends_on: [T-13, T-14]
started: 2026-09-08T14:36:40Z
last_check: 2026-09-08T14:41:39Z passed cc263b6da56d
verified: 2026-09-08T14:41:39Z cc263b6da56d
finished: 2026-09-08T14:41:39Z
---

## Objective
Make status and release use the shared evidence validator, extend `notes_current` to allow only NOTES.md plus that evaluation's listed evidence files after the candidate, and keep the release audit read-only.

## Context
- PRD: `.prd/prd-v2.md`, requirements R-03 (status/release half) and R-04. Implements: R-03, R-04.
- `template/scripts/pincer-ticket-lib.sh` `notes_current`; `template/scripts/pincer-status.sh` Notes line and Next logic.
- `template/.claude/commands/pincer-release.md` and `template/docs/release-checklist.md` (items on NOTES.md, visual evidence and the release gate).
- `test/recovery.test.js` has the existing `notes_current` cases; new `test/candidate.test.js` for the extended rules.
- Validator CLI from T-13.

## Requirements
- `notes_current`: read `evidence:` from NOTES.md. Without it, return `stale: legacy evaluation without evidence manifest — re-run /pincer-evaluate for evidence schema 1` (legacy notes stay readable but never grant readiness). With it, run `node "$LIB_DIR/pincer-evidence.cjs" validate <manifest> --candidate <candidate> --prd <prd> --files`; a validator failure returns `stale: evidence invalid: <first diagnostic>`. The allowed post-candidate change set is exactly NOTES.md, the manifest and the listed artifacts; `git diff --name-only <candidate> HEAD` outside that set is stale, naming the first offending path. Every listed file must be tracked at HEAD (`git ls-files --error-unmatch`), otherwise `stale: evidence not tracked`. The working tree must be clean except NOTES.md (unchanged M0 exemption while notes are being written). Ancestry and dirty-tree checks remain.
- `pincer-status.sh`: print an `Evidence` line (`manifest path · ok` or the diagnostic) when NOTES.md names a manifest; the Next line recommends `/pincer-evaluate` whenever notes are not current. Note that an older runtime does not enforce this contract (README/AGENTS one-liner).
- Release playbook: validate evidence through `scripts/pincer-status.sh` (which calls the shared validator) rather than re-implementing checks; run the candidate-wide project gate directly; report PASS/FAIL with the candidate ID and reasons; state that it does not repair tickets, rewrite evidence, change PRD state or publish, and that a check that mutates the candidate invalidates the audit (`git status --short` must be empty afterwards). The verdict is reported to the user; a durable runtime-owned release record is later work.
- Release checklist: NOTES.md item requires `evidence:` and a passing validation; the visual-evidence item reads from the manifest (`visual_review` or visual checks) instead of chat; add "evidence files are tracked and the working tree is clean after the audit".
- `test/candidate.test.js` (temporary repositories): candidate plus a valid evidence-only commit is `current`; each of source change, PRD change, ticket change, unlisted file under `.prd/evidence/`, and an unrelated evaluation directory after the candidate is `stale` with the named reason; legacy NOTES.md without `evidence:` is stale with the re-evaluate message; tampered artifact is stale; untracked evidence is stale; running status leaves `git status --porcelain` and tracked content unchanged. Add to the `npm test` chain and keep `test/recovery.test.js` green (update its legacy expectations).
- `test/workflow.test.js`: release playbook wording (no repair, no evidence rewrite, no PRD state change, no publish, mutation invalidates the audit).

## Acceptance Criteria
- [x] A candidate followed by a valid evidence-only commit reports `current`; source, PRD, ticket, unlisted-file and unrelated-evidence changes report `stale` with the path or reason named.
- [x] Legacy NOTES.md without `evidence:` reports stale with an explicit re-evaluation message; tampered or untracked evidence reports stale via the shared validator.
- [x] Status prints the evidence diagnostic and the audit leaves tracked and untracked state unchanged.
- [x] Release playbook and checklist read evidence through status, run the gate directly, and state the non-mutation guarantees; `node test/candidate.test.js`, `node test/recovery.test.js` and `node test/workflow.test.js` pass.

## Verification
Proves: notes_current reports current only for a candidate plus its listed evidence and stale for every other change class, in temporary repositories; regression: a change class accepted or the audit mutating state.
```bash
node test/candidate.test.js && node test/recovery.test.js && node test/workflow.test.js && grep -q 'candidate.test.js' package.json && node test/distribution.test.js
```

## Constraints
- Do not exempt all of `.prd/` or the whole evidence tree.
- Ticket receipt checks and installer manifest format stay unchanged.
- No durable release record file.
