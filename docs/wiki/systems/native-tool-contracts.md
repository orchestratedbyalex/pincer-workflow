# Native-tool study contracts (T-120)

How the v8 study is meant to run through the coding tool's own sign-in instead of an
injected API key, and what is and is not established. Authored contract:
`docs/prd-v8-native-tool-contracts.md`; suite `test/native-tool-contracts.test.js`.
Related: [[study-readiness-gate]] (the API-key path it supersedes), [[v7-execution-gaps]],
[[fix-the-driver-before-run-one]].

## The boundary

Pincer requires no provider key, implements no model client, never reads or copies a
token, and never switches a signed-in tool to API billing. The only component that broke
this was the maintainer runner's `claude-project-isolated-v1` profile (`apiKey` →
`ANTHROPIC_API_KEY`). It is **historical**: identity, fixture records, observation target
`d53ff6f0…` and the 20 September settlement in the study root remain readable, but nothing
future runs under it.

## Per surface (checked 20 Sep 2026)

- **Claude Code** 2.1.278 help / 2.1.273 pinned copy. Login = user's `claude auth login`
  inside a study `CLAUDE_CONFIG_DIR` (docs: credentials and keychain entry are keyed to
  that directory). Status = `claude auth status --json`, exit 0/1; retain only `loggedIn`,
  `authMethod`, `apiProvider`, `subscriptionType`; never `email`/`orgId`/`orgName`/paths.
  Refuse by name: `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN`,
  `ANTHROPIC_PROFILE`, federation vars, `ANTHROPIC_BASE_URL`, `CLAUDE_CODE_USE_*`,
  `apiKeyHelper`. `--bare` never reads OAuth and `--restricted` drops project settings and
  Bash, so both are excluded. `total_cost_usd` is a list-price estimate; for subscribers it
  "isn't relevant for billing purposes".
- **Codex CLI** 0.155.1. `codex login` / `--device-auth`; `codex login status`; `codex
  doctor --json` (redacted auth check). `--ignore-user-config` keeps auth in `CODEX_HOME`;
  `exec --json` gives `turn.completed.usage` tokens and **no dollar field**. Research only; a separate study profile is pending. Pincer ships no Codex hook adapter, so Claude hook evidence is not applicable.
- **Copilot in VS Code** is the shipped installation surface. Native IDE journey, editor/extension versions and capture remain unobserved.
- **Copilot CLI** is separate research, not installed. Docs: `copilot login`, token env precedence
  `COPILOT_GITHUB_TOKEN` > `GH_TOKEN` > `GITHUB_TOKEN`, `-p`, `--output-format json`,
  premium requests (1 per prompt × model rate). **No study profile; unobserved.**

## Isolation (`claude-project-native-login-v1`)

Same canary, hook capture, project-only settings, manual permissions, empty MCP and
explicit environment as v1; `authentication: host-login-config-dir`. Adds a pre-workspace
status probe, a dirty-login-directory blocker (`PROFILE_HOST_DIRTY`), canary planted in
the login directory only when it holds none of the canary file names, and
`BILLING_OVERRIDE_PRESENT` / `LOGIN_REQUIRED` refusals. **Not established:** that 2.1.273
preserves the login under a fresh HOME with `--setting-sources project`. Failure is
`NATIVE_LOGIN_NOT_PRESERVED`; the only alternative is a user-approved controlled-host
baseline under a new profile name. A key is never the fallback.

## Measurement (`claude-code-result-native-usage-v1`)

Tokens and provider minutes stay mandatory (`MISSING_REQUIRED_CAPTURE`). Cost becomes
`estimate_usd` plus `billing {mode, attributable_charge_usd, charge_reason,
charge_evidence}`. `subscription` → charge null with `SUBSCRIPTION_NOT_ATTRIBUTABLE`,
expected and valid. `api` → a charge only with retained billing evidence. Anything else
is `AMBIGUOUS_BILLING`. Dollar-superiority claims need evidenced `api` on every cell, else
`COST_COMPARISON_INCOMPATIBLE`; Codex/Copilot never enter one. Authorization gains
`billing_mode`, `session_estimate_cap_usd`, `limit_estimate_usd`, `account_usage
{max_sessions, max_elapsed_minutes, agreed}`; legacy `limit_usd`/`session_cap_usd` are
refused. Study manifest schema 2 and pending reasons `BILLING_MODE_PENDING`,
`ACCOUNT_USAGE_PENDING`, `LOGIN_STATUS_CONTRACT_PENDING` are T-121's to implement.

