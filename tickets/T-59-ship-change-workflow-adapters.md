---
ticket: T-59
status: done
size: M
prd: .prd/prd-v5.md
depends_on: [T-58]
started: 2026-09-11T23:56:58Z
last_check: 2026-09-12T00:12:08Z passed af23246c6665
verified: 2026-09-12T00:12:08Z af23246c6665
finished: 2026-09-12T00:12:08Z
---

## Objective
Ship the change workflow in every layout and adapter so PRD v5 can be implemented and reviewed without losing work or trusting stale state.

## Context
- Relevant files: bin/pincer.js; scripts/build-plugin.sh; template/.claude/commands/; template/AGENTS.md; template/.claude/hooks/hook-policy.cjs; template/docs/; README.md; docs/index.html; test/change-distribution.test.js; test/workflow.test.js.
- PRD: [Preserve changes, authorization, and resume context](../.prd/prd-v5.md), sections 5–8.
- Implements: R-09, R-06, R-04.
- Scenarios: S-29.
- Build order and coverage: [PRD v5 ticket map](../docs/prd-v5-ticket-map.md).

## Requirements
- Update installer inventory/doctor, module copying and plugin path rewriting; every existing install layout bundles the same runtime with no global binary or runtime download assumption.
- Wire canonical plan/narrow/code/evaluate/release/status to registration/selection/authorization/lifecycle/resume without repeated approvals or automatic Git operations.
- Adjust guards for the new runtime-owned records while leaving documented authored draft locations usable; verify both allowed authoring and protected-state paths.
- Document legacy/v0.5.0/v5 mode differences, migration/rollback, completed versus released, source freshness after other changes, and worktree limits.
- Regenerate adapters/plugin, include every new behavior suite in npm test, and run packed CLI journeys plus existing preservation checks. Publish no claims of unobserved agent parity.

## Acceptance Criteria
- [x] Packed Claude-only, Codex-only, Copilot-only, all-platform and plugin layouts contain identical runtime modules and execute the declared change commands.
- [x] Canonical and generated guidance names valid commands/paths and the same authorization rule; guards allow documented drafts and reject direct state manipulation.
- [x] Installer update preserves customized user files; doctor reports migration/conflict/unsupported state accurately; no version bump or release action occurs.

## Verification
Proves: Exercises packed installations and adapter/guard contracts; catches missing modules, wrong plugin paths, unusable documented commands and lost user customizations.
```bash
node test/change-distribution.test.js
npm test
```

## Constraints
- Never hand-edit generated outputs. Full live agent parity and publication are out of scope.
- Implement the new tests named below as part of this ticket and add them to `npm test`; these are planned test paths, not tests that already pass. Reuse existing fixture helpers. After any `template/` edit, run both generators and include the generated changes. Keep existing ticket history untouched; use a pinned released kit to manage this work.

