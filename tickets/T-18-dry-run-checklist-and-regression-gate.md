---
ticket: T-18
status: done
size: M
prd: .prd/prd-v2.md
depends_on: [T-12, T-16, T-17]
started: 2026-09-08T14:46:05Z
last_check: 2026-09-08T14:49:54Z passed b5d2dc6393dd
verified: 2026-09-08T14:49:54Z b5d2dc6393dd
finished: 2026-09-08T14:49:54Z
---

## Objective
Rewrite the dry-run checklist around the new contracts and recorded scenarios, and confirm the full regression, parity and packed-install gate on the assembled kit.

## Context
- PRD: `.prd/prd-v2.md`, Acceptance and validation section and the R-05 scenario list. Implements: R-05 (recorded scenarios), and the candidate-wide gate for R-01 to R-06.
- `template/docs/dry-run-checklist.md`; notes for the checklist in `docs/dry-run-2026-09-08-sonnet.md`.
- `README.md` and `template/AGENTS.md` (evidence directory and helper mention; older-runtime limitation).

## Requirements
- Dry-run checklist covers: requirement IDs and the requirement map after narrow; `Proves:` lines and behavioral checks; the built commit preceding the candidate; `.prd/evidence/prd-vN/<candidate>/manifest.json` validated by the helper; NOTES.md `evidence:`; status `Evidence` line; release read-only guarantees; profile justification.
- Recorded workflow scenarios, each with steps and expected observations: a small CSS fix (`profile: small`), a tiny high-risk change that must stay `standard`, a supplied PRD reviewed without ID replacement, an authorized resume without re-approval, and a new consequential decision surfaced during narrow. Expected: repeated approval avoided, unresolved decisions surfaced, no arbitrary ticket cap or default budget.
- Cheat instructions are single lines. Hook tests use direct JSON payloads through the hook scripts, separate from model refusals. Fixtures are reset between injected faults. Trial records capture brief, base, model/tool versions, artifacts, results and human interventions (a template block in the checklist).
- README and `template/AGENTS.md` mention the evidence directory, the validator helper and that an older runtime does not enforce the evidence contract.
- `npm test` (all M0 regressions, new targeted tests, generated parity and packed install) passes locally; the CI matrix runs the same command.

## Acceptance Criteria
- [x] The dry-run checklist covers every new contract and includes the five recorded scenarios with expected observations, single-line cheats, payload-based hook tests and a trial-record template.
- [x] README and template AGENTS.md describe the evidence directory, the helper and the older-runtime limitation.
- [x] `npm test` passes on the assembled kit.

## Verification
Proves: the checklist and docs name the new contracts (static presence) and the full gate passes on the assembled kit; regression: any M0 or new targeted test failing.
```bash
grep -q 'profile: small' template/docs/dry-run-checklist.md && grep -q 'pincer-evidence.cjs' README.md && grep -q 'pincer-evidence.cjs' template/AGENTS.md && npm test
```

## Constraints
- Do not claim cross-platform behavior from a single trial; the checklist labels untested surfaces.
