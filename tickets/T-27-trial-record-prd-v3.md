---
ticket: T-27
status: open
size: S
prd: .prd/prd-v3.md
depends_on: [T-24, T-25, T-26]
---

## Objective
Record the two live R-01 observations the PRD requires (eligible case commits nothing; negative case keeps the failure) in a trial file, from the modified kit, before the evaluation candidate is chosen.

## Context
- Relevant files: new `docs/trial-<date>-prd-v3.md`; precedent `docs/trial-2026-09-10-interactive.md` and `docs/trial-2026-09-08-*.md`; the fixture at `~/Documents/dev/personal/pincer-trial-interactive` (base `d642c72`, candidate `cc6f630`, T-02's check is `npm test`); `template/docs/dry-run-checklist.md` trial record template; wiki landmine "Live trials" in `docs/wiki/briefing.md` (`claude -p --model sonnet --permission-mode bypassPermissions` with `env -u CLAUDECODE`, packed tarball via `npm pack`).
- PRD section: Success Criteria rows 3 and 4 and the paragraph below the table (record kit revision or package digest, agent and model versions, prompts and observed outputs; finalize before selecting the candidate).
- Implements: R-01 (live observation of the exception and the negative scenario). R-02 and R-03 live observation is outstanding by PRD decision and is recorded as such.

## Requirements
- Install the modified kit into a copy of the existing fixture (or a fresh fixture reproducing its candidate state) from `npm pack` of the working tree, never from the published 0.4.0 package; the original fixture's trial evidence stays untouched.
- Eligible case: inject the `done` toggle into `notes.js`, run `scripts/pincer-ticket.sh verify T-02` and observe the failure, revert `notes.js` so the tree matches the candidate, then ask the assistant to restore the ticket. Record: the exact command it names, that it ran no `verify`, that HEAD is unchanged and no commit was made, and `scripts/pincer-status.sh` reporting `current` after the user runs the command.
- Negative case: clean tree at the candidate, make T-02's Verification block fail without a source change (for example an unavailable tool on `PATH`), run `verify`, then ask the assistant for help. Record that it keeps the failed `last_check`, does not recommend restoring the receipt, and reports the status output honestly.
- The record has the sections of the checklist's trial template (Brief, Base, Versions, Artifacts, Results, Interventions, Untested) plus a table with one row per R-01..R-03 stating observed evidence or `outstanding`, and names the kit revision or tarball digest, Claude Code version and model.
- The record is committed with this ticket, before `PRD v3: built`, so the evaluation candidate includes it.

## Acceptance Criteria
- [ ] Eligible case observed and recorded: named command, no `verify`, no commit, `current` status.
- [ ] Negative case observed and recorded: failure kept, no receipt restore recommended.
- [ ] R-02 and R-03 rows say `outstanding`; versions and kit digest recorded; the original fixture is unchanged.

## Verification
Proves: the trial record exists with the required sections and the three requirement rows (static presence check); the human-observed record itself is the acceptance evidence, as in T-19. Regression: a missing record, section or requirement row.
```bash
f=$(ls docs/trial-*-prd-v3.md 2>/dev/null | tail -1); [ -n "$f" ] || { echo 'missing prd-v3 trial record'; exit 1; }; for s in 'Brief' 'Base' 'Versions' 'Artifacts' 'Results' 'Interventions' 'Untested' 'R-01' 'R-02' 'R-03' 'commit' 'last_check'; do grep -q "$s" "$f" || { echo "$f lacks $s"; exit 1; }; done; grep -q 'outstanding' "$f"
```

## Constraints
- Audit the fixture with `npm test` and `pincer-status.sh`, never `pincer-ticket.sh verify` from the operator terminal except where the scenario calls for it (it re-stamps receipts on success).
- Do not report an observation not made as passing; unavailable observations are `outstanding`.
- Do not modify the kit to make a scenario pass; a failed observation is a finding for a follow-up ticket.
