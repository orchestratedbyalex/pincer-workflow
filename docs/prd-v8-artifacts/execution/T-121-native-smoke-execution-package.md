# Native-login operational smoke — replacement execution package (T-121)

Prepared 20 September 2026 on `feat/prd-v8` as the implementation of the
[native-tool contracts](../../prd-v8-native-tool-contracts.md) §5. It replaces the
[superseded API-key package](T-109-smoke-execution-package.md) for execution. **No session
has run under it.** Nothing here signs in, launches a model, spends, or observes what the
pinned Claude Code CLI does with a real login; every check below was exercised with fixture
executables in `test/native-login-study.test.js` and `test/benchmark-environment.test.js`,
and a fixture is not native evidence. The user's decisions are still required, and native
login preservation remains **not observed** until T-102/T-109 run the smoke.

Legend. **Implemented**: behavior of the checked-in runner, exercised offline by fixtures.
**User**: a step only the user performs. **Decision**: a document the user (or a named
reviewer) writes; nothing here infers one. **Observation**: a fact only the live smoke can
establish.

## 1. What the runner does now (Implemented)

| Item | Behavior |
| --- | --- |
| Profile | `claude-project-native-login-v1` (`isolated-launch.cjs`): `authentication: host-login-config-dir`, login directory `host/claude-config` under the study root, sanitized status record `claude-auth-status-json-v1`, `billing_mode` declared in the study manifest; canary, hook capture, project-only settings, manual permissions, empty MCP and the explicit environment are unchanged from the historical profile. `claude-project-isolated-v1` is refused with `PROFILE_HISTORICAL`. |
| Environment | Constructed from nothing: `PATH`, `HOME` (per-session), `CLAUDE_CONFIG_DIR` (the study login directory), `TMPDIR`, `LANG`, `LC_ALL`, `CLAUDE_PROJECT_DIR`, `GIT_CONFIG_NOSYSTEM`, `GIT_CONFIG_GLOBAL`. No credential variable of any kind is constructed; the supervisor refuses an environment that carries one. |
| Override refusal | Before planning (`orchestrator.cjs main`), before the first cell and before each cell's workspace, the launching environment is checked for `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN`, `ANTHROPIC_PROFILE`, `ANTHROPIC_FEDERATION_RULE_ID`, `ANTHROPIC_BASE_URL`, `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, `CLAUDE_CODE_USE_FOUNDRY`; a project settings source that sets `apiKeyHelper`, `env`, `awsAuthRefresh` or `awsCredentialExport` is refused too. Code `BILLING_OVERRIDE_PRESENT`; the message names the variable or key, never a value; the shell is not edited. |
| Custody | One exclusive lock per canonical login directory (`login-custody.cjs`), stored with a durable journal in `host/.login-custody/` (outside the credential directory), acquired before the directory inspection and the status probe and held through the session, capture retention and canary cleanup. A live owner is `LOGIN_DIR_BUSY`; a dead or unknown owner is `LOGIN_DIR_RECOVERY_REQUIRED` and is never stolen. |
| Directory inspection | Entry names only. Allowed: the CLI's own state (`.credentials.json`, `.claude.json`, `statsig/`, `todos/`, `projects/`, `debug/`, `shell-snapshots/`, `session-env/`, `history.jsonl` and the other names listed in `login-custody.cjs`). `settings.json`, `settings.local.json`, `CLAUDE.md`, `hooks/`, `commands/`, `agents/`, `skills/`, `plugins/`, `.mcp.json`, a symbolic link or any unlisted name is `PROFILE_HOST_DIRTY`, naming the entry. No credential file is opened, sized or hashed. |
| Status probe | `<pinned CLI> auth status --json` in the constructed environment, once before any workspace exists (throwaway `HOME`) and once in the session environment just before the tool starts. Exit 1 or `loggedIn !== true` is `LOGIN_REQUIRED`, whose message is exactly the instruction to run `CLAUDE_CONFIG_DIR=<dir> claude auth login` and rerun; there is no key hint and no fallback. Retained: `checked`, `logged_in`, `auth_method`, `api_provider`, `subscription_type`. Never retained or printed: the raw output, `email`, `orgId`, `orgName`, `configDirectory`, `projectsDirectory`. An unreviewed method or provider is `PROFILE_INCOMPATIBLE`; a `claude.ai` login declared `api`, or a `console` login declared `subscription`, is `BILLING_MODE_MISMATCH`. |
| Canary | Per-session `HOME/.claude` as before, plus the shared login directory: `settings.json` and `CLAUDE.md` planted with exclusive creation, journaled before and after each write with identity and digest, retired by journaled atomic rename into private holding paths and verified again after the move. Retired bytes are retained, not deleted. A changed, replaced, symlinked or unretirable file is preserved, the allocation stops (`ALLOCATION_LOGIN_DIR_RECOVERY`), and the next launch is refused until `login-custody.recover()` runs with a recorded reason. Recovery holds exclusive custody through retirement and durable receipts; it retires only verified unchanged owned files and retains their bytes. Preserved unexpected files keep the directory dirty until a person resolves them. Detached session process groups remain part of the login claim, so owner death alone cannot authorize recovery. |
| Session flags | Unchanged from the superseded package: `--print --model <resolved> --permission-mode manual --permission-prompts none --setting-sources project --settings <session>/settings.json --strict-mcp-config --mcp-config {"mcpServers":{}} --no-chrome --no-session-persistence --max-turns <n> --max-budget-usd <estimate cap> --debug hooks --debug-file <session>/debug.log --input-format text --output-format json`. `--bare`, `--restricted`, `--safe-mode` and the permission-skipping flags are refused. |
| Measurement | Profile `claude-code-result-native-usage-v1` (`usage.cjs`): `tokens` and `provider_minutes` mandatory; `total_cost_usd` retained as `estimate_usd`; `reported.cost_usd` is null with the billing reason (`SUBSCRIPTION_NOT_ATTRIBUTABLE` or `CHARGE_EVIDENCE_MISSING`); `measurement.billing` carries the declared mode and no charge. Legacy records keep `claude-code-result-modelusage-v1`; the two are never pooled (`effort.aggregate`). |
| Allocation | Schema-2 grants reserve by `session_estimate_cap_usd` against `limit_estimate_usd`, count sessions against `account_usage.max_sessions`, measure elapsed time against `account_usage.max_elapsed_minutes`, and stop on an unknown estimate, an account limit (`ALLOCATION_ACCOUNT_LIMIT`), a custody outcome (`ALLOCATION_LOGIN_DIR_RECOVERY`) or a billing-mode disagreement with a retained record (`BILLING_MODE_MISMATCH`). The ledger's `binding` names the billing mode. T-121 itself must be `done` before any launch (`lifecycle`). |
| Readiness | Study manifest schema 2 (`readiness.cjs`): `execution.billing {mode, tool_surface: claude-code, status_record_contract: claude-auth-status-json-v1}`, allocation fields above, the authorization fields of §3 below, native checks `login_preserved`, `override_refused`, `status_record_sanitized`, `billing_mode_consistent`, smoke checks `estimate_captured`, `charge_unavailable_labelled`. Pending reasons `BILLING_MODE_PENDING`, `ACCOUNT_USAGE_PENDING`, `LOGIN_STATUS_CONTRACT_PENDING`, `SURFACE_UNSUPPORTED`, `LEGACY_FIELD_REFUSED`, `PROFILE_INCOMPATIBLE`. Schema-1 manifests validate exactly as before. The inspector never runs the CLI and therefore does not check the login; the launcher does, before any workspace. |
| Launch grammar | `--i-agreed-the-usage-envelope` replaces `--i-have-a-spending-cap`; the old flag is refused by name. It asserts that a human agreed the estimate cap **and** the account-usage envelope of the `study-authorization`; it carries no numbers and is not an agent's to pass. |

