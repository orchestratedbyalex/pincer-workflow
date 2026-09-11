---
ticket: T-41
status: open
size: M
prd: .prd/prd-v4.md
depends_on: [T-40]
---

## Objective
Run the focused live trials from the packed artifact on a new CLI project and on an existing project with unrelated user edits, observe the failure/repair, interruption/resume and persistent service-failure scenarios, compare with the v0.4.1 baseline where feasible, and record every observation or mark it outstanding.

## Context
- Relevant files: new `docs/trial-<date>-prd-v4.md` (template in `template/docs/dry-run-checklist.md`), `docs/prd-v4-review-packet.md` (S-31 row and live-trial section), `test/fixtures/local-service.cjs` (the unbypassable service), the packed tarball of the candidate kit.
- PRD section: R-10 (S-31), 7 (claims match observations), 8 items 6 and 7.
- Implements: R-10 (S-31), R-01 (live negative case)

## Requirements
- Trials use `claude -p --model sonnet --permission-mode bypassPermissions` with `env -u CLAUDECODE`, one session per stage, from a throwaway repository installed from the packed tarball; record kit digest, Claude Code, model, Node and OS versions, every prompt, every check, every intervention, manual evidence repairs, repeated approvals, unnecessary evaluations and outcomes.
- Scenarios: (a) greenfield CLI project through plan → narrow → code → evaluate → release on the runtime; (b) an existing project with unrelated user edits migrated with preview then apply, edits preserved; (c) failure/repair: inject a regression, observe `verify` fail and readiness blocked, repair, observe the new pass with both attempts retained and no receipt restore; (d) interruption/resume: kill the session mid-verify, observe the running record, `recover`, resume; (e) persistent service failure with the local-service fixture stopped: the agent keeps the failure, does not name a restore command and does not switch binaries.
- Baseline: the same bounded scenarios (c) and (e) on the v0.4.1 kit where feasible, with counts of interventions and receipt restores; report limitations rather than a competitive claim.
- Anything not observed is recorded as `outstanding` in the trial record and the review packet; the packet's S-31 row cites the record.

## Acceptance Criteria
- [ ] The trial record exists with sections Brief, Base, Kit, Versions, Artifacts, Results, Interventions, Baseline, Untested and a requirement table, and every scenario is observed or `outstanding`.
- [ ] The review packet's live-trial section and S-31 row cite the record.
- [ ] No unobserved behavior is counted as a passed gate.

## Verification
Proves: the trial record is present with every required section and honest dispositions, and the packet cites it; regression: a missing section or a scenario without an observation or `outstanding` mark. The record is authored evidence; its content is reviewed, not proven, by this check.
```bash
f=$(ls docs/trial-*-prd-v4.md | tail -1) && for s in Brief Base Kit Versions Artifacts Results Interventions Baseline Untested R-01 R-10 S-31; do grep -q "$s" "$f" || { echo "missing $s"; exit 1; }; done && grep -q "$(basename "$f")" docs/prd-v4-review-packet.md && npm test
```

## Constraints
- Do not edit the runtime to make a trial pass; a trial finding goes into the record and, if it needs a fix, into a new ticket.
