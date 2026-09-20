# PRD v8 native-tool study contracts — T-120

Status: authored contract for R-21 (S-61, S-62, S-63), decided 20 September 2026 under the
[native-tool amendment](prd-v8-native-tool-plan.md) of [PRD v8](../.prd/prd-v8.md). It
specifies what T-121 must implement and what T-102/T-109 must then observe. Nothing here is
evidence that native login, isolation or subscription measurement works: every "observed"
column below is empty until a retained native record fills it. No live session, account
access, spending, merge or publication is authorized by this document.

Implementation status (T-121, 20 September 2026): the runner now implements §2.1, §2.4,
§3.1–§3.3 and §5.3 (`isolated-launch.cjs`, `login-custody.cjs`, `usage.cjs`,
`allocation.cjs`, `readiness.cjs`, `orchestrator.cjs`), exercised with fixtures in
`test/native-login-study.test.js`; the replacement package is
`prd-v8-artifacts/execution/T-121-native-smoke-execution-package.md`. Every "observed"
column below is still empty.

`node test/native-tool-contracts.test.js` checks the JSON examples in this document
against the declared rules (billing that is ambiguous, a mandatory observation that is
missing, and a profile that is incompatible with the billing mode are each rejected), and
checks that the protocol, isolation, usage and affected tickets carry this contract. Those
are static assertions about authored text. They cannot prove that any tool signs in.

## 1. Host-tool boundary (S-61)

Pincer is a set of instructions, tickets, local runtime checks and saved evidence that a
coding tool loads from the project. The coding tool owns the account, the sign-in, the
model request and the bill. Pincer therefore:

- **requires no model-provider API key** from the user, the kit, the installer, the plugin
  or the maintainer study runner;
- **implements no model client** and proxies no model traffic;
- **never reads, copies, hashes, forwards or logs** a login token, a credentials file, a
  keychain entry or an API key, and never prints one to prove a login exists;