## 2. Host setup (User)

1. Create the login directory in the study root and sign in there with the pinned CLI copy:

   ```sh
   mkdir -p /Users/Shared/pincer-v8-study/host/claude-config
   CLAUDE_CONFIG_DIR=/Users/Shared/pincer-v8-study/host/claude-config \
     /Users/Shared/pincer-v8-study/inputs/tool/claude-2.1.273 auth login
   CLAUDE_CONFIG_DIR=/Users/Shared/pincer-v8-study/host/claude-config \
     /Users/Shared/pincer-v8-study/inputs/tool/claude-2.1.273 auth status --text
   ```

   Pincer performs, scripts or automates none of this. It records only that the directory
   exists and, at launch, the five sanitized status fields listed above.
2. Do not add `settings.json`, `CLAUDE.md`, hooks, commands, agents, skills, plugins or an
   MCP file to that directory; the launcher refuses them by name (`PROFILE_HOST_DIRTY`).
3. Sign out of nothing else and copy nothing: the operator's `~/.claude` is never read.
   Account login or maintenance in that directory must happen only while no study
   invocation holds custody (`login-custody.status()` reports `held: false`).
4. Unset any `ANTHROPIC_*` or `CLAUDE_CODE_*` credential/provider variable in the launching
   shell before running the orchestrator; it refuses while one is present.

