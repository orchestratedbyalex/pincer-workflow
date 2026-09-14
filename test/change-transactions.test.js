// Change transactions (PRD v5 R-08, T-48): every write of change state is one
// locked validate-and-write operation staged under the journal and committed by
// a manifest. Overlapping subprocess writers cannot lose an event or overwrite a
// newer revision; a stale lock left by a killed writer is reclaimed by exactly one
// contender; a stale expected sequence refuses; forced termination at every
// journal boundary leaves either the old state or the committed transition, and
// recover completes it; read-only inspection writes nothing; a running attempt
// blocks a transition without being killed, and dead-owner recovery preserves
// the interrupted record and lets the transition through.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { repo, tempDir, write, read, run } from './helpers.js';

const require = createRequire(import.meta.url);
const state = require(path.join(repo, 'template/scripts/pincer-runtime/state.cjs'));
const txn = require(path.join(repo, 'template/scripts/pincer-runtime/transaction.cjs'));
const runtime = path.join(repo, 'template/scripts/pincer-runtime.cjs');
const writer = path.join(repo, 'test/fixtures/txn-writer.cjs');
const holder = path.join(repo, 'test/fixtures/hold-lock.cjs');
const RUNTIME = '.pincer/runtime';
const REL = '.prd/changes/prd-v2.json';
const rt = (dir, ...args) => run(dir, process.execPath, [runtime, ...args]);
const writerSync = (dir, ...args) => run(dir, process.execPath, [writer, dir, 'prd-v2', ...args], { env: { ...process.env, CLAUDE_PROJECT_DIR: dir, PINCER_LOCK_WAIT_MS: '20000' }, timeout: 60000 });
function writerAsync(dir, ...args) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [writer, dir, 'prd-v2', ...args], { env: { ...process.env, PINCER_LOCK_WAIT_MS: '20000' } });
    let stdout = '', stderr = '';
    child.stdout.on('data', c => { stdout += c; }); child.stderr.on('data', c => { stderr += c; });
    child.on('exit', (code, signal) => resolve({ status: code, signal, stdout, stderr }));
  });
}
const record = dir => JSON.parse(read(dir, REL));
const journalEntries = dir => (fs.existsSync(path.join(dir, `${RUNTIME}/journal`)) ? fs.readdirSync(path.join(dir, `${RUNTIME}/journal`)) : []);
const snapshotTree = dir => {
  const out = {};
  const walk = rel => {
    for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const next = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(next); else out[next] = fs.readFileSync(path.join(dir, next), 'utf8');
    }
  };
  walk('');
  return out;
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function holdLock(dir, ms) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [holder, dir, String(ms)], { stdio: ['ignore', 'pipe', 'inherit'] });
    child.stdout.on('data', chunk => { if (String(chunk).includes('held')) resolve(child); });
    child.on('error', reject);
  });
}
const waitExit = child => new Promise(resolve => (child.exitCode !== null || child.signalCode !== null ? resolve() : child.once('exit', resolve)));

// A transaction writes its files together, leaves no staging behind and releases the lock;
// a refusal inside the operation writes nothing at all.
{
  const dir = tempDir();
  const out = txn.run(dir, { command: 'test' }, ctx => {
    assert.equal(ctx.read(REL), null);
    ctx.write(REL, { schema: 2, change: 'prd-v2', sequence: 1, events: [{ sequence: 1, kind: 'register' }] });
    ctx.write('.pincer/runtime/selection.json', { schema: 1, change: 'prd-v2', selected: ctx.now });
    ctx.write('.gitignore', '.pincer/\n');
    return 'ok';
  });
  assert.equal(out.result, 'ok');
  assert.deepEqual(out.writes, [REL, '.pincer/runtime/selection.json', '.gitignore']);
  assert.equal(record(dir).sequence, 1);
  assert.equal(read(dir, '.gitignore'), '.pincer/\n');
  assert.deepEqual(journalEntries(dir), [], 'no staging left after commit');
  assert.ok(!fs.existsSync(path.join(dir, `${RUNTIME}/lock`)), 'lock released');
  const before = snapshotTree(dir);
  assert.throws(() => txn.run(dir, { command: 'test' }, ctx => { ctx.write(REL, { changed: true }); ctx.refuse('LIFECYCLE_BLOCKED', 'not allowed'); }), { code: 'LIFECYCLE_BLOCKED' });
  assert.deepEqual(snapshotTree(dir), before, 'a refusal after staging a write leaves every file unchanged');
  assert.deepEqual(journalEntries(dir), []);
  assert.throws(() => txn.run(dir, {}, ctx => ctx.write('../outside.json', {})), { code: 'INPUT_INVALID' }, 'no escape from the repository');
  assert.throws(() => txn.run(dir, {}, ctx => ctx.write(`${RUNTIME}/lock/owner.json`, {})), { code: 'INPUT_INVALID' }, 'the lock is not a target');
  assert.throws(() => txn.run(dir, {}, ctx => { ctx.write(REL, {}); ctx.write(REL, {}); }), { code: 'INPUT_INVALID' }, 'one target per transaction');
  const noWrite = txn.run(dir, {}, () => 'read-only');
  assert.deepEqual(noWrite, { result: 'read-only', writes: [], id: null });
  assert.ok(txn.boundedText('x'.repeat(2000), 'reason'));
  assert.throws(() => txn.boundedText('x'.repeat(2001), 'reason'), /longer than 2000/);
  assert.throws(() => txn.boundedText('  ', 'reason'), /nonempty/);
}

