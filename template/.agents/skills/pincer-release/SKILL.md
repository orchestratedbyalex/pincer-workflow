---
name: pincer-release
description: "Audit the repo against the workflow checklist — pass/fail per item, no fixes"
---
<!-- Generated from .claude/commands/pincer-release.md by scripts/sync-prompts.sh — edit the source, not this file -->


# $pincer-release — Workflow Audit

You are auditing the current repo state against `docs/dry-run-checklist.md`. Read-only:
report pass/fail, never fix anything — fixes belong to the stage commands.

**Requested stage:** the text that follows the `$pincer-release` mention, if any (when omitted, use the playbook's documented default)

## Steps

1. Read `docs/dry-run-checklist.md` — it is the source of truth for what to check.
2. Run `scripts/pincer-status.sh` to determine the selected PRD and which stages have run
   (it reads `.prd/`, associated `tickets/`, `NOTES.md`; add `git log`). If `the text that follows the `$pincer-release` mention, if any (when omitted, use the playbook's documented default)`
   names a stage, check only up
   to that stage.
3. Check every applicable item mechanically where possible:
   - File existence and frontmatter: read the files.
   - Commit format and story: `git log --oneline`.
   - Receipts: every done ticket carries current `last_check` and `verified` evidence;
     any status warning fails the audit. Do not call `pincer-ticket.sh` from Release:
     it writes receipts and would invalidate the evaluated candidate.
   - Run the repository's candidate-wide release gate directly (`npm test`, or the
     equivalent declared by the project) and report its actual output. Any failure
     blocks PASS. Confirm `git status --short` remains clean afterward.
4. For judgment items (tickets genuinely S/M, history reads as a story), give your
   verdict AND one sentence of evidence — never a bare pass.
5. Present a table: checklist item | pass/fail/skipped | evidence. Order by stage.
6. End with a one-line verdict: "PASS — workflow artifacts complete" or
   "FAIL — {n} items failed; fix via {command}". For each failure, name the command
   file (`.claude/commands/*.md`) whose instructions should be tightened if the
   failure is a workflow bug rather than a run mistake.
