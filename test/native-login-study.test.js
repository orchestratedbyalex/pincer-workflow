// PRD v8 T-121 (R-22, S-64/S-65/S-66): the native-login study path through its real entry
// points, with fixture executables. Every session, status probe and login directory here is
// synthetic. A fixture is not native evidence: nothing below signs into an account, launches
// a model, spends, or observes what the pinned Claude Code CLI does with a real login.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { repo, tempDir, write } from './helpers.js';
const require = createRequire(import.meta.url);
const V7 = path.join(repo, 'scripts/delivery-benchmark-v7');
const isolation = require(path.join(V7, 'isolated-launch.cjs'));
const custody = require(path.join(V7, 'login-custody.cjs'));
const usage = require(path.join(V7, 'usage.cjs'));
const effort = require(path.join(V7, 'effort.cjs'));
const effective = require(path.join(V7, 'effective.cjs'));
const runner = require(path.join(V7, 'orchestrator.cjs'));
const freeze = require(path.join(V7, 'freeze.cjs'));
const { SPEC, REPO } = require(path.join(V7, 'freeze-spec.cjs'));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const read = rel => fs.readFileSync(path.join(repo, rel), 'utf8');
const PRIVATE = 'PRIVATE_CREDENTIAL_BYTES_NEVER_READ';
const EMAIL = 'fixture-person@example.invalid';
const children = new Set();
process.on('exit', () => { for (const child of children) try { process.kill(-child.pid, 'SIGKILL'); } catch {} });
const originalRead = fs.readFileSync, originalOpen = fs.openSync;

// A study root with the login directory the user would have signed into. The credential file
// is synthetic and must never be opened by the launcher.
function study() {
  const root = tempDir();
  fs.mkdirSync(path.join(root, 'host/claude-config'), { recursive: true });
  // Written through the unguarded descriptor API: the guard below counts every later open.
  const fd = originalOpen(path.join(root, 'host/claude-config/.credentials.json'), 'w', 0o600);
  fs.writeSync(fd, JSON.stringify({ synthetic: PRIVATE })); fs.closeSync(fd);
  return root;
}
const loginDir = root => fs.realpathSync(path.join(root, 'host/claude-config'));
const control = root => path.join(fs.realpathSync(root), 'host/.login-custody');
const lockKey = root => `login.${sha(loginDir(root)).slice(0, 32)}`;
const locks = root => fs.existsSync(path.join(control(root), '.claims')) ? fs.readdirSync(path.join(control(root), '.claims')).filter(name => name.startsWith('login.')) : [];
const journals = root => fs.existsSync(path.join(control(root), 'journal')) ? fs.readdirSync(path.join(control(root), 'journal')).map(name => JSON.parse(fs.readFileSync(path.join(control(root), 'journal', name), 'utf8'))) : [];
const marker = root => fs.existsSync(path.join(control(root), 'recovery-required.json'));
function fixture(root, arm = 'plain', extra = {}) {
  const workspace = path.join(root, `workspace-${crypto.randomBytes(3).toString('hex')}`), stateRoot = path.join(root, `state-${crypto.randomBytes(3).toString('hex')}`);
  fs.mkdirSync(workspace); fs.mkdirSync(stateRoot);
  if (arm !== 'plain') for (const rel of ['AGENTS.md', 'CLAUDE.md', '.claude']) fs.cpSync(path.join(repo, 'template', rel), path.join(workspace, rel), { recursive: true });
  return { root, workspace, stateRoot, arm, model: 'claude-synthetic-1', toolVersion: '2.1.273', permissionMode: 'manual',
    caps: { turns_per_session: 5, wall_clock_minutes: 1, spend_usd: 1 }, inputRoot: root, billingMode: 'subscription', prompt: 'Perform the unchanged task.', timeoutMs: 5000, ...extra };
}
const rejectsWith = async (promise, code, check = () => {}) => assert.rejects(promise, error => { assert.equal(error.code, code, error.message); check(error); return true; });
// The launcher never opens the credential file: every in-process read of it fails the suite.
let credentialReads = 0;
const guard = file => { if (String(file).endsWith('/.credentials.json')) { credentialReads += 1; throw new Error('credential file must never be read'); } };
fs.readFileSync = (file, ...args) => { guard(file); return originalRead(file, ...args); };
fs.openSync = (file, ...args) => { guard(file); return originalOpen(file, ...args); };

// --- Cleanup replacement races and exclusive recovery -------------------------------------
{
  const root = study();
  const handle = custody.acquire(root, { regression: 'replacement-after-check' });
  custody.plant(handle, { 'CLAUDE.md': 'owned canary' });
  const target = path.join(loginDir(root), 'CLAUDE.md');
  let replaced = false;
  const outcome = custody.remove(handle, { readFileSync(file) {
    const bytes = fs.readFileSync(file);
    if (!replaced && file === target) {
      replaced = true;
      fs.renameSync(target, `${target}.original`);
      fs.writeFileSync(target, 'replacement must survive');
    }
    return bytes;
  } });
  assert.equal(outcome.recovery_required, true);
  assert.equal(fs.readFileSync(target, 'utf8'), 'replacement must survive');
  const entry = handle.journal.canaries[0];
  assert.equal(fs.readFileSync(entry.quarantine, 'utf8'), 'replacement must survive');
  custody.release(handle, outcome);
  // Once recovery clears its marker, acquisition must STILL fail until its guard releases.
  const originalRm = fs.rmSync;
  let guarded = false;
  fs.rmSync = (file, ...args) => {
    const value = originalRm(file, ...args);
    if (file === path.join(control(root), 'recovery-required.json')) {
      guarded = true;
      assert.throws(() => custody.acquire(root), e => e.code === 'LOGIN_DIR_BUSY');
      assert.throws(() => custody.recover(root, { token: handle.token, reason: 'competing recovery' }), e => e.code === 'RUN_BUSY');
    }
    return value;
  };
  try { custody.recover(root, { token: handle.token, reason: 'Review replacement; preserve it' }); }
  finally { fs.rmSync = originalRm; }
  assert.equal(guarded, true);
  assert.equal(fs.readFileSync(target, 'utf8'), 'replacement must survive');
}
{
  const root = study();
  const handle = custody.acquire(root, { regression: 'rename-before-receipt' });
  custody.plant(handle, { 'CLAUDE.md': 'owned canary' });
  // Fault immediately after atomic rename, before remove can journal completion.
  const result = custody.remove(handle, { renameSync(from, to) { fs.renameSync(from, to); throw new Error('interrupted after rename'); } });
  assert.equal(result.recovery_required, true);
  custody.release(handle, result);
  const recovered = custody.recover(root, { token: handle.token, reason: 'Inspect retained quarantine and finish cleanup' });
  assert.deepEqual(recovered.removed, ['CLAUDE.md']);
  assert.equal(fs.existsSync(path.join(loginDir(root), 'CLAUDE.md')), false);
  assert.equal(fs.readFileSync(handle.journal.canaries[0].quarantine, 'utf8'), 'owned canary');
  const next = custody.acquire(root); custody.requireClean(next.loginDir); custody.release(next);
}
console.log('native-login custody filesystem regressions: ok');

