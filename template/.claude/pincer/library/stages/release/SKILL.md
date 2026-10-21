---
name: pincer-release
description: "Read-only audit of the candidate against the release checklist, then the person's acceptance recorded on every ticket"
argument-hint: "[none]"
---
# Release

Audits the candidate against `docs/release-checklist.md` and records the person's
acceptance. Read-only: it reports pass or fail per item and fixes nothing; a failure
goes back to its stage through a new ticket. The one thing it writes is the
acceptance, through the script, after the person said so. A step that changes the
tree invalidates the audit: if `git status --short` is not empty afterwards the
verdict is FAIL and names the change.

## Reads
- `docs/release-checklist.md`: the items, grouped Tickets, Evidence, Review, Acceptance.
- `harness.json`: `stages.release.audit` (`tree` or `pr`), `systems.deploy`, `repo.checks`, `repo.pr`, `homes.evidence`, `people` (who may accept).
- `scripts/pincer-status.sh`: every ticket's state, receipts, acceptances and warnings.
- The evidence manifest under the evidence home when `stages.evaluate.evidence` is on; the review report.
- With `pr`: `gh pr view <number> --json state,mergedAt,statusCheckRollup` and `gh pr checks <number>`.
- Each ticket's `## Done when` and `## How the person checks`.

## Steps
1. [session] Run `scripts/pincer-status.sh --stage release`; on a non-zero exit print its message and stop. Then read `harness.json` for the fields above and `docs/release-checklist.md`.
2. [session] Run the plain `scripts/pincer-status.sh`. Every ticket of the change must be `done` with `verified` on its line and no `Warnings:` block; otherwise the audit already fails and names the ticket.
3. [session] Audit by `stages.release.audit`. `tree`: `git status --short` is empty; run every command in `repo.checks` (or `npm test` when the list is empty) directly and quote the output; the tree is still empty afterwards. `pr`: the pull request is merged, its checks are green, and when `systems.deploy` names a deploy you observed it ran (a run listed by `gh run list`, or the URL the person gives you). Never run `verify`, `done` or any ticket write here.
4. [session] Evidence and review: when `stages.evaluate.evidence` is on, `node scripts/pincer-evidence.cjs validate <manifest> --candidate <sha>` prints `ok`, and every artifact it lists is tracked; the review report exists and every finding has a disposition; every fix after evaluate has its own `T-NN:` commit.
5. [session] Walk the checklist: for each item, pass or fail and one sentence of evidence from status output or git, never a bare pass. Present the table grouped as the checklist is.
6. [session] Acceptance. Show the person the result and, for each ticket, its `## Done when` lines and how they can check. Ask whether they accept. Only after they say so, for each ticket: `scripts/pincer-ticket.sh accept T-NN --by "<name>" --words "<their words>"`, the name from `people` with `accepts: true`, the words theirs, not a paraphrase. A ticket they do not accept stays as it is and the audit fails on it.
7. [session] Verdict, one line naming the candidate: `PASS — candidate <sha>: workflow artifacts complete and accepted` or `FAIL — candidate <sha>: <n> items failed; fix via <command>`. A failure that is a workflow bug rather than a run mistake names the project copy under `.claude/skills/` whose steps should be tightened. Then `scripts/pincer-status.sh`.

## Checks
- `git status --short` is empty after the audit; nothing was repaired, rewritten or published.
- Every acceptance recorded names a person from `people` with `accepts: true` and quotes their words.
- The verdict names the candidate and every failed item appears before it.

## Writes
- The acceptance fields of each ticket, only through `scripts/pincer-ticket.sh accept`, only after the person said so.
- Nothing else.

## Without subagents
No agents are involved; the audit is the session's own reading of status, git and the evidence.

## When this stage is off
`scripts/pincer-status.sh --stage release` exits 3 with the reason. Say so and stop.
Acceptance is still the floor: the merge is where the person says yes, and the code
stage records it with `scripts/pincer-ticket.sh accept` right after; until then status
warns about done tickets without acceptance and names that command.