## 3. Decisions bundle (Decision)

The [superseded package](T-109-smoke-execution-package.md) §10 items 1, 2, 4, 5, 7, 8, 9
and 10 (model, browser runtime, project access, reviewer arrangement, K0 artifact,
study root, capture format, candidate pin and CI) are unchanged in kind. The allocation and
authorization change shape:

| Field | Meaning (schema 2) | Proposed value (a proposal, not a decision) |
| --- | --- | --- |
| `execution.billing.mode` | `subscription` or `api`; cross-checked against the login status of every session | `subscription` |
| `session_turns` | `--max-turns` | 3 |
| `session_wall_minutes` | supervisor watchdog | 2 |
| `session_estimate_cap_usd` | `--max-budget-usd`, a list-price estimate cap, never a charge | 1 |
| `limit_estimate_usd` | aggregate of estimates the allocator may reserve; under a subscription it bounds token use, not a bill | 3 |
| `account_usage` | `{max_sessions, max_elapsed_minutes, agreed: true}`: the user's agreed envelope of plan usage; the runner cannot enforce a plan quota and does not claim to | `{3, 20, true}` |
| `expires_at`, `allocation_id`, `purpose`, `schedule_digest` | unchanged | decision timestamp + 7 days, `v8-native-smoke-1`, `operational-smoke`, computed from the schedule |

The `study-authorization` document must be decided by `user`, carry `billing_mode`,
`session_turns`, `session_wall_minutes`, `session_estimate_cap_usd`, `limit_estimate_usd`,
`account_usage` and `schedule_digest`, and must not carry `limit_usd`, `session_cap_usd` or
`max_elapsed_minutes` (`LEGACY_FIELD_REFUSED`). Any generator that turns the bundle into
inspector documents must refuse to write a review decision for anyone who has not confirmed
a review; the 20 September API-key settlement under `decisions/` is superseded history and
is not reused.

## 4. Launch procedure (exact commands; not to be run before every decision exists)

1. Refresh the study checkout to the commit that carries this package, regenerate the
   effective manifest and schedule from the [proposed inputs](smoke-execution-inputs.proposed.json)
   (now `isolation_profile: claude-project-native-login-v1`), and write the schema-2
   manifest. Inspect from the repository root:

   ```sh
   node scripts/delivery-benchmark-v7/readiness.cjs \
     --manifest /Users/Shared/pincer-v8-study/pincer-workflow/docs/prd-v8-artifacts/execution/study.json \
     --input-root /Users/Shared/pincer-v8-study --purpose operational-smoke --require-ready
   ```

2. Plan the three cells (no session; the orchestrator refuses if a credential variable is set):

   ```sh
   cd /Users/Shared/pincer-v8-study/pincer-workflow
   node scripts/delivery-benchmark-v7/orchestrator.cjs \
     --runs /Users/Shared/pincer-v8-study/runs/smoke \
     --execution-inputs docs/prd-v8-artifacts/execution/smoke-execution-inputs.json \
     --input-root /Users/Shared/pincer-v8-study \
     --study-manifest docs/prd-v8-artifacts/execution/study.json \
     --study-input-root /Users/Shared/pincer-v8-study \
     --study-purpose operational-smoke --repetitions 1 --briefs ui-states --plan-only
   ```

3. Launch one session per invocation with the same command, without `--plan-only` and with
   `--i-agreed-the-usage-envelope`. Before the workspace exists the orchestrator takes
   custody of the login directory, inspects it, probes the login and refuses with
   `LOGIN_REQUIRED`, `PROFILE_HOST_DIRTY`, `BILLING_MODE_MISMATCH`, `LOGIN_DIR_BUSY` or
   `LOGIN_DIR_RECOVERY_REQUIRED` as applicable. An operational session finalizes its cell as
   an invalid operational record and stops the schedule (exit 1); inspect, then repeat.
