# Study agent isolation — T-102

## Implemented profile and observation boundary

`claude-project-isolated-v1` targets the installed Claude Code 2.1.273 contract.
Other versions are refused until their configuration contract is reviewed. The launcher
constructs the environment explicitly, uses new empty HOME/config/temp directories for
each session, and enables only project settings. It preserves workspace CLAUDE.md,
AGENTS.md, commands, agents, skills and the pinned kit hooks. The intended asset inventory
is retained after kit installation and checked again before every handoff.

The CLI receives manual permissions and `--permission-prompts none`: operations needing
approval are denied, never silently approved. Managed host policy is not disabled.
A separate override sets only the permission mode; project hooks are not copied into
that override and therefore are not deliberately registered twice. MCP configuration is
explicitly empty; Chrome integration and session persistence are disabled. No personal
settings, plugins, proxy variables, Node options, shell startup variables or parent-session
variables are inherited by the launcher.

Authentication uses an explicitly supplied authorized Anthropic API key in memory and
the child environment. The key is never included in arguments, records or fingerprints.
Captures remove the key before durable writes, including values split across stream
chunks. Subscription/keychain credentials are not read or copied. A dedicated config
directory has a different keychain identity, so existing subscription authentication is
not assumed to work. Missing authentication is a prerequisite failure.

The previous `live-driver.sh` entry point now refuses all calls. There is no legacy
inherited-configuration launch path.

## Observed, not only configured: the synthetic canary and the hook capture

Two additions make isolation and kit-hook behavior observable from retained files without
reading anything personal.

**Synthetic isolation canary** (`home: per-session-synthetic-canary`). Before each session
the launcher plants user-level configuration where a CLI that ignored
`--setting-sources project` would read it: `settings.json` with a `SessionStart` hook that
touches a marker inside the session root, and a `CLAUDE.md` holding a random per-session
phrase, in both the per-session `HOME/.claude` and `CLAUDE_CONFIG_DIR`. After the session
the launcher records `environment.isolation_canary = { leak_detected, user_hook_ran,
user_settings_loaded, user_instructions_loaded }`. The two `loaded` fields are `true` on
positive evidence (the hook ran; the phrase reached stdout, stderr or the hook debug log)
and otherwise `unknown`: settings can load without their `SessionStart` hook running, and
instructions can load without being echoed. **A canary that was not triggered does not
demonstrate isolation**; it only failed to refute it. The launcher writes no phrase into
the record, but captures keep whatever the tool emitted, so a leak leaves the phrase in
them. A tripped canary makes the session unreportable. The operator's real home
directory, configuration and instruction text are never read, hashed or compared.

**Hook capture** (`hook_capture: debug-hooks-file`). The argument vector adds
`--debug hooks --debug-file <session>/debug.log`, so the CLI writes its own hook matching
and execution log inside the session root. The launcher retains only a redacted copy,
`logs/<session>.debug.log` (mode 0600, append-preserved), and records
`environment.hook_capture = { present, retained, file, bytes }`; an absent log is
recorded, never read as "no hooks ran". The final result object on stdout is unchanged, so
result parsing, usage accounting, redaction and interruption handling are the same as
before. Whether the pinned CLI's hook debug lines name each executed hook command and its
exit status is a smoke finding: it is documented behavior, not yet observed here.

**Required hook evidence** (`environment.hook_evidence = { status, required, missing }`).
The plain arm requires a nonempty retained log. Kit arms require a recognized completion
line for each installed hook: `[DEBUG] Hook command completed with status <0..255>: bash
"$CLAUDE_PROJECT_DIR"/.claude/hooks/<script>.sh` (optionally preceded by an ISO UTC
timestamp). Both `block-dangerous.sh` and `ticket-guard.sh` must complete. A denial exit
status is evidence of execution, not task acceptance. Registration-only lines, attempts
without outcomes, malformed statuses and unknown formats are insufficient. This narrow
grammar is fixture-tested; matching the pinned CLI's native format remains a smoke
observation, and any format adjustment must be reviewed and frozen before measured use.
`status` is `missing` (no log), `unreadable`, `unretained` (no durable copy), `insufficient`
(retained but not showing the required hooks) or `sufficient`. Anything but `sufficient`
makes a measured session unreportable, with the reason named in `unreportable`.

