// T-102/T-121: actual child-process observations of isolated launch plumbing under the
// native-login profile, explicitly synthetic. The login directory, its custody lock, the
// status probe and the tool are fixtures. This suite does not claim authenticated/native
// CLI isolation evidence and never reads a credential.
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
  // The study login directory the user would sign into; here it holds only a synthetic
  // credential file whose bytes the launcher must never read.
  fs.mkdirSync(path.join(root, 'host/claude-config'), { recursive: true });
  fs.writeFileSync(path.join(root, 'host/claude-config/.credentials.json'), JSON.stringify({ synthetic: PRIVATE_TEXT }), { mode: 0o600 });
  if (arm !== 'plain') {
    for (const rel of ['AGENTS.md', 'CLAUDE.md', '.claude']) fs.cpSync(path.join(repo, 'template', rel), path.join(workspace, rel), { recursive: true });
    write(workspace, '.claude/skills/synthetic/SKILL.md', '# Intended synthetic skill');
  }
  return { root, workspace, stateRoot, arm, model: 'claude-synthetic-1', toolVersion: '2.1.273',
    permissionMode: 'manual', caps: { turns_per_session: 5, wall_clock_minutes: 1, spend_usd: 1 },
    inputRoot: root, billingMode: 'subscription', prompt: 'Perform the unchanged task.', timeoutMs: 5000 };
}
const loginDirOf = options => fs.realpathSync(path.join(options.inputRoot, 'host/claude-config'));
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
    // Kit-hook observation: the CLI's own hook debug log, written inside the session root
    // and retained only as a redacted copy. The filter keeps the log to hook execution.
    assert.equal(observed.args[observed.args.indexOf('--debug') + 1], 'hooks');
    assert.equal(observed.args[observed.args.indexOf('--debug-file') + 1], path.join(observed.session_root, 'debug.log'));
    assert.equal(observed.args[observed.args.indexOf('--output-format') + 1], 'json', 'result parsing is unchanged');
  }
}
const hostileHome = tempDir(), maliciousHook = path.join(hostileHome, 'PERSONAL_HOOK_RAN');
write(hostileHome, '.claude/CLAUDE.md', PRIVATE_TEXT);
write(hostileHome, '.claude/settings.json', JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: 'command', command: `touch ${maliciousHook}` }] }] } }));
write(hostileHome, '.claude/plugins/personal/plugin.json', PRIVATE_TEXT);
const hostile = { HOME: hostileHome, CLAUDE_CONFIG_DIR: path.join(hostileHome, '.claude'),
  NODE_OPTIONS: '--invalid-synthetic-host-setting', BASH_ENV: '/synthetic/private/bashrc',
  CLAUDECODE: 'parent', CLAUDE_CODE_ENTRYPOINT: 'host', ANTHROPIC_MODEL: 'unwanted',
  HTTPS_PROXY: 'https://private-proxy.invalid', UNRELATED_PRIVATE_VALUE: PRIVATE_TEXT };
