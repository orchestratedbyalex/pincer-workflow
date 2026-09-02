---
name: pincer-release
description: "Audit the repo against the workflow checklist — pass/fail per item, no fixes"
---
<!-- Generated from .claude/commands/pincer-release.md by scripts/sync-prompts.sh — edit the source, not this file -->


# $pincer-release — Workflow Audit

You are auditing the current repo state against `docs/dry-run-checklist.md`. Read-only:
report pass/fail, never fix anything — fixes belong to the stage commands.

**Requested stage:** the text that follows the `$pincer-release` mention in the user's message (ask for it if there is none)

## Steps

1. Read `docs/dry-run-checklist.md` — it is the source of truth for what to check.
2. Run `scripts/pincer-status.sh` to determine which stages have run (it reads `.prd/`,
   `tickets/`, `NOTES.md`; add `git log`). If `the text that follows the `$pincer-release` mention in the user's message (ask for it if there is none)` names a stage, check only up
   to that stage.
3. Check every applicable item mechanically where possible:
   - File existence and frontmatter: read the files.
   - Commit format and story: `git log --oneline`.
   - Receipts: every done ticket carries `verified:` (a status warning means one was
     marked done by hand). Re-run at least two checks with
     `scripts/pincer-ticket.sh verify T-{NN}` — on a done ticket it re-checks without
     touching the receipt — and report actual output.
4. For judgment items (tickets genuinely S/M, history reads as a story), give your
   verdict AND one sentence of evidence — never a bare pass.
5. Present a table: checklist item | pass/fail/skipped | evidence. Order by stage.
6. End with a one-line verdict: "PASS — workflow artifacts complete" or
   "FAIL — {n} items failed; fix via {command}". For each failure, name the command
   file (`.claude/commands/*.md`) whose instructions should be tightened if the
   failure is a workflow bug rather than a run mistake.
