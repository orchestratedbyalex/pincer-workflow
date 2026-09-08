---
ticket: T-19
status: open
size: M
prd: .prd/prd-v2.md
depends_on: [T-18]
---

## Objective
Run and record one greenfield and one brownfield live trial of the assembled kit on an available agent surface, mapping each PRD requirement to the observed acceptance evidence.

## Context
- PRD: `.prd/prd-v2.md`, Acceptance and validation section (R-01 examples, R-02 unverified visual review, R-05 scenarios, live trials). Implements: acceptance evidence for R-01 to R-06.
- Previous trial record: `docs/dry-run-2026-09-08-sonnet.md`.
- Trial-record template from T-18 in `template/docs/dry-run-checklist.md`.

## Requirements
- Two trial records in `docs/`: `docs/trial-<date>-greenfield.md` and `docs/trial-<date>-brownfield.md`, each recording brief, base commit, agent surface and model/tool versions, artifacts produced (PRD, tickets, evidence manifest path), results per checklist item, human interventions, and surfaces labelled untested.
- Each record includes a requirement table mapping R-01 to R-06 to observed evidence or an explicit `outstanding` entry; unavailable evidence stays outstanding, never fabricated.
- The brownfield trial exercises: a supplied PRD retaining its IDs, an evidence manifest validated by status, and an unavailable visual tool producing `unverified`.
- The greenfield trial exercises: `profile: small` on a small change, the built commit preceding the candidate, and a deferral requiring authorization.
- Trials are run by the user (or by the assistant where a non-interactive agent surface is available) using a throwaway copy; the ticket's check confirms the records exist with the required sections.

## Acceptance Criteria
- [ ] Both trial records exist with brief, base, versions, artifacts, results, interventions and an untested-surfaces line.
- [ ] Each record maps R-01 to R-06 to observed evidence or `outstanding`.
- [ ] No record claims cross-platform behavior or superiority from a single trial.

## Verification
Proves: trial records exist with the required sections (static presence check); the human-authored records themselves are the acceptance evidence.
```bash
for kind in greenfield brownfield; do f=$(ls docs/trial-*-$kind.md 2>/dev/null | tail -1); [ -n "$f" ] || { echo "missing $kind trial record"; exit 1; }; for s in 'Brief' 'Base' 'Versions' 'Artifacts' 'Results' 'Interventions' 'Untested' 'R-06'; do grep -q "$s" "$f" || { echo "$f lacks $s"; exit 1; }; done; done
```

## Constraints
- Record what happened; do not tune the kit inside this ticket. Findings become tickets or the next PRD.