// --- Identities ------------------------------------------------------------------------------
{
  const p = isolation.NATIVE_PROFILE;
  assert.equal(p.name, 'claude-project-native-login-v1');
  assert.equal(p.authentication, 'host-login-config-dir');
  assert.equal(p.login_dir, 'host/claude-config');
  assert.equal(p.status_record, 'claude-auth-status-json-v1');
  assert.equal(p.tool_version, isolation.PROFILE.tool_version, 'the pinned CLI copy is unchanged');
  for (const key of ['setting_sources', 'permission_mode', 'permission_prompts', 'mcp', 'home', 'hook_capture', 'host_policy']) assert.equal(p[key], isolation.PROFILE[key], `${key} unchanged from the historical profile`);
  assert.equal(isolation.PROFILE.authentication, 'anthropic-api-key', 'the historical profile stays readable under its own identity');
  assert.equal(isolation.MEASUREMENT_PROFILE, usage.NATIVE_PROFILE);
  const base = { effective: { tool: { name: 'claude-code', kind: 'native', version: '2.1.273', digest: 'a'.repeat(64) }, model: 'claude-x-1', kit: { digest: 'b'.repeat(64), commit: 'c'.repeat(40) }, platform: { os: 'darwin' }, configuration: {} } };
  const target = name => isolation.observationTarget({ effective: { ...base.effective, configuration: { isolation_profile: name } } });
  assert.equal(target(isolation.PROFILE.name), freeze.sha256(effective.canonical({ profile: isolation.PROFILE, tool: base.effective.tool, model: base.effective.model, kit: base.effective.kit, platform: base.effective.platform })), 'historical observation targets are computed exactly as before');
  assert.notEqual(target(isolation.PROFILE.name), target(isolation.NATIVE_PROFILE.name), 'the native profile is a new observation target');
  assert.throws(() => target('claude-project-native-login-v2'), /reviewed contract/);
  assert.equal(isolation.overridePresent({ PATH: '/bin', ANTHROPIC_BASE_URL: 'x' }), 'ANTHROPIC_BASE_URL');
  assert.equal(isolation.overridePresent({ PATH: '/bin', GITHUB_TOKEN: 'ci' }), null, 'unrelated tokens in a CI shell are not a Claude billing override');
  const contract = read('docs/prd-v8-native-tool-contracts.md');
  for (const name of isolation.CREDENTIAL_ENV) assert.ok(contract.includes(`\`${name}\``), `refusal list is the contract's: ${name}`);
  assert.deepEqual(custody.CANARY_FILES, ['settings.json', 'CLAUDE.md']);
  for (const name of custody.DIRTY_ENTRIES) assert.ok(contract.includes(`\`${name}${/^[a-z]+$/.test(name) ? '/' : ''}\``), `dirty entry named by the contract: ${name}`);
}

// --- The fixture entry point: a clean native-login session ----------------------------------
{
  const root = study();
  const options = fixture(root, 'pincer', { logDir: path.join(root, 'captures'), name: 'S1', fixtureStatus: 'unsanitized' });
  let loginGroupRegistered = false;
  options.onGroup = ({ pgid }) => {
    const claim = JSON.parse(fs.readFileSync(path.join(control(root), '.claims', `${lockKey(root)}.json`), 'utf8'));
    assert.ok(claim.groups.includes(pgid), 'login claim owns the detached group before the caller permits tool startup');
    loginGroupRegistered = true;
  };
  const result = await isolation.observeFixture(options);
  assert.equal(loginGroupRegistered, true);
  assert.equal(result.status, 0, result.stderr);
  const observed = JSON.parse(result.stdout);
  assert.equal(observed.config_dir, loginDir(root), 'the tool reads its login from the study login directory');
  assert.deepEqual(observed.credential_names, []);
  assert.deepEqual(observed.login_dir_entries, ['.credentials.json', 'CLAUDE.md', 'settings.json'], 'owned canaries present during the session');
  assert.deepEqual(fs.readdirSync(loginDir(root)), ['.credentials.json'], 'and removed afterwards, one file at a time');
  const e = result.environment;
  assert.deepEqual(e.authentication, { checked: true, logged_in: true, auth_method: 'claude.ai', api_provider: 'firstParty', subscription_type: 'max' }, 'exactly the sanitized status fields');
  const serialized = JSON.stringify(result);
  for (const leak of [EMAIL, 'org_fixture', 'Fixture Org', PRIVATE]) assert.ok(!serialized.includes(leak), `never retained: ${leak}`);
  assert.deepEqual(e.billing, { mode: 'subscription', attributable_charge_usd: null, charge_reason: 'SUBSCRIPTION_NOT_ATTRIBUTABLE', charge_evidence: null }, 'unavailable subscription billing is expected and labelled');
  assert.equal(e.account_limit, null);
  assert.equal(e.measurement_profile, usage.NATIVE_PROFILE);
  assert.equal(e.tool_surface, 'claude-code');
  assert.deepEqual(e.env_names, ['CLAUDE_CONFIG_DIR', 'CLAUDE_PROJECT_DIR', 'GIT_CONFIG_GLOBAL', 'GIT_CONFIG_NOSYSTEM', 'HOME', 'LANG', 'LC_ALL', 'PATH', 'TMPDIR']);
  assert.equal(e.isolation_canary.leak_detected, false);
  assert.equal(e.hook_evidence.status, 'sufficient');
  assert.deepEqual(e.login_directory.canary, { planted: 2, removed: 2, preserved: [] });
  assert.equal(e.login_directory.recovery_required, false);
  assert.equal(result.reportable, false, 'a fixture is never reportable');
  assert.deepEqual(locks(root), [], 'custody released');
  assert.equal(marker(root), false);
  const [journal] = journals(root);
  assert.equal(journal.state, 'released');
  assert.equal(journal.owner.pid, process.pid);
  assert.ok(journal.owner.process_start, 'owner identity includes process start');
  assert.deepEqual(journal.canaries.map(c => [c.name, c.state]), [['settings.json', 'removed'], ['CLAUDE.md', 'removed']]);
  assert.ok(journal.canaries.every(c => /^[a-f0-9]{64}$/.test(c.digest) && Number.isSafeInteger(c.ino)), 'each owned file journaled by identity and synthetic digest');
  assert.equal(credentialReads, 0, 'the credential file was never opened');
  // An api-billed console login is valid only when declared as such.
  const api = await isolation.observeFixture(fixture(root, 'plain', { fixtureStatus: 'console', billingMode: 'api' }));
  assert.equal(api.environment.billing.charge_reason, 'CHARGE_EVIDENCE_MISSING', 'no charge is ever derived from the estimate');
  assert.equal(api.environment.authentication.subscription_type, null);
}

