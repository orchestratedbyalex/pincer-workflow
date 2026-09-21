---
ticket: T-113
status: open
size: M
prd: .prd/prd-v8.md
depends_on: [T-110, T-112]
timeout: 900
---

## Objective
Make routine work use the least necessary workflow operations while preserving the same trust boundaries.

## Context
- PRD: [Prove reliable delivery with less effort](../.prd/prd-v8.md).
- Implements: R-14.
- Scenarios: S-40, S-41, S-42.
- Relevant paths: `README.md`, `template/.claude/commands/`, `template/.claude/references/`, `template/.agents/skills/`, `plugin/`.
- Source: [readiness assessment](../docs/pincer-readiness-2026-09-15.md).
- Order, predecessor obligations and verification limits: [v8 ticket map](../docs/prd-v8-ticket-map.md).

## Requirements
- A documented small-change/default journey and a strict journey use the pilot-ranked minimal reads and existing brief/guide reports; matched fixture walkthroughs record operation counts and reach verified evaluation.
- Repeated continuation of unchanged authorized work asks no duplicate decision, while revised scope, invalid selection and stale checks still surface the exact required next action; small profile never waives evidence or authorization.
- Packed installs and repeated updates preserve user rules, canonical and generated guidance agree, and a fresh agent can discover detailed recovery information from the concise output without guessing missing history.

Use existing small/standard profiles and default/strict modes; add no lifecycle states, automatic risk classifier or inferred approval. Any requirement to change behavior beyond guidance and guided authoring needs a recorded scope revision. Regenerate both adapters and plugin from template. Fixture operation reductions are engineering measurements; T-114 supplies real benefit measurements.

## Acceptance Criteria
- [ ] S-40: A documented small-change/default journey and a strict journey use the pilot-ranked minimal reads and existing brief/guide reports; matched fixture walkthroughs record operation counts and reach verified evaluation.
- [ ] S-41: Repeated continuation of unchanged authorized work asks no duplicate decision, while revised scope, invalid selection and stale checks still surface the exact required next action; small profile never waives evidence or authorization.
- [ ] S-42: Packed installs and repeated updates preserve user rules, canonical and generated guidance agree, and a fresh agent can discover detailed recovery information from the concise output without guessing missing history.

## Verification
Proves: The focused checks exercise the stated controls and failure paths. Static assertions are sufficient only for authored contracts/generated artifacts; behavioral claims require observed outputs, side effects or refusal behavior.
```bash
set -e
node test/proportionate-workflow.test.js
node test/strict-onboarding.test.js
node test/workflow.test.js
node test/distribution.test.js
```

The named new command/test files are deliverables of this ticket or its predecessors,
not evidence that already exists. Add executable offline suites to the normal integration
chain. Do not create placeholder passes. A record validator is not proof of live behavior;
keep any observation criterion unchecked until its linked artifacts have been reviewed.

## Constraints
- Preserve existing authorization, source/evidence freshness, failure precedence,
  recovery, unrelated user work and all legacy/migrated/changes/strict modes.
- Use the independently pinned management kit; never hand-edit lifecycle receipts.
- After any template edit regenerate adapters and plugin; never hand-edit derived files.
- No paid launch, new project access, external message, merge or publication is implied
  by this ticket. Reuse actual session decisions; obtain only missing execution inputs.
- Preserve historical frozen records and report changed execution/scoring under explicit
  cohort identity. New scenario scope or an unsupported design needs a recorded revision.
