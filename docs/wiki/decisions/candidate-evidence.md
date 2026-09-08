# Candidate evidence (schema 1) and the notes_current contract

**Decided:** 2026-09-08, PRD v2 (R-03, R-04), tickets T-13..T-15.

## What

Evaluation writes a JSON manifest and its artifacts under
`.prd/evidence/prd-vN/<candidate>/` and NOTES.md points at it with an
`evidence:` frontmatter field. A dependency-free Node helper,
`template/scripts/pincer-evidence.cjs`, validates the manifest read-only
([[evidence-validator]]). `notes_current` in `pincer-ticket-lib.sh` calls that
helper and only reports `current` when:

- NOTES.md names the selected PRD, a base and a candidate that are ancestors of HEAD;
- NOTES.md has `evidence:` (legacy notes without it are `stale: legacy evaluation
  without evidence manifest — re-run /pincer-evaluate for evidence schema 1`);
- the validator passes for that candidate and PRD;
- every file the manifest lists is tracked at HEAD;
- `git diff --name-only <candidate> HEAD` touches nothing except NOTES.md, the
  manifest and the listed artifacts (first offending path is named);
- the working tree is clean apart from NOTES.md (M0 rule kept).

Candidate ordering: `/pincer-code` commits the PRD `status: built` flip on its own
(`PRD vN: built`) before `/pincer-evaluate` records `candidate = HEAD`; evaluate
refuses a dirty tree; review fixes make a new candidate and a fresh evidence
directory. The evidence commit contains only NOTES.md plus listed files.

## Why

The Sonnet dry run (`docs/dry-run-2026-09-08-sonnet.md`) took screenshots and
described them in chat; nothing was persisted and release could not inspect them.
Exempting all of `.prd/` would let an evidence-only commit smuggle PRD edits, so the
allowed set is exactly the listed files. Legacy NOTES.md must not silently receive the
stronger guarantee, hence the explicit re-evaluate message.

## Rejected

- Directory convention or path-existence checks only: insufficient by PRD wording.
- Re-implementing evidence checks in the release playbook: one validator, called from
  status, keeps policy in one place.
- Exempting the whole evidence tree in `notes_current`: would hide unrelated or
  tampered evaluations.

## Limits

Validation establishes that the locally authored record is consistent, not that the
commands ran or images depict the app. An older runtime does not enforce the contract
(README and AGENTS.md say so). Durable release records, source-bound receipts and
automated repair stay in M1 ([[revocable-receipts]]).
