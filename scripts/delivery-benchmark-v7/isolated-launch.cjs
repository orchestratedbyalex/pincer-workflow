'use strict';
// T-102: a named, explicitly configured baseline. Actual Claude Code isolation and
// managed-policy observations remain a T-109 prerequisite; fixtures prove plumbing.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { StringDecoder } = require('node:string_decoder');
const effective = require('./effective.cjs');
const PROFILE = Object.freeze({
  name: 'claude-project-isolated-v1', tool_version: '2.1.273',
  authentication: 'anthropic-api-key', setting_sources: 'project',
  permission_mode: 'manual', permission_prompts: 'none',
  mcp: 'explicit-empty', home: 'per-session-empty',
  host_policy: 'managed-policy-preserved-observation-required',
});
const ARMS = ['plain', 'pincer', 'strict'];
const REQUIRED_KIT = ['AGENTS.md', 'CLAUDE.md', '.claude/settings.json', '.claude/hooks', '.claude/commands', '.claude/agents'];
function fail(code, detail) { const e = new Error(detail); e.code = code; throw e; }
function regular(root, rel) {
  const full = effective.contained(root, rel);
  if (!fs.statSync(full).isFile()) fail('ASSET_INVALID', 'an intended arm asset is not a regular file');
  return full;
}
function settingsFor(arm, workspace) {
  if (arm === 'plain') return { permissions: { defaultMode: 'manual' } };
  const settings = JSON.parse(fs.readFileSync(regular(workspace, '.claude/settings.json'), 'utf8'));
  if (!settings || typeof settings !== 'object' || Array.isArray(settings) || Object.keys(settings).some(k => !['permissions', 'hooks'].includes(k))) fail('SETTINGS_UNBOUND', 'kit settings contain unsupported configuration');
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
  if (options.toolVersion !== PROFILE.tool_version) fail('TOOL_UNSUPPORTED', 'installed CLI version has no reviewed isolation contract');
  if (options.permissionMode !== 'manual') fail('PERMISSION_UNSUPPORTED', 'the study profile preserves manual approval and never bypasses it');
  if (!/^claude-[a-z0-9-]*\d[a-z0-9.-]*$/.test(options.model || '')) fail('MODEL_MISSING', 'resolved model identity is required');
  for (const [key, value] of Object.entries(options.caps || {})) {
    if (!['turns_per_session', 'wall_clock_minutes', 'spend_usd'].includes(key) || !Number.isFinite(value) || value <= 0) fail('CAP_INVALID', 'caps must contain only finite positive measured limits');
  }
  if (!Number.isSafeInteger(options.caps?.turns_per_session) || !Number.isSafeInteger(options.caps?.wall_clock_minutes) || !Number.isFinite(options.caps?.spend_usd)) fail('CAP_INVALID', 'turn, wall-clock and spending caps are all required');
  if (options.caps.wall_clock_minutes > Math.floor(2147483647 / 60000)) fail('CAP_INVALID', 'wall-clock cap exceeds the supported watchdog range');
  if (typeof options.apiKey !== 'string' || options.apiKey.length === 0 || /[\r\n\0]/.test(options.apiKey)) fail('AUTHENTICATION_REQUIRED', 'supply an authorized API key through the protected runtime channel; subscription/keychain credentials are not copied');
}
function validateParameters(options) {
  validateExecutionParameters(options);
  rejectAncestorInstructions(options.workspace);
  return assetsFor(options.arm, options.workspace);
}
function observationTarget(manifest) {
  const e = manifest.effective;
  return require('./freeze.cjs').sha256(effective.canonical({ profile: PROFILE, tool: e.tool, model: e.model, kit: e.kit, platform: e.platform }));
}
function checkExecutionReadiness(options, manifest) {
  try {
    const { effective: bundle, apiKey, arm, workspace, readiness, expectedAssets } = options;
    const e = manifest.effective;
    if (e.tool.kind !== 'native') fail('FIXTURE_NOT_LIVE', 'a fixture tool cannot launch a native session');
    if (e.configuration.isolation_profile !== PROFILE.name) fail('PROFILE_UNBOUND', 'the named isolation profile must be included in the effective manifest');
    if (!readiness || Object.keys(readiness).some(k => !['purpose', 'spendingAuthorized', 'projectAccessAuthorized', 'hostPolicyPreserved', 'decisionRef', 'observationReviewed'].includes(k)) ||
      !['operational-smoke', 'measured'].includes(readiness.purpose) || readiness.spendingAuthorized !== true || readiness.projectAccessAuthorized !== true || readiness.hostPolicyPreserved !== true ||
      typeof readiness.decisionRef !== 'string' || !/^[A-Za-z0-9._:/-]+$/.test(readiness.decisionRef)) fail('READINESS_REQUIRED', 'explicit recorded spending, project-access and preserved host-policy decisions are required');
    if (typeof options.onGroup !== 'function') fail('CUSTODY_REQUIRED', 'durable process-group registration is required before launch');
    validateExecutionParameters({ model: e.model, toolVersion: e.tool.version, permissionMode: e.configuration.permission_mode, caps: manifest.caps, apiKey });
    if (readiness.purpose === 'measured') {
      if (readiness.observationReviewed !== true || !options.observationFile || !/^[a-f0-9]{64}$/.test(e.configuration.isolation_observation_digest || '')) fail('ISOLATION_OBSERVATION_REQUIRED', 'measured launch requires retained reviewed native isolation evidence');
      const file = effective.contained(bundle.inputRoot || bundle.root, options.observationFile);
      const raw = fs.readFileSync(file, 'utf8'), observation = JSON.parse(raw);
      if (Object.keys(observation).some(k => !['schema', 'kind', 'fixture', 'target', 'arms', 'host_policy_observed', 'authentication_observed', 'personal_configuration_absent', 'evidence'].includes(k)) ||
        observation.schema !== 1 || observation.kind !== 'native-isolation-observation' || observation.fixture !== false || observation.target !== observationTarget(manifest) ||
        effective.canonical(observation.arms) !== effective.canonical(ARMS) || observation.host_policy_observed !== true || observation.authentication_observed !== true || observation.personal_configuration_absent !== true ||
        !Array.isArray(observation.evidence) || !observation.evidence.length || observation.evidence.some(x => !x || typeof x !== 'object' || Object.keys(x).some(k => !['path', 'digest'].includes(k)) || typeof x.path !== 'string' || !/^[a-f0-9]{64}$/.test(x.digest || ''))) fail('ISOLATION_OBSERVATION_INVALID', 'native isolation observation is incomplete or does not match this execution');
      for (const entry of observation.evidence) {
        const evidenceFile = effective.contained(bundle.inputRoot || bundle.root, entry.path);
        const bytes = fs.readFileSync(evidenceFile);
        if (require('./freeze.cjs').secretIn(bytes.toString())) fail('ISOLATION_EVIDENCE_SECRET', 'observation evidence contains credential-shaped text');
        if (require('./freeze.cjs').sha256(bytes) !== entry.digest) fail('ISOLATION_EVIDENCE_CHANGED', 'observation evidence is missing or changed');
      }
      if (require('./freeze.cjs').secretIn(raw)) fail('ISOLATION_OBSERVATION_INVALID', 'observation must not contain credentials');
      if (require('./freeze.cjs').sha256(raw) !== e.configuration.isolation_observation_digest) fail('ISOLATION_OBSERVATION_CHANGED', 'native isolation observation does not match the frozen digest');
    }
    return { ok: true, manifest, reportable: readiness.purpose === 'measured', profile: PROFILE.name };
  } catch (error) { return { ok: false, code: error.code || 'EFFECTIVE_INPUTS_INVALID', detail: error.message, profile: PROFILE.name }; }
}

