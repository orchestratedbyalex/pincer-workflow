---
ticket: T-108
status: done
size: M
prd: .prd/prd-v8.md
depends_on: [T-100]
timeout: 900
started: 2026-09-19T06:38:17Z
last_check: 2026-09-19T06:52:08Z passed c995e5c4ea3a
finished: 2026-09-19T06:50:16Z
verified: 2026-09-19T06:52:08Z c995e5c4ea3a
---

## Objective
Prepare consistent versioned distribution artifacts before evaluation without publishing or weakening evidence freshness.

## Context
- PRD: [Prove reliable delivery with less effort](../.prd/prd-v8.md).
- Implements: R-09.
- Scenarios: S-25, S-26, S-27.
- Relevant paths: `package.json`, `scripts/build-plugin.sh`, `template/scripts/sync-prompts.sh`, `docs/kit-maintenance-checklist.md`, `scripts/prepare-release.cjs`.
- Source: [readiness assessment](../docs/pincer-readiness-2026-09-15.md).
- Order, predecessor obligations and verification limits: [v8 ticket map](../docs/prd-v8-ticket-map.md).

## Requirements
- A maintainer preparation command supports preview and explicit apply for a supplied version, regenerates adapters/plugin and verifies package/plugin/version agreement and packed layout before reporting a candidate eligible for selection.
- Repeated preparation is idempotent; invalid versions, unexpected staged work, unrelated modifications or generator failure produce actionable refusal without absorbing user files or creating a tag, commit, publication or false success.
- An integration fixture prepares metadata, commits/selects the candidate and evaluates it without self-invalidating version drift; later source/version changes still stale the evidence under the existing exact artifact allowlist.

Define node scripts/prepare-release.cjs --version <semver> --preview|--apply. Preview writes nothing; apply touches only declared version/generated paths and reports partial failure honestly. Run generators/pack checks in a scratch copy before applying. No automatic commit, tag, remote write or npm publish. Version choice is supplied at release time, not inferred from PRD numbering.

## Acceptance Criteria
- [x] S-25: A maintainer preparation command supports preview and explicit apply for a supplied version, regenerates adapters/plugin and verifies package/plugin/version agreement and packed layout before reporting a candidate eligible for selection.
- [x] S-26: Repeated preparation is idempotent; invalid versions, unexpected staged work, unrelated modifications or generator failure produce actionable refusal without absorbing user files or creating a tag, commit, publication or false success.
- [x] S-27: An integration fixture prepares metadata, commits/selects the candidate and evaluates it without self-invalidating version drift; later source/version changes still stale the evidence under the existing exact artifact allowlist.

## Verification
Proves: The focused checks exercise the stated controls and failure paths. Static assertions are sufficient only for authored contracts/generated artifacts; behavioral claims require observed outputs, side effects or refusal behavior.
```bash
set -e
node test/release-preparation.test.js
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
