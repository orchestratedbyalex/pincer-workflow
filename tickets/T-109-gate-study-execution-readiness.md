---
ticket: T-109
status: in_progress
size: M
prd: .prd/prd-v8.md
depends_on: [T-106, T-107, T-108, T-121]
timeout: 900
started: 2026-09-19T07:50:54Z
last_check: 2026-09-19T21:07:00Z failed c936a9b60fc5
---

## Objective
Provide a single auditable readiness decision before the study incurs cost.

## Context
- PRD: [Prove reliable delivery with less effort](../.prd/prd-v8.md).
- Implements: R-10.
- Scenarios: S-28, S-29, S-30.
- Relevant paths: `docs/prd-v8-protocol.md`, `docs/prd-v8-artifacts/execution/`, `scripts/delivery-benchmark-v7/orchestrator.cjs`, `scripts/delivery-benchmark-v7/readiness.cjs`.
- Source: [readiness assessment](../docs/pincer-readiness-2026-09-15.md).
- Order, predecessor obligations and verification limits: [v8 ticket map](../docs/prd-v8-ticket-map.md).

## Current scope amendment

The [native-tool plan](../docs/prd-v8-native-tool-plan.md) supersedes the API-key smoke proposal. Complete T-120/T-121 before preparing the replacement smoke. Use native sign-in and the revised subscription-aware allocation/evidence contract; do not request an API key. Existing receipts do not verify the revised scope. The authored contracts are in [docs/prd-v8-native-tool-contracts.md](../docs/prd-v8-native-tool-contracts.md) (T-120): host login in a study configuration directory, sanitized login status, billing-mode-aware allocation and evidence, and the checks the replacement smoke must show.

## Requirements
- The repaired runner passes offline end-to-end controls and fault injections, the real-browser fixture gate, packed parity and full CI; the amended cohort manifest is minted before the first measured run and lists the complete execution path.
- A study manifest names projects/access, immutable kits and bases, exact task schedule, independent reviewers, numeric spending/wall-clock caps and stop/resume rules; missing decisions produce specific pending reasons and launch nothing.
- A controlled short live smoke, once separately authorized and capped, proves actual payload capture, isolation, browser access, stop behavior and report regeneration before the full schedule; smoke artifacts remain labelled operational and never silently replace scheduled study cells.

Create the read-only readiness command and behavioral tests in this ticket. Numeric budgets must be actual user decisions, not inferred from the spending-cap flag. Preflight checks accumulated known spend and remaining allocation; incomplete cost accounting stops for review rather than treating spend as zero. Do not claim a hard provider billing cap unless the chosen provider enforces it. Verification never launches the smoke: it checks retained results. This ticket cannot close on offline fixtures alone.

## Acceptance Criteria
- [ ] S-28: The repaired runner passes offline end-to-end controls and fault injections, the real-browser fixture gate, packed parity and full CI; the amended cohort manifest is minted before the first measured run and lists the complete execution path.
- [ ] S-29: A study manifest names projects/access, immutable kits and bases, exact task schedule, independent reviewers, numeric spending/wall-clock caps and stop/resume rules; missing decisions produce specific pending reasons and launch nothing.
- [ ] S-30: A controlled short live smoke, once separately authorized and capped, proves actual payload capture, isolation, browser access, stop behavior and report regeneration before the full schedule; smoke artifacts remain labelled operational and never silently replace scheduled study cells.

## Verification
Proves: The command validates retained real observation records and required references; actual agent behavior and reviewer judgment require inspecting the linked evidence. It must fail when the observation section is absent or outstanding.
```bash
set -e
node test/study-readiness.test.js
node test/benchmark-allocation.test.js
node test/benchmark-prepared-bases.test.js
node test/benchmark-study-launch.test.js
# The launchable manifest and every artifact it references live in the study root, which
# cannot be this repository; the inspector reads the study checkout's copy of the manifest.
node scripts/delivery-benchmark-v7/readiness.cjs --manifest /Users/Shared/pincer-v8-study/pincer-workflow/docs/prd-v8-artifacts/execution/study.json --input-root /Users/Shared/pincer-v8-study --require-ready
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
