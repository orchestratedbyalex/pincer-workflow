// Account identity and scratch are separate. All account paths below are synthetic;
// these tests do not authenticate, read personal configuration, or start model sessions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const isolation = require('../scripts/delivery-benchmark-v7/isolated-launch.cjs');
const freeze = require('../scripts/delivery-benchmark-v7/freeze.cjs');
const effective = require('../scripts/delivery-benchmark-v7/effective.cjs');
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pincer-account-test-')));
try {
  const home = path.join(root, 'account'), scratch = path.join(root, 'session'), login = path.join(root, 'config');
  for (const dir of [home, scratch, login]) fs.mkdirSync(dir);
  fs.mkdirSync(path.join(scratch, 'tmp'));
  const sentinel = path.join(home, 'personal-sentinel');
  fs.writeFileSync(sentinel, 'preserve me');
  const account = { homedir: home, username: 'fixture-account' };
  const env = isolation.buildCurrentAccountEnvironment(scratch, null, login, account);
  assert.equal(env.HOME, home);
  assert.equal(env.USER, account.username);
  assert.equal(env.LOGNAME, account.username);
  assert.equal(env.CLAUDE_CONFIG_DIR, login);
  assert.equal(env.TMPDIR, path.join(scratch, 'tmp'));
  assert.equal(isolation.supervisorSessionRoot(env), fs.realpathSync(scratch));
  assert.notEqual(isolation.supervisorSessionRoot(env), path.dirname(home));
  assert.deepEqual(Object.keys(env).sort(), ['CLAUDE_CONFIG_DIR','GIT_CONFIG_GLOBAL','GIT_CONFIG_NOSYSTEM','HOME','LANG','LC_ALL','LOGNAME','PATH','TMPDIR','USER', ...(process.platform === 'darwin' ? ['__CF_USER_TEXT_ENCODING'] : [])].sort());
  assert.throws(() => isolation.buildCurrentAccountEnvironment(home, null, login, account), { code: 'SCRATCH_OVERLAPS_HOME' });
  assert.throws(() => isolation.buildCurrentAccountEnvironment(root, null, login, account), { code: 'SCRATCH_OVERLAPS_HOME' });
  assert.throws(() => isolation.buildCurrentAccountEnvironment(scratch, null, login, { homedir: '/', username: 'x' }), { code: 'ACCOUNT_IDENTITY_INVALID' });
  assert.throws(() => isolation.supervisorSessionRoot({ HOME: home }), { code: 'ENVIRONMENT_CHANGED' });
  assert.throws(() => isolation.supervisorSessionRoot({ TMPDIR: 'relative/tmp' }), { code: 'ENVIRONMENT_CHANGED' });
  // A real Node boundary covers the macOS startup environment addition.
  // No login directory or personal configuration is read and no model is invoked.
  const nativeEnv = isolation.buildCurrentAccountEnvironment(scratch, root, login);
  const childProgram = `
    const received = { ...process.env };
    const iso = require(${JSON.stringify(require.resolve('../scripts/delivery-benchmark-v7/isolated-launch.cjs'))});
    const os = require('node:os');
    const original = os.userInfo;
    os.userInfo = () => {
      const account = original();
      // Also exercise post-snapshot runtime mutation on every platform.
      process.env.PINCER_SYNTHETIC_RUNTIME_ADDITION = 'synthetic-runtime-value';
      return account;
    };
    try {
      const approved = iso.validateSupervisorEnvironment(received, process.cwd(), received.CLAUDE_CONFIG_DIR);
      const child = require('node:child_process').spawnSync(process.execPath,
        ['-e', "process.stdout.write(JSON.stringify(Object.keys(process.env).sort()))"],
        { env: approved, encoding: 'utf8' });
      if (child.status !== 0) throw Error('inert child failed');
      process.stdout.write(child.stdout);
    } catch (e) { process.stderr.write(e.code || 'FAILED'); process.exitCode = 1; }
  `;
  const boundary = changes => spawnSync(process.execPath, ['-e', childProgram], {
    cwd: root, env: { ...nativeEnv, ...changes }, encoding: 'utf8'
  });
  assert.throws(() => isolation.validateSupervisorEnvironment({ ...nativeEnv, __CF_USER_TEXT_ENCODING: 'changed' }, root, login), { code: 'ENVIRONMENT_CHANGED' });
  const cleanBoundary = boundary({});
  assert.equal(cleanBoundary.status, 0, cleanBoundary.stderr);
  assert.deepEqual(JSON.parse(cleanBoundary.stdout), Object.keys(nativeEnv).sort(), 'runtime additions never reach the tool');
  for (const change of [{ PINCER_UNEXPECTED_ENV: 'extra' }, { NODE_OPTIONS: '--no-warnings' }, { USER: 'wrong-account' }, { HOME: home }]) {
    const rejected = boundary(change);
    assert.equal(rejected.status, 1, Object.keys(change).join());
    assert.equal(rejected.stderr, 'ENVIRONMENT_CHANGED', 'inherited changes remain refused by name-only error');
  }
  // Drive the retained status reader with an executable that requires all three values.
  const program = `const e=process.env;const ok=e.HOME===${JSON.stringify(home)}&&e.USER==='fixture-account'&&e.LOGNAME==='fixture-account';process.stdout.write(JSON.stringify({loggedIn:ok,authMethod:'claude.ai',apiProvider:'firstParty',subscriptionType:'max',email:'do-not-retain@example.invalid'}));process.exitCode=ok?0:1;`;
  const command = [process.execPath, '-e', program];
  assert.deepEqual(isolation.probeLogin(command, env, scratch, login), { checked:true, logged_in:true, auth_method:'claude.ai', api_provider:'firstParty', subscription_type:'max' });
  for (const key of ['USER', 'LOGNAME']) {
    const changed = { ...env }; delete changed[key];
    assert.throws(() => isolation.probeLogin(command, changed, scratch, login), { code:'LOGIN_REQUIRED' });
  }
  // Exercise the actual pre-workspace gate: the status executable refuses unless the
  // new construction reaches it. No allocation is supplied, so no session can start.
  const study = path.join(root, 'study');
  fs.mkdirSync(path.join(study, 'host/claude-config'), { recursive:true });
  const executable = path.join(root, 'status-fixture');
  fs.writeFileSync(executable, `#!${process.execPath}\n${program}`, { mode:0o755 });
  const manifest = { caps:{turns_per_session:1,wall_clock_minutes:1,spend_usd:1}, effective:{
    model:'claude-fixture-1', tool:{kind:'native',version:'2.1.273'},
    configuration:{isolation_profile:isolation.NATIVE_PROFILE.name,permission_mode:'manual'} } };
  const originalIdentity = os.userInfo;
  os.userInfo = () => account;
  try {
    const gate = isolation.checkNativeReadiness({ effective:{inputRoot:study,input:{tool:{executable}}},
      onGroup:()=>{}, readiness:{purpose:'operational-smoke',usageEnvelopeAgreed:true,projectAccessAuthorized:true,
        hostPolicyPreserved:true,decisionRef:'synthetic-only',billingMode:'subscription'} }, manifest);
    assert.equal(gate.code, 'ALLOCATION_REQUIRED', 'status succeeded before the allocation refusal');
  } finally { os.userInfo = originalIdentity; }
  const old = isolation.LEGACY_NATIVE_PROFILE;
  assert.equal(old.name, 'claude-project-native-login-v1');
  assert.equal(old.home, 'per-session-synthetic-canary');
  const e = { tool: {}, model:'fixture', kit:{}, platform:{} };
  assert.equal(isolation.observationTarget({ effective:{ ...e, configuration:{isolation_profile:old.name} } }), freeze.sha256(effective.canonical({ profile:old, ...e })));
  assert.notEqual(isolation.observationTarget({ effective:{ ...e, configuration:{isolation_profile:old.name} } }), isolation.observationTarget({ effective:{ ...e, configuration:{isolation_profile:isolation.NATIVE_PROFILE.name} } }));
  fs.rmSync(isolation.supervisorSessionRoot(env), { recursive:true });
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'preserve me');
} finally { fs.rmSync(root, { recursive:true, force:true }); }
console.log('current-account environment tests passed (synthetic identity, status, historical target, scratch boundaries)');