// S-24: a stale expected revision refuses at commit and the newer revision survives.
{
  const dir = tempDir();
  assert.equal(writerSync(dir, '--label', 'first').status, 0);
  assert.equal(record(dir).sequence, 1);
  const stale = writerSync(dir, '--expect', '0', '--label', 'stale');
  assert.equal(stale.status, 1); assert.match(stale.stdout, /refused STATE_CHANGED: \.prd\/changes\/prd-v2\.json: sequence is 1, expected 0/);
  assert.equal(record(dir).sequence, 1, 'the stale writer changed nothing');
  assert.deepEqual(record(dir).events.map(e => e.note), ['first']);
  const fresh = writerSync(dir, '--expect', '1', '--label', 'fresh');
  assert.equal(fresh.status, 0, fresh.stdout + fresh.stderr);
  assert.deepEqual(record(dir).events.map(e => e.note), ['first', 'fresh']);
}

// S-24: overlapping subprocess writers serialize on the lock; no event is lost, the
// sequence is contiguous and the last selection names the last committer.
{
  const dir = tempDir();
  const labels = ['a', 'b', 'c', 'd', 'e', 'f'];
  const results = await Promise.all(labels.map(l => writerAsync(dir, '--hold', '150', '--label', l)));
  for (const [i, r] of results.entries()) assert.equal(r.status, 0, `writer ${labels[i]}: ${r.stdout}${r.stderr}`);
  const r = record(dir);
  assert.equal(r.sequence, labels.length);
  assert.deepEqual(r.events.map(e => e.sequence), labels.map((_, i) => i + 1), 'contiguous sequence');
  assert.deepEqual([...r.events.map(e => e.note)].sort(), labels, 'every writer\'s event is present exactly once');
  const last = r.events.at(-1).note;
  assert.equal(JSON.parse(read(dir, `${RUNTIME}/selection.json`)).by, last, 'the selection is the last committer\'s');
  assert.deepEqual(journalEntries(dir), []);
  assert.ok(!fs.existsSync(path.join(dir, `${RUNTIME}/lock`)));
}