// --- Login and billing refusals, before any task -------------------------------------------
{
  const root = study();
  await rejectsWith(isolation.observeFixture(fixture(root, 'plain', { fixtureStatus: 'logged-out' })), 'LOGIN_REQUIRED', error => {
    assert.ok(error.message.includes(`CLAUDE_CONFIG_DIR=${loginDir(root)} claude auth login`), error.message);
    assert.doesNotMatch(error.message, /API|key|token/i, 'no key hint, no fallback');
  });
  assert.deepEqual(fs.readdirSync(loginDir(root)), ['.credentials.json'], 'nothing planted before the login is confirmed');
  assert.deepEqual(locks(root), []);
  // Signed in at the pre-workspace probe, signed out by session time: refused, nothing launched.
  const lost = fixture(root, 'plain', { fixtureStatus: 'session-logged-out' });
  const refusal = await isolation.observeFixture(lost);
  assert.equal(refusal.refused, true); assert.equal(refusal.code, 'LOGIN_REQUIRED');
  assert.deepEqual(fs.readdirSync(lost.stateRoot), [], 'no tool ran');
  assert.deepEqual(fs.readdirSync(loginDir(root)), ['.credentials.json']);
  assert.equal(refusal.login_directory.recovery_required, false);
  await rejectsWith(isolation.observeFixture(fixture(root, 'plain', { fixtureStatus: 'console' })), 'BILLING_MODE_MISMATCH');
  await rejectsWith(isolation.observeFixture(fixture(root, 'plain', { fixtureStatus: 'subscription', billingMode: 'api' })), 'BILLING_MODE_MISMATCH');
  await rejectsWith(isolation.observeFixture(fixture(root, 'plain', { fixtureStatus: 'malformed' })), 'LOGIN_STATUS_INVALID', error => assert.ok(!error.message.includes(EMAIL), 'raw status output is never echoed'));
  await rejectsWith(isolation.observeFixture(fixture(root, 'plain', { fixtureStatus: 'exit-2' })), 'LOGIN_STATUS_INVALID');
  await rejectsWith(isolation.observeFixture(fixture(root, 'plain', { fixtureStatus: 'unknown-method' })), 'PROFILE_INCOMPATIBLE');
  for (const name of isolation.CREDENTIAL_ENV) {
    process.env[name] = 'synthetic-override-value-not-a-key';
    try {
      await rejectsWith(isolation.observeFixture(fixture(root)), 'BILLING_OVERRIDE_PRESENT', error => { assert.ok(error.message.includes(name)); assert.ok(!error.message.includes('synthetic-override-value')); });
      assert.equal(process.env[name], 'synthetic-override-value-not-a-key', 'the launching shell is not edited');
    } finally { delete process.env[name]; }
  }
  assert.deepEqual(locks(root), []);
  assert.equal(journals(root).every(j => j.state === 'released'), true);
}

// --- Dirty or invalid login directories ------------------------------------------------------
{
  const root = study();
  for (const [entry, dirty] of [['settings.json', true], ['settings.local.json', true], ['CLAUDE.md', true], ['hooks', true], ['plugins', true], ['.mcp.json', true], ['notes.txt', true], ['statsig', false], ['todos', false], ['.claude.json', false], ['history.jsonl', false]]) {
    const target = path.join(loginDir(root), entry);
    if (/\./.test(entry) && !['statsig', 'todos', 'hooks', 'plugins'].includes(entry)) fs.writeFileSync(target, '{}'); else fs.mkdirSync(target);
    try {
      if (dirty) await rejectsWith(isolation.observeFixture(fixture(root)), 'PROFILE_HOST_DIRTY', error => assert.ok(error.message.includes(entry), error.message));
      else assert.equal((await isolation.observeFixture(fixture(root))).status, 0, `${entry} is the CLI's own state`);
    } finally { fs.rmSync(target, { recursive: true, force: true }); }
    assert.deepEqual(locks(root), []);
  }
  fs.symlinkSync(path.join(root, 'elsewhere'), path.join(loginDir(root), 'CLAUDE.md'));
  await rejectsWith(isolation.observeFixture(fixture(root)), 'PROFILE_HOST_DIRTY', error => assert.match(error.message, /symbolic link/));
  fs.unlinkSync(path.join(loginDir(root), 'CLAUDE.md'));
  const missing = tempDir();
  await rejectsWith(isolation.observeFixture(fixture(missing)), 'LOGIN_DIR_INVALID', error => assert.match(error.message, /host\/claude-config/));
  const linked = tempDir();
  fs.mkdirSync(path.join(linked, 'host'));
  fs.symlinkSync(loginDir(root), path.join(linked, 'host/claude-config'));
  await rejectsWith(isolation.observeFixture(fixture(linked)), 'LOGIN_DIR_INVALID');
  const inHome = study();
  const originalHomedir = os.homedir;
  try {
    os.homedir = () => inHome;
    assert.throws(() => custody.loginDirectory(inHome), error => { assert.equal(error.code, 'LOGIN_DIR_INVALID'); assert.match(error.message, /operator home/); return true; });
  } finally { os.homedir = originalHomedir; }

}

// --- Replaced canary, cleanup fault, recovery, then a clean next session --------------------
{
  const root = study();
  const replaced = await isolation.observeFixture(fixture(root, 'plain', { mode: 'replace-login-canary' }));
  assert.equal(replaced.status, 0);
  assert.equal(replaced.login_dir_recovery_required, true);
  assert.equal(replaced.reportable, false);
  assert.ok(replaced.unreportable.includes('login directory custody requires recovery'));
  assert.deepEqual(replaced.environment.login_directory.canary, { planted: 2, removed: 1, preserved: ['CLAUDE.md'] });
  assert.equal(fs.readFileSync(path.join(loginDir(root), 'CLAUDE.md'), 'utf8'), 'replaced by the fixture tool\n', 'the changed file is preserved, never deleted');
  assert.equal(marker(root), true);
  assert.deepEqual(locks(root), [], 'custody is released only after the durable recovery marker');
  await rejectsWith(isolation.observeFixture(fixture(root)), 'LOGIN_DIR_RECOVERY_REQUIRED');
  const token = journals(root).find(j => j.state === 'recovery-required').owner.token;
  assert.throws(() => custody.recover(root, { token, reason: '' }), /bounded operator reason/);
  const recovered = custody.recover(root, { token, reason: 'Reviewed the replaced file; keeping it for inspection' });
  assert.deepEqual(recovered.preserved.map(p => p.name), ['CLAUDE.md'], 'recovery preserves altered files');
  assert.equal(marker(root), false);
  await rejectsWith(isolation.observeFixture(fixture(root)), 'PROFILE_HOST_DIRTY', error => assert.ok(error.message.includes('CLAUDE.md')), 'the preserved file keeps the directory dirty until a person removes it');
  fs.unlinkSync(path.join(loginDir(root), 'CLAUDE.md'));
  assert.equal((await isolation.observeFixture(fixture(root))).status, 0, 'a clean next session follows the manual removal');
  // A deletion fault preserves both owned files and stops; recovery removes them once verified.
  const faulted = await isolation.observeFixture(fixture(root, 'plain', { fixtureCustodyIO: { renameSync: () => { const error = new Error('EIO'); error.code = 'EIO'; throw error; } } }));
  assert.equal(faulted.login_dir_recovery_required, true);
  assert.deepEqual(fs.readdirSync(loginDir(root)).sort(), ['.credentials.json', 'CLAUDE.md', 'settings.json']);
  const faultToken = journals(root).find(j => j.state === 'recovery-required').owner.token;
  const cleaned = custody.recover(root, { token: faultToken, reason: 'Cleanup fault reviewed' });
  assert.deepEqual(cleaned.removed.sort(), ['CLAUDE.md', 'settings.json']);
  assert.deepEqual(cleaned.preserved, []);
  assert.deepEqual(fs.readdirSync(loginDir(root)), ['.credentials.json']);
  assert.equal((await isolation.observeFixture(fixture(root))).status, 0, 'recovery followed by a clean next session');
  assert.throws(() => custody.recover(root, { token: 'f'.repeat(32), reason: 'no such owner' }), /missing or unreadable/);
}

