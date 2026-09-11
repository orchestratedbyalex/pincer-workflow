---
ticket: T-42
status: open
size: S
prd: .prd/prd-v4.md
depends_on: [T-39]
---

## Objective
Tell the agent when to register a fresh project's change and when to preview and apply a migration, so a project actually enters migrated mode during the workflow instead of staying in legacy mode by omission.

## Context
- Relevant files: `template/.claude/commands/pincer-narrow.md` (step 5, finalize), `template/.claude/commands/pincer-code.md` (Before the loop), `template/.claude/commands/pincer-status.md`, `template/docs/dry-run-checklist.md` (narrow and code boxes), `test/workflow.test.js`.
- PRD section: 2 (journey step 1: the developer selects the PRD explicitly and previews migration), R-02 (explicit registration; no inference from PRD status), R-09 (explicit migration, never silent).
- Implements: R-02, R-09 (found while preparing T-41; the runtime is unchanged)

## Requirements
- Narrow step 5: after committing the tickets, register the selected PRD as the change when the project has no change binding and no legacy receipts: `node scripts/pincer-runtime.cjs register --prd .prd/prd-vN.md --authorization "<the user's approval, quoted>"`, then stage and commit `.prd/changes/` with a `Register PRD vN` commit. The authorization text records the user's words; running the command proves nothing by itself.
- Code, before the loop: read the `Runtime` line. `legacy` without legacy receipts on the PRD's tickets → register as above before starting the first ticket. `legacy` with legacy receipts → run `node scripts/pincer-runtime.cjs migrate --preview --prd .prd/prd-vN.md`, show the plan, and ask once whether to apply; apply only on a yes, commit the rewritten tickets, `.gitignore` and binding as `Migrate PRD vN to the runtime`, and never migrate silently. A change binding already present → continue.
- Status playbook: when the `Runtime` line says `legacy`, the report names the register or migrate command as the next step alongside the workflow `Next` line.
- Dry-run checklist: a narrow box for the registration commit and a code box that the migration preview was shown and applied only with the user's yes.
- Wording assertions in `test/workflow.test.js`; generated adapters and plugin regenerated with no further diff.

## Acceptance Criteria
- [ ] Narrow registers fresh projects with the quoted authorization; code migrates existing projects only after a preview and an explicit yes.
- [ ] The sentences are pinned by assertions and generated outputs are current.
- [ ] `npm test` passes.

## Verification
Proves: the registration and migration steps are present in the playbooks and checklist and pinned; regression: a missing step or stale generated output. Static assertions are primary evidence for this playbook change.
```bash
node test/workflow.test.js && npm test && grep -q 'register --prd .prd/prd-vN.md --authorization' template/.claude/commands/pincer-narrow.md && grep -q 'migrate --preview --prd .prd/prd-vN.md' template/.claude/commands/pincer-code.md && h() { find template/.agents template/.github plugin -type f | sort | xargs shasum -a 256 | shasum -a 256; } && before=$(h) && bash template/scripts/sync-prompts.sh >/dev/null && bash scripts/build-plugin.sh >/dev/null && [ "$(h)" = "$before" ]
```

## Constraints
- No runtime change; playbooks, checklist and tests only.