**Retention failure.** If the redacted copy cannot be written, the launcher preserves what
a redacted recovery copy in the retained scratch. If reading fails or neither redacted
copy can be written, it preserves the original protected session directory instead of
deleting the last copy. `hook_capture.recovered` names the file relative to scratch;
`original_preserved: true` and `redacted: false` identify raw evidence requiring review.
Unexpected exceptions also preserve the session directory conservatively. The result carries
`evidence_retention_failed: true` and `review_required: true`; the allocator stops the
allocation (`ALLOCATION_EVIDENCE_UNRETAINED`), so no further paid session starts before an
explicit recovery decision.

**Reportability** is one gate, `reportability()`, with every deficiency a named reason:
model attestation, process cleanup, capture failure, a tripped canary, or hook evidence
that is not sufficient. The orchestrator records those reasons in the run's `reason` and
stops the schedule. The fixture path never reaches `reportable: true`; the gate is tested
directly and through the orchestration path with the launcher's verdict as input.

## Why this profile retains project discovery

Bare mode skips project CLAUDE.md and legacy commands/agents. The released kit uses those
mechanisms. Loading it as a plugin would also change command names through namespacing.
This profile therefore retains project discovery in a clean environment; it does not
substitute a prose-only kit or silently transform its adapters.

The installed help and current official documentation establish the proposed controls,
not observed native isolation. `test/benchmark-environment.test.js` runs real child
processes with a synthetic tool, hostile environment values and personal configuration
canaries. It observes intended asset availability, runs the actual installed dangerous
command hook against a synthetic tool input, verifies process-group teardown, checks that
the planted canary stays untouched for a compliant tool and trips for a leaking one, and
checks that the hook debug log is retained redacted. Every such record is marked
`fixture: true` and `reportable: false`.

T-109 must observe the actual CLI with all three arms, working authentication, intended
kit discovery/hooks and retained managed policy before measured use. An operational
smoke is available only with explicit recorded spending, project-access and host-policy
decisions; it always remains outside measured results. No native smoke or paid session
was run while implementing T-102.

## Runtime API

```js
const launch = require('./scripts/delivery-benchmark-v7/isolated-launch.cjs');
// Capture once after installation; retain in the owned run record before launching.
const expectedAssets = launch.assetsFor(arm, workspace).files;
const result = await launch.launchNative({
  effective: bundle, arm, workspace, stateRoot, logDir, name, prompt,
  apiKey, // protected runtime value; never serialize this options object
  expectedAssets,
  onGroup: group => claims.registerGroup(claim, group),
  readiness: {
    purpose: 'operational-smoke', // or 'measured', with reviewed observation below
    spendingAuthorized: true,
    projectAccessAuthorized: true,
    hostPolicyPreserved: true,
    decisionRef: 'retained-decision-reference',
  },
});
```

These booleans record actual decisions; the API is not authorization to invent them.
The effective configuration must contain `isolation_profile: 'claude-project-isolated-v1'`
and `permission_mode: 'manual'`. A measured launch also needs
`isolation_observation_digest`, `readiness.observationReviewed: true`, and an
`observationFile` relative to the declared input root.

`preflightExecution()` checks the effective identity, profile, authentication and readiness
before workspace preparation. `preflightNative()` always adds ancestor configuration and
retained arm asset checks before the actual session. Neither accepts a flag that skips
its asset checks.

Before tool startup, an inert supervisor registers its process group through `onGroup`.
A registration failure kills the supervisor before the tool starts. On completion,
timeout or cancellation the launcher terminates descendants and checks group disappearance.
`cleanup_complete: false` prevents reportability and keeps custody recovery conservative;
the flag is retained in the record environment.
The numeric `spend_usd` cap is passed as the CLI per-session `--max-budget-usd`
limit; it is not an aggregate study billing guarantee. Aggregate allocation remains an
explicit readiness decision. Captures use unique session filenames, mode 0600, and are flushed incrementally; an
existing capture is never overwritten. Partial captures survive process interruption. A write, flush or stream failure terminates
the registered process group and returns status 74 with a structured `capture_failure`;
already-written logs remain available and the result cannot be reportable.