// --- Competing invocations, aliases and interruption ----------------------------------------
{
  const root = study();
  const alias = process.platform === 'darwin' && fs.realpathSync(root) !== root ? fs.realpathSync(root) : `${root}${path.sep}.`;
  const worker = path.join(tempDir(), 'custody-worker.cjs');
  fs.writeFileSync(worker, `
const custody = require(${JSON.stringify(path.join(V7, 'login-custody.cjs'))});
const [root, mode] = process.argv.slice(2);
try {
  const handle = custody.acquire(root, { worker: mode });
  process.stdout.write('acquired');
  if (mode === 'hold') setTimeout(() => { custody.release(handle); process.exit(0); }, 700);
  else if (mode === 'crash-with-child') {
    const fs = require('node:fs'), path = require('node:path');
    const child = require('node:child_process').spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore' });
    custody.registerGroup(handle, { pid: child.pid, pgid: child.pid });
    fs.writeFileSync(path.join(root, 'child-pid'), String(child.pid));
    process.kill(process.pid, 'SIGKILL');
  }
  else if (mode === 'crash-after-receipt') { custody.plant(handle, { 'CLAUDE.md': 'worker canary\\n' }); process.kill(process.pid, 'SIGKILL'); }
  else if (mode === 'crash-before-receipt') custody.plant(handle, { 'CLAUDE.md': 'worker canary\\n' }, { afterWrite: () => process.kill(process.pid, 'SIGKILL') });
} catch (error) { process.stdout.write(error.code || 'ERROR'); process.exitCode = 1; }
`);
  const run = (arg, mode) => new Promise(resolve => {
    const child = spawn(process.execPath, [worker, arg, mode], { detached: true, stdio: ['ignore', 'pipe', 'ignore'] });
    children.add(child); let out = '';
    child.stdout.on('data', d => { out += d; });
    child.on('exit', () => { children.delete(child); resolve(out); });
  });
  const orphanRoot = study();
  await run(orphanRoot, 'crash-with-child');
  const orphanPid = Number(fs.readFileSync(path.join(orphanRoot, 'child-pid'), 'utf8'));
  try {
    const orphanJournal = journals(orphanRoot)[0];
    assert.throws(() => custody.recover(orphanRoot, { token: orphanJournal.owner.token, reason: 'owner died but child remains' }), /recovery is blocked/);
    assert.equal(custody.status(orphanRoot).owner_state, 'unknown');
    assert.equal(locks(orphanRoot).length, 1, 'live detached session retains login custody after owner death');
  } finally { try { process.kill(-orphanPid, 'SIGKILL'); } catch {} }
  const [a, b] = await Promise.all([run(root, 'hold'), run(alias, 'hold')]);
  assert.deepEqual([a, b].sort(), ['LOGIN_DIR_BUSY', 'acquired'], 'two spellings of one login directory share one lock; exactly one wins');
  const holder = spawn(process.execPath, [worker, root, 'hold'], { detached: true, stdio: ['ignore', 'pipe', 'ignore'] }); children.add(holder);
  await new Promise(resolve => holder.stdout.once('data', resolve));
  await rejectsWith(isolation.observeFixture(fixture(root)), 'LOGIN_DIR_BUSY');
  await new Promise(resolve => holder.on('exit', resolve)); children.delete(holder);
  assert.equal((await isolation.observeFixture(fixture(root))).status, 0, 'a released lock admits the next session');
  // Crash after the receipt: the owned canary is journaled as created; nobody steals the lock.
  await run(root, 'crash-after-receipt');
  assert.deepEqual(fs.readdirSync(loginDir(root)).sort(), ['.credentials.json', 'CLAUDE.md']);
  assert.equal(locks(root).length, 1, 'the dead owner still holds the lock');
  await rejectsWith(isolation.observeFixture(fixture(root)), 'LOGIN_DIR_RECOVERY_REQUIRED', error => assert.match(error.message, /explicit recovery decision/));
  assert.deepEqual(fs.readdirSync(loginDir(root)).sort(), ['.credentials.json', 'CLAUDE.md'], 'the refused launch touches nothing');
  let dead = journals(root).find(j => j.canaries.some(c => c.state === 'created'));
  assert.throws(() => custody.recover(root, { token: 'a'.repeat(32), reason: 'wrong owner' }), /missing or unreadable/);
  const first = custody.recover(root, { token: dead.owner.token, reason: 'Worker killed under test; canary verified unchanged' });
  assert.deepEqual(first.removed, ['CLAUDE.md']); assert.deepEqual(first.preserved, []);
  assert.deepEqual(locks(root), []);
  assert.equal((await isolation.observeFixture(fixture(root))).status, 0, 'recovery, then a clean next session');
  // Crash between the exclusive write and its receipt: ownership is uncertain, so the file
  // is preserved and the directory stays dirty for a person to review.
  await run(root, 'crash-before-receipt');
  dead = journals(root).find(j => j.canaries.some(c => c.state === 'intended'));
  assert.ok(dead, 'the intent was journaled before the write');
  await rejectsWith(isolation.observeFixture(fixture(root)), 'LOGIN_DIR_RECOVERY_REQUIRED');
  const second = custody.recover(root, { token: dead.owner.token, reason: 'Worker killed before its receipt' });
  assert.deepEqual(second.removed, []);
  assert.deepEqual(second.preserved.map(p => p.name), ['CLAUDE.md']);
  assert.match(second.preserved[0].detail, /ownership uncertain/);
  assert.equal(fs.existsSync(path.join(loginDir(root), 'CLAUDE.md')), true, 'preserved, never deleted');
  await rejectsWith(isolation.observeFixture(fixture(root)), 'PROFILE_HOST_DIRTY');
  fs.unlinkSync(path.join(loginDir(root), 'CLAUDE.md'));
  assert.equal((await isolation.observeFixture(fixture(root))).status, 0);
  // An owner whose identity cannot be established blocks both launch and recovery.
  const lockFile = path.join(control(root), '.claims', `${lockKey(root)}.json`);
  const foreign = { schema: 1, key: lockKey(root), token: 'b'.repeat(32), pid: 4242, host: 'another-host.invalid', group: 4242, groups: [], created: new Date().toISOString(), purpose: 'login directory custody' };
  fs.writeFileSync(lockFile, `${JSON.stringify(foreign)}\n`);
  write(path.join(control(root), 'journal'), `${foreign.token}.json`, JSON.stringify({ schema: 1, kind: 'login-directory-custody', login_dir: loginDir(root), login_dir_digest: sha(loginDir(root)), owner: { ...foreign, process_start: null, process_start_ps: null }, ids: {}, created: foreign.created, state: 'held', canaries: [], receipts: [] }));
  await rejectsWith(isolation.observeFixture(fixture(root)), 'LOGIN_DIR_BUSY');
  assert.throws(() => custody.recover(root, { token: foreign.token, reason: 'attempted steal' }), /recovery is blocked/);
  fs.unlinkSync(lockFile);
  assert.equal(custody.status(root).held, false);
}

