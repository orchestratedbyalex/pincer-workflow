---
name: pincer-evaluate
description: "Review the built change with the roster, run the checks, save the evidence; fixes go through new tickets"
argument-hint: "[none]"
---
# Evaluate

Reviews what was built against the spec and the tickets with the agents the agreement
named, runs the checks, and saves the evidence the release stage audits. Autonomous:
run it, then present the result. A finding is fixed through a new ticket, never an
ad-hoc patch, and every fix makes a new candidate to evaluate.

## Reads
- `harness.json`: `roster.evaluate`, `stages.evaluate.where` (`local` or `pr`), `stages.evaluate.evidence`, `repo.checks`, `repo.pr`, `homes.evidence`, `homes.specs`, `homes.tickets`.
- `scripts/pincer-status.sh`: every ticket of the change must be `done` with a current receipt.
- The diff from the base to the candidate, the spec's scope and success criteria, the tickets.
- `.claude/skills/pincer-evaluate/prompts/review.md`: the dispatch, one per roster agent.
- `.claude/skills/pincer-evaluate/formats/finding.md` and `.claude/skills/pincer-evaluate/formats/finding-report.md`: what comes back and how it is merged.
- `.claude/skills/pincer-evaluate/formats/evidence.md`: the manifest the validator checks.
- `.claude/agents/<name>.md` for every name in `roster.evaluate`.

## Steps
1. [session] Run `scripts/pincer-status.sh --stage evaluate`; on a non-zero exit print its message and stop. Then read `harness.json` for the fields above and the plain report: a ticket still open or in progress stops you here; ask whether it was cut (then it goes to the spec's Out of scope) or must be finished with `/pincer-code`.
2. [session] Fix the candidate: `git status --short` must be empty, or go back to code. Record the full `base` (the commit before this change's first ticket commit) and `candidate` (`git rev-parse HEAD`) and take `git diff <base>..<candidate>`.
3. [session + agent] For every name in `roster.evaluate`, one dispatch with `.claude/skills/pincer-evaluate/prompts/review.md` filled with the agent's file, the diff, the spec's scope and success criteria, and the tickets. Keep every report, including an explicit "no findings".
4. [session] In parallel, your own pass: for every `R-NN` in the spec, delivered (evidence on this candidate), blocked (required behavior failed or unverified, which blocks a pass) or deferred (only with the person's recorded authorization, in Out of scope). Compare the result with every ticket's criteria. When there is a user interface, start it and look at it against the spec's Visual direction; do not only read the code.
5. [session] Security pass: a secret scan over the diff and the history that reports locations and never prints values; `git ls-files | grep -i '^\.env'` shows only `.env.example`; the ecosystem's dependency audit, high and critical only; with an HTTP surface, one invalid request returns a clean `4xx` without a stack trace.
6. [session] Merge everything into one report with `.claude/skills/pincer-evaluate/formats/finding-report.md`: drop findings under 70 confidence and style opinions, order by severity with security first, and give each a disposition: fix now through a ticket, or known issue. `stages.evaluate.where` = `pr`: post it with `gh pr comment <number> --body-file <report>`; `local`: write `<homes.evidence>/<candidate>/review/report.md`.
7. [session] When `stages.evaluate.evidence` is true: run every command in `repo.checks` on the clean candidate, save each log as `<homes.evidence>/<candidate>/checks/C-NN.log` (redacted, never an environment dump), write `manifest.json` after `.claude/skills/pincer-evaluate/formats/evidence.md` with digests from `node scripts/pincer-evidence.cjs digest <file>...`, then run `node scripts/pincer-evidence.cjs validate <homes.evidence>/<candidate>/manifest.json --candidate <candidate>` and correct the manifest until it prints `ok`. Commit the evidence directory alone as `evaluate: <candidate short sha>`.
8. [session + agent] Findings to fix now: a new ticket each (through `/pincer-narrow` when it is on, else written from the finding with the ticket format), built with `/pincer-code`; `fix-agent` builds them only when it is in `roster.evaluate`. A fix commit is a new candidate: repeat from step 2. Fixes never land as an ad-hoc commit.
9. [session] Say what was built, what was cut and why, the known issues, and what you would do next. Run `scripts/pincer-status.sh` and quote its `Next:` line.

## Checks
- `git status --short` was empty before the review and the candidate is `HEAD`.
- Every finding in the report has a file, a line, a confidence of 70 or more and a disposition; security findings come first.
- With evidence on, `node scripts/pincer-evidence.cjs validate` printed `ok <candidate>` and the evidence commit holds only the evidence directory.

## Writes
- The review report, as a file under the evidence home or as a PR comment.
- With evidence on, `<homes.evidence>/<candidate>/` and one commit, `evaluate: <sha>`.
- Fix tickets, through narrow and code. Never source, never a ticket's lifecycle fields.

## Without subagents
Review the diff yourself in one separate pass per roster agent, applying each
`.claude/agents/<name>.md` as the rubric, and say in the report's header that the
reviews were inline.

## When this stage is off
`scripts/pincer-status.sh --stage evaluate` exits 3 with the reason. Say so and stop:
under this agreement the pull request review is the evaluation, and release audits the
merged pull request instead of a local report.
