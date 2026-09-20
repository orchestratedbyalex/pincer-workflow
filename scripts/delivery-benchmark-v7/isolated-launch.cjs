'use strict';
// T-102/T-121: a named, explicitly configured baseline that signs in through the coding
// tool's own login. Actual Claude Code login preservation, isolation and managed-policy
// observations remain a T-109 prerequisite; fixtures prove plumbing, never native behavior.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { StringDecoder } = require('node:string_decoder');
const crypto = require('node:crypto');
const effective = require('./effective.cjs');
const custody = require('./login-custody.cjs');
// Historical: the API-key profile. Its identity stays exported so retained fixture records and
// their observation target remain readable. It is not the execution path of any session.
const PROFILE = Object.freeze({
  name: 'claude-project-isolated-v1', tool_version: '2.1.273',
  authentication: 'anthropic-api-key', setting_sources: 'project',
  permission_mode: 'manual', permission_prompts: 'none',
  mcp: 'explicit-empty', home: 'per-session-synthetic-canary',
  hook_capture: 'debug-hooks-file',
  host_policy: 'managed-policy-preserved-observation-required',
});
// Current: the user's own `claude auth login` inside the study login directory. The runner
// never creates, reads, copies or hashes a credential, and never injects a provider key.
const NATIVE_PROFILE = Object.freeze({
  name: 'claude-project-native-login-v1', tool_version: '2.1.273',
  authentication: 'host-login-config-dir', config_dir: 'study-login-directory',
  login_dir: custody.LOGIN_DIR, status_record: 'claude-auth-status-json-v1',
  billing_mode: 'declared-in-study-manifest',
  setting_sources: 'project', permission_mode: 'manual', permission_prompts: 'none',
  mcp: 'explicit-empty', home: 'per-session-synthetic-canary',
  hook_capture: 'debug-hooks-file',
  host_policy: 'managed-policy-preserved-observation-required',
});
const PROFILES = Object.freeze({ [PROFILE.name]: PROFILE, [NATIVE_PROFILE.name]: NATIVE_PROFILE });
const MEASUREMENT_PROFILE = 'claude-code-result-native-usage-v1';
const TOOL_SURFACE = 'claude-code';
const BILLING_MODES = ['subscription', 'api'];
// Variables that would switch the session's billing or provider (contracts §1.2). Presence
// is refused by NAME; the value is never read, logged or compared.
const CREDENTIAL_ENV = Object.freeze(['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_PROFILE', 'ANTHROPIC_FEDERATION_RULE_ID', 'ANTHROPIC_BASE_URL', 'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY']);
const OVERRIDE_SETTINGS = Object.freeze(['apiKeyHelper', 'env', 'awsAuthRefresh', 'awsCredentialExport']);
const ARMS = ['plain', 'pincer', 'strict'];
const REQUIRED_KIT = ['AGENTS.md', 'CLAUDE.md', '.claude/settings.json', '.claude/hooks', '.claude/commands', '.claude/agents'];
const REFUSED_FLAGS = ['--bare', '--restricted', '--safe-mode', '--dangerously-skip-permissions', '--allow-dangerously-skip-permissions'];
function fail(code, detail) { const e = new Error(detail); e.code = code; throw e; }
function profileFor(name) {
  if (!Object.hasOwn(PROFILES, name)) fail('PROFILE_UNBOUND', 'the named isolation profile has no reviewed contract');
  return PROFILES[name];
}
function overridePresent(env = process.env) {
  return CREDENTIAL_ENV.find(name => Object.hasOwn(env, name)) || null;
}
function regular(root, rel) {
  const full = effective.contained(root, rel);
  if (!fs.statSync(full).isFile()) fail('ASSET_INVALID', 'an intended arm asset is not a regular file');
  return full;
}
function settingsFor(arm, workspace) {
  if (arm === 'plain') return { permissions: { defaultMode: 'manual' } };
  const settings = JSON.parse(fs.readFileSync(regular(workspace, '.claude/settings.json'), 'utf8'));
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) fail('SETTINGS_UNBOUND', 'kit settings contain unsupported configuration');
  // A settings source the session would load must not select a key, helper or provider.
  const override = OVERRIDE_SETTINGS.find(key => Object.hasOwn(settings, key));
  if (override) fail('BILLING_OVERRIDE_PRESENT', `the project settings the session would load set \`${override}\`; remove it (its value was not read)`);
  if (Object.keys(settings).some(k => !['permissions', 'hooks'].includes(k))) fail('SETTINGS_UNBOUND', 'kit settings contain unsupported configuration');
  const permissions = settings.permissions || {};
  if (Object.keys(permissions).some(k => k !== 'deny') || (permissions.deny && (!Array.isArray(permissions.deny) || permissions.deny.some(v => typeof v !== 'string')))) fail('PERMISSION_UNBOUND', 'kit permissions must add deny rules only');
  // Commands remain exactly the installed kit commands. No ambient hook/config merge.
  const hooks = settings.hooks || {};
  if (Object.keys(hooks).some(k => k !== 'PreToolUse') || !Array.isArray(hooks.PreToolUse)) fail('HOOK_UNBOUND', 'only the pinned kit PreToolUse hook contract is supported');
  for (const group of hooks.PreToolUse) {
    if (!group || Object.keys(group).some(k => !['matcher', 'hooks'].includes(k)) || !['Bash', 'Edit|Write|MultiEdit|Bash'].includes(group.matcher) || !Array.isArray(group.hooks)) fail('HOOK_UNBOUND', 'unsupported kit hook group');
    for (const hook of group.hooks) {
      if (!hook || Object.keys(hook).some(k => !['type', 'command'].includes(k)) || hook.type !== 'command' || !/^bash "\$CLAUDE_PROJECT_DIR"\/\.claude\/hooks\/(?:block-dangerous|ticket-guard)\.sh$/.test(hook.command)) fail('HOOK_UNBOUND', 'unsupported kit hook command');
    }
  }
  return { permissions: { ...permissions, defaultMode: 'manual' }, hooks };
}
function assetsFor(arm, workspace) {
  if (!ARMS.includes(arm)) fail('ARM_INVALID', 'unknown study arm');
  workspace = fs.realpathSync(workspace);
  if (arm === 'plain') {
    for (const rel of ['CLAUDE.md', '.claude', '.mcp.json']) if (fs.existsSync(path.join(workspace, rel))) fail('PLAIN_CONTAMINATED', 'plain workspace contains undisclosed agent configuration');
    return { files: {}, settings: settingsFor(arm, workspace) };
  }
  for (const name of ['CLAUDE.local.md', '.mcp.json']) if (fs.existsSync(path.join(workspace, name))) fail('SETTINGS_UNBOUND', 'workspace contains undeclared local agent configuration');
  for (const entry of fs.readdirSync(effective.contained(workspace, '.claude'))) {
    if (!['settings.json', 'hooks', 'commands', 'agents', 'references', 'skills'].includes(entry)) fail('SETTINGS_UNBOUND', 'workspace contains undeclared Claude configuration');
  }
  const files = {};
  for (const rel of REQUIRED_KIT) Object.assign(files, effective.tree(workspace, rel).files);
  for (const rel of ['.claude/references', '.claude/skills']) if (fs.existsSync(path.join(workspace, rel))) Object.assign(files, effective.tree(workspace, rel).files);
  // The instruction import must continue to refer to the installed shared instructions.
  const claude = fs.readFileSync(regular(workspace, 'CLAUDE.md'), 'utf8');
  if (!/^@AGENTS\.md\s*$/m.test(claude)) fail('INSTRUCTION_UNBOUND', 'kit CLAUDE.md must import its installed AGENTS.md');
  return { files, settings: settingsFor(arm, workspace) };
}
function rejectAncestorInstructions(workspace) {
  let dir = path.dirname(fs.realpathSync(workspace));
  for (;;) {
    for (const name of ['CLAUDE.md', 'CLAUDE.local.md', '.claude']) {
      if (fs.existsSync(path.join(dir, name))) fail('ANCESTOR_CONFIGURATION', 'workspace has an ancestor agent configuration; use a clean dedicated study root');
    }
    const parent = path.dirname(dir); if (parent === dir) break; dir = parent;
  }
}
function validateExecutionParameters(options) {
  if (options.toolVersion !== NATIVE_PROFILE.tool_version) fail('TOOL_UNSUPPORTED', 'installed CLI version has no reviewed isolation contract');
  if (options.permissionMode !== 'manual') fail('PERMISSION_UNSUPPORTED', 'the study profile preserves manual approval and never bypasses it');
  if (!/^claude-[a-z0-9-]*\d[a-z0-9.-]*$/.test(options.model || '')) fail('MODEL_MISSING', 'resolved model identity is required');
  for (const [key, value] of Object.entries(options.caps || {})) {
    if (!['turns_per_session', 'wall_clock_minutes', 'spend_usd'].includes(key) || !Number.isFinite(value) || value <= 0) fail('CAP_INVALID', 'caps must contain only finite positive measured limits');
  }
  if (!Number.isSafeInteger(options.caps?.turns_per_session) || !Number.isSafeInteger(options.caps?.wall_clock_minutes) || !Number.isFinite(options.caps?.spend_usd)) fail('CAP_INVALID', 'turn, wall-clock and estimate caps are all required');
  if (options.caps.wall_clock_minutes > Math.floor(2147483647 / 60000)) fail('CAP_INVALID', 'wall-clock cap exceeds the supported watchdog range');
  if (!BILLING_MODES.includes(options.billingMode)) fail('AMBIGUOUS_BILLING', 'the declared billing mode must be subscription or api; nothing else may launch');
  if (Object.hasOwn(options, 'apiKey')) fail('BILLING_OVERRIDE_PRESENT', 'an API key is not a launch input; the study signs in through the tool\'s own login');
  if (typeof options.inputRoot !== 'string' || !options.inputRoot) fail('LOGIN_DIR_REQUIRED', 'the study root holding host/claude-config is required');
}
function validateParameters(options) {
  validateExecutionParameters(options);
  rejectAncestorInstructions(options.workspace);
  return assetsFor(options.arm, options.workspace);
}
function observationTarget(manifest) {
  const e = manifest.effective;
  const profile = profileFor(e.configuration?.isolation_profile);
  return require('./freeze.cjs').sha256(effective.canonical({ profile, tool: e.tool, model: e.model, kit: e.kit, platform: e.platform }));
}
// --- Login status (contracts §1.2, §2.1 rule 5) ------------------------------------------------
// `claude auth status --json` in the constructed environment. Retained: exactly five fields.
// Never retained or printed: the raw output, email, organization or directory paths.
const STATUS_METHODS = { 'claude.ai': 'subscription', console: 'api' };
function probeLogin(command, env, cwd, loginDir) {
  const result = spawnSync(command[0], command.slice(1), { cwd, env, encoding: 'utf8', timeout: 30000, maxBuffer: 256 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const instruction = `sign in with \`CLAUDE_CONFIG_DIR=${loginDir} claude auth login\` using the pinned CLI, then rerun`;
  if (result.error) fail('LOGIN_STATUS_INVALID', 'the login status command could not be executed');
  if (result.status === 1) fail('LOGIN_REQUIRED', `not signed in: ${instruction}`);
  if (result.status !== 0) fail('LOGIN_STATUS_INVALID', `login status exited ${result.status}; the reviewed claude-auth-status-json-v1 contract expects exit 0 or 1`);
  let parsed;
  try { parsed = JSON.parse(result.stdout); } catch { fail('LOGIN_STATUS_INVALID', 'login status output is not the reviewed JSON record; the output was not retained'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail('LOGIN_STATUS_INVALID', 'login status output is not the reviewed JSON record; the output was not retained');
  if (parsed.loggedIn !== true) fail('LOGIN_REQUIRED', `not signed in: ${instruction}`);
  const record = { checked: true, logged_in: true, auth_method: parsed.authMethod, api_provider: parsed.apiProvider, subscription_type: typeof parsed.subscriptionType === 'string' ? parsed.subscriptionType : null };
  if (!Object.hasOwn(STATUS_METHODS, record.auth_method) || record.api_provider !== 'firstParty') fail('PROFILE_INCOMPATIBLE', 'login status reports an authentication method or provider outside the reviewed Claude contract');
  return record;
}
function checkBillingMode(record, billingMode) {
  if (STATUS_METHODS[record.auth_method] !== billingMode) fail('BILLING_MODE_MISMATCH', `the declared billing mode is ${billingMode} but the login status reports ${record.auth_method} (${STATUS_METHODS[record.auth_method]})`);
}
const billingBlock = mode => ({ mode, attributable_charge_usd: null, charge_reason: mode === 'subscription' ? 'SUBSCRIPTION_NOT_ATTRIBUTABLE' : 'CHARGE_EVIDENCE_MISSING', charge_evidence: null });
function nativeStatusCommand(bundle) {
  const executable = bundle?.input?.tool?.executable;
  if (typeof executable !== 'string') fail('EFFECTIVE_INPUTS_INVALID', 'the effective inputs must name the tool executable');
  return [fs.realpathSync(executable), 'auth', 'status', '--json'];
}
const fixtureStatusCommand = mode => [process.execPath, __filename, '--fixture-auth-status', mode || 'subscription'];
// A throwaway HOME for the pre-workspace probe: the same construction as a session, minus
// the project directory that does not exist yet.
function probeEnvironment(probeRoot, loginDir) {
  const env = buildEnvironment(probeRoot, null, loginDir);
  delete env.CLAUDE_PROJECT_DIR;
  return env;
}
function probeUnderCustody(command, loginDir, billingMode) {
  const probeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pincer-login-probe-'));
  try {
    for (const name of ['home', 'tmp']) fs.mkdirSync(path.join(probeRoot, name), { mode: 0o700 });
    const record = probeLogin(command, probeEnvironment(probeRoot, loginDir), probeRoot, loginDir);
    checkBillingMode(record, billingMode);
    return record;
  } finally { fs.rmSync(probeRoot, { recursive: true, force: true }); }
}
// Custody first, then the directory inspection, then the status probe, all before any
// workspace exists (§2.4). A refusal after acquisition releases the lock; nothing was planted.
function establishLogin(options, { statusCommand, ids = {} }) {
  const inputRoot = options.inputRoot;
  const override = overridePresent(process.env);
  if (override) fail('BILLING_OVERRIDE_PRESENT', `the launching environment sets ${override}; unset it in the launching shell (its value was not read) so the session cannot be billed or routed elsewhere`);
  let handle = null, acquired = false;
  if (options.custody) {
    const held = custody.verifyHeld(inputRoot, options.custody, { ownerPid: options.custody.ownerPid || process.pid });
    handle = options.custody.journal ? options.custody : { ...options.custody, loginDir: held.loginDir, journal: held.journal };
  } else { handle = custody.acquire(inputRoot, ids); acquired = true; }
  try {
    // Under held custody the runner's own journaled canaries may already be present; every
    // other unexpected name is still dirt.
    custody.requireClean(handle.loginDir, handle.journal.canaries.filter(c => ['intended', 'created'].includes(c.state)).map(c => c.name));
    let authentication = null;
    if (acquired) authentication = probeUnderCustody(statusCommand, handle.loginDir, options.billingMode);
    return { custody: handle, acquired, authentication, loginDir: handle.loginDir };
  } catch (error) {
    if (acquired) { try { custody.release(handle, { recovery_required: error.code === 'LOGIN_DIR_RECOVERY_REQUIRED', detail: error.code }); } catch {} }
    throw error;
  }
}
function releaseCustody(handle, outcome = {}) {
  if (!handle || !handle.claim) return null;
  return custody.release(handle, outcome);
}
function checkExecutionReadiness(options, manifest) {
  let login = null;
  try {
    const { effective: bundle, arm, workspace, readiness } = options;
    const e = manifest.effective;
    // A protected observation path is refused before anything is read, locked or probed.
    if (options.observationFile !== undefined && options.observationFile !== null) rejectProtectedObservationPath(options.observationFile);
    if (e.tool.kind !== 'native') fail('FIXTURE_NOT_LIVE', 'a fixture tool cannot launch a native session');
    const profileName = e.configuration.isolation_profile;
    if (profileName === PROFILE.name) fail('PROFILE_HISTORICAL', `${PROFILE.name} is the historical API-key profile; it is not the execution path of any session. Plan a cohort under ${NATIVE_PROFILE.name}`);
    if (profileName !== NATIVE_PROFILE.name) fail('PROFILE_UNBOUND', 'the named isolation profile must be included in the effective manifest');
    if (!readiness || Object.keys(readiness).some(k => !['purpose', 'usageEnvelopeAgreed', 'projectAccessAuthorized', 'hostPolicyPreserved', 'decisionRef', 'observationReviewed', 'billingMode'].includes(k)) ||
      !['operational-smoke', 'measured'].includes(readiness.purpose) || readiness.usageEnvelopeAgreed !== true || readiness.projectAccessAuthorized !== true || readiness.hostPolicyPreserved !== true ||
      typeof readiness.decisionRef !== 'string' || !/^[A-Za-z0-9._:/-]+$/.test(readiness.decisionRef)) fail('READINESS_REQUIRED', 'explicit recorded usage-envelope, project-access and preserved host-policy decisions are required');
    if (!BILLING_MODES.includes(readiness.billingMode)) fail('AMBIGUOUS_BILLING', 'the study authorization must declare billing_mode subscription or api');
    if (typeof options.onGroup !== 'function') fail('CUSTODY_REQUIRED', 'durable process-group registration is required before launch');
    const inputRoot = bundle?.inputRoot || bundle?.root;
    validateExecutionParameters({ model: e.model, toolVersion: e.tool.version, permissionMode: e.configuration.permission_mode, caps: manifest.caps, billingMode: readiness.billingMode, inputRoot, ...(Object.hasOwn(options, 'apiKey') ? { apiKey: options.apiKey } : {}) });
    login = establishLogin({ inputRoot, billingMode: readiness.billingMode, custody: options.custody }, { statusCommand: nativeStatusCommand(bundle), ids: { purpose: readiness.purpose, decision: readiness.decisionRef, arm: arm || null, ...(options.ids || {}) } });
    return { ok: true, manifest, reportable: readiness.purpose === 'measured', profile: NATIVE_PROFILE.name, custody: login.custody, acquired: login.acquired, authentication: login.authentication, billing: billingBlock(readiness.billingMode), loginDir: login.loginDir };
  } catch (error) { return { ok: false, code: error.code || 'EFFECTIVE_INPUTS_INVALID', detail: error.message, profile: NATIVE_PROFILE.name }; }
}

function rejectProtectedObservationPath(relative) {
  if (typeof relative !== 'string' || /(?:^|[\\/])(?:\.env(?:\.[^/\\]*)?|credentials(?:\.[^/\\]*)?|auth(?:\.[^/\\]*)?|\.credentials(?:\.[^/\\]*)?|\.ssh|\.aws|\.netrc|\.npmrc)(?:[\\/]|$)/i.test(relative)) {
    fail('ISOLATION_PATH_PROTECTED', 'Protected configuration paths cannot be observation artifacts');
  }
}
function observationPath(root, relative) {
  rejectProtectedObservationPath(relative);
  try { return effective.contained(root, relative); }
  catch { fail('ISOLATION_OBSERVATION_INVALID', 'Observation artifact path is missing or unsafe'); }
}
function readObservation(file) {
  try { return fs.readFileSync(file, 'utf8'); }
  catch { fail('ISOLATION_OBSERVATION_INVALID', 'Observation artifact cannot be read'); }
}
// A gate that failed after acquiring custody releases it; nothing was planted yet.
function refusedAfter(gate, error, fallback) {
  if (gate.acquired) { try { releaseCustody(gate.custody, { detail: error.code || fallback }); } catch {} }
  return { ok: false, code: error.code || fallback, detail: error.code ? error.message : fallback === 'ISOLATION_OBSERVATION_INVALID' ? 'Native isolation observation is invalid' : error.message, profile: NATIVE_PROFILE.name };
}
function checkObservation(options, gate) {
  if (!gate.ok) return gate;
  try {
    const bundle = options.effective;
    const manifest = gate.manifest;
    const e = manifest.effective;
    if (options.readiness.purpose === 'measured') {
      if (options.readiness.observationReviewed !== true || !options.observationFile || !/^[a-f0-9]{64}$/.test(e.configuration.isolation_observation_digest || '')) fail('ISOLATION_OBSERVATION_REQUIRED', 'measured launch requires retained reviewed native isolation evidence');
      const file = observationPath(bundle.inputRoot || bundle.root, options.observationFile);
      const raw = readObservation(file);
      if (require('./freeze.cjs').secretIn(raw)) fail('ISOLATION_OBSERVATION_INVALID', 'observation must not contain credentials');
      let observation;
      try { observation = JSON.parse(raw); }
      catch { fail('ISOLATION_OBSERVATION_INVALID', 'native isolation observation is not valid JSON'); }
      if (!observation || typeof observation !== 'object' || Array.isArray(observation)) fail('ISOLATION_OBSERVATION_INVALID', 'native isolation observation must be an object');
      const checks = ['host_policy_observed', 'authentication_observed', 'personal_configuration_absent', 'login_preserved', 'override_refused'];
      if (Object.keys(observation).some(k => !['schema', 'kind', 'fixture', 'target', 'arms', ...checks, 'evidence'].includes(k)) ||
        observation.schema !== 1 || observation.kind !== 'native-isolation-observation' || observation.fixture !== false || observation.target !== observationTarget(manifest) ||
        effective.canonical(observation.arms) !== effective.canonical(ARMS) || checks.some(k => observation[k] !== true) ||
        !Array.isArray(observation.evidence) || !observation.evidence.length || observation.evidence.some(x => !x || typeof x !== 'object' || Object.keys(x).some(k => !['path', 'digest'].includes(k)) || typeof x.path !== 'string' || !/^[a-f0-9]{64}$/.test(x.digest || ''))) fail('ISOLATION_OBSERVATION_INVALID', 'native isolation observation is incomplete or does not match this execution');
      for (const entry of observation.evidence) {
        const evidenceFile = observationPath(bundle.inputRoot || bundle.root, entry.path);
        const bytes = readObservation(evidenceFile);
        if (require('./freeze.cjs').secretIn(bytes.toString())) fail('ISOLATION_EVIDENCE_SECRET', 'observation evidence contains credential-shaped text');
        if (require('./freeze.cjs').sha256(bytes) !== entry.digest) fail('ISOLATION_EVIDENCE_CHANGED', 'observation evidence is missing or changed');
      }
      if (require('./freeze.cjs').sha256(raw) !== e.configuration.isolation_observation_digest) fail('ISOLATION_OBSERVATION_CHANGED', 'native isolation observation does not match the frozen digest');
    }
    return gate;
  } catch (error) { return refusedAfter(gate, error, 'ISOLATION_OBSERVATION_INVALID'); }
}

function checkArmAssets(options, gate) {
  if (!gate.ok) return gate;
  try {
    rejectAncestorInstructions(options.workspace);
    const assets = assetsFor(options.arm, options.workspace);
    if (!options.expectedAssets || effective.canonical(options.expectedAssets) !== effective.canonical(assets.files)) fail('ARM_ASSETS_CHANGED', 'intended arm configuration differs from its retained post-install asset inventory');
    return { ...gate, assets };
  } catch (error) { return refusedAfter(gate, error, 'ARM_ASSETS_INVALID'); }
}
function checkAllocation(options, gate, requireReservation) {
  if (!gate.ok) return gate;
  try {
    if (!options.allocation) fail('ALLOCATION_REQUIRED', 'A checked study allocation is required for native execution');
    if (options.readiness.purpose === 'measured' && options.observationFile) rejectProtectedObservationPath(options.observationFile);
    const grant = require('./allocation.cjs').verifyLaunch(options.allocation, {
      effectiveDigest: gate.manifest.cohort, arm: options.arm, caps: gate.manifest.caps,
      ...(requireReservation ? { prompt: options.prompt } : {}), requireReservation,
    });
    if (grant.purpose !== options.readiness.purpose) fail('ALLOCATION_PURPOSE_CHANGED', 'Launch purpose differs from the approved study purpose');
    if (grant.billing && grant.billing.mode !== options.readiness.billingMode) fail('BILLING_MODE_MISMATCH', 'The declared billing mode differs from the approved study manifest');
    if (options.readiness.purpose === 'measured') {
      if (!options.observationFile || !grant.observationFile) fail('ISOLATION_OBSERVATION_REQUIRED', 'Measured launch requires the approved observation artifact');
      const root = options.effective.inputRoot || options.effective.root;
      if (fs.realpathSync(root) !== fs.realpathSync(grant.inputRoot)) fail('ISOLATION_OBSERVATION_UNBOUND', 'Observation artifact root differs from the approved study root');
      if (observationPath(root, options.observationFile) !== observationPath(grant.inputRoot, grant.observationFile)) fail('ISOLATION_OBSERVATION_UNBOUND', 'Observation artifact differs from the approved study artifact');
    }
    return gate;
  } catch (error) { return refusedAfter(gate, error, 'ALLOCATION_INVALID'); }
}
function checkNativeReadiness(options, manifest) {
  return checkArmAssets(options, checkObservation(options, checkAllocation(options, checkExecutionReadiness(options, manifest), true)));
}
// The pre-workspace gate. With `holdCustody` the caller keeps the login-directory lock (and
// must release it after the session); otherwise the lock is released here, nothing planted.
function preflightExecution(options) {
  let gate;
  try { gate = checkObservation(options, checkAllocation(options, checkExecutionReadiness(options, effective.assertCurrent(options.effective)), false)); }
  catch (error) { return { ok: false, code: error.code || 'EFFECTIVE_INPUTS_INVALID', detail: error.message, profile: NATIVE_PROFILE.name }; }
  if (gate.ok && gate.acquired && !options.holdCustody) {
    releaseCustody(gate.custody, { detail: 'preflight only' });
    return { ...gate, custody: null, acquired: false };
  }
  return gate;
}
function preflightNative(options) {
  try { return checkNativeReadiness(options, effective.assertCurrent(options.effective)); }
  catch (error) { return { ok: false, code: error.code || 'EFFECTIVE_INPUTS_INVALID', detail: error.message, profile: NATIVE_PROFILE.name }; }
}

function buildEnvironment(sessionRoot, workspace, loginDir) {
  // Deliberately never read/spread process.env. Shell, Node, provider, proxy, plugin,
  // parent-session and personal configuration variables cannot cross this boundary, and no
  // credential variable of any kind is constructed: the tool reads its own login from
  // CLAUDE_CONFIG_DIR, the study login directory the user signed into.
  return {
    PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`,
    HOME: path.join(sessionRoot, 'home'), CLAUDE_CONFIG_DIR: loginDir,
    TMPDIR: path.join(sessionRoot, 'tmp'), LANG: 'C', LC_ALL: 'C',
    ...(workspace ? { CLAUDE_PROJECT_DIR: fs.realpathSync(workspace) } : {}),
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
  };
}
// The CLI's hook debug log lives beside the permission override, inside the session root
// that is removed after the run; only a redacted copy is retained (`retainHookDebug`).
const debugFileFor = settingsPath => path.join(path.dirname(settingsPath), 'debug.log');
function argumentsFor(options, settingsPath) {
  const args = ['--print', '--model', options.model, '--permission-mode', 'manual', '--permission-prompts', 'none',
    '--setting-sources', 'project', '--settings', settingsPath,
    '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--no-chrome', '--no-session-persistence',
    '--max-turns', String(options.caps.turns_per_session), '--max-budget-usd', String(options.caps.spend_usd),
    // Kit-hook observation: the CLI logs hook matching and execution in its own debug
    // stream; the `hooks` filter keeps everything else out. The final result object on
    // stdout is unchanged, so accounting parses exactly what it parsed before.
    '--debug', 'hooks', '--debug-file', debugFileFor(settingsPath),
    // Task text is data on stdin, never an option-shaped positional argument.
    '--input-format', 'text', '--output-format', 'json'];
  if (args.some(arg => REFUSED_FLAGS.includes(arg))) fail('ARGUMENTS_REFUSED', 'the native profile refuses bare, restricted, safe-mode and permission-skipping flags');
  return args;
}
// Synthetic isolation canary. User-level settings with a SessionStart hook and a user
// CLAUDE.md are planted where a CLI that ignored `--setting-sources project` would read
// them: the per-session HOME, and (under custody) the shared study login directory. Nothing
// personal is involved: the phrase is random per session. The launcher writes only the
// verdict into the record; captures keep whatever the tool emitted, so a leak leaves the
// phrase in them.
function canaryFiles(phrase, marker) {
  return {
    'settings.json': JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: 'command', command: `touch ${JSON.stringify(marker)}` }] }] } }),
    'CLAUDE.md': `${phrase}\n`,
  };
}
function plantHomeCanary(sessionRoot) {
  const phrase = `PINCER-CANARY-${crypto.randomBytes(8).toString('hex')}`;
  const marker = path.join(sessionRoot, 'canary-user-hook-ran');
  const dir = path.join(sessionRoot, 'home', '.claude');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  for (const [name, content] of Object.entries(canaryFiles(phrase, marker))) fs.writeFileSync(path.join(dir, name), content, { mode: 0o600 });
  return { phrase, marker, loginMarker: path.join(sessionRoot, 'canary-login-hook-ran') };
}
// "Canary not triggered" is not "isolation demonstrated". A hook that ran or a phrase that
// was echoed is positive evidence the user-level file was loaded. The converse is not
// evidence: settings may load without their SessionStart hook running, and instructions
// may load without being echoed. Those questions stay `unknown` here; a reviewer answers
// them from the hook log and other retained evidence, or leaves them open.
function checkCanary(canary, texts) {
  const home_hook_ran = fs.existsSync(canary.marker);
  const login_dir_hook_ran = fs.existsSync(canary.loginMarker);
  const user_hook_ran = home_hook_ran || login_dir_hook_ran;
  const echoed = texts.some(text => typeof text === 'string' && text.includes(canary.phrase));
  return { leak_detected: user_hook_ran || echoed, user_hook_ran, login_dir_hook_ran,
    user_settings_loaded: user_hook_ran ? true : 'unknown', user_instructions_loaded: echoed ? true : 'unknown' };
}
// Retain the CLI's hook debug log as a redacted copy beside the captures. The raw file is
// removed with the session root. Absence is recorded, never assumed to mean "no hooks".
// If no redacted copy can be retained, keep the original protected session directory.
// Never move or delete the last copy: even an unreadable file may be recoverable later.
function retainHookDebug(debugFile, target, clean, recovery, io = fs) {
  if (!fs.existsSync(debugFile)) return { capture: { present: false }, text: '' };
  const original = error => ({ present: true, retained: false,
    recovered: path.relative(recovery.dir, debugFile), redacted: false,
    original_preserved: true, error });
  let raw;
  try { raw = io.readFileSync(debugFile, 'utf8'); }
  catch (error) { return { capture: { ...original(error.code || 'UNKNOWN'), readable: false }, text: '', preserveSession: true }; }
  const safe = clean(raw), bytes = Buffer.byteLength(safe);
  if (!target) return { capture: { present: true, retained: false, file: null, bytes }, text: safe };
  let error;
  try { io.writeFileSync(target, safe, { flag: 'wx', mode: 0o600 }); return { capture: { present: true, retained: true, file: path.basename(target), bytes }, text: safe }; }
  catch (e) { error = e.code || 'UNKNOWN'; }
  const recovered = path.join(recovery.dir, `${recovery.name}.debug.log`);
  try { io.writeFileSync(`${recovered}.redacted`, safe, { flag: 'wx', mode: 0o600 }); return { capture: { present: true, retained: false, recovered: `${recovery.name}.debug.log.redacted`, redacted: true, error }, text: safe }; } catch {}
  return { capture: original(error), text: safe, preserveSession: true };
}
// Required hook evidence per arm: the plain arm has no kit hooks, so a retained log is
// enough; kit arms require complete, recognized command-completion records. This narrow
// grammar is exercised by fixtures, not yet attested by the pinned native CLI. Unknown
// native formats remain insufficient until reviewed; registration text is never evidence.
const KIT_HOOK_SCRIPTS = ['.claude/hooks/block-dangerous.sh', '.claude/hooks/ticket-guard.sh'];
function hookEvidence(arm, capture, text) {
  const required = arm === 'plain' ? [] : KIT_HOOK_SCRIPTS;
  const completed = new Set();
  for (const line of text.split(/\r?\n/)) {
    const event = line.match(/^(?:\d{4}-\d{2}-\d{2}T[\d:.]+Z )?\[DEBUG\] Hook command completed with status (0|[1-9]\d{0,2}): bash "\$CLAUDE_PROJECT_DIR"\/(\.claude\/hooks\/(?:block-dangerous|ticket-guard)\.sh)$/);
    if (event && Number(event[1]) <= 255) completed.add(event[2]);
  }
  const missing = required.filter(script => !completed.has(script));
  let status;
  if (!capture.present) status = 'missing';
  else if (capture.readable === false) status = 'unreadable';
  else if (!capture.retained) status = 'unretained';
  else status = !text.trim() || missing.length ? 'insufficient' : 'sufficient';
  return { status, required, missing };
}
// Account limits (contracts §1.2): any session, weekly, model or spend limit named by the
// result or its stderr is a stop. The kind is classified for the record; no wait, rotation,
// top-up or key fallback follows.
function accountLimit(texts, result, at) {
  const text = texts.filter(t => typeof t === 'string').join('\n');
  const error = result && typeof result === 'object' ? `${result.error || ''} ${result.subtype || ''} ${result.result || ''}` : '';
  const haystack = `${text}\n${error}`;
  let kind = null;
  if (/weekly limit/i.test(haystack)) kind = 'weekly';
  else if (/session limit/i.test(haystack)) kind = 'session';
  else if (/limit for (?:this|the) model|model limit/i.test(haystack)) kind = 'model';
  else if (/spend(?:ing)? limit|billing_error|account_on_hold|usage credits/i.test(haystack)) kind = 'spend';
  else if (/usage limit|rate limit|rate_limit|quota/i.test(haystack)) kind = 'unknown';
  return kind ? { kind, at } : null;
}
// Every deficiency is a named reason; a measured session is reportable only with none.
function reportability({ nativePreflight, attestedModel, model, result, canary, hookEvidence: evidence, loginDirectory = null, authentication = null }) {
  const unreportable = [];
  if (attestedModel !== model) unreportable.push('model attestation missing or different from the requested model');
  if (result.cleanup_complete !== true) unreportable.push('process cleanup unresolved');
  if (result.capture_failure) unreportable.push('capture failure');
  if (canary.leak_detected) unreportable.push('isolation canary tripped');
  if (evidence.status !== 'sufficient') unreportable.push(`hook evidence ${evidence.status}${evidence.missing?.length ? ` (${evidence.missing.join(', ')})` : ''}`);
  if (loginDirectory && loginDirectory.recovery_required) unreportable.push('login directory custody requires recovery');
  if (authentication && authentication.logged_in !== true) unreportable.push('login status not confirmed');
  return { reportable: Boolean(nativePreflight?.reportable) && unreportable.length === 0, unreportable };
}
// No launcher-held secret exists to redact any more; credential-shaped text is still removed
// from every durable capture, including when it is split across stream chunks.
const SECRET_SHAPE = /\b(?:sk-ant-|sk-|ghp_|gho_|github_pat_)[A-Za-z0-9_-]{16,}/g;
const SECRET_TAIL = /(?:\b(?:sk-ant-|sk-|ghp_|gho_|github_pat_)[A-Za-z0-9_-]{0,15}|\bs(?:k(?:-(?:a(?:n(?:t)?)?)?)?)?|\bg(?:h(?:[po])?|i(?:t(?:h(?:u(?:b(?:_(?:p(?:a(?:t)?)?)?)?)?)?)?)?)?)$/;
function redactor() {
  return text => String(text || '').replace(SECRET_SHAPE, '[REDACTED]');
}
function groupSignal(pid, signal) { if (!Number.isSafeInteger(pid) || pid <= 0) return false; try { process.kill(-pid, signal); return true; } catch (e) { return e.code === 'ESRCH'; } }
async function groupGone(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return true;
  for (let i = 0; i < 100; i++) {
    try { process.kill(-pid, 0); } catch (error) { if (error.code === 'ESRCH') return true; else return false; }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  return false;
}
// A detached inert supervisor waits for a start message. Ownership is durably notified
// before that message, so a crash can never leave an unregistered session process group.
async function supervise({ cwd, env, payload, timeoutMs, onGroup = async () => {}, signal, logFiles, captureIO = fs }) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) fail('CAP_INVALID', 'fixture watchdog requires a positive finite deadline');
  if (overridePresent(env)) fail('BILLING_OVERRIDE_PRESENT', 'the constructed environment must not carry a credential variable');
  const fds = {};
  try {
    if (logFiles) for (const key of ['stdout', 'stderr']) fds[key] = fs.openSync(logFiles[key], 'wx', 0o600);
  } catch (error) { for (const fd of Object.values(fds)) fs.closeSync(fd); throw error; }
  const child = spawn(process.execPath, [__filename, '--session-supervisor'], { cwd, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '', status = null, timedOut = false, stopped = false, registrationError = null, captureFailure = null;
  const clean = redactor();
  const captureFailed = (operation, error) => {
    if (!captureFailure) captureFailure = { code: 'CAPTURE_IO_FAILED', operation,
      errno: ['EIO', 'ENOSPC', 'EACCES', 'EPERM', 'EBADF', 'EROFS', 'EDQUOT'].includes(error?.code) ? error.code : 'UNKNOWN' };
    stop();
  };
  // Credential-shaped text is removed before durable capture, including chunk boundaries.
  // Logs retain complete provider JSON for later accounting; no environment dump.
  const capture = (stream, fd, append) => {
    let pending = '', closed = false;
    const decoder = new StringDecoder('utf8');
    const emit = value => {
      if (!value || captureFailure) return;
      const safe = clean(value);
      if (fd !== null) {
        try { if (captureIO.writeSync(fd, safe) !== Buffer.byteLength(safe)) { const error = new Error('incomplete capture write'); error.code = 'EIO'; throw error; } } catch (error) { captureFailed('write', error); return; }
        try { captureIO.fsyncSync(fd); } catch (error) { captureFailed('flush', error); return; }
      }
      append(safe);
    };
    const close = () => {
      if (closed || fd === null) return;
      closed = true;
      try { fs.closeSync(fd); } catch (error) { captureFailed('close', error); }
    };
    stream.on('data', data => {
      if (captureFailure) return;
      pending += decoder.write(data);
      const tail = pending.match(SECRET_TAIL);
      const keep = tail ? tail[0].length : 0;
      emit(pending.slice(0, pending.length - keep)); pending = pending.slice(pending.length - keep);
    });
    stream.on('end', () => { pending += decoder.end(); emit(pending); close(); });
    stream.on('error', error => { captureFailed('read', error); close(); });
    stream.on('close', close);
  };
  capture(child.stdout, fds.stdout ?? null, value => { stdout += value; });
  capture(child.stderr, fds.stderr ?? null, value => { stderr += value; });
  child.stdin.on('error', () => {});
  let killTimer;
  const stop = () => {
    if (stopped) return; stopped = true;
    groupSignal(child.pid, 'SIGTERM');
    killTimer = setTimeout(() => groupSignal(child.pid, 'SIGKILL'), 150);
  };
  const completed = new Promise(resolve => {
    child.on('error', () => { status = 127; stop(); });
    child.on('exit', code => { status = code; stop(); });
    child.on('close', () => { clearTimeout(killTimer); groupSignal(child.pid, 'SIGKILL'); resolve(); });
  });
  const deadline = setTimeout(() => { timedOut = true; stop(); }, timeoutMs);
  const aborted = () => stop(); signal?.addEventListener('abort', aborted, { once: true });
  try {
    if (!child.pid) throw new Error('supervisor failed to start');
    await Promise.race([Promise.resolve().then(() => onGroup({ pid: child.pid, pgid: child.pid })), completed.then(() => { throw new Error('supervisor ended before registration'); })]);
    if (signal?.aborted) stop();
    if (!stopped) child.stdin.end(JSON.stringify(payload));
  } catch (error) { registrationError = error; stop(); }
  await completed; clearTimeout(deadline); signal?.removeEventListener('abort', aborted);
  const cleanupComplete = await groupGone(child.pid);
  if (registrationError) fail('CUSTODY_REGISTRATION_FAILED', 'session group could not be durably registered; no tool was started');
  if (timedOut) {
    const marker = '\nisolated-launch: session ended by the wall-clock cap\n';
    stderr += marker;
    if (logFiles?.stderr) try { fs.appendFileSync(logFiles.stderr, marker); } catch (error) { captureFailed('append-marker', error); }
  }
  return { status: captureFailure ? 74 : timedOut ? 124 : signal?.aborted ? 143 : status, child_status: status,
    stdout: clean(stdout), stderr: clean(stderr), timedOut, pgid: child.pid, cleanup_complete: cleanupComplete, capture_failure: captureFailure };
}
const FIXTURE_MODES = ['ok', 'exit7', 'echo-secret', 'hang', 'descendant', 'stream-descendant', 'leak-canary', 'partial-hook-log', 'replace-login-canary', 'account-limit', 'no-usage', 'auth-error'];
const refusal = (code, detail) => ({ refused: true, status: 3, stdout: '', stderr: `${code}: ${detail}`, code, reportable: false, unreportable: [detail], cleanup_complete: true, end: 'refused', limit: false, account_limit: null });
async function runSession(options, nativePreflight = null) {
  const native = Boolean(nativePreflight), assets = nativePreflight?.assets || validateParameters(options);
  if (!native && !FIXTURE_MODES.includes(options.mode || 'ok')) fail('FIXTURE_MODE_INVALID', 'unknown fixture behavior');
  const root = fs.realpathSync(options.stateRoot);
  const billingMode = native ? nativePreflight.billing.mode : options.billingMode;
  // Custody of the shared login directory precedes every inspection, probe and canary write.
  let handle = native ? nativePreflight.custody : null, acquiredHere = false;
  if (!handle) {
    const gate = establishLogin({ inputRoot: options.inputRoot, billingMode }, { statusCommand: fixtureStatusCommand(options.fixtureStatus), ids: { fixture: true, arm: options.arm, session: options.name || null } });
    handle = gate.custody; acquiredHere = true;
  }
  const sessionRoot = fs.mkdtempSync(path.join(root, 'isolated-session-'));
  for (const name of ['home', 'tmp']) fs.mkdirSync(path.join(sessionRoot, name), { mode: 0o700 });
  const settingsPath = path.join(sessionRoot, 'settings.json');
  // Project settings provide the hooks once. Repeating them in --settings risks
  // merging duplicate hook entries; the override only specifies the approval mode.
  fs.writeFileSync(settingsPath, JSON.stringify({ permissions: { defaultMode: 'manual' } }), { mode: 0o600 });
  const canary = plantHomeCanary(sessionRoot);
  const env = buildEnvironment(sessionRoot, options.workspace, handle.loginDir);
  const args = argumentsFor(options, settingsPath);
  const clean = redactor();
  const started = new Date().toISOString();
  const logFiles = options.logDir ? { stdout: path.join(options.logDir, `${options.name}.json`), stderr: path.join(options.logDir, `${options.name}.err`), debug: path.join(options.logDir, `${options.name}.debug.log`) } : null;
  const custodyIO = !native && options.fixtureCustodyIO ? options.fixtureCustodyIO : {};
  // On an unexpected exception, preserve rather than erase possible evidence.
  let preserveSession = true, loginDirectory = null, outcome = null;
  try {
    if (logFiles) {
      if (!/^[A-Za-z0-9_-]+$/.test(options.name || '')) fail('LOG_NAME_INVALID', 'a safe session identity is required');
      fs.mkdirSync(options.logDir, { recursive: true, mode: 0o700 });
      if (fs.existsSync(logFiles.stdout) || fs.existsSync(logFiles.stderr) || fs.existsSync(logFiles.debug)) fail('LOG_EXISTS', 'session captures are append-preserved; allocate a new session identity');
    }
    custody.annotate(handle, { session: options.name || null, arm: options.arm, started });
    // The login-directory canary is planted with exclusive creation under custody; every
    // write is journaled before and after. A replaced file is preserved, never deleted.
    custody.plant(handle, canaryFiles(canary.phrase, canary.loginMarker), custodyIO);
    // Status in the constructed environment, before the tool starts. A missing login is a
    // named refusal with the tool's own login instruction; there is no fallback.
    let authentication;
    try {
      authentication = probeLogin(native ? nativeStatusCommand(options.effective) : fixtureStatusCommand(options.fixtureStatus), env, sessionRoot, handle.loginDir);
      checkBillingMode(authentication, billingMode);
    } catch (error) {
      outcome = custody.remove(handle, custodyIO);
      preserveSession = false;
      return { ...refusal(error.code || 'LOGIN_STATUS_INVALID', error.message), started, ended: new Date().toISOString(), login_directory: describeLogin(handle, outcome), environment: { fixture: !native, isolation_profile: NATIVE_PROFILE.name, authentication: { checked: true, logged_in: false, auth_method: null, api_provider: null, subscription_type: null } } };
    }
    const payload = native ? { kind: 'native', args, prompt: options.prompt, bundle: options.effective, arm: options.arm, readiness: options.readiness,
      expectedAssets: options.expectedAssets, observationFile: options.observationFile || null, allocation: options.allocation, custody: { key: handle.key, token: handle.token } } :
      { kind: 'fixture', args, prompt: options.prompt, mode: options.mode || 'ok', model: options.model, heartbeat: options.heartbeat || null };
    const result = await supervise({ cwd: fs.realpathSync(options.workspace), env, payload,
      timeoutMs: native ? options.caps.wall_clock_minutes * 60000 : options.timeoutMs || options.caps.wall_clock_minutes * 60000,
      onGroup: async group => { custody.registerGroup(handle, group); if (options.onGroup) await options.onGroup(group); }, signal: options.signal, logFiles, captureIO: native ? fs : options.fixtureCaptureIO || fs });
    const retainIO = !native && options.fixtureRetainIO ? { ...fs, ...options.fixtureRetainIO } : fs;
    const hookDebug = retainHookDebug(debugFileFor(settingsPath), logFiles?.debug || null, clean, { dir: root, name: options.name || 'session' }, retainIO);
    const isolationCanary = checkCanary(canary, [result.stdout, result.stderr, hookDebug.text]);
    const evidence = hookEvidence(options.arm, hookDebug.capture, hookDebug.text);
    // Owned canaries leave the login directory only when identity and digest still match.
    outcome = custody.remove(handle, custodyIO);
    loginDirectory = describeLogin(handle, outcome);
    // A log that existed but could not be retained where the record expects it is a
    // retention failure: the allocator stops on it, and review precedes any further launch.
    const evidenceRetentionFailed = Boolean(logFiles) && hookDebug.capture.present === true && hookDebug.capture.retained !== true;
    let attestedModel = null, parsed = null;
    try { parsed = JSON.parse(result.stdout); } catch {}
    if (native && parsed && typeof parsed === 'object') {
      if (typeof parsed.model === 'string') attestedModel = parsed.model; else if (parsed.modelUsage && Object.keys(parsed.modelUsage).length === 1) attestedModel = Object.keys(parsed.modelUsage)[0];
    }
    const ended = new Date().toISOString();
    const limit = accountLimit([result.stdout, result.stderr], parsed, ended);
    const environment = {
      fixture: !native, tool: native ? TOOL_SURFACE : 'synthetic-session', tool_surface: TOOL_SURFACE, tool_version: NATIVE_PROFILE.tool_version,
      model: native ? attestedModel : options.model, requested_model: options.model,
      node: process.version, os: os.platform(), platform_release: os.release(), arch: os.arch(),
      permission_mode: 'manual', permission_prompts: 'none', isolation_profile: NATIVE_PROFILE.name, measurement_profile: MEASUREMENT_PROFILE,
      host_policy_observed: nativePreflight?.reportable || false, authentication, billing: billingBlock(billingMode), account_limit: limit, caps: options.caps,
      // Retained in the record: whether the supervisor observed the session's process group
      // gone before returning. The allocation ledger stops on the same fact; the record
      // carries it so report regeneration from retained files can see it too.
      cleanup_complete: result.cleanup_complete,
      // Observed, not configured: whether the planted user-level configuration was read,
      // whether the CLI's hook debug log was written and retained, and what it showed.
      isolation_canary: isolationCanary, hook_capture: hookDebug.capture, hook_evidence: evidence, login_directory: loginDirectory,
      configuration: NATIVE_PROFILE, env_names: Object.keys(env).sort(),
    };
    const { reportable, unreportable } = reportability({ nativePreflight, attestedModel: native ? attestedModel : options.model, model: options.model, result, canary: isolationCanary, hookEvidence: evidence, loginDirectory, authentication });
    preserveSession = hookDebug.preserveSession === true;
    return { ...result, started, ended, environment, assets: assets.files, logFiles,
      reportable, unreportable, evidence_retention_failed: evidenceRetentionFailed, review_required: evidenceRetentionFailed || outcome.recovery_required,
      login_directory: loginDirectory, login_dir_recovery_required: outcome.recovery_required, account_limit: limit,
      observation: !native ? 'controlled fixture plumbing; not native CLI isolation evidence' : !attestedModel ? 'provider model attestation missing; operational only' : options.readiness.purpose,
      end: result.timedOut ? 'capped' : result.status === 124 ? 'ambiguous' : 'completed',
      limit: limit !== null, refused: false };
  } finally {
    if (!outcome) { try { outcome = custody.remove(handle, custodyIO); } catch {} }
    if (acquiredHere) { try { custody.release(handle, { recovery_required: !outcome || Boolean(outcome.recovery_required), detail: outcome?.recovery_required ? 'canary cleanup incomplete' : null }); } catch {} }
    // Refusals before the tool starts have no hook evidence to preserve.
    if (!preserveSession || !fs.existsSync(debugFileFor(settingsPath))) fs.rmSync(sessionRoot, { recursive: true, force: true });
  }
}
function describeLogin(handle, outcome) {
  return { custody: 'exclusive-lock', control: custody.CONTROL_DIR, journal: handle.token, login_dir: handle.loginDir,
    canary: { planted: handle.journal.canaries.filter(c => c.state !== 'intended').length, removed: outcome?.removed?.length || 0, preserved: (outcome?.preserved || []).map(p => p.name) },
    recovery_required: Boolean(outcome?.recovery_required) };
}
async function observeFixture(options) { return runSession(options); }
async function launchNative(options) {
  const preflight = preflightNative(options);
  if (!preflight.ok) return { refused: true, status: 3, stdout: '', stderr: preflight.detail, code: preflight.code, reportable: false };
  const releaseHere = preflight.acquired;
  try {
    if (!options.logDir || !options.name) return { refused: true, status: 3, stdout: '', stderr: 'durable session captures are required', reportable: false };
    if (typeof options.prompt !== 'string' || !options.prompt.length) return { refused: true, status: 3, stdout: '', stderr: 'a nonempty frozen task prompt is required', reportable: false };
    const e = preflight.manifest.effective;
    const result = await runSession({ ...options, model: e.model, toolVersion: e.tool.version, permissionMode: e.configuration.permission_mode, caps: preflight.manifest.caps, inputRoot: options.effective.inputRoot || options.effective.root }, preflight);
    if (releaseHere) { releaseCustody(preflight.custody, { recovery_required: Boolean(result.login_dir_recovery_required), detail: result.code || null }); preflight.acquired = false; }
    return result;
  } finally {
    if (releaseHere && preflight.acquired) { try { releaseCustody(preflight.custody, { recovery_required: true, detail: 'launch did not complete' }); } catch {} }
  }
}
// The inert supervisor cannot launch a native tool until it independently verifies
// the effective identity, the explicit readiness decision and its parent's login-directory
// custody supplied by the owned caller. It never acquires custody or probes the login.
if (require.main === module && process.argv[2] === '--session-supervisor') {
  let input = '';
  process.stdin.on('data', data => { input += data; });
  process.stdin.on('end', () => {
    try {
      const payload = JSON.parse(input);
      if (typeof payload.prompt !== 'string' || !payload.prompt.length) fail('PROMPT_INVALID', 'a nonempty task prompt is required on stdin');
      let executable, args;
      if (payload.kind === 'native') {
        const override = overridePresent(process.env);
        if (override) fail('BILLING_OVERRIDE_PRESENT', `the session environment carries ${override}`);
        const gate = preflightNative({ effective: payload.bundle, arm: payload.arm, workspace: process.cwd(),
          readiness: payload.readiness, expectedAssets: payload.expectedAssets, observationFile: payload.observationFile, onGroup: () => {}, allocation: payload.allocation, prompt: payload.prompt,
          custody: { ...payload.custody, ownerPid: process.ppid } });
        if (!gate.ok) fail(gate.code, gate.detail);
        const sessionRoot = path.dirname(process.env.HOME);
        const expectedEnv = buildEnvironment(sessionRoot, process.cwd(), gate.loginDir);
        if (effective.canonical(process.env) !== effective.canonical(expectedEnv)) fail('ENVIRONMENT_CHANGED', 'supervisor environment differs from the isolated profile');
        const settingsPath = path.join(sessionRoot, 'settings.json');
        if (effective.canonical(JSON.parse(fs.readFileSync(settingsPath, 'utf8'))) !== effective.canonical({ permissions: { defaultMode: 'manual' } })) fail('SETTINGS_CHANGED', 'isolated permission override changed');
        const expectedArgs = argumentsFor({ model: gate.manifest.effective.model, caps: gate.manifest.caps }, settingsPath);
        if (effective.canonical(payload.args) !== effective.canonical(expectedArgs)) fail('ARGUMENTS_CHANGED', 'native arguments differ from the frozen profile');
        executable = fs.realpathSync(payload.bundle.input.tool.executable); args = expectedArgs;
        require('./allocation.cjs').consume(payload.allocation);
      } else if (payload.kind === 'fixture') {
        const { prompt, ...metadata } = payload;
        executable = process.execPath; args = [__filename, '--fixture-tool', JSON.stringify(metadata)];
      }
      else fail('LAUNCH_INVALID', 'unknown launch mode');
      const child = spawn(executable, args, { cwd: process.cwd(), env: process.env, stdio: ['pipe', 'inherit', 'inherit'] });
      let inputFailed = false;
      child.stdin.on('error', () => {
        inputFailed = true;
        process.stderr.write('PROMPT_DELIVERY_FAILED: task input could not be delivered\n');
        child.kill('SIGTERM');
      });
      child.stdin.end(payload.prompt, 'utf8');
      child.on('error', () => { process.exitCode = 127; });
      child.on('exit', (code, signal) => { process.exitCode = inputFailed ? 74 : code ?? (signal === 'SIGTERM' ? 143 : signal === 'SIGINT' ? 130 : 1); });
    } catch (error) { process.stderr.write(`${error.code || 'LAUNCH_REFUSED'}: ${error.message}\n`); process.exitCode = 3; }
  });
} else if (require.main === module && process.argv[2] === '--fixture-auth-status') {
  // A synthetic `claude auth status --json`. Modes cover the reviewed contract and its
  // violations; `unsanitized` carries the fields the runner must never retain.
  const mode = process.argv[3] || 'subscription';
  const account = { email: 'fixture-person@example.invalid', orgId: 'org_fixture_0000', orgName: 'Fixture Org', configDirectory: process.env.CLAUDE_CONFIG_DIR, projectsDirectory: `${process.env.CLAUDE_CONFIG_DIR}/projects`, analyticsDisabled: false };
  if (mode === 'logged-out') { process.stdout.write(JSON.stringify({ loggedIn: false, authMethod: 'none', apiProvider: 'firstParty' })); process.exitCode = 1; }
  else if (mode === 'malformed') process.stdout.write('Logged in as fixture-person@example.invalid\n');
  else if (mode === 'exit-2') { process.stderr.write('fixture: unexpected failure\n'); process.exitCode = 2; }
  else if (mode === 'unknown-method') process.stdout.write(JSON.stringify({ loggedIn: true, authMethod: 'invented', apiProvider: 'firstParty', subscriptionType: null, ...account }));
  else if (mode === 'console') process.stdout.write(JSON.stringify({ loggedIn: true, authMethod: 'console', apiProvider: 'firstParty', subscriptionType: null, ...account }));
  // Signed in at the pre-workspace probe, signed out by the time the session environment is
  // constructed: the in-session check must refuse without launching a task.
  else if (mode === 'session-logged-out' && !String(process.env.TMPDIR || '').includes('pincer-login-probe-')) { process.stdout.write(JSON.stringify({ loggedIn: false })); process.exitCode = 1; }
  else process.stdout.write(JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty', subscriptionType: 'max', ...(mode === 'unsanitized' || mode === 'subscription' ? account : {}) }));
} else if (require.main === module && process.argv[2] === '--fixture-tool') {
  const input = JSON.parse(process.argv[3]);
  const prompt = fs.readFileSync(0, 'utf8');
  const SYNTHETIC_TOKEN = 'sk-ant-fixture-synthetic-not-a-key-0123456789abcdef';
  if (input.mode === 'echo-secret') process.stdout.write(SYNTHETIC_TOKEN);
  else if (input.mode === 'exit7') process.exitCode = 7;
  else if (input.mode === 'auth-error') { process.stdout.write(JSON.stringify({ type: 'result', subtype: 'error_during_execution', is_error: true, error: 'authentication_failed', total_cost_usd: 0, duration_api_ms: 0, modelUsage: {} })); process.exitCode = 1; }
  else if (input.mode === 'leak-canary') {
    // A tool that ignores the profile: it reads user-level settings from the login dir,
    // runs their SessionStart hook and echoes the user CLAUDE.md. The canary must catch it.
    const userSettings = JSON.parse(fs.readFileSync(path.join(process.env.CLAUDE_CONFIG_DIR, 'settings.json'), 'utf8'));
    for (const group of userSettings.hooks.SessionStart) for (const hook of group.hooks) spawnSync('/bin/bash', ['--noprofile', '--norc', '-c', hook.command], { env: process.env, timeout: 5000 });
    process.stdout.write(fs.readFileSync(path.join(process.env.CLAUDE_CONFIG_DIR, 'CLAUDE.md'), 'utf8'));
  }
  else if (['hang', 'descendant', 'stream-descendant'].includes(input.mode)) {
    if (input.mode !== 'hang') spawn(process.execPath, ['-e', `const fs=require('node:fs');setInterval(()=>fs.appendFileSync(process.argv[1],'.'),25)`, input.heartbeat], { stdio: 'ignore' });
    if (input.mode === 'stream-descendant') setInterval(() => process.stdout.write('fixture-stream-chunk\n'), 75);
    setInterval(() => {}, 1000);
  } else {
    const flag = name => input.args[input.args.indexOf(name) + 1];
    // The synthetic tool writes the hook debug log the way the CLI would: one line per
    // executed hook command with its status, plus a credential-shaped string so the retained
    // copy proves redaction. `partial-hook-log` runs and logs only the first hook.
    const debugLines = [`[DEBUG] fixture hook debug: executing hook commands; token ${SYNTHETIC_TOKEN}`];
    const override = JSON.parse(fs.readFileSync(flag('--settings'), 'utf8'));
    const projectFile = path.join(process.cwd(), '.claude/settings.json');
    const project = fs.existsSync(projectFile) ? JSON.parse(fs.readFileSync(projectFile, 'utf8')) : {};
    const settings = { ...project, permissions: { ...project.permissions, ...override.permissions } };
    const has = rel => fs.existsSync(path.join(process.cwd(), rel));
    const groups = (settings.hooks?.PreToolUse || []).slice(0, input.mode === 'partial-hook-log' ? 1 : undefined);
    const hookExits = groups.flatMap(group => group.hooks.map(hook => {
      const status = spawnSync('/bin/bash', ['--noprofile', '--norc', '-c', hook.command], {
        cwd: process.cwd(), env: process.env, encoding: 'utf8', input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'rm -rf /' } }), timeout: 5000,
      }).status;
      debugLines.push(`[DEBUG] Hook command completed with status ${status}: ${hook.command}`);
      return status;
    }));
    fs.writeFileSync(flag('--debug-file'), `${debugLines.join('\n')}\n`);
    // A tool that overwrites the shared login directory's file: cleanup must preserve it.
    if (input.mode === 'replace-login-canary') fs.writeFileSync(path.join(process.env.CLAUDE_CONFIG_DIR, 'CLAUDE.md'), 'replaced by the fixture tool\n');
    const observed = { model: input.model, cwd: process.cwd(), credential_names: Object.keys(process.env).filter(name => CREDENTIAL_ENV.includes(name)),
      env_names: Object.keys(process.env).sort(), settings, config_dir: process.env.CLAUDE_CONFIG_DIR, home: process.env.HOME,
      project_instructions: has('CLAUDE.md') && has('AGENTS.md'),
      commands: has('.claude/commands'), agents: has('.claude/agents'), skills: has('.claude/skills'), hook_exits: hookExits,
      plugins_in_home: fs.existsSync(path.join(process.env.HOME, '.claude/plugins')),
      canary_planted: fs.existsSync(path.join(process.env.HOME, '.claude/settings.json')) && fs.existsSync(path.join(process.env.CLAUDE_CONFIG_DIR, 'CLAUDE.md')),
      login_dir_entries: fs.readdirSync(process.env.CLAUDE_CONFIG_DIR).sort(),
      session_root: path.dirname(flag('--settings')), args: input.args, prompt };
    if (input.mode === 'account-limit') { process.stdout.write(JSON.stringify({ type: 'result', subtype: 'error_during_execution', is_error: true, error: "You've hit your weekly limit", total_cost_usd: 0, duration_api_ms: 0, modelUsage: {}, fixture: observed })); process.exitCode = 1; }
    else if (input.mode === 'no-usage') process.stdout.write(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, total_cost_usd: 0.42, duration_api_ms: 1200, fixture: observed }));
    else process.stdout.write(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, total_cost_usd: 0.42, duration_api_ms: 1200,
      modelUsage: { [input.model]: { inputTokens: 100, outputTokens: 20, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, costUSD: 0.42 } }, fixture: observed, ...observed }));
  }
} else if (require.main === module) { process.stderr.write('isolated-launch: direct native launch is unavailable until the T-109 isolation observation gate\n'); process.exitCode = 3; }
module.exports = { PROFILE, NATIVE_PROFILE, PROFILES, MEASUREMENT_PROFILE, TOOL_SURFACE, BILLING_MODES, CREDENTIAL_ENV, KIT_HOOK_SCRIPTS, profileFor, overridePresent, assetsFor, settingsFor, observationTarget, probeLogin, checkNativeReadiness, preflightExecution, preflightNative, releaseCustody, buildEnvironment, argumentsFor, hookEvidence, accountLimit, reportability, observeFixture, launchNative };
