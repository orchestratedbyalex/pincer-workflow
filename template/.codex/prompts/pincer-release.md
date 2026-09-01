<!-- Generated from .claude/commands/pincer-release.md by scripts/sync-prompts.sh — edit the source, not this file -->


# /pincer-release — Workflow Audit

You are auditing the current repo state against `docs/dry-run-checklist.md`. Read-only:
report pass/fail, never fix anything — fixes belong to the stage commands.

**Requested stage:** $ARGUMENTS

## Steps

1. Read `docs/dry-run-checklist.md` — it is the source of truth for what to check.
2. Determine which stages have run, from the artifacts present (`.prd/`, `tickets/`,
   git log, `NOTES.md`). If `$ARGUMENTS` names a stage, check only up to that stage.
3. Check every applicable item mechanically where possible:
   - File existence and frontmatter: read the files.
   - Commit format and story: `git log --oneline`.
   - Ticket verification commands: run at least two, report actual output.
4. For judgment items (tickets genuinely S/M, history reads as a story), give your
   verdict AND one sentence of evidence — never a bare pass.
5. Present a table: checklist item | pass/fail/skipped | evidence. Order by stage.
6. End with a one-line verdict: "PASS — workflow artifacts complete" or
   "FAIL — {n} items failed; fix via {command}". For each failure, name the command
   file (`.claude/commands/*.md`) whose instructions should be tightened if the
   failure is a workflow bug rather than a run mistake.
