---
ticket: T-14
status: done
size: M
prd: .prd/prd-v2.md
depends_on: [T-11, T-13]
started: 2026-09-08T14:35:58Z
last_check: 2026-09-08T14:36:39Z passed d73c7d94a7f5
verified: 2026-09-08T14:36:39Z d73c7d94a7f5
finished: 2026-09-08T14:36:39Z
---

## Objective
Make evaluate select a clean committed candidate after the PRD built transition, persist schema-1 evidence for that candidate, and reference the manifest from NOTES.md in one scoped follow-up commit.

## Context
- PRD: `.prd/prd-v2.md`, requirements R-03 (evaluate half) and R-04 (candidate ordering). Implements: R-03, R-04.
- Dry-run findings 2 and 9 in `docs/dry-run-2026-09-08-sonnet.md`: screenshots were described but not persisted; the built-status flip sat in its own commit.
- `template/.claude/commands/pincer-evaluate.md` steps 1, 4 and 9; `template/.claude/commands/pincer-code.md` "When all tickets are done".
- Evidence schema and CLI from T-13 (`template/scripts/pincer-evidence.cjs`).
- `test/workflow.test.js` for wording contracts.

## Requirements
- Code playbook: when all tickets are done, set the PRD to `status: built` and commit that change (`PRD vN: built`) before handing over; it is part of the candidate, never moved into a later evidence-only commit.
- Evaluate playbook step 1: require implementation, tickets and the PRD built transition to be committed and the working tree clean, then record `candidate = git rev-parse HEAD` and the base. Everything reviewed is that candidate.
- Evaluate playbook adds an evidence step: create `.prd/evidence/prd-vN/<candidate>/`, save command logs (redacted summaries or safe logs, never secrets or environment dumps) and visual captures (scenario, viewport, observed result, image) as artifacts, compute digests with `node scripts/pincer-evidence.cjs digest`, and write `manifest.json` per schema 1 with per-requirement dispositions, check results, coverage review, environment and tool limitations. Non-UI changes record `visual_review.applicable: false` with a reason. Unavailable tools produce `unverified` checks, never fabricated artifacts. Validate with `node scripts/pincer-evidence.cjs validate <manifest> --candidate <candidate> --prd <prd>` before committing.
- Evaluate playbook step 9: NOTES.md frontmatter gains `evidence: .prd/evidence/prd-vN/<candidate>/manifest.json`; the notes reference the manifest and summarize dispositions. The subsequent commit stages only NOTES.md, the manifest and its artifacts (`evaluate: PRD vN candidate <short sha>`).
- Review fixes go through tickets, produce a new candidate and require a fresh evaluation and evidence directory; the playbook says so and never edits an existing manifest for a different candidate.
- `test/workflow.test.js` asserts: code playbook commits the built transition; evaluate requires a clean committed candidate before review, writes the manifest under the evidence path, validates it with the helper, adds `evidence:` to NOTES.md, and limits the follow-up commit to NOTES.md plus listed evidence files.

## Acceptance Criteria
- [x] The code playbook commits the PRD built transition before evaluate selects the candidate, and the evaluate playbook refuses to review an uncommitted or dirty candidate.
- [x] The evaluate playbook writes `.prd/evidence/prd-vN/<candidate>/manifest.json` and artifacts per schema 1, validates them with the helper, and records why visual review is not applicable for non-UI work.
- [x] NOTES.md carries `evidence:` pointing at the manifest, and the follow-up commit is limited to NOTES.md plus the listed evidence files.
- [x] Review fixes require a new ticket, candidate and evaluation; `node test/workflow.test.js` covers these contracts and generated outputs match.

## Verification
Proves: the playbooks carry the evidence and candidate-ordering contract (static contract, wording assertions) and generated outputs match; agent behavior itself is validated by the T-19 trials.
```bash
node test/workflow.test.js && node test/distribution.test.js
```

## Constraints
- Do not change `notes_current`, status or release here (T-15).
- No hosted evidence storage or screenshot diffing.