function checkArmAssets(options, gate) {
  if (!gate.ok) return gate;
  try {
    rejectAncestorInstructions(options.workspace);
    const assets = assetsFor(options.arm, options.workspace);
    if (!options.expectedAssets || effective.canonical(options.expectedAssets) !== effective.canonical(assets.files)) fail('ARM_ASSETS_CHANGED', 'intended arm configuration differs from its retained post-install asset inventory');
    return { ...gate, assets };
  } catch (error) { return { ok: false, code: error.code || 'ARM_ASSETS_INVALID', detail: error.message, profile: PROFILE.name }; }
}
function checkNativeReadiness(options, manifest) { return checkArmAssets(options, checkExecutionReadiness(options, manifest)); }
function preflightExecution(options) {
  try { return checkExecutionReadiness(options, effective.assertCurrent(options.effective)); }
  catch (error) { return { ok: false, code: error.code || 'EFFECTIVE_INPUTS_INVALID', detail: error.message, profile: PROFILE.name }; }
}
function preflightNative(options) { return checkArmAssets(options, preflightExecution(options)); }

function buildEnvironment(sessionRoot, workspace, apiKey) {
  // Deliberately never read/spread process.env. Shell, Node, provider, proxy, plugin,
  // parent-session and personal configuration variables cannot cross this boundary.
  return {
    PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`,
    HOME: path.join(sessionRoot, 'home'), CLAUDE_CONFIG_DIR: path.join(sessionRoot, 'config'),
    TMPDIR: path.join(sessionRoot, 'tmp'), LANG: 'C', LC_ALL: 'C',
    CLAUDE_PROJECT_DIR: fs.realpathSync(workspace), ANTHROPIC_API_KEY: apiKey,
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
  };
}
function argumentsFor(options, settingsPath) {
  return ['--print', '--model', options.model, '--permission-mode', 'manual', '--permission-prompts', 'none',
    '--setting-sources', 'project', '--settings', settingsPath,
    '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--no-chrome', '--no-session-persistence',
    '--max-turns', String(options.caps.turns_per_session), '--max-budget-usd', String(options.caps.spend_usd),
    // Task text is data on stdin, never an option-shaped positional argument.
    '--input-format', 'text', '--output-format', 'json'];
}
function redactor(secret) {
  return text => String(text || '').split(secret).join('[REDACTED]').replace(/\b(?:sk-ant-|sk-|ghp_)[A-Za-z0-9_-]{16,}/g, '[REDACTED]');
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
  const fds = {};
  try {
    if (logFiles) for (const key of ['stdout', 'stderr']) fds[key] = fs.openSync(logFiles[key], 'wx', 0o600);
  } catch (error) { for (const fd of Object.values(fds)) fs.closeSync(fd); throw error; }
  const child = spawn(process.execPath, [__filename, '--session-supervisor'], { cwd, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '', status = null, timedOut = false, stopped = false, registrationError = null, captureFailure = null;
  const clean = redactor(env.ANTHROPIC_API_KEY);
  const captureFailed = (operation, error) => {
    if (!captureFailure) captureFailure = { code: 'CAPTURE_IO_FAILED', operation,
      errno: ['EIO', 'ENOSPC', 'EACCES', 'EPERM', 'EBADF', 'EROFS', 'EDQUOT'].includes(error?.code) ? error.code : 'UNKNOWN' };
    stop();
  };
  // Authentication is removed before durable capture, including chunk boundaries.
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
      pending = pending.split(env.ANTHROPIC_API_KEY).join('[REDACTED]');
      let keep = 0;
      for (let i = 1; i < env.ANTHROPIC_API_KEY.length && i <= pending.length; i++) if (pending.endsWith(env.ANTHROPIC_API_KEY.slice(0, i))) keep = i;
      emit(pending.slice(0, pending.length - keep)); pending = pending.slice(pending.length - keep);
    });
    stream.on('end', () => { pending += decoder.end(); emit(pending && env.ANTHROPIC_API_KEY.startsWith(pending) ? '[REDACTED]' : pending); close(); });
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
async function runSession(options, nativePreflight = null) {
  const native = Boolean(nativePreflight), assets = nativePreflight?.assets || validateParameters(options);
  if (!native && !['ok', 'exit7', 'echo-secret', 'hang', 'descendant', 'stream-descendant'].includes(options.mode || 'ok')) fail('FIXTURE_MODE_INVALID', 'unknown fixture behavior');
  const root = fs.realpathSync(options.stateRoot);
  const sessionRoot = fs.mkdtempSync(path.join(root, 'isolated-session-'));
  for (const name of ['home', 'config', 'tmp']) fs.mkdirSync(path.join(sessionRoot, name), { mode: 0o700 });
  const settingsPath = path.join(sessionRoot, 'settings.json');
  // Project settings provide the hooks once. Repeating them in --settings risks
  // merging duplicate hook entries; the override only specifies the approval mode.
  fs.writeFileSync(settingsPath, JSON.stringify({ permissions: { defaultMode: 'manual' } }), { mode: 0o600 });
  const env = buildEnvironment(sessionRoot, options.workspace, options.apiKey);
  const args = argumentsFor(options, settingsPath);
  const started = new Date().toISOString();
  const logFiles = options.logDir ? { stdout: path.join(options.logDir, `${options.name}.json`), stderr: path.join(options.logDir, `${options.name}.err`) } : null;
  try {
    if (logFiles) {
      if (!/^[A-Za-z0-9_-]+$/.test(options.name || '')) fail('LOG_NAME_INVALID', 'a safe session identity is required');
      fs.mkdirSync(options.logDir, { recursive: true, mode: 0o700 });
      if (fs.existsSync(logFiles.stdout) || fs.existsSync(logFiles.stderr)) fail('LOG_EXISTS', 'session captures are append-preserved; allocate a new session identity');
    }
    const payload = native ? { kind: 'native', args, prompt: options.prompt, bundle: options.effective, arm: options.arm, readiness: options.readiness,
      expectedAssets: options.expectedAssets, observationFile: options.observationFile || null } :
      { kind: 'fixture', args, prompt: options.prompt, mode: options.mode || 'ok', model: options.model, heartbeat: options.heartbeat || null };
    const result = await supervise({ cwd: fs.realpathSync(options.workspace), env, payload,
      timeoutMs: native ? options.caps.wall_clock_minutes * 60000 : options.timeoutMs || options.caps.wall_clock_minutes * 60000,
      onGroup: options.onGroup, signal: options.signal, logFiles, captureIO: native ? fs : options.fixtureCaptureIO || fs });
    let attestedModel = null;
    if (native) {
      try { const response = JSON.parse(result.stdout); if (typeof response.model === 'string') attestedModel = response.model; else if (response.modelUsage && Object.keys(response.modelUsage).length === 1) attestedModel = Object.keys(response.modelUsage)[0]; } catch {}
    }
    const environment = {
      fixture: !native, tool: native ? 'claude-code' : 'synthetic-session', tool_version: PROFILE.tool_version,
      model: native ? attestedModel : options.model, requested_model: options.model,
      node: process.version, os: os.platform(), platform_release: os.release(), arch: os.arch(),
      permission_mode: 'manual', permission_prompts: 'none', isolation_profile: PROFILE.name,
      host_policy_observed: nativePreflight?.reportable || false, authentication: PROFILE.authentication, caps: options.caps,
      configuration: PROFILE, env_names: Object.keys(env).filter(k => k !== 'ANTHROPIC_API_KEY').sort(),
    };
    const reportable = Boolean(nativePreflight?.reportable && attestedModel === options.model && result.cleanup_complete && !result.capture_failure);
    return { ...result, started, ended: new Date().toISOString(), environment, assets: assets.files, logFiles,
      reportable, observation: !native ? 'controlled fixture plumbing; not native CLI isolation evidence' : !attestedModel ? 'provider model attestation missing; operational only' : options.readiness.purpose,
      end: result.timedOut ? 'capped' : result.status === 124 ? 'ambiguous' : 'completed',
      limit: /usage limit|session limit|rate limit|quota/i.test(`${result.stdout}\n${result.stderr}`), refused: false };
  } finally { fs.rmSync(sessionRoot, { recursive: true, force: true }); }
}
async function observeFixture(options) { return runSession(options); }
async function launchNative(options) {
  const preflight = preflightNative(options);
  if (!preflight.ok) return { refused: true, status: 3, stdout: '', stderr: preflight.detail, code: preflight.code, reportable: false };
  if (!options.logDir || !options.name) return { refused: true, status: 3, stdout: '', stderr: 'durable session captures are required', reportable: false };
  if (typeof options.prompt !== 'string' || !options.prompt.length) return { refused: true, status: 3, stdout: '', stderr: 'a nonempty frozen task prompt is required', reportable: false };
  const e = preflight.manifest.effective;
  return runSession({ ...options, model: e.model, toolVersion: e.tool.version, permissionMode: e.configuration.permission_mode, caps: preflight.manifest.caps }, preflight);
}
// The inert supervisor cannot launch a native tool until it independently verifies
// the effective identity and explicit readiness decision supplied by the owned caller.
if (require.main === module && process.argv[2] === '--session-supervisor') {
  let input = '';
  process.stdin.on('data', data => { input += data; });
  process.stdin.on('end', () => {
    try {
      const payload = JSON.parse(input);
      if (typeof payload.prompt !== 'string' || !payload.prompt.length) fail('PROMPT_INVALID', 'a nonempty task prompt is required on stdin');
      let executable, args;
      if (payload.kind === 'native') {
        const gate = preflightNative({ effective: payload.bundle, apiKey: process.env.ANTHROPIC_API_KEY, arm: payload.arm, workspace: process.cwd(),
          readiness: payload.readiness, expectedAssets: payload.expectedAssets, observationFile: payload.observationFile, onGroup: () => {} });
        if (!gate.ok) fail(gate.code, gate.detail);
        const sessionRoot = path.dirname(process.env.HOME);
        const expectedEnv = buildEnvironment(sessionRoot, process.cwd(), process.env.ANTHROPIC_API_KEY);
        if (effective.canonical(process.env) !== effective.canonical(expectedEnv)) fail('ENVIRONMENT_CHANGED', 'supervisor environment differs from the isolated profile');
        const settingsPath = path.join(sessionRoot, 'settings.json');
        if (effective.canonical(JSON.parse(fs.readFileSync(settingsPath, 'utf8'))) !== effective.canonical({ permissions: { defaultMode: 'manual' } })) fail('SETTINGS_CHANGED', 'isolated permission override changed');
        const expectedArgs = argumentsFor({ model: gate.manifest.effective.model, caps: gate.manifest.caps }, settingsPath);
        if (effective.canonical(payload.args) !== effective.canonical(expectedArgs)) fail('ARGUMENTS_CHANGED', 'native arguments differ from the frozen profile');
        executable = fs.realpathSync(payload.bundle.input.tool.executable); args = expectedArgs;
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
} else if (require.main === module && process.argv[2] === '--fixture-tool') {
  const input = JSON.parse(process.argv[3]);
  const prompt = fs.readFileSync(0, 'utf8');
  if (input.mode === 'echo-secret') process.stdout.write(process.env.ANTHROPIC_API_KEY);
  else if (input.mode === 'exit7') process.exitCode = 7;
  else if (['hang', 'descendant', 'stream-descendant'].includes(input.mode)) {
    if (input.mode !== 'hang') spawn(process.execPath, ['-e', `const fs=require('node:fs');setInterval(()=>fs.appendFileSync(process.argv[1],'.'),25)`, input.heartbeat], { stdio: 'ignore' });
    if (input.mode === 'stream-descendant') setInterval(() => process.stdout.write('fixture-stream-chunk\n'), 75);
    setInterval(() => {}, 1000);
  } else {
    const flag = name => input.args[input.args.indexOf(name) + 1];
    const override = JSON.parse(fs.readFileSync(flag('--settings'), 'utf8'));
    const projectFile = path.join(process.cwd(), '.claude/settings.json');
    const project = fs.existsSync(projectFile) ? JSON.parse(fs.readFileSync(projectFile, 'utf8')) : {};
    const settings = { ...project, permissions: { ...project.permissions, ...override.permissions } };
    const has = rel => fs.existsSync(path.join(process.cwd(), rel));
    const hookExits = (settings.hooks?.PreToolUse || []).flatMap(group => group.hooks.map(hook => spawnSync('/bin/bash', ['--noprofile', '--norc', '-c', hook.command], {
      cwd: process.cwd(), env: process.env, encoding: 'utf8', input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'rm -rf /' } }), timeout: 5000,
    }).status));
    process.stdout.write(JSON.stringify({ model: input.model, cwd: process.cwd(), auth_present: Boolean(process.env.ANTHROPIC_API_KEY),
      env_names: Object.keys(process.env).sort(), settings,
      project_instructions: has('CLAUDE.md') && has('AGENTS.md'),
      commands: has('.claude/commands'), agents: has('.claude/agents'), skills: has('.claude/skills'), hook_exits: hookExits,
      plugins_in_home: fs.existsSync(path.join(process.env.HOME, '.claude/plugins')), args: input.args, prompt }));
  }
} else if (require.main === module) { process.stderr.write('isolated-launch: direct native launch is unavailable until the T-109 isolation observation gate\n'); process.exitCode = 3; }
module.exports = { PROFILE, assetsFor, settingsFor, observationTarget, checkNativeReadiness, preflightExecution, preflightNative, buildEnvironment, argumentsFor, observeFixture, launchNative };
