---
ticket: T-121
status: done
size: L
prd: .prd/prd-v8.md
depends_on: [T-120]
timeout: 900
started: 2026-09-20T10:22:38Z
last_check: 2026-09-20T18:54:39Z passed 826a1616422f
finished: 2026-09-20T10:39:21Z
verified: 2026-09-20T18:54:39Z 826a1616422f
---

## Objective
Replace the API-key study path with native tool login.

## Context
- Implements: R-22.
- Scenarios: S-64, S-65, S-66.
- User-authorized planning revision: [native-tool plan](../docs/prd-v8-native-tool-plan.md).
- PRD: [v8](../.prd/prd-v8.md).

## Requirements
Implement the approved T-120 contracts across launcher/environment construction, usage, allocation, readiness, finalization and reporting. Do not simply remove the API-key check and inherit the personal HOME. Do not extract tokens or copy keychains. Refuse API override without logging values or editing user configuration. Prefer documented login status; if no safe supported check exists, report the limitation rather than inventing it.

Create test/native-login-study.test.js using fixture executables through the real entry point, asserting side effects, captures, stop behavior and absence of extra task launches. A fixture is not native evidence. Keep legacy cohort readers valid, regenerate frozen inputs, replace the superseded smoke proposals, and document the controlled-host setup and user login steps. Add the suite to npm test and update current suite counts. Run full regression, packed parity and exact-candidate CI at the implementation boundary. T-109 handles separately authorized real smoke; this ticket must not depend on T-109 and create a cycle.

## Review corrections to implement

Follow native-tool contracts §2.4: lock the canonical shared login directory across allocations before probing or planting; journal owned canary creation durably; preserve changed/unowned files; block uncertain custody and require recorded recovery. Test concurrent launches, path aliases, partial creation and interruption, replaced canaries, cleanup/retention faults and recovery before a later session. Never read credentials or recursively clean the login directory.

The current executable study schema is Claude-only. Reject Codex/Copilot records instead of relabelling Claude status/profile data. Codex needs a separate surface-specific profile before T-110/T-111; no Pincer Codex hook adapter exists and Claude hook evidence is not applicable. GitHub Copilot's shipped surface is VS Code; CLI research is separate.

## Acceptance Criteria
- [x] S-64: The actual launch entry point uses supported native login, refuses missing login and provider-key overrides before a task, and never records secrets or credential hashes.
- [x] S-65: Entry-point fixture regressions exercise subscription billing unavailability versus missing evidence, account limits, isolation leakage, interruption/restart and retention faults while preserving stop/freshness protections.
- [x] S-66: The replacement package, proposed inputs, cohort and regression results describe the implemented path; actual native login and isolation remain explicitly unobserved until T-102/T-109.

## Implementation — 20 September 2026

Implemented in `scripts/delivery-benchmark-v7/` (`isolated-launch.cjs` native-login profile with status probe, override refusal and billing block; new `login-custody.cjs` for the shared login-directory lock, journal and recovery; `usage.cjs` versioned native reader; `allocation.cjs` schema-2 grants, `max_sessions`, custody and account-limit stops; `readiness.cjs` manifest schema 2; `orchestrator.cjs` `--i-agreed-the-usage-envelope`, credential refusal, held custody; `effective.cjs`, `effort.cjs`, `freeze-spec.cjs`). Suite `test/native-login-study.test.js` runs fixture executables through the real entry points; `test/benchmark-environment.test.js` and `test/study-readiness.test.js` carry the profile and schema-2 cases. Replacement package: `docs/prd-v8-artifacts/execution/T-121-native-smoke-execution-package.md`; `study.json` is schema 2 and pending; the proposed inputs name the native profile. The criteria above are ticked as fixture-verified implementation deliverables. A fixture is not native evidence: no account login, live session or spending occurred, and native login preservation, the CLI's own login-directory entry names and its hook-log format remain T-102/T-109 observations.

## Verification
Proves: The declared contract or fixture entry-point behavior matches the amended native-login design, including rejection paths. These commands do not prove actual account authentication or execute a live study.
```bash
set -e
node test/native-login-study.test.js
node test/benchmark-environment.test.js
node test/benchmark-allocation.test.js
node test/benchmark-study-launch.test.js
node test/execution-freeze.test.js
```

New test files are deliverables, not checks claimed to exist or pass today. Use meaningful behavior/schema cases, not placeholder success. Verify through the independent pinned management kit; never hand-edit lifecycle receipts.

## Constraints
- No provider key requirement, direct model API client, copied credential store, login-token extraction, inferred approval or automatic billing fallback.
- Preserve evidence freshness, prior failures, restart safety, unrelated work and historical cohort identities.
- No live model session, account access, spending, merge or publication is authorized by this planning ticket.
- Regenerate adapters/plugin after any template changes; regenerate the cohort after frozen-input changes.

## Custody review corrections — 20 September 2026

Addressed replacement-after-check deletion by journaled atomic retirement with retained bytes, kept recovery guarded through cleanup/receipt completion, and registered detached session groups in the login claim as well as the run claim before startup. Added filesystem race/interruption regressions and a real detached-child owner-death regression. Historical closure is retained; no lifecycle field is hand-edited. Exact-candidate CI and packed parity remain separate checks, and native login is still unobserved.