// A killed writer leaves a stale lock; concurrent contenders reclaim it exactly once
// and all commit in some order; a live holder makes them wait, then they commit.
{
  const dir = tempDir();
  assert.equal(writerSync(dir, '--label', 'seed').status, 0);
  const victim = await holdLock(dir, 60000);
  victim.kill('SIGKILL'); await waitExit(victim);
  assert.ok(fs.existsSync(path.join(dir, `${RUNTIME}/lock`)), 'stale lock left behind');
  const results = await Promise.all(['x', 'y', 'z'].map(l => writerAsync(dir, '--hold', '100', '--label', l)));
  for (const r of results) assert.equal(r.status, 0, r.stdout + r.stderr);
  const reclaimers = results.filter(r => /reclaiming stale lock left by pid/.test(r.stderr));
  assert.equal(reclaimers.length, 1, `exactly one contender reclaims the stale lock (${reclaimers.length})`);
  assert.deepEqual(record(dir).events.map(e => e.sequence), [1, 2, 3, 4]);
  assert.deepEqual(fs.readdirSync(path.join(dir, RUNTIME)).filter(n => n.startsWith('lock')), [], 'no lock or claim directories remain');
  const live = await holdLock(dir, 1500);
  const started = Date.now();
  const waited = await writerAsync(dir, '--label', 'after-live');
  assert.equal(waited.status, 0, waited.stdout);
  assert.ok(Date.now() - started >= 1000, 'the writer waited for the live holder instead of stealing the lock');
  assert.doesNotMatch(waited.stderr, /reclaiming/);
  await waitExit(live);
  const bounded = run(dir, process.execPath, [writer, dir, 'prd-v2', '--label', 'bounded'], { env: { ...process.env, PINCER_LOCK_WAIT_MS: '300' } });
  assert.equal(bounded.status, 0);
  const holder2 = await holdLock(dir, 2000);
  const busy = run(dir, process.execPath, [writer, dir, 'prd-v2', '--label', 'busy'], { env: { ...process.env, PINCER_LOCK_WAIT_MS: '300' } });
  assert.equal(busy.status, 3, busy.stdout); assert.match(busy.stdout, /busy: .*is held by pid/);
  await waitExit(holder2);
}

// S-25: forced termination at every journal boundary. Before the manifest the old
// state stays and staging is discarded; after it, the transition is complete or
// completable, never half of each. Read-only inspection of the incomplete state
// writes nothing; recover completes it and a later transaction continues.
for (const point of ['validated', 'staged', 'manifest', 'rename:0', 'rename:1', 'cleanup']) {
  const dir = tempDir();
  assert.equal(writerSync(dir, '--label', 'seed').status, 0);
  const seedTree = snapshotTree(dir);
  const crashed = writerSync(dir, '--crash', point, '--label', 'crash');
  assert.equal(crashed.signal, 'SIGKILL', `${point}: the writer killed itself (${crashed.status} ${crashed.stdout}${crashed.stderr})`);
  assert.ok(fs.existsSync(path.join(dir, `${RUNTIME}/lock`)), `${point}: the killed writer left its lock`);
  const committed = ['manifest', 'rename:0', 'rename:1', 'cleanup'].includes(point);
  const pendingBefore = txn.pending(dir);
  const treeBefore = snapshotTree(dir);
  assert.deepEqual(snapshotTree(dir), treeBefore, `${point}: pending() is read-only`);
  if (committed) {
    if (point === 'cleanup') {
      // The manifest was removed after the last rename: the transition is complete.
      assert.equal(pendingBefore.committed.length, 0, `${point}: nothing pending after the manifest was removed`);
      assert.equal(record(dir).sequence, 2);
    } else {
      assert.equal(pendingBefore.committed.length, 1, `${point}: one committed transaction pending`);
      assert.match(pendingBefore.committed[0].command, /^txn-writer crash$/);
      const seqNow = record(dir).sequence;
      assert.ok(seqNow === 1 || seqNow === 2, `${point}: the record is the old or the new revision, never something else (${seqNow})`);
      if (seqNow === 2) assert.equal(record(dir).events.at(-1).note, 'crash', `${point}: the new revision carries its event`);
    }
  } else {
    assert.deepEqual(record(dir), JSON.parse(seedTree[REL]), `${point}: old state intact before the commit point`);
    assert.equal(pendingBefore.committed.length, 0);
    assert.equal(pendingBefore.uncommitted.length, point === 'staged' ? 1 : 0, `${point}: uncommitted staging is visible as such`);
  }
  const rec = rt(dir, 'recover');
  assert.equal(rec.status, 0, `${point}: ${rec.stdout}${rec.stderr}`);
  assert.match(rec.stderr, /reclaiming stale lock/, `${point}: recover reclaims the dead writer's lock`);
  if (committed && point !== 'cleanup') assert.match(rec.stdout, /completed transaction txn-\S+ \(txn-writer crash\): \.prd\/changes\/prd-v2\.json, \.pincer\/runtime\/selection\.json/, `${point}: recover names the completed transaction`);
  if (point === 'staged') assert.match(rec.stdout, /discarded uncommitted staging txn-/, `${point}: staging discarded`);
  const after = record(dir);
  assert.equal(after.sequence, committed ? 2 : 1, `${point}: recovered revision`);
  assert.deepEqual(after.events.map(e => e.sequence), committed ? [1, 2] : [1], `${point}: history matches the revision`);
  if (committed) assert.equal(JSON.parse(read(dir, `${RUNTIME}/selection.json`)).by, 'crash', `${point}: the coordinated selection write landed with the record`);
  else assert.equal(JSON.parse(read(dir, `${RUNTIME}/selection.json`)).by, 'seed', `${point}: the selection is the old one`);
  assert.deepEqual(journalEntries(dir), [], `${point}: journal clean after recover`);
  assert.deepEqual(txn.pending(dir), { committed: [], uncommitted: [] });
  assert.match(rt(dir, 'recover').stdout, /^nothing to recover$/m, `${point}: recover is idempotent`);
  const next = writerSync(dir, '--label', 'next');
  assert.equal(next.status, 0, next.stdout + next.stderr);
  assert.equal(record(dir).sequence, committed ? 3 : 2, `${point}: a later transaction continues the sequence`);
}
// A committed transaction is also completed by the next transaction, not only by recover,
// and an unreadable manifest is left in place and reported rather than guessed at.
{
  const dir = tempDir();
  assert.equal(writerSync(dir, '--label', 'seed').status, 0);
  const crashed = writerSync(dir, '--crash', 'rename:0', '--label', 'crash');
  assert.equal(crashed.signal, 'SIGKILL');
  const next = writerSync(dir, '--label', 'next');
  assert.equal(next.status, 0, next.stdout + next.stderr);
  assert.deepEqual(record(dir).events.map(e => e.note), ['seed', 'crash', 'next'], 'the crashed commit was completed before the next writer read the record');
  assert.deepEqual(journalEntries(dir), []);
  write(dir, `${RUNTIME}/journal/txn-20260911T000000Z-bad000/manifest.json`, '{"schema": 1, "id": "txn-20260911T000000Z-bad000", ');
  const rec = rt(dir, 'recover');
  assert.equal(rec.status, 0);
  assert.match(rec.stdout, /left transaction txn-20260911T000000Z-bad000 in place: malformed JSON/);
  assert.ok(fs.existsSync(path.join(dir, `${RUNTIME}/journal/txn-20260911T000000Z-bad000/manifest.json`)), 'unreadable manifest kept for inspection');
  assert.equal(txn.pending(dir).committed[0].problem.startsWith('malformed JSON'), true);
}