Records distinguish requested model from provider-attested model. Missing or mismatched
attestation makes a native result unreportable. Provider payloads remain available in the
sanitized captures for subsequent usage accounting; a requested model string is not
substituted for observation.

## Retained native observation format

The observation is reviewed evidence, not a self-issued runtime certificate. Its target
is `launch.observationTarget(manifest)`, binding the profile, tool bytes/version, model,
kit identity and platform. All evidence files are contained under the explicit input
root and checked against their recorded byte digests. The SHA-256 of the observation
file itself is frozen in `configuration.isolation_observation_digest`.

```json
{
  "schema": 1,
  "kind": "native-isolation-observation",
  "fixture": false,
  "target": "<64-hex target digest>",
  "arms": ["plain", "pincer", "strict"],
  "host_policy_observed": true,
  "authentication_observed": true,
  "personal_configuration_absent": true,
  "evidence": [{"path": "observations/native-smoke.json", "digest": "<64-hex>"}]
}
```

Native evidence is outstanding. Fixture records, missing evidence, changed artifacts,
unreviewed observations, changed tool/model/kit/platform and unsupported CLI versions
cannot satisfy the measured-launch gate.

## Official configuration references

- [CLI flags](https://code.claude.com/docs/en/cli-reference): setting sources, permissions,
  strict MCP configuration and session persistence controls.
- [Programmatic use](https://code.claude.com/docs/en/headless): project discovery and the
  bare-mode limitations that exclude this kit's legacy commands/agents.
- [Authentication](https://code.claude.com/docs/en/authentication): explicit API-key use
  and configuration-directory-specific credential storage/keychain identity.
- [Settings precedence](https://code.claude.com/docs/en/settings): managed-policy precedence
  and project settings behavior.

## Native-login revision (T-120, 20 September 2026)

`claude-project-isolated-v1` above is **historical**: it authenticates with an injected
`ANTHROPIC_API_KEY`, which the user's 20 September decision excludes. Its identity, fixture
records, observation target `d53ff6f0…` and retained effective manifest `1c91c6ef…` remain
readable under their own names; it is not the execution path of any future session, and no
native observation was ever recorded under it.

The replacement profile is `claude-project-native-login-v1`, specified in
[the native-tool contracts](prd-v8-native-tool-contracts.md) §2 and implemented by T-121:
`authentication: host-login-config-dir` (the user signs in once with `claude auth login`
inside a study `CLAUDE_CONFIG_DIR`; the runner never creates, reads, copies or hashes a
credential), the same per-session synthetic canary and hook capture, the same
project-only settings, manual permissions, empty MCP and explicit environment, plus a
pre-workspace `claude auth status --json` check retaining only `loggedIn`, `authMethod`,
`apiProvider` and `subscriptionType`, a dirty-login-directory blocker
(`PROFILE_HOST_DIRTY`), and refusal of every credential or billing override
(`BILLING_OVERRIDE_PRESENT`) without printing a value or editing the user's shell.

Whether the pinned CLI preserves that login under a fresh HOME with project-only settings
is not established by documentation or by this profile; it is the first T-109 observation.
If it does not, the result is the blocker `NATIVE_LOGIN_NOT_PRESERVED`, and the only
alternative is a declared controlled-host baseline approved by the user as a methodology
revision under a new profile name. An API key is never the fallback. Codex and Copilot
isolation are specified or explicitly unobserved in the contract; neither is scheduled.

## Implemented native-login profile (T-121, 20 September 2026)

`isolated-launch.cjs` now exports both profiles. `PROFILE` (`claude-project-isolated-v1`)
is kept only so retained fixture records and their observation target stay readable;
`checkExecutionReadiness` refuses it with `PROFILE_HISTORICAL`. `NATIVE_PROFILE`
(`claude-project-native-login-v1`) adds `login_dir: host/claude-config`,
`status_record: claude-auth-status-json-v1` and `billing_mode: declared-in-study-manifest`
to the fields above, so its observation target differs from `d53ff6f0…`.

**Order of a launch.** `preflightExecution` runs before any workspace exists: the launching
environment is checked for the nine credential/provider variables of the contract
(`BILLING_OVERRIDE_PRESENT`, name only); custody of the login directory is acquired
(`login-custody.cjs`); the directory's entry names are inspected (`PROFILE_HOST_DIRTY`);
`<tool> auth status --json` runs with a throwaway `HOME` and the login directory as
`CLAUDE_CONFIG_DIR` (`LOGIN_REQUIRED`, `LOGIN_STATUS_INVALID`, `PROFILE_INCOMPATIBLE`,
`BILLING_MODE_MISMATCH`). The orchestrator holds custody through kit installation, the
session, capture retention and canary cleanup, and releases it only after a durable
receipt. In the session the launcher plants the synthetic canary in the per-session
`HOME/.claude` as before and, with exclusive creation under custody, in the login directory;
probes the status again in the actual session environment; and then starts the supervisor,
which verifies that its parent holds custody and that the environment carries no credential
variable before consuming the reservation. The child environment is `PATH`, `HOME`,
`CLAUDE_CONFIG_DIR`, `TMPDIR`, `LANG`, `LC_ALL`, `CLAUDE_PROJECT_DIR`, `GIT_CONFIG_NOSYSTEM`,
`GIT_CONFIG_GLOBAL`. `caps.spend_usd` keeps its historical key name; it is the
`--max-budget-usd` list-price estimate cap and is never a charge.

**Custody and recovery** (`login-custody.cjs`). One lock per canonical login directory in
`host/.login-custody/`, outside the credential directory, with a journal that records the
owner (pid, host, token, process start), the allocation/run/session ids and every canary
write as `intended` then `created` (identity and digest). Aliases of one directory share
the lock; a symlinked login root or one inside the operator's home is `LOGIN_DIR_INVALID`. A
live owner is `LOGIN_DIR_BUSY`; a dead or unknown owner is `LOGIN_DIR_RECOVERY_REQUIRED`
and is never stolen. Cleanup deletes one owned file at a time only when its identity and
digest still match the journal; a changed, replaced, symlinked or undeletable file is
preserved, a recovery marker is written before the lock is released, the record says
`login_directory.recovery_required: true`, and the allocation stops
(`ALLOCATION_LOGIN_DIR_RECOVERY`). `recover(root, {token, reason})` needs the owner proven
gone, removes only verified unchanged owned files, preserves the rest (a write without its
receipt is uncertain ownership), leaves a receipt, and launches nothing. Nothing in the
directory is ever read, sized or hashed except the runner's own two canary files.

**Record additions.** `environment.authentication` holds exactly `checked`, `logged_in`,
`auth_method`, `api_provider`, `subscription_type`; `environment.billing` the declared
mode with `attributable_charge_usd: null` and its reason; `environment.account_limit` a
classified `{kind, at}` or `null`; `environment.login_directory` the custody summary;
`isolation_canary` gains `login_dir_hook_ran`. A reviewed `native-isolation-observation`
for a measured launch must now also carry `login_preserved: true` and
`override_refused: true`.

**What the fixtures established, and what they did not.** `test/native-login-study.test.js`
and `test/benchmark-environment.test.js` exercise every refusal above with a synthetic
status command and tool, competing invocations on aliased roots, a crash before and after
the canary receipt, a replaced canary, a deletion fault, recovery and the clean session that
follows, the orchestrator holding and releasing custody, the account-limit stop, and the
subscription-unavailable versus missing-capture distinction, while proving the synthetic
credential file is never opened. None of this observes the pinned CLI: whether 2.1.273
preserves the login under this construction, what entry names it leaves in the directory,
and whether its hook log matches the grammar remain T-109 observations.

### Custody correction — 20 September 2026

Native login cleanup retires canaries to journaled private holding paths and retains their bytes; it never unlinks a mutable login-directory pathname after checking it. Replacements and uncertain files remain preserved for explicit recovery. Recovery holds its guard through cleanup and receipts. Both login and run claims record the detached supervisor group before task startup, so surviving children prevent recovery after owner death. See the native-tool contract's custody correction.
