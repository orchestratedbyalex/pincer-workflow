// T-102: actual child-process observations of isolated launch plumbing, explicitly
// synthetic. This suite does not claim authenticated/native CLI isolation evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { repo, tempDir, write } from './helpers.js';
const require = createRequire(import.meta.url);
const isolation = require('../scripts/delivery-benchmark-v7/isolated-launch.cjs');
const SECRET = 'sk-ant-synthetic-secret-canary-1234567890123456';
const PRIVATE_TEXT = 'PRIVATE_INSTRUCTION_CANARY';
function fixture(arm = 'plain') {
  const root = tempDir(), workspace = path.join(root, 'workspace'), stateRoot = path.join(root, 'state');
  fs.mkdirSync(workspace); fs.mkdirSync(stateRoot);
  if (arm !== 'plain') {
    for (const rel of ['AGENTS.md', 'CLAUDE.md', '.claude']) fs.cpSync(path.join(repo, 'template', rel), path.join(workspace, rel), { recursive: true });
    write(workspace, '.claude/skills/synthetic/SKILL.md', '# Intended synthetic skill');
  }
  return { root, workspace, stateRoot, arm, model: 'claude-synthetic-1', toolVersion: '2.1.273',
    permissionMode: 'manual', caps: { turns_per_session: 5, wall_clock_minutes: 1, spend_usd: 1 },
    apiKey: SECRET, prompt: 'Perform the unchanged task.', timeoutMs: 5000 };
}
const restore = {};
{
  // The task is not trusted CLI syntax, even when its complete contents name a flag.
  // Both launch modes use argumentsFor() and the same child stdin-delivery code.
  const options = fixture();
  const baseline = isolation.argumentsFor(options, '/controlled/settings.json');
  for (const prompt of ['--dangerously-skip-permissions', '--permission-mode=bypassPermissions', '--settings /private/settings.json', '--model attacker\n--plugin-dir /private/plugin\nKeep this Unicode: π']) {
    assert.deepEqual(isolation.argumentsFor({ ...options, prompt }, '/controlled/settings.json'), baseline,
      'task content cannot alter the shared native/fixture argv');
    assert.ok(!baseline.includes(prompt));
    const result = await isolation.observeFixture({ ...options, prompt });
    assert.equal(result.status, 0, result.stderr);
    const observed = JSON.parse(result.stdout);
    assert.equal(observed.prompt, prompt, 'the real child reads the unchanged task from stdin');
    assert.ok(!observed.args.includes(prompt), 'task bytes never become CLI arguments');
    assert.equal(observed.args[observed.args.indexOf('--permission-mode') + 1], 'manual');
    assert.equal(observed.args[observed.args.indexOf('--input-format') + 1], 'text');
    assert.ok(!observed.args.includes('--dangerously-skip-permissions'));
  }
}
const hostileHome = tempDir(), maliciousHook = path.join(hostileHome, 'PERSONAL_HOOK_RAN');
write(hostileHome, '.claude/CLAUDE.md', PRIVATE_TEXT);
write(hostileHome, '.claude/settings.json', JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: 'command', command: `touch ${maliciousHook}` }] }] } }));
write(hostileHome, '.claude/plugins/personal/plugin.json', PRIVATE_TEXT);
const hostile = { HOME: hostileHome, CLAUDE_CONFIG_DIR: path.join(hostileHome, '.claude'),
  NODE_OPTIONS: '--invalid-synthetic-host-setting', BASH_ENV: '/synthetic/private/bashrc',
  CLAUDECODE: 'parent', CLAUDE_CODE_ENTRYPOINT: 'host', ANTHROPIC_MODEL: 'unwanted',
  ANTHROPIC_AUTH_TOKEN: SECRET, HTTPS_PROXY: 'https://private-proxy.invalid', UNRELATED_PRIVATE_VALUE: PRIVATE_TEXT };
