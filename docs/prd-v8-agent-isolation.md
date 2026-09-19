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
The plain arm requires a retained log; a kit arm's retained log must name both installed
hook scripts (`.claude/hooks/block-dangerous.sh`, `.claude/hooks/ticket-guard.sh`).
`status` is `missing` (no log), `unreadable`, `unretained` (no durable copy), `insufficient`
(retained but not showing the required hooks) or `sufficient`. Anything but `sufficient`
makes a measured session unreportable, with the reason named in `unreportable`.

**Retention failure.** If the redacted copy cannot be written, the launcher preserves what
it can in the retained scratch: a redacted copy if that succeeds, otherwise the raw file
renamed there and flagged `redacted: false`. The result carries
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