4. If a run stops with `ALLOCATION_LOGIN_DIR_RECOVERY` or a launch is refused with
   `LOGIN_DIR_RECOVERY_REQUIRED`, read the journal under
   `/Users/Shared/pincer-v8-study/host/.login-custody/journal/`, confirm the previous owner
   process is gone, and record the recovery decision:

   ```sh
   node -e "const c=require('./scripts/delivery-benchmark-v7/login-custody.cjs');console.log(JSON.stringify(c.recover('/Users/Shared/pincer-v8-study',{token:process.argv[1],reason:process.argv[2]}),null,2))" <journal-token> "<why the preserved state was reviewed>"
   ```

   Recovery removes only verified unchanged owned canaries and preserves everything else;
   a preserved file keeps the directory `PROFILE_HOST_DIRTY` until a person removes it.
5. After the third session, regenerate the reports offline and write the native and smoke
   summaries for review (schema-2 checks in §5).

## 5. Checks the smoke must show (Observation), and where each is observed

| Check | Observed in | Judged by |
| --- | --- | --- |
| `login_preserved` | `logs/S1.json` (`subtype`, no `authentication_failed`), `record.environment.model` (attested) and `record.environment.authentication.logged_in` | a completed or capped session with the attested model under the study login directory; an authentication error is the blocker `NATIVE_LOGIN_NOT_PRESERVED` |
| `override_refused` | offline only: `test/native-login-study.test.js` and the orchestrator's refusal with a synthetic variable; never with a real key | the suite output retained with the candidate |
| `status_record_sanitized` | `record.environment.authentication` | exactly `checked`, `logged_in`, `auth_method`, `api_provider`, `subscription_type`; `grep -r example.invalid` finds nothing personal and the reviewer confirms no email or organization appears anywhere under `runs/smoke` |
| `billing_mode_consistent` | `record.environment.billing.mode`, `record.measurement.billing`, `.allocation/state.json` `binding.billing_mode` | all equal the manifest's declaration and match `auth_method` |
| `estimate_captured` | `record.reported.estimate_usd`, `record.measurement.metrics.estimate_usd` | a number labelled estimate; `reported.cost_usd` null with `SUBSCRIPTION_NOT_ATTRIBUTABLE` |
| `charge_unavailable_labelled` | `record.unavailable.cost_usd`, `record.measurement.billing.charge_reason` | the reason names the billing mode; nothing reports a charge |
| `payload_capture`, `isolation`, `browser`, `stop`, `cleanup`, `report_regeneration` | as in the superseded package §5 | unchanged, with `record.environment.login_directory.canary` quiet in both `HOME` and the login directory (recorded as failed-to-refute, never as demonstrated) and `recovery_required: false` |
| hook evidence | `logs/S1.debug.log`, `record.environment.hook_evidence` | `sufficient` for kit arms; the pinned CLI's hook log format is still a smoke finding |

## 6. What this package does not show

- That the pinned 2.1.273 CLI preserves a `claude auth login` made under the study
  `CLAUDE_CONFIG_DIR` when `HOME` is fresh and settings are project-only. Documentation says
  the credential and keychain entry are keyed to that directory; nothing here observed it.
  If the smoke shows `NATIVE_LOGIN_NOT_PRESERVED`, the only alternative is a user-approved
  controlled-host baseline under a new profile name; an API key is never the fallback.
- That the CLI leaves the login directory with only the allowed entry names after a session.
  A new CLI-owned name would surface as `PROFILE_HOST_DIRTY` and needs a reviewed addition to
  `login-custody.cjs`, which re-mints the cohort.
- That Copilot behaves like either CLI, or that a quiet canary proves absence.
- Any dollar cost. Under a subscription the estimate is a list-price figure and no charge is
  attributable; dollar-superiority claims are withheld (`COST_COMPARISON_INCOMPATIBLE`).

## Solo operational-smoke amendment — 20 September 2026

The user reports Claude Pro and no available independent reviewers. Record subscription billing; Pro availability for the proposed pinned model remains to be observed through native login. This does not authorize any account usage or session.

For schema-2 operational smoke only, one operator may review technical captures with `independent: false`. A referenced `operational-smoke-reviewer-decision` must have the usual decision envelope and bind `decided_by: user`, the operator's `reviewer` ID, `independent: false`, `purpose: operational-smoke`, and the exact `candidate`. Per-kind evidence reviews, retained artifacts, project access, numeric limits and separate execution authorization are still required. No participation or evidence-review decision is inferred from this amendment.

Measured and comparative studies still require two independent non-implementing human reviewers. Solo smoke establishes technical observations only; it cannot establish workflow superiority or independent review effort. The gate rejects the solo arrangement for measured use. This gate change creates a new candidate and cohort: the earlier green commit and draft are historical and must be refreshed after candidate CI.
