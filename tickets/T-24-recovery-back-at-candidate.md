---
ticket: T-24
status: open
size: M
prd: .prd/prd-v3.md
depends_on: []
---

## Objective
Add the one recovery exception to the code and status playbooks: when the tree is back at the evaluated candidate and the ticket's check passes directly, the user restores the ticket file and nothing is verified or committed.

## Context
- Relevant files: `template/.claude/commands/pincer-code.md` (section `## Recovering a ticket file`, the sentences after "a restored receipt is never evidence"), `template/.claude/commands/pincer-status.md` (step 3, "Never restore a ticket file from git to clear a warning"), `template/docs/dry-run-checklist.md` (code cheat boxes after `/pincer-code`), `test/workflow.test.js` (R-06 block, add assertions next to the existing ones).
- PRD section: R-01 (all scenarios), Architecture "Key components" first bullet, trial finding 1 in `docs/trial-2026-09-10-interactive.md`.
- Implements: R-01
- Generated outputs (`template/.agents/skills/pincer-code/SKILL.md`, `template/.agents/skills/pincer-status/SKILL.md`, `template/.github/prompts/pincer-code.prompt.md`, `template/.github/prompts/pincer-status.prompt.md`, `plugin/commands/code.md`, `plugin/commands/status.md`, `plugin/docs/dry-run-checklist.md`) come from `bash template/scripts/sync-prompts.sh` and `bash scripts/build-plugin.sh`; never hand-edit them.

## Requirements
- The code recovery section keeps every existing sentence that `test/workflow.test.js` asserts ("hand the repair to the user, who performs it in their own terminal", "fresh verification; a restored receipt is never evidence", "Do not recommend restoring source files or unrelated edits") and adds, after them, one exception of at most six sentences stating the three conditions: the PRD is built with valid candidate evidence; tracked files match the evaluated candidate (or the candidate plus its evidence-only commit) with nothing untracked; the ticket's Verification block passes when run directly, not through `verify`, which would write a receipt.
- When the three conditions hold the playbook says: the committed evaluation still describes the tree; name the exact command for the user to restore the ticket file in their own terminal; do not run `verify`, refresh the receipt or commit anything; the restored file is what is already committed, not new evidence. The literal phrases `the committed evaluation still describes the tree` and `do not run `verify`, refresh the receipt or commit anything` appear.
- The negative case is stated: if the Verification block fails on that clean tree, the failure is real; keep the failed `last_check` and repair through the lifecycle with fresh verification.
- The remaining-source-changes case is stated: if source still differs from the candidate, name the differing paths and let the user decide; the literal phrase `does not authorize discarding source changes` appears. When the tree already settles the fix, do not ask which way to fix the source.
- The status playbook keeps "Never restore a ticket file from git to clear a warning; a failed attempt is a record." and adds one sentence pointing at the exception in the code playbook, containing the literal phrase `nothing is verified or committed`.
- The dry-run checklist keeps the existing `git checkout` cheat box and adds one box after it: revert the source so the tree matches the candidate, then ask again; the assistant names the restore command for you, runs no `verify`, and commits nothing; status is `current` after you run it. The box contains the literal phrase `commits nothing`.
- `test/workflow.test.js` asserts the four literal phrases above (three in code, one in status) and the checklist phrase, alongside the unchanged R-06 assertions.
- Both generators are run and their outputs committed with the edit; `test/distribution.test.js` passes.

## Acceptance Criteria
- [ ] The code playbook carries the exception with its three conditions, the negative case and the remaining-source-changes case, and every pre-existing R-06 assertion still passes unchanged.
- [ ] The status playbook and the dry-run checklist carry their one-sentence and one-box counterparts.
- [ ] `test/workflow.test.js` pins the new phrases; running the generators again produces no diff.

## Verification
Proves: the new wording is present in the source playbooks, the checklist and the generated plugin, and the full suite (including the unchanged R-06 assertions and distribution parity) passes; regression: any listed phrase missing from source or plugin, or stale generated output. Static assertions are primary evidence here because the change is playbook text, a static contract; agent compliance is observed in T-27.
```bash
npm test && grep -q 'the committed evaluation still describes the tree' template/.claude/commands/pincer-code.md && grep -q 'does not authorize discarding source changes' template/.claude/commands/pincer-code.md && grep -q 'nothing is verified or committed' template/.claude/commands/pincer-status.md && grep -q 'commits nothing' template/docs/dry-run-checklist.md && grep -q 'the committed evaluation still describes the tree' plugin/commands/code.md && grep -q 'nothing is verified or committed' plugin/commands/status.md && grep -q 'the committed evaluation still describes the tree' test/workflow.test.js && bash template/scripts/sync-prompts.sh >/dev/null && bash scripts/build-plugin.sh >/dev/null && git diff --quiet -- template/.agents template/.github plugin
```

## Constraints
- Do not touch `hook-policy.cjs`, `pincer-ticket-lib.sh`, `pincer-status.sh` or `notes_current`; routing and guard behavior stay as they are.
- Do not remove or reword the sentences the existing R-06 assertions pin; the exception is additive.
- Do not edit `template/.agents/skills/`, `template/.github/prompts/` or `plugin/` by hand.
- Keep the exception short; no paragraph of caveats about trials or fault provenance.
