# Code-quality review — PRD v3

Reviewer: `general-purpose` subagent applying `template/.claude/agents/code-quality-reviewer.md`
as the rubric, dispatched 2026-09-11 on `git diff d15933d..7c19e42` (the first candidate)
with the PRD's Scope and Success Criteria, the ticket list, and instructions to check the
generated outputs for drift and every new assertion for vacuity.

## Reviewer report (verbatim)

Setup checks: `git status --short` is empty after running both generators at 7c19e42 (no
drift). `npm test` passes all 12 suites. Every new regex in `test/workflow.test.js` matches a
literal phrase in its source (the `\s+` ones cover the line wraps); none is vacuous —
deleting any pinned sentence breaks a literal match. Evaluate step 9 conflicts with nothing in
`pincer-evidence.cjs` (`command` is only required for `kind: command`, `note` exists for
redactions). No contradiction with `pincer-release.md`, `release-checklist.md` ("run directly,
without invoking the ticket state writer" agrees with the new "run directly rather than
through `verify`") or the hook guard (the assistant still may not restore; the user does).

1. `template/.claude/commands/pincer-code.md:90-92` (also `.prd/prd-v3.md`, T-24) — the
   exception's second condition is literally unsatisfiable. "tracked files match the
   evaluated candidate … with nothing untracked" — but the ticket file is tracked and by
   construction differs (its receipt was revoked; that is the reason to restore it). A
   literal reader never applies the exception; a loose reader must guess which tracked files
   are exempt. Fix: "tracked files other than the ticket file being restored match…".
2. `tickets/T-27-trial-record-prd-v3.md` Objective and Requirement contradict its own
   acceptance criteria and the record: they say the negative case "keeps the failure" /
   "does not recommend restoring the receipt" while the record says the assistant did name
   `git checkout` and the scenario "was therefore not observed". Fix: reword to "attempted;
   recorded honestly or `outstanding`".
3. `.prd/prd-v3.md` Problem paragraph misdescribes the trial it cites: "after a source fault
   had been reverted, the agent repaired the source itself" is self-contradictory; the fault
   was still in place and the agent reverted it. Fix the sentence.
4. `.prd/prd-v3.md` Success Criteria rows 4 and 5 are stale against the record: row 4 reads
   as a live criterion with no marker although Out of Scope cuts it; row 5 says R-02 live
   observation is outstanding while the trial row says it was observed as a by-product.
5. `tickets/T-25-one-command-per-check.md` — `git diff --quiet HEAD -- pincer-evidence.cjs
   test/evidence.test.js` is vacuous after commit: once T-25 is committed the working tree
   equals HEAD, so a later re-verify proves nothing about "validator unchanged".
6. Hash-before/after check (T-24/25/26 Verification): sound. A generator failure breaks the
   chain; added or removed files change the `find` set; output is deterministic. It verifies
   idempotence of the working tree, not committed content — `test/distribution.test.js`
   inside `npm test` covers the latter.
7. Trial record: internally consistent and honest. It does not claim the negative
   observation; its Finding 1 (which environment "run directly" means) is a real gap in the
   shipped wording — the observed agent hit "block fails on that clean tree" under the
   session's `PATH` and still applied the exception. Recorded and deferred in Out of Scope.

Verdict: mergeable after fixing 1–3 (wording only); generated outputs are current and the
suite passes.

## Dispositions

| # | Disposition |
| --- | --- |
| 1 | Fixed in T-28 (`a10358e`): "tracked files other than the ticket file being restored match the evaluated candidate", in the code playbook, its three generated copies and the PRD's R-01 bullet; pinned by a new assertion in `test/workflow.test.js`. |
| 2 | Fixed in T-28: T-27's Objective and negative-case requirement now say attempted and recorded honestly or as `outstanding`; its Verification block and receipt are unchanged. |
| 3 | Fixed in T-28: the Problem paragraph now says the fault was still in place when the restore was requested. |
| 4 | Fixed in T-28: row 4 marked `outstanding (see Out of Scope)` with the attempt noted; row 5 says R-02 was observed as a by-product and R-03 live is outstanding. |
| 5 | Known issue, not fixed: the check was meaningful when `verify` ran before the T-25 commit (the validator was untouched in the working tree). Changing a done ticket's Verification block would invalidate its receipt, so the block stays; `test/evidence.test.js` inside `npm test` is the durable guard. |
| 6 | No action. |
| 7 | No action in this PRD; the wording question is recorded as trial finding 1 and in the PRD's Out of Scope for follow-up. |

## Second candidate

The fix diff `7c19e42..a10358e` touches only the four texts named above plus generated copies
and one test line (8 files, 60 insertions, 14 deletions). It was reviewed by the evaluator
against the findings rather than re-sent to the subagent: every change is a sentence the
reviewer proposed, and `npm test` (C-01), the generator no-drift check (C-02) and the secret
scan (C-04) were re-run on `a10358e`.