// S-26: a running attempt of the change blocks the transition without being killed;
// after explicit recovery of a dead owner the interrupted result stays and the
// transition works. An attempt of another change does not block.
{
  const dir = tempDir();
  assert.equal(writerSync(dir, '--label', 'seed').status, 0);
  const live = spawn('bash', ['-c', 'sleep 30'], { stdio: 'ignore' });
  await sleep(200);
  const attempt = (id, sequence, change, owner) => ({ schema: 2, runtime: 2, id, sequence, context: { kind: 'ticket', change, ticket: 'T-01' }, outcome: 'running', owner, started: '2026-09-11T00:00:00Z', finished: null, limitations: [] });
  const mine = attempt('000001-20260911T000000Z-aaaaaa', 1, 'prd-v2', { pid: live.pid, host: os.hostname() });
  const other = attempt('000002-20260911T000001Z-bbbbbb', 2, 'prd-v9', { pid: live.pid, host: os.hostname() });
  state.writeAttempt(dir, mine); state.writeAttempt(dir, other);
  state.writeIndex(dir, { schema: 1, sequence: 2, current: { 'ticket:prd-v2:T-01': mine.id, 'ticket:prd-v9:T-01': other.id }, running: [mine.id, other.id] });
  const blocked = writerSync(dir, '--idle', '--label', 'blocked');
  assert.equal(blocked.status, 1); assert.match(blocked.stdout, /refused ATTEMPT_RUNNING: attempt 000001-20260911T000000Z-aaaaaa of change prd-v2 is running \(pid \d+ is still running\); the transition is refused and the attempt is not terminated/);
  assert.equal(live.exitCode, null, 'the running check was not killed');
  assert.equal(record(dir).sequence, 1);
  assert.deepEqual(txn.runningAttempts(dir, 'prd-v9').map(a => a.id), [other.id], 'the other change\'s attempt is its own');
  live.kill('SIGKILL'); await waitExit(live); await sleep(100);
  const dead = writerSync(dir, '--idle', '--label', 'dead-owner');
  assert.equal(dead.status, 1); assert.match(dead.stdout, /is running \(its owner is no longer running: run recover first\)/, 'a dead owner still blocks until explicit recovery');
  const rec = rt(dir, 'recover');
  assert.equal(rec.status, 0, rec.stderr);
  assert.match(rec.stdout, new RegExp(`finalized ${mine.id} as interrupted`));
  assert.equal(state.readAttempt(dir, mine.id).attempt.outcome, 'interrupted');
  assert.equal(state.readIndex(dir).index.current['ticket:prd-v2:T-01'], mine.id, 'the interrupted result stays the current pointer');
  const after = writerSync(dir, '--idle', '--label', 'after-recover');
  assert.equal(after.status, 0, after.stdout + after.stderr);
  assert.deepEqual(record(dir).events.map(e => e.note), ['seed', 'after-recover']);
  assert.equal(state.readAttempt(dir, mine.id).attempt.outcome, 'interrupted', 'recovery preserved the interrupted evidence');
}

