# Candidate evidence (schema 1) and the notes_current contract

**Decided:** 2026-09-08, PRD v2 (R-03, R-04), tickets T-13..T-15.

## What

Evaluation writes a JSON manifest and its artifacts under
`.prd/evidence/prd-vN/<candidate>/` and NOTES.md points at it with an
`evidence:` frontmatter field. A dependency-free Node helper,
`template/scripts/pincer-evidence.cjs`, validates the manifest read-only
([[evidence-validator]]). `notes_current` calls that helper and only reports
`current` when (it lived in `pincer-ticket-lib.sh` until T-36 deleted the Bash
library; it is now `notesCurrent()` in `pincer-runtime/status.cjs`, with
`locator.current()` replacing it in changes mode):

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

## Consequence: one candidate carries one manifest

The allowed post-candidate set is *the named manifest's own listed files* — never a
directory, never a pattern. Two manifests under one candidate therefore cannot coexist:
the second one's files are, by construction, an offending post-candidate change, and
`status` reads `stale`. This surfaced when the combined v5+v6 candidate `ce98abd` was
first written with a manifest per PRD. The fix is the model the rule already implies:
**one manifest for the selected PRD; the other PRD's dispositions go in NOTES.md and its
own review packet** — not a weakened check.

## Consequence: the release version bump invalidates the evaluation it releases

Any commit after the candidate that is not NOTES.md or a listed artifact makes status
read `stale: candidate changed after evaluation`, and `npm version` writing
`package.json` is exactly such a commit. So is a wiki edit. There is no ordering that
avoids this and also ships the evaluated tree — the bump has to come after the
evaluation, and the evaluation is of a tree without the bump. At 0.6.0 the bump landed
before the merge and status went stale (`… after evaluation: package.json`); the
evaluated candidate is still `ce98abd` and the record of it is still valid, but the
tool's own readiness line no longer says so. Treat the evaluation as sealed at the
candidate, do the wiki `end` and the bump after the merge, and expect `stale` from that
point until the next candidate. Whether the rule should exempt a version bump is an open
thread, not something to fix by loosening `notes_current`.

## Limits

Validation establishes that the locally authored record is consistent, not that the
commands ran or images depict the app. An older runtime does not enforce the contract
(README and AGENTS.md say so). Durable release records, source-bound receipts and
automated repair were M1 and **have since shipped**: PRD v4 (released as v0.5.0)
added the SHA-256 source manifest and the attempt runner, so readiness emits
`SOURCE_CHANGED` when the source moves under a receipt ([[runtime-owned-verification]],
[[revocable-receipts]]).

Related: [[evidence-validator]], [[release-audit-read-only]], [[distribution-channels]].