// --- The orchestrator: usage envelope grammar, override refusal, native planning -------------
{
  assert.deepEqual(effective.parseArgs(['--i-agreed-the-usage-envelope']), { 'i-agreed-the-usage-envelope': true });
  assert.throws(() => effective.parseArgs(['--i-have-a-spending-cap']), /renamed: --i-agreed-the-usage-envelope/);
  const inputRoot = tempDir(), runs = path.join(tempDir(), 'smoke');
  write(inputRoot, 'inputs/kits/kit.tgz', 'fixture archive identity');
  write(inputRoot, 'browser/index.cjs', 'module.exports = {};\n');
  write(inputRoot, 'runtime/browser', 'browser binary');
  fs.mkdirSync(path.join(inputRoot, 'host/claude-config'), { recursive: true });
  const executable = path.join(inputRoot, 'inputs/tool/version-probe');
  fs.mkdirSync(path.dirname(executable), { recursive: true });
  fs.writeFileSync(executable, effective.versionProbeFixture('2.1.273'), { mode: 0o755 });
  write(inputRoot, 'inputs.json', JSON.stringify({
    model: 'claude-example-1', tool: { executable, version: '2.1.273', kind: 'version-probe-fixture' },
    caps: { turns_per_session: 3, wall_clock_minutes: 2, spend_usd: 1 },
    kit: { path: 'inputs/kits/kit.tgz', commit: 'a'.repeat(40) },
    browser: { entry: 'browser/index.cjs', roots: ['browser'], runtime: { name: 'chromium', version: '1.2.3', path: 'runtime' } },
    configuration: { permission_mode: 'manual', cwd_kind: 'scratch', isolation_profile: isolation.NATIVE_PROFILE.name },
  }));
  write(inputRoot, 'study.json', JSON.stringify({ schema: 2, kind: 'pincer-study-readiness', execution: null, projects: null, kits: null, schedule: null, reviewers: null, authorization: null, allocation: null, stop_resume: null, evidence: {} }));
  const documented = ['--runs', runs, '--execution-inputs', path.join(inputRoot, 'inputs.json'), '--input-root', inputRoot,
    '--study-manifest', path.join(inputRoot, 'study.json'), '--study-input-root', inputRoot,
    '--study-purpose', 'operational-smoke', '--repetitions', '1', '--briefs', 'ui-states', '--plan-only'];
  const clean = Object.fromEntries(Object.entries(process.env).filter(([name]) => !isolation.CREDENTIAL_ENV.includes(name)));
  const cli = (args, env = clean) => spawnSync(process.execPath, [path.join(V7, 'orchestrator.cjs'), ...args], { encoding: 'utf8', env });
  const withKey = cli(documented, { ...clean, ANTHROPIC_API_KEY: 'synthetic-value-never-printed' });
  assert.equal(withKey.status, 3, withKey.stderr);
  assert.match(withKey.stderr, /ANTHROPIC_API_KEY is set in the launching environment/);
  assert.ok(!withKey.stderr.includes('synthetic-value'), 'the value is never read');
  assert.equal(fs.existsSync(runs), false, 'nothing planned');
  const oldFlag = cli([...documented, '--i-have-a-spending-cap']);
  assert.equal(oldFlag.status, 2); assert.match(oldFlag.stderr, /renamed/);
  const planned = cli(documented);
  assert.equal(planned.status, 0, planned.stderr);
  assert.match(planned.stdout, /3 cells, 3 newly planned/);
  const records = fs.readdirSync(runs, { recursive: true }).filter(name => name.endsWith('record.json')).map(name => JSON.parse(fs.readFileSync(path.join(runs, name), 'utf8')));
  assert.equal(records.length, 3);
  for (const record of records) {
    assert.equal(record.environment.isolation_profile, isolation.NATIVE_PROFILE.name);
    assert.equal(record.environment.measurement_profile, usage.NATIVE_PROFILE, 'a native cohort is measured under the native profile from the plan on');
    assert.equal(record.environment.tool_surface, 'claude-code');
    assert.deepEqual(effort.problems(record), []);
  }
  const help = cli(['--help']);
  assert.match(help.stdout, /--i-agreed-the-usage-envelope/); assert.doesNotMatch(help.stdout, /i-have-a-spending-cap/);
  assert.match(help.stdout, /host\/claude-config/);
  const source = read('scripts/delivery-benchmark-v7/orchestrator.cjs') + read('scripts/delivery-benchmark-v7/isolated-launch.cjs');
  assert.ok(!/process\.env\.ANTHROPIC_API_KEY/.test(source) && !/ANTHROPIC_API_KEY:/.test(source), 'no credential variable is read or constructed');
}