## Gotchas

- The contract document is in `SPEC.harness` (appended last): editing it re-mints the
  cohort. Cohort after T-120: `a6a6d474…`.
- The suite's validators are declared-contract restatements inside the test; T-121 must
  implement them in the runner, not import the test.
- The test pins phrases in the protocol/isolation/usage docs, nine tickets, the README,
  the superseded package, `freeze-spec.cjs` and `package.json`.
- The `openai-docs` skill the ticket names is not installed; official pages were read.

## Review correction — 20 September 2026

The Claude record schema now rejects Codex/Copilot records instead of accepting relabelled Claude authentication. The contract specifies a directory-wide lock and durable canary ownership/recovery journal; changed or unowned files are preserved, never automatically deleted. T-121 must exercise concurrency and interruption cases. The historical T-120 closure is preserved because the pinned legacy kit has no ticket-reopen operation; a fresh verification receipt records the corrected contract. This technical review does not impersonate a human reviewer or claim native observations. The old `a6a6d474…` cohort is historical after this correction.

Corrected cohort: `3284061a…`; pinned-kit T-120 verification passed all three suites on 20 September at 09:17:26Z.

## Implemented — T-121 (20 September 2026)

The contract is now code: `isolated-launch.cjs` (`NATIVE_PROFILE`, `probeLogin`,
`overridePresent`, `establishLogin`, `accountLimit`), `login-custody.cjs` (lock, journal,
`plant`/`remove`/`recover`), `usage.cjs` (`NATIVE_PROFILE`, `billingFor`), `allocation.cjs`
(`limits`), `readiness.cjs` (schema 2), `orchestrator.cjs` (`--i-agreed-the-usage-envelope`,
held custody, credential refusal before planning). Fixture suites:
`test/native-login-study.test.js` (entry points, custody concurrency/interruption/recovery,
orchestration scenarios, schema-2 ledger), `test/benchmark-environment.test.js` (profile and
gate), `test/study-readiness.test.js` (schema 2). Operator-facing:
`docs/prd-v8-artifacts/execution/T-121-native-smoke-execution-package.md`. Still unobserved:
login preservation on 2.1.273, the CLI's own login-directory entry names, the hook-log format.
The `caps.spend_usd` key name survives as the `--max-budget-usd` estimate cap.

T-121 custody review correction: canaries are atomically moved into journaled private holding paths and retained, so mutable login paths are never check-then-unlinked. Recovery guards cover cleanup and receipts; login claims register detached session groups before tool startup. Cohort `725f586d…`; final pinned-kit verification and packed parity pass. Full regression is blocked by the sandbox's local-listener denial and exact-candidate CI remains pending.

Next action: [candidate validation procedure](../../prd-v8-artifacts/execution/T-121-candidate-validation.md) provides host test, scoped commit and push commands plus the exact-SHA CI requirement. The native plan and smoke package now reflect implemented custody behavior. Refresh the external study checkout only after establishing the candidate; native observation decisions remain separate.

macOS CI follow-up: control-area creation now tolerates concurrent mkdir while rejecting symlinks/non-directories; exclusive claims still decide ownership. Deterministic race tests pass. Pinned-kit re-verification was blocked at process registration in the sandbox and revoked the old receipt; rerun on the host before pushing. See the progress journal for candidate and cohort identities.

Solo smoke amendment: user has Claude Pro and no independent reviewers. Schema-2 operational smoke may use one explicitly non-independent operator with a candidate-bound user decision; measured studies still require two independent reviewers. Evidence reviews and execution authorization remain separate. The previous green candidate must be replaced after CI on this amendment.