for (const [key, value] of Object.entries(hostile)) { restore[key] = process.env[key]; process.env[key] = value; }
try {
  for (const arm of ['plain', 'pincer', 'strict']) {
    const options = fixture(arm), calls = [];
    options.onGroup = async group => { calls.push(group); assert.ok(group.pid > 0); };
    const result = await isolation.observeFixture(options);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.cleanup_complete, true, 'registered session group is observed gone before returning');
    assert.equal(result.environment.cleanup_complete, true, 'and the fact is retained in the record environment');
    // Synthetic isolation canary: user-level settings, a SessionStart hook and a user
    // CLAUDE.md are planted in the per-session HOME and config dir. A CLI that honors
    // --setting-sources project never runs the hook or sees the phrase.
    // "Canary not triggered" is not "isolation demonstrated": a hook that did not run and
    // a phrase that was not echoed leave the loading question unknown, never answered.
    const canary = result.environment.isolation_canary;
    assert.deepEqual(canary, { home_canary: 'installed-fixture-only', personal_configuration_absent: 'unknown', leak_detected: false, user_hook_ran: false, login_dir_hook_ran: false, user_settings_loaded: 'unknown', user_instructions_loaded: 'unknown' }, JSON.stringify(canary));
    assert.ok(!JSON.stringify(result).includes('PINCER-CANARY-'), 'a clean session leaves no phrase anywhere');
    assert.equal(result.environment.hook_capture.present, true, 'the fixture wrote a hook debug log');
    assert.equal(result.environment.hook_evidence.status, 'unretained', 'without a log directory nothing durable holds it');
    assert.equal(result.reportable, false);
    assert.ok(result.unreportable.includes('hook evidence unretained'), JSON.stringify(result.unreportable));
    assert.equal(result.environment.fixture, true);
    assert.equal(result.environment.tool, 'synthetic-session');
    assert.equal(result.environment.isolation_profile, isolation.NATIVE_PROFILE.name);
    assert.equal(result.environment.authentication.auth_method, 'claude.ai', 'the fixture status probe was retained');
    assert.deepEqual(Object.keys(result.environment.authentication).sort(), ['api_provider', 'auth_method', 'checked', 'logged_in', 'subscription_type'], 'only the sanitized status fields');
    assert.deepEqual(result.environment.billing, { mode: 'subscription', attributable_charge_usd: null, charge_reason: 'SUBSCRIPTION_NOT_ATTRIBUTABLE', charge_evidence: null });
    assert.equal(result.environment.login_directory.recovery_required, false);
    assert.ok(!result.environment.env_names.some(name => isolation.CREDENTIAL_ENV.includes(name)), 'no credential variable is constructed');
    for (const name of ['model', 'tool', 'tool_version', 'os', 'platform_release', 'node', 'permission_mode']) assert.ok(result.environment[name]);
    const observed = JSON.parse(result.stdout);
    assert.equal(observed.cwd, fs.realpathSync(options.workspace));
    assert.deepEqual(observed.credential_names, [], 'the tool receives no provider key or token');
    assert.equal(observed.config_dir, loginDirOf(options), 'the tool reads its own login from the study login directory');
    assert.ok(observed.home.startsWith(fs.realpathSync(options.stateRoot)), 'HOME is the per-session directory');
    assert.deepEqual(observed.login_dir_entries, ['.credentials.json', 'CLAUDE.md', 'settings.json'], 'the login directory holds the credential plus the two owned canaries while the tool runs');
    assert.deepEqual(fs.readdirSync(loginDirOf(options)), ['.credentials.json'], 'and only the credential afterwards');
    assert.equal(fs.readFileSync(path.join(loginDirOf(options), '.credentials.json'), 'utf8'), JSON.stringify({ synthetic: PRIVATE_TEXT }), 'the credential file is untouched');
    assert.equal(observed.plugins_in_home, false);
    assert.equal(observed.canary_planted, true, 'the synthetic user settings and CLAUDE.md exist while the tool runs');
    assert.equal(calls.length, 1);
    for (const name of ['NODE_OPTIONS', 'BASH_ENV', 'CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'ANTHROPIC_MODEL', 'HTTPS_PROXY', 'UNRELATED_PRIVATE_VALUE']) assert.ok(!observed.env_names.includes(name), name);
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
    // Same policy, same arm assets; only the per-session custody journal receipt differs.
    const withoutJournal = env => ({ ...env, login_directory: { ...env.login_directory, journal: null } });
    assert.match(handoff.environment.login_directory.journal, /^[a-f0-9]{32}$/);
    assert.notEqual(handoff.environment.login_directory.journal, result.environment.login_directory.journal, 'each session has its own durable custody journal');
    assert.deepEqual(withoutJournal(handoff.environment), withoutJournal(result.environment));
    assert.deepEqual(handoff.assets, result.assets);
  }
  {
    // A credential or billing override in the launching shell is refused by name before any
    // custody, probe or session; its value is never read and never appears anywhere.
    process.env.ANTHROPIC_AUTH_TOKEN = SECRET;
    try {
      const options = fixture();
      await assert.rejects(isolation.observeFixture(options), error => {
        assert.equal(error.code, 'BILLING_OVERRIDE_PRESENT');
        assert.match(error.message, /ANTHROPIC_AUTH_TOKEN/);
        assert.ok(!error.message.includes(SECRET), 'the value is not read into the refusal');
        return true;
      });
      assert.deepEqual(fs.readdirSync(options.stateRoot), [], 'nothing was launched');
      assert.deepEqual(fs.readdirSync(path.join(options.inputRoot, 'host')), ['claude-config'], 'no custody lock was taken');
      assert.equal(process.env.ANTHROPIC_AUTH_TOKEN, SECRET, 'the launching shell is not edited');
    } finally { delete process.env.ANTHROPIC_AUTH_TOKEN; }
  }
  const echo = await isolation.observeFixture({ ...fixture(), mode: 'echo-secret' });
  assert.equal(echo.stdout, '[REDACTED]', 'even a child echo of credential-shaped text cannot reach the captures');
  const captureOptions = fixture();
  captureOptions.logDir = path.join(captureOptions.root, 'captures'); captureOptions.name = 'session-1';
  const captured = await isolation.observeFixture({ ...captureOptions, mode: 'echo-secret' });
  assert.equal(fs.readFileSync(captured.logFiles.stdout, 'utf8'), '[REDACTED]');
  assert.equal(fs.statSync(captured.logFiles.stdout).mode & 0o777, 0o600);
  await assert.rejects(isolation.observeFixture(captureOptions), /append-preserved/);
  {
    // The hook debug log is retained beside the captures, redacted, 0600, append-preserved,
    // and its absence is recorded rather than assumed.
    const options = fixture('pincer');
    options.logDir = path.join(options.root, 'captures'); options.name = 'S1';
    const result = await isolation.observeFixture(options);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.logFiles.debug, path.join(options.logDir, 'S1.debug.log'));
    const debug = fs.readFileSync(result.logFiles.debug, 'utf8');
    assert.match(debug, /fixture hook debug/);
    assert.ok(!debug.includes('sk-ant-fixture'), 'the retained debug copy is redacted');
    assert.ok(debug.includes('[REDACTED]'));
    assert.equal(fs.statSync(result.logFiles.debug).mode & 0o777, 0o600);
    assert.deepEqual(result.environment.hook_capture, { present: true, retained: true, file: 'S1.debug.log', bytes: Buffer.byteLength(debug) });
    const KIT_HOOKS = ['.claude/hooks/block-dangerous.sh', '.claude/hooks/ticket-guard.sh'];
    assert.deepEqual(result.environment.hook_evidence, { status: 'sufficient', required: KIT_HOOKS, missing: [] });
    for (const hook of KIT_HOOKS) assert.ok(debug.includes(hook), `the retained log names ${hook}`);
    assert.equal(result.evidence_retention_failed, false);
    assert.deepEqual(fs.readdirSync(options.stateRoot), [], 'the raw debug log leaves with the session root');
    const plain = await isolation.observeFixture({ ...fixture(), logDir: path.join(tempDir(), 'captures'), name: 'S1' });
    assert.deepEqual(plain.environment.hook_evidence, { status: 'sufficient', required: [], missing: [] }, 'the plain arm requires a retained log and no kit hooks');
    const silent = await isolation.observeFixture({ ...fixture(), logDir: path.join(tempDir(), 'captures'), name: 'S1', mode: 'exit7' });
    assert.equal(silent.environment.hook_capture.present, false, 'a tool that wrote no debug log is recorded as such');
    assert.equal(silent.environment.hook_evidence.status, 'missing');
    assert.equal(fs.existsSync(silent.logFiles.debug), false);
    assert.equal(silent.evidence_retention_failed, false, 'nothing existed to retain');
    // A log that exists but does not show every kit hook is insufficient, not "present".
    const partial = await isolation.observeFixture({ ...fixture('pincer'), logDir: path.join(tempDir(), 'captures'), name: 'S1', mode: 'partial-hook-log' });
    assert.equal(partial.environment.hook_capture.retained, true);
    assert.deepEqual(partial.environment.hook_evidence, { status: 'insufficient', required: KIT_HOOKS, missing: ['.claude/hooks/ticket-guard.sh'] });
    assert.ok(partial.unreportable.some(reason => /hook evidence insufficient .*ticket-guard/.test(reason)), JSON.stringify(partial.unreportable));
  }
  {
    // Registration, attempts, missing outcomes and unknown formats prove no completion.
    const scripts = isolation.KIT_HOOK_SCRIPTS;
    const capture = { present: true, retained: true };
    const completion = (script, status = '0') => `[DEBUG] Hook command completed with status ${status}: bash "$CLAUDE_PROJECT_DIR"/${script}`;
    for (const text of [
      `Registered but NEVER EXECUTED: ${scripts.join(' and ')}`,
      scripts.map(script => `[DEBUG] Starting hook: ${script}`).join('\n'),
      scripts.map(script => completion(script, 'null')).join('\n'),
      scripts.map(script => completion(script, '256')).join('\n'),
      scripts.map(script => `Registered: ${completion(script)}`).join('\n'),
      scripts.map(script => `${completion(script)} (not executed)`).join('\n'),
      completion(scripts[0]),
    ]) {
      const evidence = isolation.hookEvidence('strict', capture, text);
      assert.equal(evidence.status, 'insufficient', text);
      assert.equal(isolation.reportability({ nativePreflight: { reportable: true }, attestedModel: 'm', model: 'm',
        result: { cleanup_complete: true }, canary: { leak_detected: false }, hookEvidence: evidence }).reportable, false);
    }
    assert.equal(isolation.hookEvidence('strict', capture, scripts.map(script => completion(script, '2')).join('\n')).status,
      'sufficient', 'a completed denial is execution evidence, not proof of task acceptance');
  }
  for (const failure of ['unreadable', 'all-writes', 'primary-write']) {
    // Exercise the real session cleanup path, not only the retention helper. Failed
    // reading or exhausted recovery must preserve the original bytes and protected root.
    const options = fixture('pincer');
    options.logDir = path.join(options.root, 'captures'); options.name = 'S1';
    const fault = () => { const error = new Error(SECRET); error.code = 'ENOSPC'; throw error; };
    let original, originalBytes;
    const io = {
      readFileSync(file, encoding) {
        original = file; originalBytes = fs.readFileSync(file);
        if (failure === 'unreadable') fault();
        return originalBytes.toString(encoding);
      },
      writeFileSync(file, ...args) {
        if (failure === 'all-writes' || file === path.join(options.logDir, 'S1.debug.log')) fault();
        return fs.writeFileSync(file, ...args);
      },
    };
    const result = await isolation.observeFixture({ ...options, fixtureRetainIO: io });
    assert.equal(result.status, 0, result.stderr);
    const capture = result.environment.hook_capture;
    assert.equal(capture.retained, false);
    assert.equal(result.environment.hook_evidence.status, failure === 'unreadable' ? 'unreadable' : 'unretained');
    assert.equal(result.evidence_retention_failed, true);
    assert.equal(result.review_required, true);
    assert.equal(fs.existsSync(result.logFiles.debug), false);
    const recovered = path.join(options.stateRoot, capture.recovered);
    assert.ok(fs.existsSync(recovered), 'the raw log survives for review');
    if (failure === 'primary-write') {
      assert.equal(capture.redacted, true);
      assert.equal(fs.existsSync(original), false, 'a successful redacted recovery permits cleanup');
      assert.equal(fs.statSync(recovered).mode & 0o777, 0o600);
      assert.ok(!fs.readFileSync(recovered, 'utf8').includes(SECRET));
    } else {
      assert.equal(capture.original_preserved, true);
      assert.equal(capture.redacted, false);
      assert.equal(fs.realpathSync(recovered), fs.realpathSync(original));
      assert.deepEqual(fs.readFileSync(recovered), originalBytes, 'the last copy survives byte for byte');
      assert.equal(fs.statSync(path.dirname(recovered)).mode & 0o777, 0o700, 'raw evidence stays in its protected session directory');
    }
    assert.match(fs.readFileSync(recovered, 'utf8'), /block-dangerous/);
    assert.ok(!JSON.stringify(result).includes(SECRET), 'the fault message never reaches the result');
  }
  {
    // The reportability gate itself, with a measured preflight: every deficiency is a
    // named reason, and only a session with none of them is reportable.
    const clean = { nativePreflight: { reportable: true }, attestedModel: 'claude-m-1', model: 'claude-m-1',
      result: { cleanup_complete: true, capture_failure: null }, canary: { leak_detected: false }, hookEvidence: { status: 'sufficient', missing: [] } };
    assert.deepEqual(isolation.reportability(clean), { reportable: true, unreportable: [] });
    for (const [patch, reason] of [
      [{ attestedModel: null }, /model attestation/], [{ result: { cleanup_complete: false, capture_failure: null } }, /cleanup/],
      [{ result: { cleanup_complete: true, capture_failure: { code: 'CAPTURE_IO_FAILED' } } }, /capture failure/],
      [{ canary: { leak_detected: true } }, /canary tripped/],
      [{ hookEvidence: { status: 'missing', missing: [] } }, /hook evidence missing/],
      [{ hookEvidence: { status: 'unreadable', missing: [] } }, /hook evidence unreadable/],
      [{ hookEvidence: { status: 'unretained', missing: [] } }, /hook evidence unretained/],
      [{ hookEvidence: { status: 'insufficient', missing: ['.claude/hooks/ticket-guard.sh'] } }, /hook evidence insufficient \(.claude\/hooks\/ticket-guard.sh\)/],
    ]) {
      const verdict = isolation.reportability({ ...clean, ...patch });
      assert.equal(verdict.reportable, false, JSON.stringify(patch));
      assert.equal(verdict.unreportable.length, 1);
      assert.match(verdict.unreportable[0], reason);
    }
    assert.equal(isolation.reportability({ ...clean, nativePreflight: { reportable: false } }).reportable, false, 'an operational or fixture session is never reportable');
  }
  {
    // A tool that reads user-level configuration despite the profile trips the canary:
    // the planted hook runs and the planted phrase reaches the captures. The result is
    // unreportable and the record says why; the emitted phrase remains in the captures.
    const leaked = await isolation.observeFixture({ ...fixture(), mode: 'leak-canary' });
    assert.equal(leaked.status, 0, leaked.stderr);
    const canary = leaked.environment.isolation_canary;
    assert.deepEqual(canary, { home_canary: 'installed-fixture-only', personal_configuration_absent: 'unknown', leak_detected: true, user_hook_ran: true, login_dir_hook_ran: true, user_settings_loaded: true, user_instructions_loaded: true }, 'the leaking tool read the login-directory canary');
    assert.equal(leaked.reportable, false);
    assert.ok(leaked.unreportable.includes('isolation canary tripped'));
    assert.match(leaked.stdout, /PINCER-CANARY-[a-f0-9]{16}/, 'captures keep what the tool printed, phrase included');
    assert.ok(!JSON.stringify(leaked.environment).includes('PINCER-CANARY-'), 'the launcher itself writes no phrase into the record');
  }
} finally {
  for (const [key, value] of Object.entries(restore)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
}
{
  for (const [overrides, code] of [[{ toolVersion: '9.9.9' }, 'TOOL_UNSUPPORTED'], [{ permissionMode: 'bypassPermissions' }, 'PERMISSION_UNSUPPORTED'], [{ apiKey: '' }, 'BILLING_OVERRIDE_PRESENT'], [{ apiKey: SECRET }, 'BILLING_OVERRIDE_PRESENT'],
    [{ caps: { turns_per_session: 0, wall_clock_minutes: 1, spend_usd: 1 } }, 'CAP_INVALID'], [{ model: '' }, 'MODEL_MISSING'], [{ billingMode: 'either' }, 'AMBIGUOUS_BILLING'], [{ billingMode: undefined }, 'AMBIGUOUS_BILLING'], [{ inputRoot: undefined }, 'LOGIN_DIR_REQUIRED']]) {
    const options = { ...fixture(), ...overrides };
    await assert.rejects(isolation.observeFixture(options), error => { assert.equal(error.code, code, JSON.stringify(overrides)); assert.ok(!String(error.message).includes(SECRET)); return true; });
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
    configuration: { isolation_profile: isolation.NATIVE_PROFILE.name, permission_mode: 'manual' },
    kit: { digest: 'b'.repeat(64), commit: 'c'.repeat(40) }, platform: { os: process.platform, node: process.version } } };
  // The gate probes login status through the manifest's own executable. This fixture answers
  // only `auth status --json`; it can never start a session.
  const statusScript = path.join(options.root, 'status-only.sh');
  fs.writeFileSync(statusScript, '#!/bin/sh\nif [ "$1" = "auth" ] && [ "$2" = "status" ] && [ "$3" = "--json" ]; then printf \'%s\' \'{"loggedIn":true,"authMethod":"claude.ai","apiProvider":"firstParty","subscriptionType":"max","email":"fixture@example.invalid","orgId":"org_fixture"}\'; exit 0; fi\nexit 99\n', { mode: 0o755 });
  const gateOptions = { ...options, effective: { inputRoot: options.root, input: { tool: { executable: statusScript } } },
    expectedAssets: isolation.assetsFor(options.arm, options.workspace).files, onGroup: async () => {},
    readiness: { purpose: 'operational-smoke', usageEnvelopeAgreed: true, projectAccessAuthorized: true,
      hostPolicyPreserved: true, decisionRef: 'synthetic-gate-decision', billingMode: 'subscription' } };
  // An accepted gate holds login-directory custody for the caller; release it here.
  const gate = (o, m) => { const g = isolation.checkNativeReadiness(o, m); if (g.ok && g.acquired) isolation.releaseCustody(g.custody); return g; };
  const smoke = gate(gateOptions, manifest);
  assert.equal(smoke.ok, false); assert.equal(smoke.code, 'ALLOCATION_REQUIRED');
  // The historical API-key profile is refused by name; the legacy readiness vocabulary too.
  const historical = gate(gateOptions, { ...manifest, effective: { ...manifest.effective, configuration: { ...manifest.effective.configuration, isolation_profile: isolation.PROFILE.name } } });
  assert.equal(historical.code, 'PROFILE_HISTORICAL'); assert.match(historical.detail, /not the execution path/);
  const oldNative = gate(gateOptions, { ...manifest, effective: { ...manifest.effective, configuration: { ...manifest.effective.configuration, isolation_profile: isolation.LEGACY_NATIVE_PROFILE.name } } });
  assert.equal(oldNative.code, 'PROFILE_HISTORICAL');
  assert.equal(gate({ ...gateOptions, readiness: { ...gateOptions.readiness, spendingAuthorized: true } }, manifest).code, 'READINESS_REQUIRED');
  assert.equal(gate({ ...gateOptions, readiness: { ...gateOptions.readiness, billingMode: 'api' } }, manifest).code, 'BILLING_MODE_MISMATCH', 'a subscription login cannot be declared api-billed');
  assert.equal(gate({ ...gateOptions, apiKey: SECRET }, manifest).code, 'BILLING_OVERRIDE_PRESENT');
  const allocation = require('../scripts/delivery-benchmark-v7/allocation.cjs');
  const originalVerify = allocation.verifyLaunch;
  // Isolate this format/path unit test. The actual allocation module is exercised
  // by its controlled-worker suite; this stub cannot reach launchNative here.
  allocation.verifyLaunch = () => ({ purpose: 'operational-smoke', inputRoot: options.root, observationFile: 'observation.json' });
  gateOptions.allocation = { fixture: true };
  try {

  assert.equal(gate({ ...gateOptions, readiness: { ...gateOptions.readiness, usageEnvelopeAgreed: false } }, manifest).ok, false);
  assert.equal(gate({ ...gateOptions, expectedAssets: { unknown: 'unbound' } }, manifest).code, 'ARM_ASSETS_CHANGED');
  const measured = { ...gateOptions, observationFile: 'observation.json', readiness: { ...gateOptions.readiness, purpose: 'measured', observationReviewed: true } };
  assert.equal(gate(measured, manifest).code, 'ALLOCATION_PURPOSE_CHANGED');
  allocation.verifyLaunch = () => ({ purpose: 'measured', inputRoot: options.root, observationFile: 'observation.json' });
  assert.equal(gate(gateOptions, manifest).code, 'ALLOCATION_PURPOSE_CHANGED');
  assert.equal(gate(measured, manifest).ok, false);
  const evidence = 'synthetic gate evidence only; not a real observed session'; write(options.root, 'evidence.txt', evidence);
  // The reviewed observation now also records that the login survived the constructed
  // environment and that the override refusal was exercised (T-121 contracts §6).
  const observation = { schema: 1, kind: 'native-isolation-observation', fixture: false,
    target: isolation.observationTarget(manifest), arms: ['plain', 'pincer', 'strict'],
    host_policy_observed: true, authentication_observed: true, personal_configuration_absent: true, login_preserved: true, override_refused: true,
    evidence: [{ path: 'evidence.txt', digest: sha(evidence) }] };
  const raw = JSON.stringify(observation); write(options.root, 'observation.json', raw);
  manifest.effective.configuration.isolation_observation_digest = sha(raw);
  assert.equal(gate(measured, manifest).ok, true, 'authored gate format passes with a controlled allocation verifier only');
  {
    const incomplete = { ...observation }; delete incomplete.login_preserved;
    write(options.root, 'observation.json', JSON.stringify(incomplete));
    assert.equal(gate(measured, { ...manifest, effective: { ...manifest.effective, configuration: { ...manifest.effective.configuration, isolation_observation_digest: sha(JSON.stringify(incomplete)) } } }).code, 'ISOLATION_OBSERVATION_INVALID', 'an observation without login_preserved cannot gate a measured launch');
    write(options.root, 'observation.json', raw);
  }
  write(options.root, 'evidence.txt', 'changed');
  assert.equal(gate(measured, manifest).code, 'ISOLATION_EVIDENCE_CHANGED');
  write(options.root, 'evidence.txt', evidence);
  write(options.root, 'substitute.json', raw);
  assert.equal(gate({ ...measured, observationFile: 'substitute.json' }, manifest).code, 'ISOLATION_OBSERVATION_UNBOUND');
  const otherRoot = tempDir();
  fs.mkdirSync(path.join(otherRoot, 'host/claude-config'), { recursive: true });
  write(otherRoot, 'observation.json', raw);
  assert.equal(gate({ ...measured, effective: { ...measured.effective, inputRoot: otherRoot } }, manifest).code, 'ISOLATION_OBSERVATION_UNBOUND');
  const originalRead = fs.readFileSync;
  const controlArea = fs.realpathSync(path.join(options.root, 'host')) + '/.login-custody/';
  for (const protectedPath of ['.env', '.env.local', 'credentials.json', 'auth.json', '.ssh/key', '.aws/config', '.netrc', '.npmrc']) {
    let reads = 0;
    fs.readFileSync = () => { reads += 1; throw new Error('private canary must not be read'); };
    try {
      const refusal = gate({ ...measured, observationFile: protectedPath }, manifest);
      assert.equal(refusal.code, 'ISOLATION_PATH_PROTECTED');
      assert.equal(reads, 0, 'protected observation refused before any file read');
    } finally { fs.readFileSync = originalRead; }
    const hostile = JSON.stringify({ ...observation, evidence: [{ path: protectedPath, digest: sha('private') }] });
    write(options.root, 'observation.json', hostile);
    const allowedObservation = fs.realpathSync(path.join(options.root, 'observation.json'));
    let protectedReads = 0;
    // The launcher's own custody control area is its own; the login directory is not.
    fs.readFileSync = (file, ...args) => {
      const resolved = path.resolve(String(file));
      if (resolved !== allowedObservation && !resolved.startsWith(controlArea)) { protectedReads += 1; throw new Error('private canary must not be read'); }
      return originalRead(file, ...args);
    };
    try {
      assert.equal(gate(measured, manifest).code, 'ISOLATION_PATH_PROTECTED');
      assert.equal(protectedReads, 0, 'protected evidence refused before its read; the login directory is never read');
    } finally { fs.readFileSync = originalRead; }
  }
  write(options.root, 'observation.json', '{PRIVATE_PARSE_ERROR_CANARY');
  const malformed = gate(measured, manifest);
  assert.equal(malformed.code, 'ISOLATION_OBSERVATION_INVALID');
  assert.ok(!malformed.detail.includes('PRIVATE_PARSE_ERROR_CANARY'));
  } finally { allocation.verifyLaunch = originalVerify; }
}

console.log('benchmark environment tests passed (native-login fixtures; native observation remains required)');