for (const [key, value] of Object.entries(hostile)) { restore[key] = process.env[key]; process.env[key] = value; }
try {
  for (const arm of ['plain', 'pincer', 'strict']) {
    const options = fixture(arm), calls = [];
    options.onGroup = async group => { calls.push(group); assert.ok(group.pid > 0); };
    const result = await isolation.observeFixture(options);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.cleanup_complete, true, 'registered session group is observed gone before returning');
    assert.equal(result.environment.cleanup_complete, true, 'and the fact is retained in the record environment');
    assert.equal(result.reportable, false);
    assert.equal(result.environment.fixture, true);
    assert.equal(result.environment.tool, 'synthetic-session');
    assert.equal(result.environment.isolation_profile, isolation.PROFILE.name);
    for (const name of ['model', 'tool', 'tool_version', 'os', 'platform_release', 'node', 'permission_mode']) assert.ok(result.environment[name]);
    const observed = JSON.parse(result.stdout);
    assert.equal(observed.cwd, fs.realpathSync(options.workspace));
    assert.equal(observed.auth_present, true);
    assert.equal(observed.plugins_in_home, false);
    assert.equal(calls.length, 1);
    for (const name of ['NODE_OPTIONS', 'BASH_ENV', 'CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'ANTHROPIC_MODEL', 'ANTHROPIC_AUTH_TOKEN', 'HTTPS_PROXY', 'UNRELATED_PRIVATE_VALUE']) assert.ok(!observed.env_names.includes(name), name);
    assert.equal(observed.args[observed.args.indexOf('--permission-mode') + 1], 'manual');
    assert.equal(observed.args[observed.args.indexOf('--permission-prompts') + 1], 'none');
    assert.equal(observed.args[observed.args.indexOf('--setting-sources') + 1], 'project');
    assert.ok(observed.args.includes('--strict-mcp-config'));
    assert.ok(!observed.args.includes('--bare'), 'legacy kit commands and agents retain discovery');
    assert.ok(!observed.args.includes('--dangerously-skip-permissions'));
    assert.equal(observed.project_instructions, arm !== 'plain');
    assert.equal(observed.commands, arm !== 'plain');
    assert.equal(observed.agents, arm !== 'plain');
    assert.equal(observed.skills, arm !== 'plain');
    if (arm !== 'plain') {
      assert.ok(observed.hook_exits.includes(2), 'the installed dangerous-command hook actually rejects the synthetic dangerous tool input');
      assert.equal(observed.hook_exits.length, 2, 'project hooks run once each, never copied into the override');
      assert.ok(Object.keys(result.assets).includes('.claude/commands/pincer-plan.md'));
    }
    assert.equal(fs.existsSync(maliciousHook), false);
    assert.deepEqual(fs.readdirSync(options.stateRoot), [], 'dedicated session config/home is removed');
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes(SECRET)); assert.ok(!serialized.includes(PRIVATE_TEXT));
    // A handoff uses a new isolated config but the same explicit policy and arm assets.
    const handoff = await isolation.observeFixture(options);
    assert.deepEqual(handoff.environment, result.environment);
    assert.deepEqual(handoff.assets, result.assets);
  }
  const echo = await isolation.observeFixture({ ...fixture(), mode: 'echo-secret' });
  assert.equal(echo.stdout, '[REDACTED]', 'even a child echo cannot put authentication into captures');
  const captureOptions = fixture();
  captureOptions.logDir = path.join(captureOptions.root, 'captures'); captureOptions.name = 'session-1';
  const captured = await isolation.observeFixture({ ...captureOptions, mode: 'echo-secret' });
  assert.equal(fs.readFileSync(captured.logFiles.stdout, 'utf8'), '[REDACTED]');
  assert.equal(fs.statSync(captured.logFiles.stdout).mode & 0o777, 0o600);
  await assert.rejects(isolation.observeFixture(captureOptions), /append-preserved/);
} finally {
  for (const [key, value] of Object.entries(restore)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
}
{
  for (const overrides of [{ toolVersion: '9.9.9' }, { permissionMode: 'bypassPermissions' }, { apiKey: '' }, { caps: { turns_per_session: 0, wall_clock_minutes: 1, spend_usd: 1 } }, { model: '' }]) {
    const options = { ...fixture(), ...overrides };
    await assert.rejects(isolation.observeFixture(options));
    assert.deepEqual(fs.readdirSync(options.stateRoot), [], 'refused settings leave no per-session state');
  }
  const options = fixture('pincer');
  write(options.workspace, '.claude/settings.local.json', JSON.stringify({ env: { PRIVATE: SECRET } }));
  await assert.rejects(isolation.observeFixture(options), /undeclared/);
  assert.deepEqual(fs.readdirSync(options.stateRoot), []);
  const escaped = fixture('pincer');
  fs.unlinkSync(path.join(escaped.workspace, 'AGENTS.md'));
  fs.symlinkSync(path.join(hostileHome, '.claude/CLAUDE.md'), path.join(escaped.workspace, 'AGENTS.md'));
  await assert.rejects(isolation.observeFixture(escaped), /symbolic/);
  const ancestor = fixture(); write(ancestor.root, 'CLAUDE.md', PRIVATE_TEXT);
  await assert.rejects(isolation.observeFixture(ancestor), /ancestor/);
}
{
  const options = fixture(), heartbeat = path.join(options.root, 'heartbeat');
  const result = await isolation.observeFixture({ ...options, mode: 'descendant', heartbeat, timeoutMs: 300 });
  assert.equal(result.status, 124);
  assert.equal(result.timedOut, true);
  assert.equal(result.cleanup_complete, true);
  assert.ok(fs.existsSync(heartbeat), 'a real grandchild ran before timeout');
  const before = fs.readFileSync(heartbeat, 'utf8');
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(fs.readFileSync(heartbeat, 'utf8'), before, 'watchdog reaps descendants, not only the immediate child');
  assert.deepEqual(fs.readdirSync(options.stateRoot), []);
  const failure = await isolation.observeFixture({ ...fixture(), mode: 'exit7' });
  assert.equal(failure.status, 7);
}
{
  const options = fixture(), heartbeat = path.join(options.root, 'never-started');
  await assert.rejects(isolation.observeFixture({ ...options, mode: 'descendant', heartbeat,
    onGroup: async () => { throw new Error('cannot record group'); } }), /durably registered/);
  assert.equal(fs.existsSync(heartbeat), false, 'registration failure prevents the tool from starting');
  assert.deepEqual(fs.readdirSync(options.stateRoot), []);
  const controller = new AbortController();
  const running = isolation.observeFixture({ ...fixture(), mode: 'hang', signal: controller.signal });
  setTimeout(() => controller.abort(), 150);
  const aborted = await running;
  assert.equal(aborted.status, 143);
}
{
  // A disk fault while output is arriving must terminate the whole registered group,
  // retain the already-written prefix, and return a structured infrastructure failure.
  for (const operation of ['write', 'flush']) {
    const options = fixture(), heartbeat = path.join(options.root, 'capture-heartbeat');
    let calls = 0;
    const injected = (fd, value) => {
      calls += 1;
      if (calls === 2) { const error = new Error(SECRET); error.code = 'ENOSPC'; throw error; }
      return operation === 'write' ? fs.writeSync(fd, value) : fs.fsyncSync(fd);
    };
    const result = await isolation.observeFixture({ ...options, mode: 'stream-descendant', heartbeat,
      logDir: path.join(options.root, 'captures'), name: 'disk-fault',
      fixtureCaptureIO: { writeSync: operation === 'write' ? injected : fs.writeSync,
        fsyncSync: operation === 'flush' ? injected : fs.fsyncSync } });
    assert.equal(result.status, 74);
    assert.deepEqual(result.capture_failure, { code: 'CAPTURE_IO_FAILED', operation, errno: 'ENOSPC' });
    assert.equal(result.reportable, false);
    assert.equal(result.cleanup_complete, true);
    assert.ok(fs.readFileSync(result.logFiles.stdout, 'utf8').includes('fixture-stream-chunk'), 'successful prefix retained');
    const before = fs.readFileSync(heartbeat, 'utf8');
    await new Promise(resolve => setTimeout(resolve, 200));
    assert.equal(fs.readFileSync(heartbeat, 'utf8'), before, 'disk failure reaps the continuing grandchild');
    assert.ok(!JSON.stringify(result).includes(SECRET), 'raw disk error message is never captured');
    assert.deepEqual(fs.readdirSync(options.stateRoot), []);
  }
}
{
  const legacy = spawnSync('/bin/sh', [path.join(repo, 'scripts/delivery-benchmark-v7/live-driver.sh'), '--i-have-a-spending-cap'], { encoding: 'utf8' });
  assert.equal(legacy.status, 3); assert.match(legacy.stderr, /historical direct launch route is disabled/);
  const refusal = isolation.preflightNative({});
  assert.equal(isolation.preflightExecution({}).ok, false);
  assert.equal(refusal.ok, false);
  assert.match(refusal.detail, /effective manifest/);
}
{
  // Gate tests use authored metadata only and never call a provider executable.
  // launchNative independently re-resolves the real executable before this gate.
  const options = fixture();
  const sha = require('../scripts/delivery-benchmark-v7/freeze.cjs').sha256;
  const manifest = { caps: options.caps, effective: { model: options.model,
    tool: { name: 'claude-code', kind: 'native', version: '2.1.273', digest: 'a'.repeat(64) },
    configuration: { isolation_profile: isolation.PROFILE.name, permission_mode: 'manual' },
    kit: { digest: 'b'.repeat(64), commit: 'c'.repeat(40) }, platform: { os: process.platform, node: process.version } } };
  const gateOptions = { ...options, effective: { inputRoot: options.root },
    expectedAssets: isolation.assetsFor(options.arm, options.workspace).files, onGroup: async () => {},
    readiness: { purpose: 'operational-smoke', spendingAuthorized: true, projectAccessAuthorized: true,
      hostPolicyPreserved: true, decisionRef: 'synthetic-gate-decision' } };
  const smoke = isolation.checkNativeReadiness(gateOptions, manifest);
  assert.equal(smoke.ok, false); assert.equal(smoke.code, 'ALLOCATION_REQUIRED');
  const allocation = require('../scripts/delivery-benchmark-v7/allocation.cjs');
  const originalVerify = allocation.verifyLaunch;
  // Isolate this format/path unit test. The actual allocation module is exercised
  // by its controlled-worker suite; this stub cannot reach launchNative here.
  allocation.verifyLaunch = () => ({ purpose: 'operational-smoke', inputRoot: options.root, observationFile: 'observation.json' });
  gateOptions.allocation = { fixture: true };
  try {

  assert.equal(isolation.checkNativeReadiness({ ...gateOptions, readiness: { ...gateOptions.readiness, spendingAuthorized: false } }, manifest).ok, false);
  assert.equal(isolation.checkNativeReadiness({ ...gateOptions, expectedAssets: { unknown: 'unbound' } }, manifest).code, 'ARM_ASSETS_CHANGED');
  const measured = { ...gateOptions, observationFile: 'observation.json', readiness: { ...gateOptions.readiness, purpose: 'measured', observationReviewed: true } };
  assert.equal(isolation.checkNativeReadiness(measured, manifest).code, 'ALLOCATION_PURPOSE_CHANGED');
  allocation.verifyLaunch = () => ({ purpose: 'measured', inputRoot: options.root, observationFile: 'observation.json' });
  assert.equal(isolation.checkNativeReadiness(gateOptions, manifest).code, 'ALLOCATION_PURPOSE_CHANGED');
  assert.equal(isolation.checkNativeReadiness(measured, manifest).ok, false);
  const evidence = 'synthetic gate evidence only; not a real observed session'; write(options.root, 'evidence.txt', evidence);
  const observation = { schema: 1, kind: 'native-isolation-observation', fixture: false,
    target: isolation.observationTarget(manifest), arms: ['plain', 'pincer', 'strict'],
    host_policy_observed: true, authentication_observed: true, personal_configuration_absent: true,
    evidence: [{ path: 'evidence.txt', digest: sha(evidence) }] };
  const raw = JSON.stringify(observation); write(options.root, 'observation.json', raw);
  manifest.effective.configuration.isolation_observation_digest = sha(raw);
  assert.equal(isolation.checkNativeReadiness(measured, manifest).ok, true, 'authored gate format passes with a controlled allocation verifier only');
  write(options.root, 'evidence.txt', 'changed');
  assert.equal(isolation.checkNativeReadiness(measured, manifest).code, 'ISOLATION_EVIDENCE_CHANGED');
  write(options.root, 'evidence.txt', evidence);
  write(options.root, 'substitute.json', raw);
  assert.equal(isolation.checkNativeReadiness({ ...measured, observationFile: 'substitute.json' }, manifest).code, 'ISOLATION_OBSERVATION_UNBOUND');
  const otherRoot = tempDir();
  write(otherRoot, 'observation.json', raw);
  assert.equal(isolation.checkNativeReadiness({ ...measured, effective: { inputRoot: otherRoot } }, manifest).code, 'ISOLATION_OBSERVATION_UNBOUND');
  const originalRead = fs.readFileSync;
  for (const protectedPath of ['.env', '.env.local', 'credentials.json', 'auth.json', '.ssh/key', '.aws/config', '.netrc', '.npmrc']) {
    let reads = 0;
    fs.readFileSync = () => { reads += 1; throw new Error('private canary must not be read'); };
    try {
      const refusal = isolation.checkNativeReadiness({ ...measured, observationFile: protectedPath }, manifest);
      assert.equal(refusal.code, 'ISOLATION_PATH_PROTECTED');
      assert.equal(reads, 0, 'protected observation refused before any file read');
    } finally { fs.readFileSync = originalRead; }
    const hostile = JSON.stringify({ ...observation, evidence: [{ path: protectedPath, digest: sha('private') }] });
    write(options.root, 'observation.json', hostile);
    const allowedObservation = fs.realpathSync(path.join(options.root, 'observation.json'));
    let protectedReads = 0;
    fs.readFileSync = (file, ...args) => {
      if (path.resolve(String(file)) !== allowedObservation) { protectedReads += 1; throw new Error('private canary must not be read'); }
      return originalRead(file, ...args);
    };
    try {
      assert.equal(isolation.checkNativeReadiness(measured, manifest).code, 'ISOLATION_PATH_PROTECTED');
      assert.equal(protectedReads, 0, 'protected evidence refused before its read');
    } finally { fs.readFileSync = originalRead; }
  }
  write(options.root, 'observation.json', '{PRIVATE_PARSE_ERROR_CANARY');
  const malformed = isolation.checkNativeReadiness(measured, manifest);
  assert.equal(malformed.code, 'ISOLATION_OBSERVATION_INVALID');
  assert.ok(!malformed.detail.includes('PRIVATE_PARSE_ERROR_CANARY'));
  } finally { allocation.verifyLaunch = originalVerify; }
}

console.log('benchmark environment tests passed (native observation remains required)');
