---
name: pincer-release
description: "Audit the evaluated candidate, record the person's acceptance, and commit only that acceptance before the final clean-tree check"
argument-hint: "[none]"
---
# Release

Runs a read-only audit first, then records and commits the person's acceptance.
The audit fixes nothing: a failed implementation or evidence check returns to its
stage through a new ticket. Acceptance is a separate, narrowly scoped write after
the person says yes. Keep the evaluated candidate, the audited checkout and the
acceptance commit distinct; an acceptance commit is not a new tested implementation.

## Reads
- `docs/release-checklist.md`: the items, grouped Tickets, Evidence, Review, Acceptance.
- `harness.json`: `stages.release.audit` (`tree` or `pr`), `systems.deploy`, `repo.checks`, `repo.pr`, `repo.branches`, `homes.evidence`, `people` (who may accept).
- `scripts/pincer-status.sh`: every ticket's state, receipts, acceptances and warnings.
- The evidence manifest under the evidence home when `stages.evaluate.evidence` is on; the review report.
- With `pr`: `gh pr view <number> --json state,mergedAt,statusCheckRollup` and `gh pr checks <number>`.
- Each ticket's `## Done when` and `## How the person checks`.

## Steps
1. [session] Run `scripts/pincer-status.sh --stage release`; on a non-zero exit print its message and stop. Read `harness.json` and `docs/release-checklist.md`. Record the full `audit_head` from `git rev-parse HEAD`. With evidence on, record the evaluated `candidate` from its manifest; without evidence, the candidate is `audit_head`. Compare the candidate to `audit_head`: only the retained evaluation artifacts and previously recorded acceptance fields may differ. Any implementation, check, spec or agreement change needs a new evaluation; never relabel an old manifest as the current candidate.
2. [session] Run `scripts/pincer-status.sh`. Every ticket of the change must be `done` with `verified` on its line. Before acceptance, a `T-NN done without acceptance` warning is expected for an unaccepted ticket and does not block the technical audit; every other warning fails it. Record those tickets as pending acceptance, never as accepted.
3. [session] Read-only audit. `git status --short` must be empty before and after it, including the index. With `tree`, run every command in `repo.checks` (or `npm test` when empty) directly and quote the output. With `pr`, the implementation pull request must be merged with green checks and the deploy named in `systems.deploy` must have been observed. Do not run `verify`, `done`, `accept` or any other file write during this phase. A check that changes the tree fails the audit; do not clear the change to make it pass.
4. [session] Evidence and review: with evidence on, run `node scripts/pincer-evidence.cjs validate <manifest> --candidate <candidate>`; it must print `ok`, and every listed artifact must be tracked. The review report must exist and every finding have a disposition; every implementation fix after evaluate needs its own `T-NN:` commit and a new evaluation. Confirm `HEAD` is still `audit_head`.
5. [session] Present the checklist with evidence per item. Technical items are pass or fail; acceptance items remain pending until the person responds. A technical failure stops here and names the stage to fix it. Otherwise show the result, each ticket's `## Done when` lines, and how to check it, then ask whether the person accepts. This is not a final PASS yet.
6. [session] Only after the person says so, run `scripts/pincer-ticket.sh accept T-NN --by "<name>" --words "<their words>"` for each ticket they accept. The name must be an acceptor in `people`; quote their actual words, never a paraphrase or a synthetic approval. Do not rewrite an already accepted ticket unless the person explicitly replaces that acceptance. A declined or unanswered ticket stays unaccepted and the final verdict remains pending or failed.
7. [session] Commit the acceptance separately. Inspect `git diff --name-only`, `git diff --unified=0 -- <accepted ticket paths>`, and the index. The entire diff from `audit_head` may change only `accepted`, `accepted_by`, and `accepted_words` in those tickets' frontmatter; no ticket body, verification receipt, other field, source file or evidence artifact may change. Unexpected changes stop release; do not hide, restore or include them. Stage only the explicit ticket paths, inspect `git diff --cached`, then commit as `accept: <candidate short sha>`. Record the full `acceptance_commit`. If no new acceptance was written, make no empty commit and retain the existing acceptance commit identity. Follow the agreement's branch and PR policy; pushing or merging needs the user's existing authorization or a new explicit instruction. When that policy requires an acceptance PR, keep release pending until it is merged and its required checks pass.
8. [session] Final check. `git status --short` must be empty. Inspect the committed diff from `audit_head` through the acceptance commit again: only the three acceptance fields in the accepted tickets may differ. Run status: every ticket of the change must be done, verified and accepted by a named person, with no warnings. When evidence is on, revalidate the unchanged evidence against the original `candidate`, not the acceptance commit. A changed artifact, unexpected commit or implementation change fails this check and requires a new evaluation.
9. [session] Verdict: `PASS — candidate <candidate>, acceptance commit <acceptance_commit>: workflow artifacts complete and accepted` only when all applicable items pass, including any required acceptance PR. Otherwise report `PENDING — candidate <candidate>: <remaining acceptance or publication step>` or `FAIL — candidate <candidate>: <failed items>; fix via <command>`. Name every failed item first. A workflow bug names the project copy under `.claude/skills/` whose steps should change. Finish with `scripts/pincer-status.sh`.

## Checks
- The technical audit changed no files; the acceptance phase changed only the three allowed frontmatter fields and committed them separately.
- `git status --short` is empty at the end; no implementation change was hidden inside acceptance.
- Every acceptance names a person from `people` with `accepts: true` and quotes their words.
- Evidence still validates against its original candidate; the verdict separately names the acceptance commit and any pending remote step.

## Writes
- The three acceptance fields, only through `scripts/pincer-ticket.sh accept`, only after the person said so.
- One acceptance-only commit when new acceptance was recorded; any required branch or PR follows the agreement and the user's authorization.
- No implementation, verification receipt, agreement or evidence edits; no implicit push, merge or publication.

## Without subagents
No agents are involved; the audit is the session's own reading of status, git and the evidence.

## When this stage is off
`scripts/pincer-status.sh --stage release` exits 3 with the reason. Say so and stop.
Acceptance is still the floor: the merge is where the person says yes, and the code
stage records it with `scripts/pincer-ticket.sh accept` right after; until then status
warns about done tickets without acceptance and names that command.
