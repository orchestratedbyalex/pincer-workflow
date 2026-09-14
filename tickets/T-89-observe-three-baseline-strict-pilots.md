---
ticket: T-89
status: open
size: L
prd: .prd/prd-v7.md
depends_on: [T-88]
timeout: 600
---

## Objective
Observe where the released strict workflow costs users effort before changing it.

## Context
- PRD: [Make trusted delivery easier and cheaper](../.prd/prd-v7.md).
- Implements: R-03.
- Scenarios: S-07, S-08, S-09.
- Relevant files: new docs/prd-v7-pilots.md; docs/prd-v7-artifacts/pilots/baseline/; new test/strict-pilot-records.test.js.
- Build order, verification limits and shared constraints: [v7 ticket map](../docs/prd-v7-ticket-map.md).

## Requirements
- Prepare a concrete project/access/reviewer/cap manifest: one genuinely new project and two existing projects with intended changes, pinned bases and held-out acceptance/preservation checks. Use disposable snapshots for probes and preserve unrelated work in at least one brownfield project.
- Use an independently pinned 0.6.0 installed kit and record its digest. Carry every pilot through actual adoption, an explicitly authorized revision, pause, fresh-session recovery and candidate/schema 3 evaluation using shipped guidance.
- Record prompts, actual scope decisions, stage effort, repeated reads/commands/approvals, human review, interventions, failures and repairs. Generic continue does not authorize revised content.
- Retain failed attempts and evaluator outputs. Missing tools, access, budget or observations leave the corresponding criteria unchecked; record validation cannot substitute for execution.
- Rank baseline friction and identify which observed operations scaffold/brief output will remove. Define matched snapshots/tasks and counting rules for the later paired comparisons; document learning effects.
- Create the record-validation suite to reject missing required sessions, forged/missing artifact links and incorrect candidate references, including working and faulty fixture records.

## Acceptance Criteria
- [ ] S-07: All three real projects have inspectable full strict journeys, candidate evidence and preservation checks; revised scope has its actual authorization and unrelated work survives.
- [ ] S-08: All required stages were observed and reviewed; original failures and repairs remain visible, and unavailable stages cannot pass the record validator or close the ticket.
- [ ] S-09: A measured friction report cites concrete baseline events and supplies the design basis for T-90 and T-91 before either starts.

## Verification
Proves: baseline record completeness, reference/candidate integrity and recomputable effort; actual session compliance and semantic acceptance require review of the linked live artifacts.
```bash
set -e
node test/strict-pilot-records.test.js
node test/effort-records.test.js
```

## Constraints
- This is live work, not a fixture-only ticket. Obtain only missing project-access or spending decisions after preparing the bounded schedule; never bypass host permissions. If observed failures require product fixes, create linked tickets and retain the original runs.
- Keep this distribution repository in legacy management mode. Use an independently pinned released 0.6.0 management kit outside the tree when implementing; do not manage tickets with runtime code being edited.
- New test files named here are implementation deliverables, not existing evidence. Add implemented executable suites to `npm test`; never create placeholder passes or hand-authored attempt/receipt metadata.
- After any `template/` edit run `bash template/scripts/sync-prompts.sh` and `bash scripts/build-plugin.sh`, and include generated outputs. Preserve prior PRDs, ticket history and unrelated user work.

