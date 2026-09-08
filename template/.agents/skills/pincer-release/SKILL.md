---
name: pincer-release
description: "Audit the repo against the workflow checklist — pass/fail per item, no fixes"
---
<!-- Generated from .claude/commands/pincer-release.md by scripts/sync-prompts.sh — edit the source, not this file -->


# $pincer-release — Workflow Audit

You are auditing the current repo state against `docs/release-checklist.md`. Read-only:
report pass/fail, never fix anything — fixes belong to the stage commands. Release does
not repair tickets, rewrite evidence, change PRD state, or publish. A check that mutates
the candidate invalidates the audit: if `git status --short` is not empty afterwards,
the verdict is FAIL and names the mutation. The verdict is reported to the user; a
durable runtime-owned release record is later work.

**Requested stage:** the text that follows the `$pincer-release` mention, if any (when omitted, use the playbook's documented default)

## Steps

1. Read `docs/release-checklist.md` — it is the source of truth for product-candidate
   readiness. `docs/dry-run-checklist.md` is a separate manual platform trial and must
   not impose toy-project or Pincer-kit assumptions on this audit.
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
   - Evidence: `scripts/pincer-status.sh` runs the shared validator
     (`scripts/pincer-evidence.cjs`) against the manifest `NOTES.md` names. The `Notes`
     line must read `current` and the `Evidence` line `ok`; any other text fails the
     audit with that diagnostic. Do not re-implement evidence checks and do not accept
     screenshots described in chat: read the manifest's `checks`, requirement
     dispositions and `visual_review`. Validation establishes that the record is
     consistent, not that the commands ran — say so if asked.
   - Every file the manifest lists is tracked, and `git status --short` is empty before
     and after the audit.
   - Run the repository's candidate-wide release gate directly (`npm test`, or the
     equivalent declared by the project) and report its actual output. Any failure
     blocks PASS. Confirm `git status --short` remains clean afterward.
4. For judgment items (tickets genuinely S/M, history reads as a story), give your
   verdict AND one sentence of evidence — never a bare pass.
5. Present a table: checklist item | pass/fail/skipped | evidence. Order by stage.
6. End with a one-line verdict naming the candidate: "PASS — candidate {sha}: workflow
   artifacts complete" or "FAIL — candidate {sha}: {n} items failed; fix via {command}".
   Fixes go through a new ticket, a new candidate and a new evaluation. For each failure, name the command
   file (`.claude/commands/*.md`) whose instructions should be tightened if the
   failure is a workflow bug rather than a run mistake.