// The existing recover report still lists stray temp files, and a transaction
// staging directory is never mistaken for one.
{
  const dir = tempDir();
  write(dir, `${RUNTIME}/journal/.index.json.1.deadbeef.tmp`, '{');
  fs.mkdirSync(path.join(dir, `${RUNTIME}/journal/txn-20260911T000000Z-stage0`), { recursive: true });
  write(dir, `${RUNTIME}/journal/txn-20260911T000000Z-stage0/01-prd-v2.json`, '{}');
  const rec = rt(dir, 'recover');
  assert.equal(rec.status, 0, rec.stderr);
  assert.match(rec.stdout, /removed stray journal file \.pincer\/runtime\/journal\/\.index\.json\.1\.deadbeef\.tmp/);
  assert.match(rec.stdout, /discarded uncommitted staging txn-20260911T000000Z-stage0/);
  assert.deepEqual(journalEntries(dir), []);
}
console.log('change transaction tests passed');

// PRD v6 T-69: adoption of strict coverage goes through the same transaction API —
// it waits on the lock (STATE_BUSY after the bound), writes the record and the
// snapshot together, leaves no staging behind and releases the lock.
{
  const dir = tempDir(); run(dir, 'git', ['init', '-q']);
  write(dir, '.gitignore', '.pincer/\n');
  write(dir, '.prd/prd-v1.md', read(path.join(repo, 'test/fixtures/prd-v6'), 'strict/prd-v1.md'));
  for (const f of fs.readdirSync(path.join(repo, 'test/fixtures/prd-v6/strict/tickets'))) write(dir, `tickets/${f}`, read(path.join(repo, 'test/fixtures/prd-v6'), `strict/tickets/${f}`));
  write(dir, '.prd/coverage/prd-v1.json', read(path.join(repo, 'test/fixtures/prd-v6'), 'strict/coverage/prd-v1.json'));
  run(dir, 'git', ['add', '-A']); run(dir, 'git', ['-c', 'user.name=T', '-c', 'user.email=t@example.invalid', 'commit', '-q', '-m', 'base']);
  assert.equal(rt(dir, 'register', '--prd', '.prd/prd-v1.md').status, 0);
  const changeOp = path.join(repo, 'test/fixtures/change-op.cjs');
  const held = await holdLock(dir, 1500);
  const busy = run(dir, process.execPath, [changeOp, dir, 'adopt', 'prd-v1'], { env: { ...process.env, CLAUDE_PROJECT_DIR: dir, PINCER_LOCK_WAIT_MS: '200' } });
  assert.equal(busy.status, 3, busy.stdout + busy.stderr); assert.match(busy.stdout, /refused STATE_BUSY/);
  assert.equal(JSON.parse(read(dir, '.prd/changes/prd-v1.json')).schema, 2, 'nothing written while busy');
  await waitExit(held);
  const ok = run(dir, process.execPath, [changeOp, dir, 'adopt', 'prd-v1']);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.equal(JSON.parse(read(dir, '.prd/changes/prd-v1.json')).schema, 3);
  assert.ok(fs.existsSync(path.join(dir, '.prd/changes/prd-v1/agreements/G-01.json')), 'the adoption snapshot landed with the record');
  assert.deepEqual(journalEntries(dir), [], 'no staging left');
  assert.ok(!fs.existsSync(path.join(dir, `${RUNTIME}/lock`)), 'lock released');
}
console.log('change transaction tests passed (adoption through the transaction API)');