- **never switches billing** by injecting a provider key or a token into a signed-in tool;
- treats credentials that an application under development needs (a database password in a
  brief's fixture, say) as that application's concern, outside this boundary.

The installed product already satisfies this: the kit is Markdown, shell hooks and a Node
runtime that never contact a model provider. The one component that did not was the
maintainer study runner: `isolated-launch.cjs` profile `claude-project-isolated-v1` required
`apiKey` and injected `ANTHROPIC_API_KEY` into a fresh environment (until T-121). That profile is
**historical**: its identity, its retained fixture records and its frozen cohorts remain
readable, and it is not the execution path of any future session.

### 1.1 Surfaces, versions and what was actually checked

| Surface | Version checked | How checked (20 September 2026) | Live behavior observed by this project |
| --- | --- | --- | --- |
| Claude Code CLI | 2.1.278 installed help; 2.1.273 is the pinned study copy at `/Users/Shared/pincer-v8-study/inputs/tool` | `claude --help`, `claude auth --help`, `claude auth status --help`; official authentication, costs, CLI reference and programmatic-use pages | **None.** No native session has run under v8. |
| Codex CLI | 0.155.1 installed | `codex --help`, `codex login --help`, `codex login status --help`, `codex doctor --help`, `codex exec --help`; official authentication and non-interactive pages | **None.** |
| GitHub Copilot (VS Code) | editor/extension versions unobserved | repository README and generated `.github` adapter; official GitHub IDE sign-in and VS Code prompt-file documentation | **None.** Shipped installation target; no native journey observed. |
| GitHub Copilot CLI | not installed on this host; version unobserved | official install, about, programmatic reference and billing pages only | **None.** Separate research only; the shipped Copilot target is VS Code, not this CLI. |

A version not listed here has no reviewed contract. A different installed version is
refused by the runner until its help and documentation are re-read and this table is
revised; the revision is a frozen-input change and re-mints the cohort.

### 1.2 Claude Code: login, status, capture, cost exposure

Official statements relied on (authentication, costs, CLI reference and programmatic-use
pages, read 20 September 2026):

- Sign-in: "Individual users can log in with a claude.ai account"; `claude auth login`
  "Sign in to your Anthropic account", with `--console` selecting Console billing instead.
- Status: `claude auth status` "Show authentication status as JSON … Exits with code 0 if
  logged in, 1 if not." The installed 2.1.278 JSON has exactly these keys: `loggedIn`,
  `authMethod`, `apiProvider`, `analyticsDisabled`, `projectsDirectory`, `configDirectory`,
  `email`, `orgId`, `orgName`, `subscriptionType`.
- Storage: "If you've set the `CLAUDE_CONFIG_DIR` environment variable, Claude Code keeps
  the `.credentials.json` file under that directory instead … and keys the macOS Keychain
  entry to that directory too, so a session with a different `CLAUDE_CONFIG_DIR` reads a
  different entry."
- Precedence: cloud-provider variables, then `ANTHROPIC_AUTH_TOKEN`, then
  `ANTHROPIC_API_KEY` ("In non-interactive mode (`-p`), the key is always used when
  present"), then `apiKeyHelper`, then `CLAUDE_CODE_OAUTH_TOKEN`, then Anthropic profiles,
  then "Subscription OAuth credentials from `/login`". "If you have an active Claude
  subscription but also have `ANTHROPIC_API_KEY` set in your environment, Claude Code uses
  the API key once you approve it."
- Bare mode: "In bare mode, Claude Code never reads OAuth credentials or the system
  keychain." Bare mode is therefore **excluded** from the native profile.
- Restricted mode "loads only managed settings and `--settings`" and removes Bash: it would
  suppress the kit's project hooks and change the experiment, so it is excluded as well.
- Cost: with `--output-format json` "the response payload includes `total_cost_usd` …
  Both figures are client-side estimates". For subscribers, "the session cost figure isn't
  relevant for billing purposes"; the figure is computed "locally from token counts at
  list price". `--max-budget-usd` compares against that same estimate.
- Limits: subscribers can hit "You've hit your session limit" or "You've hit your weekly
  limit"; usage credits, when enabled, add a dollar spend limit managed on claude.ai.

Consequences fixed by this contract:

| Item | Contract |
| --- | --- |
| Login mechanism | The user runs `claude auth login` once inside the study configuration directory (`CLAUDE_CONFIG_DIR=<study root>/host/claude-config`). Pincer never performs, scripts or automates the sign-in. |
| Status check | The runner may run `claude auth status --json` in the constructed session environment. Retained fields: `loggedIn`, `authMethod`, `apiProvider`, `subscriptionType`. **Never retained:** `email`, `orgId`, `orgName`, `configDirectory`, `projectsDirectory`, or any other key. Exit 1 is `LOGIN_REQUIRED`. |
| Actionable failure | `LOGIN_REQUIRED` prints exactly: sign in with `CLAUDE_CONFIG_DIR=<dir> claude auth login`, then rerun. No API-key hint, no fallback. |
| Billing override refusal | Before any workspace preparation, the runner refuses when the launching environment or a settings source the session would load names `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN`, `ANTHROPIC_PROFILE`, `ANTHROPIC_FEDERATION_RULE_ID`, `ANTHROPIC_BASE_URL`, `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, `CLAUDE_CODE_USE_FOUNDRY`, or an `apiKeyHelper` setting. Code `BILLING_OVERRIDE_PRESENT`; the message names the variable or key, never its value; the user's shell, profile and settings are not edited. |
| Capture | `--output-format json` final result object (frozen, unchanged from the smoke package), `--debug hooks --debug-file <session>/debug.log` redacted copy, synthetic canary. `stream-json` is a separate profile decision. |
| Cost field | `total_cost_usd` and per-model `costUSD` are **estimates at list price**. Under a subscription login they are never a charge. |
| Session caps | `--max-turns`, `--max-budget-usd` (estimate cap), plus the launcher's wall clock. None is a provider quota. |
| Account limits | A result or retry event naming a session, weekly, model or spend limit (`rate_limit`, `billing_error`, `account_on_hold`) is an `ACCOUNT_LIMIT` stop. No wait-and-continue, rotation, top-up or key fallback. |

### 1.3 Codex CLI: login, status, capture, cost exposure

Official statements relied on (installed help 0.155.1; authentication and non-interactive
pages, read 20 September 2026):

- Sign-in: `codex login` opens a browser; `codex login --device-auth` gives a device code;
  "When you sign in with ChatGPT, Codex usage follows your ChatGPT workspace permissions".
  `codex login --with-api-key` and `--with-access-token` read a secret from stdin and are
  **excluded** (Pincer never handles the secret).
- Status: `codex login status` prints the method (observed: `Logged in using ChatGPT`, exit
  0). `codex doctor --json` emits "a redacted machine-readable report" whose
  `auth.credentials` check reports `stored auth mode`, `stored API key` and `stored ChatGPT
  tokens` as booleans/strings without values.
- Storage: `$CODEX_HOME/auth.json` or the OS credential store; the documentation says to
  treat `auth.json` "like a password: it contains access tokens". Copying it to another
  machine is a documented fallback that Pincer **does not use**.
- Isolation controls: `--ignore-user-config` "Do not load `$CODEX_HOME/config.toml`; auth
  still uses `CODEX_HOME`"; `--ephemeral` "Run without persisting session files";
  `-C <dir>`; `--sandbox`; `--skip-git-repo-check`; `-p <profile>`.
- Capture: `codex exec --json` "stdout becomes a JSON Lines (JSONL) stream"; `turn.completed`
  carries `usage` with `input_tokens`, `cached_input_tokens`, `output_tokens`. **No dollar
  field is documented.** `--output-last-message <file>` writes the final message.
- Billing: ChatGPT plans use included usage; API key "at standard API rates".
- Overrides: `OPENAI_API_KEY` and `CODEX_API_KEY` select API billing.

Consequences: Codex capability notes are **research, not a defined study profile**. Login is the user's
`codex login` inside `CODEX_HOME=<study root>/host/codex-home`; status is `codex login
status` (exit code and method line) plus the redacted `codex doctor --json` auth check;
the refusal list is `OPENAI_API_KEY`, `CODEX_API_KEY`, and a stored API key reported by
the doctor check; the estimate field is **absent** (`estimate_usd: null`, reason
`TOOL_REPORTS_NO_ESTIMATE`), so no dollar comparison is specified here; documented tokens
come from `turn.completed.usage`, summed across turns, each field required. Hooks: Codex
0.155.1 exposes `--dangerously-bypass-hook-trust`, so a hook mechanism exists, but its
capture format is **unreviewed**; this does not create a requirement for a Pincer Codex hook adapter. The shipped kit has none.

### 1.4 GitHub Copilot in VS Code: shipped surface, live behavior unobserved

This is Pincer's existing Copilot installation target, distinct from Copilot CLI.
The user signs into GitHub through VS Code. Pincer ships `.github/copilot-instructions.md`
and `.github/prompts/*.prompt.md`; the instructions link to project rules and prompt
files invoke the workflow. Official IDE sign-in and prompt-file documentation was checked
for this correction; editor and extension versions, instruction loading, permission
behavior, capture and a full Pincer journey were not observed.

A future IDE trial must pin VS Code and extension versions, observe the actual prompt
and instruction loading, retain permitted session/review artifacts, and assess native
permission controls and runtime verification. Do not replace the IDE with a CLI or API
client, assume Claude hook logs exist, or manufacture unavailable token/cost telemetry.
No IDE study record schema or automated launch profile is defined by this revision.

### 1.5 GitHub Copilot CLI: separate research, uninstalled, unobserved

Official statements relied on (install, about, programmatic reference and billing pages,
read 20 September 2026; nothing executed):

- Prerequisites: "An active GitHub Copilot subscription"; Node 22 or later for npm install;
  Linux, macOS, and Windows via PowerShell or WSL.
- Sign-in: interactive `/login`; `copilot login` "via OAuth" with `--web-flow`,
  `--device-code`, `--with-token`. "Copilot CLI will use an authentication token found in
  environment variables … in order of precedence: `COPILOT_GITHUB_TOKEN`, `GH_TOKEN`,
  `GITHUB_TOKEN`." Token storage: "the system credential store" or "a plain text
  configuration file under `~/.copilot/` (or the directory specified by `COPILOT_HOME`)".
- Programmatic: `-p PROMPT` "Execute a prompt in non-interactive mode"; `-s` suppresses
  decoration; `--output-format=FORMAT` "`text` (the default) or `json`"; `--allow-tool`,
  `--deny-tool`, `--available-tools`, `--add-dir`, `--model`, `--secret-env-vars`,
  `--no-ask-user`; `--allow-all` / `--yolo` "Allow the CLI all permissions".
- Billing: "Each prompt to Copilot CLI uses one premium request with the default model.
  For other models, this is multiplied by the model's rate." Additional requests at
  $0.04/request when a budget is set. **No per-prompt dollar figure is exposed to the
  session.**

Consequences: Copilot has **no study profile** in this revision. Not observed here: a hook
mechanism, a debug log, a settings-source switch, model attestation in the JSON output, the
exact JSON shape, or whether a fresh `COPILOT_HOME` isolates configuration. Pincer's
Copilot **VS Code** support claim stays "installation target, live behavior unobserved". A Copilot
study scope needs its own recorded breakdown, an installed pinned version, and this table
revised. Injecting `GH_TOKEN`-family variables into a session is credential transport and
is excluded; the user signs in through `copilot login` inside a study `COPILOT_HOME`.

## 2. Authenticated isolation without credential copying (S-62)

### 2.1 Profile `claude-project-native-login-v1` (design; T-121 implements)

| Field | v1 (historical, API key) | native-login v1 (this contract) |
| --- | --- | --- |
| `name` | `claude-project-isolated-v1` | `claude-project-native-login-v1` |
| `authentication` | `anthropic-api-key` | `host-login-config-dir` |
| `config_dir` | per-session empty | study login directory, established once by the user, never copied from `~/.claude` |
| `home` | per-session synthetic canary | per-session synthetic canary (unchanged) |
| `setting_sources` | `project` | `project` (unchanged) |
| `permission_mode` / `permission_prompts` | `manual` / `none` | unchanged |
| `mcp` | explicit-empty | unchanged |
| `hook_capture` | `debug-hooks-file` | unchanged |
| `host_policy` | managed-policy-preserved-observation-required | unchanged |
| `billing_mode` | implicit API | declared in the study manifest and cross-checked against the retained status record |

Construction rules:

1. **Study login directory.** `CLAUDE_CONFIG_DIR=<study root>/host/claude-config`. The user
   creates it by signing in there; the runner never creates a credential in it, never reads or hashes
   `.credentials.json` (entry names may be listed by rule 2), and never touches the operator's `~/.claude`. Documentation
   says the credential and keychain entry are keyed to this directory. **Whether the pinned
   2.1.273 CLI honors that under `--setting-sources project` with a fresh HOME is a T-109
   observation, not a fact this contract asserts.**
2. **Dirty-directory refusal.** Before each session the runner lists the login directory's
   entry names (names only, never contents or sizes of credential files). Allowed entries
   are the CLI's own state (`.credentials.json`, `statsig/`, `todos/`, `projects/`,
   `debug/`, `shell-snapshots/`, `session-env/`, `.claude.json`, `history.jsonl`, and other
   names the T-121 implementation lists explicitly). `settings.json`, `settings.local.json`,
   `CLAUDE.md`, `hooks/`, `commands/`, `agents/`, `skills/`, `plugins/`, `.mcp.json` or any
   unlisted name is `PROFILE_HOST_DIRTY`: a specific blocker naming the entry, never a silent
   relaxation.
3. **Canary placement and custody.** Apply the exclusive ownership and recovery rules
   in §2.4 before inspecting, planting, checking or removing login-directory canaries.
   Plant only absent files with exclusive creation; never replace an existing file.
   Per-session HOME and the shared login directory receive owned synthetic canaries.
   Hash only the runner's own synthetic files. Cleanup removes only unchanged owned
   files. Changed files, symlinks, unknown ownership or incomplete cleanup are preserved
   and stop the allocation with `LOGIN_DIR_RECOVERY_REQUIRED`; they are not silently
   reduced to `not_plantable` while continuing the run. An approved design that cannot
   plant a source records isolation as unknown and needs a separately reviewed profile.
4. **Explicit child environment.** The launcher constructs the environment from nothing:
   `PATH`, `HOME`, `CLAUDE_CONFIG_DIR`, `TMPDIR`, `CLAUDE_PROJECT_DIR`, locale and terminal
   variables as today, **no credential variable of any kind**. The refusal list in §1.2
   applies to the *launching* environment too: an override present there means the operator
   may be API-billed elsewhere and the run stops with `BILLING_OVERRIDE_PRESENT`.
5. **Status before workspace.** `claude auth status --json` runs in the constructed
   environment before any workspace is prepared. `loggedIn !== true` → `LOGIN_REQUIRED`.
   `authMethod` and `apiProvider` are retained and must be consistent with the manifest's
   declared `billing_mode` (§3.2); otherwise `BILLING_MODE_MISMATCH`.
6. **Session flags.** `-p --output-format json --model <resolved> --max-turns <n>
   --max-budget-usd <estimate cap> --setting-sources project --permission-mode manual
   --permission-prompts none --strict-mcp-config --mcp-config <empty> --no-chrome
   --no-session-persistence --debug hooks --debug-file <session>/debug.log`, as the smoke
   package already froze, minus nothing and plus nothing. `--bare`, `--restricted`,
   `--safe-mode`, `--dangerously-skip-permissions` and `--allow-dangerously-skip-permissions`
   are refused.

### 2.2 What is and is not demonstrated

- A quiet canary **does not** demonstrate isolation; it fails to refute it. This is
  unchanged from `docs/prd-v8-agent-isolation.md`.
- A `loggedIn: true` status **does not** demonstrate that the session used that login. The
  session's own result (`error` subtypes, `api_retry` `authentication_failed`) and the
  provider-attested model together are the evidence of a working native session.
- If the pinned CLI does not preserve login under this construction, the outcome is a
  **blocker** (`NATIVE_LOGIN_NOT_PRESERVED`) recorded in the T-109 observation. The only
  alternative is a **declared controlled-host baseline**: a dedicated OS user or clean
  host where the user signs in normally, with the canary in that account's real config
  directory. That baseline is a methodology revision, needs the user's recorded approval, is
  a new profile name and cohort, and claims exactly what the canary and hook log observed.
  It is never a fallback the runner selects on its own, and an API key is never a fallback.

### 2.3 Codex isolation and evidence: future surface-specific profile

The login/configuration research in §1.3 is input to a future Codex profile, not a
launch contract. Before T-110/T-111 use Codex, define its own authentication vocabulary,
isolation identity, usage schema, supported captures and stop rules, and verify them
against the pinned tool. Do not require Claude's `provider_minutes`, status fields or
estimate allocator when the Codex surface does not expose them.

Pincer installs Codex skills and project instructions, not a Codex hook adapter. Observe
skill/instruction use, runtime checks, sandbox and permission controls, recovery and
candidate evidence. Claude-only hook checks are explicitly **not applicable** to that
surface, with the reason retained; missing evidence for an applicable control still blocks
its claim. The existence of a host hook option creates no Pincer hook requirement.

The Claude schema in §3 and its examples reject every Codex/Copilot record with
`SURFACE_UNSUPPORTED`, including relabelled Claude records. This does not withdraw product
support or cancel T-111: it makes the missing Codex study profile an explicit prerequisite
before its native journey. There is no implied Codex profile in T-121's Claude smoke path.

### 2.4 Shared login-directory ownership and recovery

These are implementation obligations for T-121, not implemented guarantees.

- Acquire an exclusive lock keyed by the canonical login-directory path before any auth
  probe, directory inspection or canary mutation. Hold it through the child process's
  termination, capture retention and cleanup. All study invocations using that directory,
  across arms, allocations and workspaces, share this lock. A live owner yields
  `LOGIN_DIR_BUSY` and launches no task. Account login/maintenance must run only while the
  directory is released; unmanaged tool use during a run invalidates controlled custody.
- Store the lock and durable ownership journal outside the credential directory, in the
  protected study control area. Record allocation/attempt/session IDs and owner identity
  including process-start identity (PID alone is insufficient). Record only canonical
  directory identity and owned synthetic paths/digests, never credential contents/hashes.
- Reject symlinked login roots and canary destinations. Journal intended creation before
  each exclusive write; durably record each created file's identity and synthetic digest.
  Never overwrite an existing file. Partial creation remains recoverable from the journal;
  a create-before-receipt crash is uncertain ownership and must preserve the file.
- Delete only files whose owner, path, file identity and digest still match the journal,
  using custody-safe checks. Never recursively clean the shared login directory. On a
  mismatch, replacement, unexpected file or retention/cleanup failure, preserve files and
  recovery metadata, stop the allocation and report `LOGIN_DIR_RECOVERY_REQUIRED`.
- A dead or unknown lock owner does not authorize automatic lock stealing or deletion.
  Recovery requires proven owner termination plus an explicit recorded recovery decision.
  If process custody cannot be established, block. Recovery may remove verified owned
  unchanged canaries; it must preserve altered/unowned files and never read credentials.
  Release custody only after durable cleanup/recovery receipts; retain the history.
- T-121 must test competing invocations, aliases to the same root, partial creation,
  interruption before/after writes, changed/replaced canaries, failed cleanup, unavailable
  owner identity and recovery followed by a clean next session. Fixtures establish these
  controls; T-109 still observes actual login preservation and host behavior.

## 3. Subscription-aware usage, allocation, readiness and comparison (S-63)

The executable schema specified here is **Claude-only**: `tool_surface: claude-code`,
`isolation_profile: claude-project-native-login-v1`, and
`measurement_profile: claude-code-result-native-usage-v1`. Authentication must use the
reviewed Claude status vocabulary (`claude.ai` for subscription, `console` for API billing;
`api_provider: firstParty`); unknown methods/providers are refused. A future surface must
have its own schema and profile instead of changing only `tool_surface` in a Claude record.
The API-billed example describes Console account login, not a provider-key fallback or
permission to schedule API billing; the subscription smoke remains the intended path.

### 3.1 Measurement profile `claude-code-result-native-usage-v1`

`claude-code-result-modelusage-v1` (T-105) remains the reader for every retained API-key
record. The native profile keeps its token and provider-time rules and replaces the cost
metric with a billing block. Field semantics:

| Field | Source | Meaning |
| --- | --- | --- |
| `tokens` | `modelUsage` four fields, each present, summed once | **Mandatory capture.** Missing or invalid → the record is `incomplete` (`MISSING_REQUIRED_CAPTURE`). |
| `provider_minutes` | `duration_api_ms / 60000` | **Mandatory capture.** Same rule. |
| `estimate_usd` | `total_cost_usd` | Client estimate at list price. Mandatory for Claude Code (the payload always carries it); recorded as an **estimate**, never as a charge. Absent for Codex (`TOOL_REPORTS_NO_ESTIMATE`). |
| `billing.mode` | manifest declaration cross-checked with the retained status record | `subscription` or `api`. Anything else is `AMBIGUOUS_BILLING` and stops before launch. |
| `billing.attributable_charge_usd` | billing evidence only | Under `subscription`: `null` with reason `SUBSCRIPTION_NOT_ATTRIBUTABLE` — **expected, valid, not a failure**. Under `api`: a number only when `billing.charge_evidence` references a retained billing export; otherwise `null` with `CHARGE_EVIDENCE_MISSING` and the record is valid but excluded from dollar claims. |
| `billing.charge_evidence` | reference | `null` or `{ref, digest}` to a retained, sanitized billing export. Never an inference from list price. |
| `account_limit` | result/retry events | `null` or `{kind: session|weekly|model|spend|unknown, at}`; any non-null value is a stop. |

Rules that must hold, and which the contract suite rejects when violated:

- **Ambiguous billing.** `billing.mode` absent or not in {`subscription`,`api`}; a
  subscription record with a non-null `attributable_charge_usd`; an api record whose
  `attributable_charge_usd` is non-null while `charge_evidence` is null; a record whose
  `estimate_usd` is copied into `attributable_charge_usd`.
- **Missing mandatory observation.** `tokens` or `provider_minutes` null; the
  `authentication` status record absent from the session environment; for Claude Code,
  `estimate_usd` null with no reason.
- **Incompatible profile.** `isolation_profile: claude-project-isolated-v1` with
  `billing.mode: subscription`; `measurement profile claude-code-result-modelusage-v1` on
  a native record; `claude-project-native-login-v1` with any credential variable in the
  retained `env_names`; a Codex record with a non-null `estimate_usd`.

### 3.2 Allocation and authorization

The `study-authorization` decision, still `decided_by: user`, gains:

- `billing_mode`: `subscription` or `api` (required; no default);
- `session_estimate_cap_usd` (replaces `session_cap_usd` in meaning: the `--max-budget-usd`
  estimate cap, not a charge), `session_wall_minutes`, `session_turns`;
- `limit_estimate_usd` (replaces `limit_usd` in meaning: the aggregate of estimates the
  allocator may reserve; under `subscription` it bounds token use, not a bill);
- `account_usage`: `{ max_sessions, max_elapsed_minutes, agreed: true }` — the user's
  agreed envelope of plan usage; the runner cannot enforce a plan quota and says so;
- `schedule_digest`, `expires_at`, `allocation_id`, `purpose` unchanged.

Allocator rules: reserve by estimate exactly as today; **unknown estimate stops** (an
estimate is mandatory capture for Claude Code); an `account_limit` event stops the whole
allocation (`ALLOCATION_ACCOUNT_LIMIT`), and resume is an explicit recorded decision; no
session may start when `billing_mode` in the manifest differs from the retained status
record of the previous session (`BILLING_MODE_MISMATCH`). "Actual attributable billed
charge" is never computed by the allocator; it is imported as evidence by T-119.

### 3.3 Readiness (study manifest schema 2)

Schema 1 manifests remain readable and validate exactly as today. Schema 2 adds, and the
inspector requires for any native-login purpose:

- `execution.billing`: `{ mode, tool_surface: 'claude-code', status_record_contract:
  'claude-auth-status-json-v1' }`; other surfaces are `SURFACE_UNSUPPORTED`;
- `allocation.session_estimate_cap_usd`, `allocation.limit_estimate_usd`,
  `allocation.account_usage` matching the decision;
- the `native` evidence summary's checks gain `login_preserved`, `override_refused`,
  `status_record_sanitized`, `billing_mode_consistent`; the `smoke` summary's checks gain
  `estimate_captured`, `charge_unavailable_labelled`.

Pending reasons added: `BILLING_MODE_PENDING`, `ACCOUNT_USAGE_PENDING`,
`LOGIN_STATUS_CONTRACT_PENDING`. All existing reasons keep their names and order.

### 3.4 Comparison rules (T-110, T-114, T-115, T-116, T-118)

| Claim | Requirement |
| --- | --- |
| Elapsed time, operations, interventions, review minutes, acceptance | Any billing mode; report as today with denominators. |
| Token and provider-time comparison | Any billing mode; same tool surface and profile on both sides. |
| Estimate comparison | Same tool surface; labelled "list-price estimate", never "cost" or "charge". |
| Dollar-superiority or dollar-target claim | Every compared cell has `billing.mode: api` **and** non-null `attributable_charge_usd` with charge evidence. Mixed or subscription cells → `COST_COMPARISON_INCOMPATIBLE`; the claim is withheld, and the report says why. |
| Codex or Copilot cells | Never in a dollar comparison (no estimate or charge is exposed). |

The 72-cell and 27-cell studies remain planned obligations. Their feasibility under plan
usage limits is checked after the smoke and pilots; a proposed scope revision, not a
silently smaller sample, is the only way to shrink them.

## 4. Schema and profile migration, and rollback

| Identity | Before | After | Migration | Rollback |
| --- | --- | --- | --- | --- |
| Isolation profile | `claude-project-isolated-v1` | `claude-project-native-login-v1` | New profile object; the old one stays exported for reading retained fixture records and their `observationTarget`. | None to the API path. If native login is not preserved, the study is blocked pending the user's decision on a controlled-host baseline (§2.2). |
| Usage profile | `claude-code-result-modelusage-v1` | `claude-code-result-native-usage-v1` | Versioned reader; old records keep `cost_usd` under the old profile and are labelled `legacy-api-estimate`. Never pooled with native records. | Old reader remains. |
| Study manifest | schema 1 | schema 2 (§3.3) | The inspector accepts both; schema 1 has no `billing` and is refused for a native-login purpose with `BILLING_MODE_PENDING`. | Schema 1 manifests stay valid for reading history. |
| Study authorization | `limit_usd`, `session_cap_usd` | `limit_estimate_usd`, `session_estimate_cap_usd`, `billing_mode`, `account_usage` | The 20 September API-key authorization is superseded, not rewritten; its documents stay under `decisions/` as history. | n/a |
| Effective manifest | `configuration.isolation_profile: claude-project-isolated-v1` | `claude-project-native-login-v1` | New cohort; the retained `1c91c6ef…` effective manifest and observation target `d53ff6f0…` describe the superseded API-key identity. | n/a |
| Frozen cohort | `SPEC.harness` without this document | with this document appended | Regenerate `test/fixtures/delivery-benchmark-v7/frozen.json`; existing cohort digests remain historical identities. | n/a |

Every step preserves: evidence freshness targets, prior failures, restart safety,
unrelated user work, historical cohort identities, and the rule that receipts are never
hand-edited.

## 5. Replacement execution-package design (for T-121 to produce; not a launch)

1. **Host setup (user).** Create `<study root>/host/claude-config`; run
   `CLAUDE_CONFIG_DIR=<that dir> claude auth login` with the pinned CLI; confirm with
   `claude auth status --text`. Pincer records only that the directory exists and the four
   sanitized status fields.
2. **Decisions bundle (user).** Model; caps (`session_turns`, `session_wall_minutes`,
   `session_estimate_cap_usd`); `limit_estimate_usd`; `account_usage`; `billing_mode`;
   K0 artifact acceptance; capture format; project access; two independent reviewers;
   the `study-authorization` document. The generator that turns these into inspector
   documents must refuse to write a review decision for anyone who has not confirmed a
   review, exactly as `settle-smoke.cjs` does today.
3. **Launch grammar.** The orchestrator's `--i-have-a-spending-cap` is renamed to
   `--i-agreed-the-usage-envelope`; it asserts that a human agreed the estimate cap **and**
   the account-usage envelope, carries no numbers, and is not the agent's to pass. The
   orchestrator reads no credential variable and refuses if one is present.
4. **Checks the smoke must show.** Login preserved (session result not an authentication
   error, attested model present); override refusal exercised offline with a synthetic
   variable, never with a real key; status record sanitized; estimate captured and labelled;
   charge unavailable and labelled; hook evidence sufficient for kit arms; canary quiet in
   both HOME and login directory (recorded as failed-to-refute); stop on injected account
   limit exercised offline only; cleanup complete; report regenerated offline.
5. **What the package must say it did not show.** That the login directory isolates the
   keychain entry on the pinned version; that Copilot behaves like either CLI; that a quiet
   canary proves absence.

## 6. Affected requirements (wording revised by this ticket)

- **T-102** — "required authentication remain functional" now means the host login of
  §2.1, and its native acceptance additionally requires `login_preserved` and
  `override_refused` in the observation.
- **T-105** — provider-field semantics are frozen per profile; the native profile's
  billing block (§3.1) is a T-105-owned semantics change delivered through T-121 with a
  versioned reader.
- **T-109** — the smoke's decisions bundle and checks are §5; the inspector's schema-2
  fields are §3.3; "numeric spending caps" means estimate caps plus an account-usage
  envelope, and "hard provider billing cap" is not claimed for any surface.
- **T-110/T-111** — Copilot VS Code stays unobserved (§1.4); Copilot CLI is separate research (§1.5). Codex needs the separate profile and applicable-control evidence described in §2.3 before its journeys.
- **T-114/T-115/T-116/T-118** — "total cost" is reported by billing mode under §3.4;
  dollar claims are conditional.

## 7. Contract examples checked by `test/native-tool-contracts.test.js`

Valid native session record (abridged to the contract fields):

```json native-session-record
{
  "schema": 1,
  "kind": "native-session-record",
  "isolation_profile": "claude-project-native-login-v1",
  "measurement_profile": "claude-code-result-native-usage-v1",
  "tool_surface": "claude-code",
  "authentication": { "checked": true, "logged_in": true, "auth_method": "claude.ai", "api_provider": "firstParty", "subscription_type": "max" },
  "env_names": ["CLAUDE_CONFIG_DIR", "CLAUDE_PROJECT_DIR", "HOME", "PATH", "TMPDIR"],
  "metrics": {
    "tokens": { "value": 120, "reason": null },
    "provider_minutes": { "value": 0.5, "reason": null },
    "estimate_usd": { "value": 1.25, "reason": null }
  },
  "billing": { "mode": "subscription", "attributable_charge_usd": null, "charge_reason": "SUBSCRIPTION_NOT_ATTRIBUTABLE", "charge_evidence": null },
  "account_limit": null
}
```

Valid API-billed record with charge evidence (the only shape admissible to a dollar claim):

```json native-session-record
{
  "schema": 1,
  "kind": "native-session-record",
  "isolation_profile": "claude-project-native-login-v1",
  "measurement_profile": "claude-code-result-native-usage-v1",
  "tool_surface": "claude-code",
  "authentication": { "checked": true, "logged_in": true, "auth_method": "console", "api_provider": "firstParty", "subscription_type": null },
  "env_names": ["CLAUDE_CONFIG_DIR", "CLAUDE_PROJECT_DIR", "HOME", "PATH", "TMPDIR"],
  "metrics": {
    "tokens": { "value": 120, "reason": null },
    "provider_minutes": { "value": 0.5, "reason": null },
    "estimate_usd": { "value": 1.25, "reason": null }
  },
  "billing": { "mode": "api", "attributable_charge_usd": 1.31, "charge_reason": null, "charge_evidence": { "ref": "evidence/billing/console-export-2026-09.json", "digest": "0000000000000000000000000000000000000000000000000000000000000000" } },
  "account_limit": null
}
```

Study authorization (schema 2 fields):

```json study-authorization
{
  "schema": 1,
  "kind": "study-authorization",
  "approved": true,
  "decided_by": "user",
  "decided_at": "2026-09-20T00:00:00Z",
  "purpose": "operational-smoke",
  "allocation_id": "v8-native-smoke-1",
  "billing_mode": "subscription",
  "session_turns": 3,
  "session_wall_minutes": 2,
  "session_estimate_cap_usd": 1,
  "limit_estimate_usd": 3,
  "account_usage": { "max_sessions": 3, "max_elapsed_minutes": 20, "agreed": true },
  "expires_at": "2026-09-27T00:00:00Z",
  "schedule_digest": "0000000000000000000000000000000000000000000000000000000000000000",
  "evidence": [{ "ref": "decisions/native-smoke-decisions.json", "digest": "0000000000000000000000000000000000000000000000000000000000000000" }]
}
```

Comparison admissibility (the report-side rule of §3.4):

```json comparison-admissibility
{
  "claim": "dollar-superiority",
  "cells": [
    { "billing_mode": "api", "attributable_charge_usd": 1.31, "charge_evidence": true, "tool_surface": "claude-code" },
    { "billing_mode": "api", "attributable_charge_usd": 0.92, "charge_evidence": true, "tool_surface": "claude-code" }
  ]
}
```

## 8. Official references checked for this contract

Read 20 September 2026; installed help output recorded above.

- Claude Code: [Authentication](https://code.claude.com/docs/en/authentication),
  [Manage costs](https://code.claude.com/docs/en/costs),
  [CLI reference](https://code.claude.com/docs/en/cli-reference),
  [Run programmatically](https://code.claude.com/docs/en/headless),
  [Settings](https://code.claude.com/docs/en/settings).
- Codex CLI: [Authentication](https://learn.chatgpt.com/docs/auth),
  [Non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)
  (both reached by redirect from `developers.openai.com/codex/…`). The `openai-docs`
  skill named by the ticket is not installed in this environment; the official pages were
  read directly instead.
- GitHub Copilot in VS Code: [IDE sign-in](https://docs.github.com/en/copilot/how-tos/chat-with-copilot/chat-in-ide),
  [Prompt files](https://code.visualstudio.com/docs/agent-customization/prompt-files).
- GitHub Copilot CLI (separate research): [Install](https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli),
  [About](https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli),
  [Programmatic reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-programmatic-reference),
  [Command reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference),
  [Premium requests](https://docs.github.com/en/copilot/concepts/billing/copilot-requests).

None of these pages demonstrates that the pinned Claude Code 2.1.273 preserves a login
under a dedicated `CLAUDE_CONFIG_DIR` with a fresh HOME and project-only settings. That is
the first thing the native smoke must observe.

## Custody review correction — 20 September 2026

Cleanup must not check a mutable pathname and then unlink it. The implementation atomically moves an apparently owned canary into a unique private holding directory under the custody control area, journals the destination before the move, and verifies the moved object. Both verified canaries and unexpected replacements are retained there; a replacement is restored by exclusive linking where possible, never by overwriting a newer file. `removed` means removed from the active login directory, not destroyed. Changed or uncertain files require recovery and their retained locations are recorded. No automatic recursive cleanup of these holding directories is permitted.

Explicit recovery holds the recovery guard throughout canary inspection, retirement and durable receipts, including marker removal. Dead-owner recovery keeps the abandoned claim until that work completes. Released-owner recovery acquires the same guard and rechecks that no new owner exists. A recovery-in-progress marker survives exceptions.

Before allowing a session supervisor to start its tool, its detached process group must be registered in both the login-directory claim and the run claim. Owner death alone cannot permit login-directory recovery while a registered group remains live or uncertain. Registration failure launches no tool. T-121 includes replacement-after-check, rename-before-receipt, competing recovery/acquisition and detached-child-after-owner-death regressions.