// --- The orchestration path: subscription unavailability vs missing evidence, limits, custody ---
{
  const readiness = require(path.join(V7, 'readiness.cjs'));
  const allocator = require(path.join(V7, 'allocation.cjs'));
  const briefs = require(path.join(V7, 'briefs.cjs'));
  const harness = require(path.join(V7, 'harness.cjs'));
  const saved = { inspect: readiness.inspectStudy, current: effective.assertCurrent, preflight: isolation.preflightExecution, release: isolation.releaseCustody, launch: isolation.launchNative, reserve: allocator.reserve, reconcile: allocator.reconcile, evaluate: harness.evaluateCandidate };
  const cohort = 'a'.repeat(64);
  try {
    for (const scenario of ['subscription-complete', 'missing-capture', 'account-limit', 'login-lost', 'recovery-required', 'api-charge-unavailable']) {
      const runs = tempDir(), inputRoot = tempDir(), baseWorkspace = tempDir();
      harness.prepare(baseWorkspace, 'scope-revision', { arm: 'plain' });
      const base = harness.git(baseWorkspace, 'rev-parse', 'HEAD');
      fs.writeFileSync(path.join(inputRoot, 'kit.tgz'), 'fixture');
      const billingMode = scenario === 'api-charge-unavailable' ? 'api' : 'subscription';
      const provenance = Object.fromEntries(['prompts', 'driver', 'collector', 'evaluator', 'protocol', 'caps', 'configuration'].map(key => [key, 'b'.repeat(64)]));
      const plan = runner.plan(runs, { cohort, ids: ['scope-revision'], provenance, environment: { isolation_profile: isolation.NATIVE_PROFILE.name, measurement_profile: usage.NATIVE_PROFILE, tool_surface: 'claude-code' } });
      const cell = plan.cells.find(cell => cell.arm === 'plain' && cell.repetition === 1);
      const run = 'scope-revision/rep-1/plain';
      const prompts = briefs.loadBrief('scope-revision').prompts;
      const sessions = prompts.map(prompt => ({ id: prompt.name, run, name: prompt.name, arm: 'plain', project: 'approved', effective_digest: cohort, prompt_digest: effort.sha256(prompt.prompt) }));
      readiness.inspectStudy = () => ({ ready: true, launchGrant: { inputRoot, observationFile: null, allocation: { root: runs, id: 'v8-native-smoke-1', billing_mode: billingMode }, billing: { mode: billingMode, tool_surface: 'claude-code', status_record_contract: 'claude-auth-status-json-v1' },
        execution: { effective_digest: cohort }, sessions, decision: { ref: 'controlled-decision' }, projects: [{ id: 'approved', base }] } });
      const manifest = { cohort, effective: { model: 'synthetic' }, caps: { turns_per_session: 5, wall_clock_minutes: 1 } };
      effective.assertCurrent = () => manifest;
      const handle = { claim: { fixture: true }, token: 'c'.repeat(32) };
      let preflights = [], releases = [], launches = 0, reconciledWith = null, launched = null;
      isolation.preflightExecution = options => { preflights.push({ holdCustody: options.holdCustody, billingMode: options.readiness.billingMode, envelope: options.readiness.usageEnvelopeAgreed }); return { ok: true, custody: handle, acquired: true, billing: { mode: billingMode } }; };
      isolation.releaseCustody = (h, outcome) => { releases.push({ same: h === handle, outcome }); return { at: 'now' }; };
      allocator.reserve = () => ({ fixture: true });
      // The ledger's own account-limit stop is exercised below; here the orchestrator's branch is.
      allocator.reconcile = options => { reconciledWith = options.result; return { stopped: scenario === 'recovery-required' }; };
      isolation.launchNative = async options => {
        launches++; launched = options;
        fs.mkdirSync(options.logDir, { recursive: true });
        if (scenario === 'login-lost') return { refused: true, status: 3, code: 'LOGIN_REQUIRED', stderr: 'LOGIN_REQUIRED: not signed in', reportable: false, cleanup_complete: true, ended: new Date().toISOString() };
        const payload = { type: 'result', subtype: 'success', is_error: false, total_cost_usd: 0.1, duration_api_ms: 6000, ...(scenario === 'missing-capture' ? {} : { modelUsage: { synthetic: { inputTokens: 100, outputTokens: 20, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 } } }) };
        if (scenario === 'account-limit') Object.assign(payload, { subtype: 'error_during_execution', is_error: true, error: "You've hit your weekly limit" });
        fs.writeFileSync(path.join(options.logDir, `${options.name}.json`), JSON.stringify(payload));
        const limit = scenario === 'account-limit' ? { kind: 'weekly', at: new Date().toISOString() } : null;
        const recovery = scenario === 'recovery-required';
        return { status: scenario === 'account-limit' ? 1 : 0, end: scenario === 'account-limit' ? 'failed' : 'completed', cleanup_complete: true, reportable: false,
          unreportable: recovery ? ['login directory custody requires recovery'] : [], observation: 'operational-smoke', limit: limit !== null, account_limit: limit,
          login_dir_recovery_required: recovery, evidence_retention_failed: false, review_required: recovery, ended: new Date().toISOString(),
          environment: { fixture: true, tool: 'synthetic-native-boundary', isolation_profile: isolation.NATIVE_PROFILE.name, measurement_profile: usage.NATIVE_PROFILE, tool_surface: 'claude-code',
            authentication: { checked: true, logged_in: true, auth_method: billingMode === 'api' ? 'console' : 'claude.ai', api_provider: 'firstParty', subscription_type: billingMode === 'api' ? null : 'max' },
            billing: { mode: billingMode, attributable_charge_usd: null, charge_reason: billingMode === 'api' ? 'CHARGE_EVIDENCE_MISSING' : 'SUBSCRIPTION_NOT_ATTRIBUTABLE', charge_evidence: null }, account_limit: limit } };
      };
      harness.evaluateCandidate = async () => ({ outcome: 'accepted', checks: [{ id: 'controlled-independent-check', result: 'passed', independent: true }] });
      const out = await runner.driveRun(runs, cell, { cohort, usageEnvelopeAgreed: true, model: 'synthetic', maxTurns: 5, wallClockMinutes: 1,
        kit: fs.realpathSync(path.join(inputRoot, 'kit.tgz')), effective: { manifest, inputRoot, input: { kit: { path: 'kit.tgz' } } },
        allocation: { manifestPath: path.join(inputRoot, 'study.json'), inputRoot, purpose: 'operational-smoke' } });
      assert.equal(launches, 1, scenario);
      assert.deepEqual(preflights, [{ holdCustody: true, billingMode, envelope: true }], `${scenario}: custody is taken before the workspace and held`);
      assert.equal(launched.custody, handle, 'the held custody handle reaches the launcher');
      assert.equal(launched.readiness.billingMode, billingMode);
      assert.equal(releases.length, 1, `${scenario}: custody released exactly once, after the session`);
      assert.equal(releases[0].same, true);
      assert.equal(releases[0].outcome.recovery_required, scenario === 'recovery-required');
      const record = out.record;
      if (scenario === 'login-lost') { assert.equal(out.refused, true); assert.match(out.detail, /refused before invocation/); continue; }
      assert.equal(record.status, 'invalid', scenario);
      assert.deepEqual(effort.problems(record), [], `${scenario}: ${JSON.stringify(effort.problems(record))}`);
      assert.equal(record.measurement.profile, usage.NATIVE_PROFILE);
      assert.equal(record.measurement.billing.mode, billingMode);
      assert.equal(record.reported.cost_usd, null, 'the legacy cost column is never filled from an estimate');
      if (scenario === 'subscription-complete') {
        assert.equal(record.reported.estimate_usd, 0.1, 'the list-price estimate is reported as an estimate');
        assert.equal(record.reported.tokens, 120);
        assert.equal(record.reported.provider_minutes, 0.1);
        assert.match(record.unavailable.cost_usd, /SUBSCRIPTION_NOT_ATTRIBUTABLE/);
        assert.equal(record.unavailable.tokens, undefined, 'a complete capture leaves no missing observation');
        assert.match(record.reason, /Operational smoke session/);
        assert.equal(effort.report(record).estimate_usd, 0.1);
        assert.equal(effort.report(record).billing.charge_reason, 'SUBSCRIPTION_NOT_ATTRIBUTABLE');
        const agg = effort.aggregate([effort.report(record)]);
        assert.equal(agg.arms.plain.estimate_usd.measured_subtotal, 0.1);
        assert.equal(agg.arms.plain.cost_usd.total, null);
        assert.match(agg.arms.plain.cost_usd.limitation, /no attributable cost/);
      }
      if (scenario === 'api-charge-unavailable') { assert.equal(record.reported.estimate_usd, 0.1); assert.match(record.unavailable.cost_usd, /CHARGE_EVIDENCE_MISSING/); }
      if (scenario === 'missing-capture') {
        assert.equal(record.reported.tokens, null, 'a missing mandatory capture is missing');
        assert.match(record.unavailable.tokens, /Provider field missing/);
        assert.equal(record.reported.estimate_usd, 0.1);
        assert.match(record.unavailable.cost_usd, /SUBSCRIPTION_NOT_ATTRIBUTABLE/, 'and is distinct from the expected subscription unavailability');
      }
      if (scenario === 'account-limit') {
        assert.match(record.reason, /account limit during S1 \(weekly\); the schedule stopped/);
        assert.equal(out.stop, true);
        assert.deepEqual(reconciledWith.account_limit.kind, 'weekly', 'the allocator sees the classified limit');
        assert.equal(record.environment.account_limit.kind, 'weekly');
      }
      if (scenario === 'recovery-required') {
        assert.equal(reconciledWith.login_dir_recovery_required, true, 'the allocator sees the custody outcome');
        assert.match(record.reason, /allocation stopped/);
        assert.equal(out.stop, true);
      }
    }
  } finally {
    readiness.inspectStudy = saved.inspect; effective.assertCurrent = saved.current; isolation.preflightExecution = saved.preflight; isolation.releaseCustody = saved.release;
    isolation.launchNative = saved.launch; allocator.reserve = saved.reserve; allocator.reconcile = saved.reconcile; harness.evaluateCandidate = saved.evaluate;
  }
}

