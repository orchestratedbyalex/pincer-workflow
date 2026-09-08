---
ticket: T-21
status: done
size: M
prd: .prd/prd-v2.md
depends_on: [T-20]
started: 2026-09-08T15:15:40Z
last_check: 2026-09-08T15:22:38Z passed ae159249f464
verified: 2026-09-08T15:22:38Z ae159249f464
finished: 2026-09-08T15:22:38Z
---

## Objective
Fix the six evaluation findings on candidate `2952e62`: path-relative and quoting mismatches that make `notes_current` report false `stale`, usage errors surfaced as evidence verdicts, the 40/64-hex inconsistency, the unchecked manifest `base`, and whole-tree restores slipping past the ticket guard.

## Context
- Review record: `.prd/evidence/prd-v2/2952e62f75e518ae8bf3142ec30e7abc052d7a21/review/code-quality.md` (kept in the superseded evidence directory). Implements: R-04 (findings 1, 2, 5, 6), R-03 (finding 4), R-06 (finding 3).
- `template/scripts/pincer-ticket-lib.sh` `evidence_validate`, `evidence_reason`, `notes_current`; `template/scripts/pincer-status.sh` Evidence line; `template/scripts/pincer-evidence.cjs` CLI flags; `template/.claude/hooks/hook-policy.cjs` `ticketShellMutation`; `template/.claude/commands/pincer-code.md` recovery section.
- Tests: `test/candidate.test.js`, `test/evidence.test.js`, `test/hooks.test.js`, `test/recovery.test.js`, `test/workflow.test.js`.

## Requirements
- `notes_current` compares the validator's file list with `git -c core.quotePath=false diff --name-only --relative`, so a project that is a subdirectory of the git toplevel and an artifact with a non-ASCII name are `current` after a valid evidence-only commit. Candidates and bases are 40-hex only; the 64-hex branch is removed.
- `evidence_validate` omits `--candidate`, `--base` and `--prd` when the value is absent or malformed, and `evidence_reason` reports a validator usage error (exit 2) as `validator usage: …`, never as a manifest verdict. The status `Evidence` line therefore never blames the manifest for an argument the script fabricated.
- The validator gains `--base <sha>`; a mismatch fails with `wrong base`. `notes_current` and status pass NOTES.md's base.
- A visual check needs a saved image only when its result is `passed`; an `unverified` visual check (browser unavailable) is representable without an image and, when required, blocks readiness — found by the no-browser evaluate trial, where the agent had to fall back to `visual_review.applicable: false`.
- The ticket guard blocks whole-tree restores that would revive a revoked receipt regardless of whether a ticket path is named: `git checkout`/`git restore` with pathspec `.`, `:/`, `./`, `*`, `tickets` or `tickets/…`, or `restore` without a pathspec; `git reset --hard|--merge|--keep`; `git stash` (push, save, pop, apply, drop, clear, or bare); `git clean -f…` with no pathspec. Branch switches (`git checkout main`, `git checkout -b x`), `git restore src/app.js`, `git reset --soft HEAD~1`, `git stash list|show`, and `git clean -n` stay allowed. The code playbook's recovery section describes exactly this coverage.
- Tests: `test/candidate.test.js` gains the subdirectory-project and non-ASCII-artifact cases (both `current`) and a wrong-base case (`stale`); `test/evidence.test.js` covers `--base`; `test/hooks.test.js` covers the blocked and allowed git forms above; `test/recovery.test.js` uses whole-tree forms after a failed recheck; `test/workflow.test.js` checks the recovery wording.

## Acceptance Criteria
- [x] A subdirectory project and a non-ASCII artifact name report `current` after a valid evidence-only commit; a manifest with a different `base` reports `stale: evidence invalid: wrong base`.
- [x] Status never prints a validator usage message as the manifest's verdict; malformed NOTES fields skip the corresponding flag.
- [x] Whole-tree restores, hard resets and stash operations are blocked by the ticket guard while branch switches and file-specific restores outside `tickets/` stay allowed.
- [x] All listed tests and generated outputs pass.

## Verification
Proves: the runtime scripts and hook behave correctly on the reported layouts and command forms in temporary repositories and direct hook payloads; regression: a false stale, a leaked usage message, or a whole-tree restore passing the guard.
```bash
node test/candidate.test.js && node test/evidence.test.js && node test/hooks.test.js && node test/recovery.test.js && node test/workflow.test.js && node test/distribution.test.js
```

## Constraints
- Do not loosen any existing guard rule or accept paths outside the evidence directory.
