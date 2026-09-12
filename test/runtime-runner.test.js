// The attempt runner (PRD v4 R-03, R-04, R-05): every outcome is derived from
// actual execution with failure injection for capture, mutation, timeout,
// signals and crashes. Each scenario runs in a fresh registered fixture.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { repo, tempDir, createTicket, createPrd, write, read, run, bindV050 } from './helpers.js';

const runtime = path.join(repo, 'template/scripts/pincer-runtime.cjs');
const state = createRequire(import.meta.url)(path.join(repo, 'template/scripts/pincer-runtime/state.cjs'));
const rt = (dir, ...args) => run(dir, process.execPath, [runtime, ...args], { timeout: 60000, maxBuffer: 64 * 1024 * 1024 });
function passes(result, label = '') { assert.equal(result.status, 0, `${label}\n${result.stdout}${result.stderr}`); return result.stdout; }
function git(dir, ...args) { return passes(run(dir, 'git', args), `git ${args.join(' ')}`).trim(); }
function commit(dir, message) {
  git(dir, 'add', '-A');
  git(dir, '-c', 'user.name=Pincer Test', '-c', 'user.email=test@example.invalid', 'commit', '-q', '--allow-empty', '-m', message);
  return git(dir, 'rev-parse', 'HEAD');
}
// A registered (migrated) fixture with one in-progress ticket running `command`.
function migrated(command, { timeout, status = 'in_progress' } = {}) {
  const dir = tempDir(); git(dir, 'init', '-q'); createPrd(dir);
  const file = createTicket(dir, { command });
  let text = read(dir, file).replace('status: open', `status: ${status}${status === 'in_progress' ? '\nstarted: 2026-09-11T00:00:00Z' : ''}`);
  if (timeout) text = text.replace('size: S', `size: S\ntimeout: ${timeout}`);
  write(dir, file, text);
  write(dir, 'src/app.js', 'module.exports = 1;\n');
  write(dir, 'value.txt', 'good');
  write(dir, '.gitignore', '.pincer/\n');
  commit(dir, 'base');
  bindV050(dir);
  commit(dir, 'register');
  return { dir, file };
}
const attempts = dir => state.listAttempts(dir, 'ticket:prd-v1:T-01');
const latest = dir => state.latestAttempt(dir, 'ticket:prd-v1:T-01');
const statusJson = dir => JSON.parse(passes(rt(dir, 'status', '--json'), 'status --json'));
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// Spawn verify asynchronously; resolves the child once an attempt is `running`.
async function spawnVerify(dir) {
  const child = spawn(process.execPath, [runtime, 'verify', 'T-01'], { cwd: dir, env: { ...process.env, CLAUDE_PROJECT_DIR: dir }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  child.stdout.on('data', c => { out += c; }); child.stderr.on('data', c => { err += c; });
  const exit = new Promise(resolve => child.on('close', (code, signal) => resolve({ code, signal, out: () => out, err: () => err })));
  for (let i = 0; i < 100; i++) {
    const a = latest(dir);
    if (a && a.outcome === 'running' && a.child && a.child.pid) return { child, exit, attempt: a };
    await sleep(100);
  }
  throw new Error(`no running attempt appeared\n${out}${err}`);
}

// S-07: distinct stdout/stderr markers then a nonzero exit are captured in the
// right logs, echoed to the terminal, and recorded as failed with the exit code.
{
  const { dir } = migrated('echo OUT-MARKER; echo ERR-MARKER >&2; exit 3');
  const r = rt(dir, 'verify', 'T-01');
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /── T-01 verification ──\n  \$ echo OUT-MARKER; echo ERR-MARKER >&2; exit 3\nOUT-MARKER/);
  assert.match(r.stderr, /ERR-MARKER/);
  assert.match(r.stderr, /✗ T-01 verification FAILED \(exit 3\) — recorded as attempt 000001-.* any prior passing attempt is superseded/);
  const a = latest(dir);
  assert.equal(a.outcome, 'failed'); assert.equal(a.exit_code, 3); assert.equal(a.signal, null);
  assert.equal(read(dir, a.artifacts.stdout.path), 'OUT-MARKER\n');
  assert.equal(read(dir, a.artifacts.stderr.path), 'ERR-MARKER\n');
  assert.equal(a.artifacts.stdout.bytes, 11); assert.equal(a.artifacts.stdout.truncated, false);
  assert.match(a.artifacts.stdout.sha256, /^[0-9a-f]{64}$/);
  assert.equal(a.context.kind, 'ticket'); assert.equal(a.context.ticket, 'T-01'); assert.equal(a.context.change, 'prd-v1');
  assert.match(a.context.prd_revision, /^[0-9a-f]{64}$/); assert.match(a.context.base, /^[0-9a-f]{40}$/);
  assert.equal(a.check.timeout_seconds, 600); assert.match(a.check.digest, /^[0-9a-f]{64}$/);
  assert.equal(a.source.before, a.source.after); assert.ok(a.source.files > 0);
  assert.match(a.runner.version, /bash/i); assert.deepEqual(a.runner.args, ['-eo', 'pipefail', '-c']);
  assert.match(a.started, /Z$/); assert.match(a.finished, /Z$/);
  assert.doesNotMatch(JSON.stringify(a), /"PATH"|"HOME"/, 'no environment dump');
  assert.equal(git(dir, 'status', '--porcelain'), '', 'verify writes no tracked file');
  assert.deepEqual(state.readIndex(dir).index.running, [], 'not left running');
}

// S-08: green → running → red never reports ready between attempts or afterwards;
// the passing record is retained as history.
{
  const { dir } = migrated('test "$(cat value.txt)" = good');
  passes(rt(dir, 'verify', 'T-01'), 'first pass');
  assert.equal(latest(dir).outcome, 'passed');
  assert.equal(rt(dir, 'ready', 'T-01').status, 0);
  write(dir, 'value.txt', 'bad');
  assert.equal(rt(dir, 'verify', 'T-01').status, 1);
  const all = attempts(dir);
  assert.deepEqual(all.map(a => a.outcome), ['passed', 'failed'], 'history retained');
  assert.equal(state.readIndex(dir).index.current['ticket:prd-v1:T-01'], all[1].id, 'current points at the failure');
  assert.equal(statusJson(dir).tickets[0].readiness.reasons[0].code, 'CHECK_FAILED');
  assert.equal(rt(dir, 'ready', 'T-01').status, 1);
  write(dir, 'value.txt', 'good');
  passes(rt(dir, 'verify', 'T-01'), 'repaired pass');
  assert.deepEqual(attempts(dir).map(a => a.outcome), ['passed', 'failed', 'passed'], 'failure retained after the repaired pass');
  assert.equal(rt(dir, 'ready', 'T-01').status, 0);
}
{
  // While an attempt is running, status reports ATTEMPT_RUNNING and ready exits 1.
  const { dir } = migrated('sleep 4');
  const { child, exit } = await spawnVerify(dir);
  const j = statusJson(dir);
  assert.equal(j.tickets[0].readiness.reasons[0].code, 'ATTEMPT_RUNNING');
  assert.equal(j.tickets[0].latest_attempt.outcome, 'running');
  assert.equal(rt(dir, 'ready', 'T-01').status, 1);
  const done = await exit;
  assert.equal(done.code, 0, done.err());
  assert.equal(latest(dir).outcome, 'passed');
  assert.ok(!alive(child.pid));
}

// S-09: missing executable, unwritable state, and capped output.
{
  const { dir } = migrated('nonexistent-command-xyz --flag');
  const r = rt(dir, 'verify', 'T-01');
  assert.equal(r.status, 1);
  const a = latest(dir);
  assert.equal(a.outcome, 'failed'); assert.equal(a.exit_code, 127);
  assert.match(read(dir, a.artifacts.stderr.path), /command not found/);
}
{
  const { dir } = migrated('true');
  passes(rt(dir, 'verify', 'T-01'));
  const count = attempts(dir).length;
  const stateDir = path.join(dir, '.pincer/runtime');
  fs.chmodSync(stateDir, 0o555);
  const r = rt(dir, 'verify', 'T-01');
  fs.chmodSync(stateDir, 0o755);
  if (process.getuid && process.getuid() === 0) console.log('  (skipped unwritable-state case: running as root)');
  else {
    assert.equal(r.status, 4, r.stdout + r.stderr);
    assert.match(r.stderr, /ATTEMPT_ERROR|STATE_BUSY|cannot persist/);
    assert.equal(attempts(dir).length, count, 'no attempt and no fabricated log when state is unwritable');
    assert.equal(latest(dir).outcome, 'passed', 'the earlier record is untouched');
  }
}
{
  const { dir } = migrated('head -c 1500000 /dev/zero | tr "\\0" a; echo; echo tail-marker');
  passes(rt(dir, 'verify', 'T-01'));
  const a = latest(dir);
  assert.equal(a.outcome, 'passed');
  assert.equal(a.artifacts.stdout.truncated, true);
  assert.ok(a.artifacts.stdout.bytes <= 1024 * 1024);
  const log = read(dir, a.artifacts.stdout.path);
  assert.match(log, /\[pincer: truncated, \d+ more bytes not stored\]\n$/);
  assert.doesNotMatch(log, /tail-marker/, 'bytes beyond the cap are not stored');
}

// S-10: inspection creates no attempt; every explicit verify creates a new one.
{
  const { dir } = migrated('true');
  passes(rt(dir, 'verify', 'T-01'));
  const first = latest(dir);
  const snapshotState = () => JSON.stringify([attempts(dir).map(a => [a.id, a.outcome, a.started, a.finished]), state.readIndex(dir).index]);
  const before = snapshotState();
  passes(rt(dir, 'status')); passes(rt(dir, 'status', '--json')); passes(rt(dir, 'ready', 'T-01')); passes(rt(dir, 'snapshot'));
  assert.equal(snapshotState(), before, 'status, ready and snapshot rewrite nothing');
  passes(rt(dir, 'verify', 'T-01'));
  const second = latest(dir);
  assert.notEqual(second.id, first.id); assert.equal(second.sequence, first.sequence + 1);
  assert.equal(attempts(dir).length, 2);
}

// S-11 (dynamic): a source edit after a pass makes status report SOURCE_CHANGED
// naming the path; S-12: ticking a box does not.
{
  const { dir, file } = migrated('true');
  passes(rt(dir, 'verify', 'T-01'));
  assert.equal(rt(dir, 'ready', 'T-01').status, 0);
  write(dir, file, read(dir, file).replace('- [x] expected behavior', '- [ ] expected behavior'));
  const ticked = statusJson(dir).tickets[0].readiness;
  assert.deepEqual(ticked.reasons.map(r => r.code), ['CRITERIA_UNTICKED'], 'a checkbox change is not a source change');
  write(dir, file, read(dir, file).replace('- [ ] expected behavior', '- [x] expected behavior'));
  write(dir, 'src/app.js', 'module.exports = 2;\n');
  const r = statusJson(dir).tickets[0].readiness;
  assert.equal(r.reasons[0].code, 'SOURCE_CHANGED');
  assert.match(r.reasons[0].detail, /src\/app\.js/);
  assert.equal(r.next, 'verify');
  const gate = rt(dir, 'ready', 'T-01');
  assert.equal(gate.status, 1); assert.match(gate.stdout, /SOURCE_CHANGED .*src\/app\.js/);
  const human = passes(rt(dir, 'status'));
  assert.match(human, /T-01 +in_progress .* latest attempt passed/);
  write(dir, file, read(dir, file).replace('\ntrue\n', '\ntrue && true\n'));
  assert.ok(statusJson(dir).tickets[0].readiness.reasons.some(x => x.code === 'CHECK_CHANGED'), 'block change is CHECK_CHANGED');
}

// S-13: a zero-exit check that edits source is error, not evidence.
{
  const { dir } = migrated('echo mutated >> src/app.js');
  const r = rt(dir, 'verify', 'T-01');
  assert.equal(r.status, 4);
  assert.match(r.stderr, /ERROR: SOURCE_CHANGED: the check mutated source: src\/app\.js/);
  const a = latest(dir);
  assert.equal(a.outcome, 'error'); assert.equal(a.exit_code, 0);
  assert.notEqual(a.source.before, a.source.after);
  assert.equal(rt(dir, 'ready', 'T-01').status, 1);
  assert.equal(statusJson(dir).tickets[0].readiness.reasons[0].code, 'ATTEMPT_ERROR');
}

// S-16: SIGINT and SIGTERM to the runtime finalize interrupted and kill the child;
// a timeout finalizes timed_out; a forced kill leaves running until recover.
for (const signal of ['SIGINT', 'SIGTERM']) {
  const { dir } = migrated('sleep 30');
  const { child, exit, attempt } = await spawnVerify(dir);
  child.kill(signal);
  const done = await exit;
  assert.equal(done.code, 130, `${signal}: exit 130 (${done.code} ${done.signal})\n${done.err()}`);
  const a = latest(dir);
  assert.equal(a.id, attempt.id); assert.equal(a.outcome, 'interrupted');
  assert.match(a.limitations[0], new RegExp(`interrupted by ${signal}`));
  assert.ok(!alive(attempt.child.pid), `${signal}: child killed`);
  assert.deepEqual(state.readIndex(dir).index.running, []);
  assert.equal(rt(dir, 'ready', 'T-01').status, 1);
  assert.equal(statusJson(dir).tickets[0].readiness.reasons[0].code, 'ATTEMPT_INTERRUPTED');
}
{
  const { dir } = migrated('sleep 30', { timeout: 1 });
  const started = Date.now();
  const r = rt(dir, 'verify', 'T-01');
  const elapsed = Date.now() - started;
  assert.equal(r.status, 124, r.stderr);
  assert.match(r.stderr, /TIMED OUT after 1 s/);
  assert.ok(elapsed < 12000, `timeout enforced promptly (${elapsed} ms)`);
  const a = latest(dir);
  assert.equal(a.outcome, 'timed_out'); assert.equal(a.check.timeout_seconds, 1);
  assert.ok(!alive(a.child.pid), 'child killed on timeout');
  assert.equal(statusJson(dir).tickets[0].readiness.reasons[0].code, 'ATTEMPT_TIMED_OUT');
  assert.match(statusJson(dir).tickets[0].readiness.next, /timeout/);
}
{
  const { dir } = migrated('sleep 30');
  const { child, exit, attempt } = await spawnVerify(dir);
  child.kill('SIGKILL');
  await exit;
  assert.equal(latest(dir).outcome, 'running', 'a forced kill leaves the record running');
  assert.ok(alive(attempt.child.pid), 'the orphaned child survives the runtime');
  const j = statusJson(dir);
  assert.equal(j.tickets[0].readiness.ready, false);
  assert.equal(j.tickets[0].readiness.reasons[0].code, 'ATTEMPT_RUNNING');
  assert.equal(rt(dir, 'ready', 'T-01').status, 1);
  const rec = passes(rt(dir, 'recover'));
  assert.match(rec, new RegExp(`finalized ${attempt.id} as interrupted`));
  await sleep(300);
  assert.ok(!alive(attempt.child.pid), 'recover terminated the orphaned process group');
  const a = latest(dir);
  assert.equal(a.outcome, 'interrupted');
  assert.ok(a.limitations.some(l => /orphaned child process group/.test(l)));
  assert.equal(statusJson(dir).tickets[0].readiness.reasons[0].code, 'ATTEMPT_INTERRUPTED');
}

// S-17: a grandchild is terminated with the group on timeout; secrets in output
// are redacted and counted; an inline secret literal in the block is refused.
{
  const { dir } = migrated(`bash ${path.join(repo, 'test/fixtures/grandchild.sh')} 30`, { timeout: 1 });
  const r = rt(dir, 'verify', 'T-01');
  assert.equal(r.status, 124, r.stderr);
  const heartbeat = path.join(dir, 'heartbeat.tmp');
  assert.ok(fs.existsSync(heartbeat), 'grandchild ran');
  await sleep(1500);
  const m1 = fs.statSync(heartbeat).mtimeMs;
  await sleep(800);
  assert.equal(fs.statSync(heartbeat).mtimeMs, m1, 'heartbeat stopped: the grandchild was terminated with the group');
}
{
  const { dir } = migrated('echo "API_KEY=supersecret123"; echo "Authorization: Bearer abc.def.ghi" >&2; echo "AKIAABCDEFGHIJKLMNOP"; printf -- "-----BEGIN RSA PRIVATE KEY-----\\nMIIEvQIB\\n-----END RSA PRIVATE KEY-----\\n"');
  const r = rt(dir, 'verify', 'T-01');
  assert.equal(r.status, 0, r.stderr);
  const a = latest(dir);
  const out = read(dir, a.artifacts.stdout.path), err = read(dir, a.artifacts.stderr.path);
  assert.doesNotMatch(out + err + r.stdout + r.stderr, /supersecret123|abc\.def\.ghi|AKIAABCDEFGHIJKLMNOP|MIIEvQIB/, 'secret markers never persist or print');
  assert.match(out, /API_KEY=\[redacted\]/); assert.match(err, /Authorization: \[redacted\]/);
  assert.ok(a.artifacts.stdout.redactions >= 3 && a.artifacts.stderr.redactions >= 1, JSON.stringify(a.artifacts));
}
{
  const { dir } = migrated('TOKEN=abc123 true');
  const r = rt(dir, 'verify', 'T-01');
  assert.equal(r.status, 4);
  assert.match(r.stderr, /Verification block line 1 assigns a secret-like literal/);
  assert.equal(attempts(dir).length, 0, 'refused before launch');
  const { dir: ok } = migrated('TOKEN="$UNSET_TOKEN" true');
  assert.equal(rt(ok, 'verify', 'T-01').status, 0, 'environment references are allowed');
}

// T-44: sanitizer coverage for non-Bearer schemes, quoted values and prefixed
// inline assignments.
{
  const sanitize = createRequire(import.meta.url)(path.join(repo, 'template/scripts/pincer-runtime/sanitize.cjs'));
  assert.equal(sanitize.sanitizeLine('Authorization: Basic dXNlcjpwYXNz').text, 'Authorization: [redacted] [redacted]');
  assert.equal(sanitize.sanitizeLine('x-api-key: Token abc.def').text, 'x-api-key: [redacted] [redacted]');
  assert.equal(sanitize.sanitizeLine('secret="a b c" tail').text, 'secret="[redacted]" tail');
  assert.equal(sanitize.sanitizeLine("password='p w' x").text, "password='[redacted]' x");
  assert.doesNotMatch(sanitize.sanitizeLine('{"apiKey": "sk live 1"}').text, /sk live/);
  for (const line of ['env TOKEN=abc cmd', 'FOO=1 TOKEN=abc cmd', 'true; TOKEN=abc cmd', 'export API_KEY=zzz', 'cmd && SECRET=x cmd2']) assert.equal(sanitize.inlineSecretLine([line]), 1, `refused: ${line}`);
  for (const line of ['TOKEN=$(cat t) cmd', 'TOKEN=`cat t` cmd', 'TOKEN="$X" cmd', 'TOKEN= cmd', 'npm test', 'echo "TOKEN=x"']) assert.equal(sanitize.inlineSecretLine([line]), null, `allowed: ${line}`);
  const { dir: prefixed } = migrated('env TOKEN=abc123 true');
  const r = rt(prefixed, 'verify', 'T-01');
  assert.equal(r.status, 4); assert.match(r.stderr, /assigns a secret-like literal/);
}

// Mode boundaries: an unregistered PRD keeps the legacy receipt contract (no local
// state), an open migrated ticket is started by verify, and a changed revision
// refuses before any child process starts.
{
  const dir = tempDir(); git(dir, 'init', '-q'); createPrd(dir); createTicket(dir); commit(dir, 'base');
  const legacy = rt(dir, 'verify', 'T-01');
  assert.equal(legacy.status, 0, legacy.stderr); assert.match(legacy.stdout, /receipt: /);
  assert.ok(!fs.existsSync(path.join(dir, '.pincer')), 'legacy mode never writes local state');
  const { dir: open, file: openFile } = migrated('true', { status: 'open' });
  assert.equal(rt(open, 'verify', 'T-01').status, 0);
  assert.match(read(open, openFile), /^status: in_progress$/m, 'verify starts an open migrated ticket');
  const { dir: rev } = migrated('true');
  write(rev, '.prd/prd-v1.md', `${read(rev, '.prd/prd-v1.md')}\nmore\n`);
  const changed = rt(rev, 'verify', 'T-01');
  assert.equal(changed.status, 4); assert.match(changed.stderr, /REVISION_CHANGED/);
  assert.equal(attempts(rev).length, 0, 'no child process started');
}

// Review fixes (T-45): the timeout terminates the process group even when the
// shell has already exited and a background child keeps the output pipes open;
// a child that ignores SIGTERM is killed after the grace period; the run never
// waits for the child's own schedule.
{
  const { dir } = migrated('sleep 9 & echo $! > .pincer/bg.pid; exit 0', { timeout: 1 });
  const started = Date.now();
  const r = rt(dir, 'verify', 'T-01');
  const elapsed = Date.now() - started;
  assert.equal(r.status, 124, r.stdout + r.stderr);
  assert.ok(elapsed < 5000, `the run ends at the timeout, not when the background child exits (${elapsed} ms)`);
  const a = latest(dir);
  assert.equal(a.outcome, 'timed_out');
  const bg = Number(read(dir, '.pincer/bg.pid').trim());
  assert.ok(bg > 0 && !alive(bg), 'the background child was terminated with the group');
  assert.ok(a.limitations.some(l => /SIGTERM/.test(l)), JSON.stringify(a.limitations));
}
{
  const { dir } = migrated('bash -c \'trap "" TERM; sleep 30\' & echo $! > .pincer/bg.pid; exit 0', { timeout: 1 });
  const started = Date.now();
  const r = rt(dir, 'verify', 'T-01');
  const elapsed = Date.now() - started;
  assert.equal(r.status, 124, r.stdout + r.stderr);
  assert.ok(elapsed >= 5000 && elapsed < 12000, `SIGKILL after the grace period bounds the run (${elapsed} ms)`);
  const bg = Number(read(dir, '.pincer/bg.pid').trim());
  assert.ok(bg > 0 && !alive(bg), 'the SIGTERM-ignoring child was killed');
  assert.ok(latest(dir).limitations.some(l => /SIGKILL/.test(l)), JSON.stringify(latest(dir).limitations));
}
// T-46: a descendant that left the group (setsid) cannot be reached; nothing is
// claimed to have been sent, capture is abandoned after the drain bound, the run
// still ends and is timed_out.
{
  const { dir } = migrated("perl -e 'use POSIX; setsid(); sleep 30' & echo $! > .pincer/bg.pid; exit 0", { timeout: 1 });
  const started = Date.now();
  const r = rt(dir, 'verify', 'T-01');
  const elapsed = Date.now() - started;
  const bg = Number(read(dir, '.pincer/bg.pid').trim());
  try { process.kill(bg, 'SIGKILL'); } catch { /* already gone */ }
  assert.equal(r.status, 124, r.stdout + r.stderr);
  assert.ok(elapsed >= 8000 && elapsed < 12000, `timeout, grace and drain bound the run (${elapsed} ms)`);
  const a = latest(dir);
  assert.equal(a.outcome, 'timed_out');
  assert.ok(a.limitations.some(l => /no reachable process remained/.test(l) && /abandoned/.test(l)), JSON.stringify(a.limitations));
  assert.ok(!a.limitations.some(l => /was sent/.test(l)), 'no signal is claimed that was not delivered');
}
console.log('runtime runner tests passed');

// PRD v6 T-72: a declared check may run in a declared working directory; the
// attempt records it (`cwd`), and the default stays `.`.
{
  const dir = tempDir(); git(dir, 'init', '-q');
  fs.mkdirSync(path.join(dir, 'sub'), { recursive: true }); write(dir, 'sub/marker.txt', 'here\n');
  commit(dir, 'base');
  const runner = createRequire(import.meta.url)(path.join(repo, 'template/scripts/pincer-runtime/runner.cjs'));
  const context = { kind: 'candidate', change: 'x', prd: '.prd/prd-v1.md', prd_revision: 'a'.repeat(64), base: 'b'.repeat(40), candidate: 'c'.repeat(40), check: 'C-01' };
  const inSub = await runner.runAttempt({ root: dir, context, commands: ['test -f marker.txt'], timeoutSeconds: 10, command: 'check C-01', echo: false, cwd: 'sub' });
  assert.equal(inSub.attempt.outcome, 'passed', JSON.stringify(inSub)); assert.equal(inSub.attempt.cwd, 'sub');
  const atRoot = await runner.runAttempt({ root: dir, context, commands: ['test -f marker.txt'], timeoutSeconds: 10, command: 'check C-01', echo: false });
  assert.equal(atRoot.attempt.outcome, 'failed'); assert.equal(atRoot.attempt.cwd, '.');
}
console.log('runtime runner tests passed (declared cwd)');