// --- The allocation ledger under a schema-2 grant ---------------------------------------------
{
  const home = tempDir(), moduleRoot = path.join(home, 'scripts/delivery-benchmark-v7');
  fs.mkdirSync(path.dirname(moduleRoot), { recursive: true });
  fs.cpSync(V7, moduleRoot, { recursive: true });
  fs.mkdirSync(path.join(home, 'tickets'));
  const receipt = '2026-09-20T00:00:00Z', command = 'node --version\n', blockHash = sha(command).slice(0, 12);
  for (const name of fs.readdirSync(path.join(repo, 'tickets')).filter(name => /^T-1(?:0[1-9]|21)-/.test(name))) {
    fs.writeFileSync(path.join(home, 'tickets', name), `---\nstatus: done\nlast_check: ${receipt} passed ${blockHash}\nverified: ${receipt} ${blockHash}\nfinished: ${receipt}\n---\n\n## Verification\n\`\`\`bash\n${command}\`\`\`\n`);
  }
  fs.writeFileSync(path.join(moduleRoot, 'readiness.cjs'), "exports.inspectStudy=o=>({launchGrant:JSON.parse(require('fs').readFileSync(o.manifestPath))});");
  const api = require(path.join(moduleRoot, 'allocation.cjs')), claims = require(path.join(moduleRoot, 'run-claims.cjs')), attemptsModule = require(path.join(moduleRoot, 'attempts.cjs')), effortCopy = require(path.join(moduleRoot, 'effort.cjs'));
  const runs = path.join(home, 'runs'); fs.mkdirSync(runs);
  const session = { id: 'attempt-000001:S1', run: 'fixture/rep-1/plain', attempt: 'attempt-000001', name: 'S1', payload: 'fixture/rep-1/plain/attempts/attempt-000001/logs/S1.json' };
  const grant = { schema: 1, manifestDigest: 'a'.repeat(64), purpose: 'operational-smoke', inputRoot: home, billing: { mode: 'subscription', tool_surface: 'claude-code', status_record_contract: 'claude-auth-status-json-v1' },
    allocation: { id: 'v8-native-smoke-1', root: runs, session_estimate_cap_usd: 1, limit_estimate_usd: 3, session_wall_minutes: 1, billing_mode: 'subscription', account_usage: { max_sessions: 1, max_elapsed_minutes: 60, agreed: true },
      expires_at: new Date(Date.now() + 3600000).toISOString(), decision: { ref: 'decision.json', digest: 'd'.repeat(64) } },
    sessions: [{ id: 'plain', run: 'fixture/rep-1/plain', arm: 'plain', name: 'S1', purpose: 'operational-smoke', prompt_digest: 'b'.repeat(64), effective_digest: 'c'.repeat(64) }] };
  const manifestPath = path.join(home, 'grant.json'); fs.writeFileSync(manifestPath, JSON.stringify(grant));
  const cellHome = path.join(runs, session.run); fs.mkdirSync(cellHome, { recursive: true });
  const environment = { isolation_profile: isolation.NATIVE_PROFILE.name, measurement_profile: usage.NATIVE_PROFILE, tool_surface: 'claude-code', billing: { mode: 'subscription', attributable_charge_usd: null, charge_reason: 'SUBSCRIPTION_NOT_ATTRIBUTABLE', charge_evidence: null }, authentication: { checked: true, logged_in: true, auth_method: 'claude.ai', api_provider: 'firstParty', subscription_type: 'max' } };
  const record = effortCopy.empty({ run: session.run, cohort: 'c'.repeat(64), brief: 'fixture', arm: 'plain', repetition: 1, order: 1, environment });
  fs.writeFileSync(path.join(cellHome, 'record.json'), JSON.stringify(record));
  const options = extra => ({ manifestPath, purpose: 'operational-smoke', nextSessionId: 'plain', ...extra });
  assert.deepEqual(api.limits(grant.allocation), { limit: 3, sessionCap: 1, elapsed: 60, maxSessions: 1, mode: 'subscription', estimate: true });
  assert.throws(() => api.reserve({ ...options(), manifestPath: (() => { const p = path.join(home, 'legacy-mixed.json'); fs.writeFileSync(p, JSON.stringify({ ...grant, allocation: { ...grant.allocation, billing_mode: undefined } })); return p; })(), session, cellClaim: claims.acquire(runs, 'cell.fixture.1.strict') }), /declared billing mode/);
  const claim = claims.acquire(runs, 'cell.fixture.1.plain');
  assert.equal(api.inspect({ grant }).ready, true);
  const handle = api.reserve(options({ session, cellClaim: claim }));
  const state = JSON.parse(fs.readFileSync(path.join(runs, '.allocation/state.json'), 'utf8'));
  assert.equal(state.binding.billing_mode, 'subscription', 'the ledger declares its billing mode');
  assert.equal(state.reservations[0].capUSD, 1, 'the reserved figure is the estimate cap');
  assert.ok(api.inspect({ grant }).reasons.some(r => r.code === 'ALLOCATION_SESSIONS_EXHAUSTED'), 'the agreed envelope admits no second session');
  const attempt = attemptsModule.begin(cellHome, record, {}); attempt.base = record.provenance.base = 'a'.repeat(40);
  attemptsModule.intent(record, attempt, 'S1', 'Synthetic'); fs.writeFileSync(path.join(cellHome, 'record.json'), JSON.stringify(record));
  fs.mkdirSync(path.dirname(path.join(runs, session.payload)), { recursive: true });
  fs.writeFileSync(path.join(runs, session.payload), '', { flag: 'wx' });
  const worker = path.join(home, 'consume.cjs');
  fs.writeFileSync(worker, `const a=require(${JSON.stringify(path.join(moduleRoot, 'allocation.cjs'))});process.stdin.once('data',()=>{try{a.consume(${JSON.stringify(options({ handle }))});process.stdout.write('consumed');}catch(e){process.stderr.write(e.code+':'+e.message);process.exitCode=7;}});`);
  const child = spawn(process.execPath, [worker], { detached: true, stdio: ['pipe', 'pipe', 'pipe'] }); children.add(child);
  let out = '', err = '';
  child.stdout.on('data', v => { out += v; }); child.stderr.on('data', v => { err += v; });
  const done = new Promise(resolve => child.on('close', code => { children.delete(child); resolve(code); }));
  claims.registerGroup(claim, { pid: child.pid, pgid: child.pid });
  child.stdin.end('go');
  assert.equal(await done, 0, err); assert.equal(out, 'consumed');
  // A missing mandatory capture stops for review; an unknown estimate stops; nothing is free.
  fs.writeFileSync(path.join(runs, session.payload), JSON.stringify({ type: 'result', subtype: 'success', total_cost_usd: 0.4, duration_api_ms: 10 }));
  assert.equal(api.reconcile(options({ handle, cellClaim: claim, result: { cleanup_complete: true } })).code, 'ALLOCATION_CAPTURE_INCOMPLETE');
  fs.writeFileSync(path.join(runs, session.payload), JSON.stringify({ type: 'result', subtype: 'success', duration_api_ms: 10, modelUsage: { fixture: { inputTokens: 1, outputTokens: 1, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 } } }));
  assert.equal(api.reconcile(options({ handle, cellClaim: claim, result: { cleanup_complete: true } })).code, 'ALLOCATION_COST_UNKNOWN');
  {
    // An unknown estimate is an incomplete record with its reason, not a malformed one.
    const r = JSON.parse(fs.readFileSync(path.join(cellHome, 'record.json'), 'utf8'));
    usage.apply(r, usage.collect(cellHome, r));
    assert.equal(r.reported.estimate_usd, null); assert.match(r.unavailable.estimate_usd, /Provider field missing/);
    assert.equal(r.reported.cost_usd, null); assert.match(r.unavailable.cost_usd, /SUBSCRIPTION_NOT_ATTRIBUTABLE/);
    assert.deepEqual(effortCopy.problems(r), []);
  }
  fs.writeFileSync(path.join(runs, session.payload), JSON.stringify({ type: 'result', subtype: 'success', total_cost_usd: 0.4, duration_api_ms: 10, modelUsage: { fixture: { inputTokens: 1, outputTokens: 1, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 } } }));
  // A classified account limit settles the estimate and stops the allocation in one step.
  const limited = api.reconcile(options({ handle, cellClaim: claim, result: { cleanup_complete: true, account_limit: { kind: 'weekly', at: receipt } } }));
  assert.equal(limited.code, 'ALLOCATION_ACCOUNT_LIMIT'); assert.equal(limited.stopped, true);
  const stateFile = path.join(runs, '.allocation/state.json');
  const clearStop = () => { const s = JSON.parse(fs.readFileSync(stateFile, 'utf8')); assert.equal(s.reservations[0].status, 'settled'); assert.equal(s.reservations[0].actualUSD, 0.4, 'the settled figure is the list-price estimate, never a charge'); s.stopped = null; fs.writeFileSync(stateFile, JSON.stringify(s)); };
  clearStop();
  assert.equal(api.reconcile(options({ handle, cellClaim: claim, result: { cleanup_complete: true, login_dir_recovery_required: true } })).code, 'ALLOCATION_LOGIN_DIR_RECOVERY', 'a custody outcome stops even a settled reservation');
  clearStop();
  const settled = api.reconcile(options({ handle, cellClaim: claim, result: { cleanup_complete: true } }));
  assert.equal(settled.settled, true); assert.equal(settled.actualUSD, 0.4);
  assert.equal(api.inspect({ grant }).knownSpendUSD, 0.4);
  // A retained record whose login disagrees with the declared billing mode admits nothing.
  const mismatched = JSON.parse(fs.readFileSync(path.join(cellHome, 'record.json'), 'utf8')); mismatched.environment.authentication.auth_method = 'console';
  fs.writeFileSync(path.join(cellHome, 'record.json'), JSON.stringify(mismatched));
  assert.ok(api.inspect({ grant }).reasons.some(r => r.code === 'BILLING_MODE_MISMATCH'));
  claims.release(claim);
}

// --- Study manifest schema 2 ---------------------------------------------------------------------
// The inspector's schema-2 rules (billing declaration, estimate caps, account-usage envelope,
// native-login checks, legacy-field refusal, schema-1 history) are exercised by
// `test/study-readiness.test.js`, which stubs process spawning before loading the modules.
// Here: the checked-in pending manifest is schema 2 and the inspector refuses it as pending.
{
  const pending = spawnSync(process.execPath, [path.join(V7, 'readiness.cjs'), '--manifest', path.join(repo, 'docs/prd-v8-artifacts/execution/study.json'), '--purpose', 'operational-smoke', '--require-ready'], { cwd: repo, encoding: 'utf8' });
  assert.equal(pending.status, 2);
  const result = JSON.parse(pending.stdout);
  assert.equal(result.ready, false);
  assert.ok(result.pending.some(p => p.code === 'EXECUTION_IDENTITY_PENDING'), JSON.stringify(result.pending));
  assert.equal(result.launchGrant, null);
}

// --- The replacement package, frozen inputs and the suite chain -------------------------------
{
  assert.equal(SPEC.harness.indexOf('scripts/delivery-benchmark-v7/login-custody.cjs'), SPEC.harness.indexOf('scripts/delivery-benchmark-v7/isolated-launch.cjs') + 1, 'the custody module is frozen in load order');
  assert.equal(SPEC.harness.at(-1), 'docs/prd-v8-native-tool-contracts.md');
  const frozen = JSON.parse(read('test/fixtures/delivery-benchmark-v7/frozen.json'));
  assert.equal(freeze.compute(REPO, SPEC).cohort, frozen.cohort, 'the frozen cohort was regenerated with the implementation');
  const pkg = read('docs/prd-v8-artifacts/execution/T-121-native-smoke-execution-package.md').replace(/\s+/g, ' ');
  for (const phrase of ['--i-agreed-the-usage-envelope', 'host/claude-config', 'claude auth login', 'NATIVE_LOGIN_NOT_PRESERVED', 'LOGIN_DIR_RECOVERY_REQUIRED', 'billing_mode', 'estimate', 'not observed', 'No session has run']) assert.ok(pkg.includes(phrase), `replacement package states: ${phrase}`);
  assert.doesNotMatch(pkg, /ANTHROPIC_API_KEY=|export ANTHROPIC_API_KEY/, 'the replacement package never asks for a key');
  assert.match(read('docs/prd-v8-artifacts/execution/T-109-smoke-execution-package.md'), /Superseded for execution/);
  const study = JSON.parse(read('docs/prd-v8-artifacts/execution/study.json'));
  assert.equal(study.schema, 2); assert.equal(study.execution, null); assert.equal(study.authorization, null);
  const proposed = JSON.parse(read('docs/prd-v8-artifacts/execution/smoke-execution-inputs.proposed.json'));
  assert.equal(proposed.configuration.isolation_profile, isolation.NATIVE_PROFILE.name);
  assert.ok(JSON.parse(read('package.json')).scripts.test.includes('node test/native-login-study.test.js'));
  assert.match(read('README.md'), /requires no model-provider API key/);
  assert.equal(credentialReads, 0, 'no code path in this suite opened the synthetic credential file');
}
fs.readFileSync = originalRead; fs.openSync = originalOpen;
console.log('native-login study tests passed (fixture login directory, status probe, custody and sessions only; no account login, no live session, nothing native observed)');
