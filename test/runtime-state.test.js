// Durable state and locking (PRD v4 R-05, R-06): overlapping writers cannot
// corrupt or lose records, a dead-owner lock is reclaimed but a live one is never
// stolen, a corrupt index is diagnosed and never rewritten by inspection, an
// interrupted write leaves the prior state readable, and recovery finalizes only
// dead-owner running attempts as interrupted, never as passed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { repo, tempDir, write, read, run } from './helpers.js';

const runtime = path.join(repo, 'template/scripts/pincer-runtime.cjs');
const holder = path.join(repo, 'test/fixtures/hold-lock.cjs');
const state = createRequire(import.meta.url)(path.join(repo, 'template/scripts/pincer-runtime/state.cjs'));
const rt = (dir, ...args) => run(dir, process.execPath, [runtime, ...args]);
const RUNTIME = '.pincer/runtime';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function holdLock(dir, ms) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [holder, dir, String(ms)], { stdio: ['ignore', 'pipe', 'inherit'] });
    child.stdout.on('data', chunk => { if (String(chunk).includes('held')) resolve(child); });
    child.on('error', reject);
    child.on('exit', code => { if (code !== 0) reject(new Error(`holder exited ${code}`)); });
  });
}
const waitExit = child => new Promise(resolve => (child.exitCode !== null ? resolve() : child.once('exit', resolve)));
const attempt = (id, sequence, outcome, owner = { pid: process.pid, host: os.hostname() }) => ({
  schema: 1, runtime: 1, id, sequence, context: { kind: 'ticket', change: 'prd-v1', ticket: 'T-01' }, outcome, owner, started: '2026-09-11T00:00:00Z', finished: outcome === 'running' ? null : '2026-09-11T00:00:01Z', limitations: [],
});

// S-15: a second writer receives a bounded busy result while the lock is held,
// and succeeds after release; records from both survive.
{
  const dir = tempDir();
  const child = await holdLock(dir, 2500);
  const started = Date.now();
  const busy = run(dir, process.execPath, [runtime, 'recover'], { env: { ...process.env, CLAUDE_PROJECT_DIR: dir, PINCER_LOCK_WAIT_MS: '500' } });
  const waited = Date.now() - started;
  assert.equal(busy.status, 3, `busy exit 3\n${busy.stdout}${busy.stderr}`);
  assert.match(busy.stderr, /STATE_BUSY/);
  assert.match(busy.stderr, new RegExp(`pid ${child.pid} on ${os.hostname()}`), 'names the owner');
  assert.match(busy.stderr, /hold-lock fixture/);
  assert.ok(waited >= 400 && waited < 2400, `bounded wait of about 500 ms (${waited} ms)`);
  assert.throws(() => state.withLock(dir, () => {}, { waitMs: 300 }), /is held by/, 'in-process writer is bounded too');
  await waitExit(child);
  assert.ok(!fs.existsSync(path.join(dir, `${RUNTIME}/lock`)), 'holder released the lock');
  const after = rt(dir, 'recover');
  assert.equal(after.status, 0, after.stderr);
  // Sequence allocation is authoritative and strictly increasing across writers.
  const ids = [];
  for (let i = 0; i < 3; i++) {
    state.withLock(dir, () => {
      const { index } = state.readIndex(dir);
      const sequence = index.sequence + 1;
      const id = state.attemptId(sequence);
      state.writeAttempt(dir, attempt(id, sequence, 'passed'));
      index.sequence = sequence; index.current['ticket:prd-v1:T-01'] = id;
      state.writeIndex(dir, index);
      ids.push(id);
    });
  }
  const records = state.listAttempts(dir, 'ticket:prd-v1:T-01');
  assert.deepEqual(records.map(r => r.id), ids, 'all records exist in sequence order');
  assert.deepEqual(records.map(r => r.sequence), [1, 2, 3]);
  assert.equal(state.latestAttempt(dir, 'ticket:prd-v1:T-01').id, ids[2]);
  assert.match(ids[0], /^000001-\d{8}T\d{6}Z-[0-9a-f]{6}$/);
}

// A stale lock (dead owner on this host) is reclaimed with a diagnostic; a live
// owner is not; a foreign host is never reclaimed automatically.
{
  const dir = tempDir();
  const p = state.paths(dir);
  fs.mkdirSync(p.lock, { recursive: true });
  write(dir, `${RUNTIME}/lock/owner.json`, JSON.stringify({ pid: 999999, ppid: 1, host: os.hostname(), started: '2026-09-11T00:00:00Z', command: 'crashed verify' }));
  const reclaimed = rt(dir, 'recover');
  assert.equal(reclaimed.status, 0, reclaimed.stderr);
  assert.match(reclaimed.stderr, /reclaiming stale lock left by pid 999999 \(crashed verify/);
  assert.ok(!fs.existsSync(p.lock));
  fs.mkdirSync(p.lock, { recursive: true });
  write(dir, `${RUNTIME}/lock/owner.json`, JSON.stringify({ pid: 999999, host: 'another-host.example', started: '2026-09-11T00:00:00Z', command: 'verify' }));
  assert.throws(() => state.withLock(dir, () => {}, { waitMs: 200 }), /another-host\.example/, 'foreign-host lock is not reclaimed');
  assert.ok(fs.existsSync(p.lock), 'foreign lock left in place');
  fs.rmSync(p.lock, { recursive: true });
  const child = await holdLock(dir, 1500);
  assert.throws(() => state.withLock(dir, () => {}, { waitMs: 200 }), /is held by/, 'live owner is never stolen');
  assert.ok(fs.existsSync(p.lock));
  await waitExit(child);
}

// A corrupt index is exit 4 with a diagnostic and is never overwritten.
{
  const dir = tempDir();
  write(dir, `${RUNTIME}/index.json`, '{"schema": 1, "sequence": ');
  const corrupt = rt(dir, 'recover');
  assert.equal(corrupt.status, 4);
  assert.match(corrupt.stderr, /index\.json: malformed JSON/);
  assert.equal(read(dir, `${RUNTIME}/index.json`), '{"schema": 1, "sequence": ');
  write(dir, `${RUNTIME}/index.json`, '{"schema": 7, "sequence": 0, "current": {}, "running": []}');
  assert.match(rt(dir, 'recover').stderr, /unsupported index schema 7/);
  assert.equal(state.readIndex(dir).code, 'INVALID');
}

// An interrupted write (stray journal file) leaves the prior state readable and
// is named by recover; a dead-owner running attempt is finalized as interrupted;
// a live-owner one is left running; nothing is promoted to passed.
{
  const dir = tempDir();
  const child = await holdLock(tempDir(), 1500); // a live pid that is not us
  const dead = attempt('000001-20260911T000000Z-aaaaaa', 1, 'running', { pid: 999999, host: os.hostname() });
  const live = attempt('000002-20260911T000001Z-bbbbbb', 2, 'running', { pid: child.pid, host: os.hostname() });
  const foreign = attempt('000003-20260911T000002Z-cccccc', 3, 'running', { pid: 4242, host: 'another-host.example' });
  const passed = attempt('000004-20260911T000003Z-dddddd', 4, 'passed');
  for (const a of [dead, live, foreign, passed]) state.writeAttempt(dir, a);
  state.writeIndex(dir, { schema: 1, sequence: 4, current: { 'ticket:prd-v1:T-01': dead.id }, running: [dead.id, live.id, foreign.id, '000009-missing-record'] });
  write(dir, `${RUNTIME}/journal/.index.json.12345.deadbeef.tmp`, '{"schema": 1, "sequence": 99');
  assert.equal(state.readIndex(dir).index.sequence, 4, 'prior state readable with a stray journal file');
  const out = rt(dir, 'recover');
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, new RegExp(`finalized ${dead.id} as interrupted`));
  assert.match(out.stdout, new RegExp(`still running ${live.id} \\(pid ${child.pid} is alive\\)`));
  assert.match(out.stdout, new RegExp(`still running ${foreign.id} \\(owned by another-host\\.example`));
  assert.match(out.stdout, /dropped 000009-missing-record from running: record missing/);
  assert.match(out.stdout, /removed stray journal file \.pincer\/runtime\/journal\/\.index\.json\.12345\.deadbeef\.tmp/);
  assert.ok(!fs.existsSync(path.join(dir, `${RUNTIME}/journal/.index.json.12345.deadbeef.tmp`)));
  const deadNow = state.readAttempt(dir, dead.id).attempt;
  assert.equal(deadNow.outcome, 'interrupted');
  assert.match(deadNow.finished, /Z$/);
  assert.match(deadNow.limitations[0], /finalized as interrupted by recover: owner pid 999999/);
  assert.equal(state.readAttempt(dir, live.id).attempt.outcome, 'running');
  assert.equal(state.readAttempt(dir, foreign.id).attempt.outcome, 'running');
  assert.equal(state.readAttempt(dir, passed.id).attempt.outcome, 'passed', 'finished records untouched');
  const index = state.readIndex(dir).index;
  assert.deepEqual(index.running, [live.id, foreign.id]);
  assert.equal(index.current['ticket:prd-v1:T-01'], dead.id, 'current pointer still names the interrupted attempt, never a pass');
  assert.equal(state.latestAttempt(dir, 'ticket:prd-v1:T-01').outcome, 'interrupted');
  const again = rt(dir, 'recover').stdout;
  assert.doesNotMatch(again, /finalized|dropped|removed/, 'recover is idempotent: nothing new to repair');
  assert.match(again, /still running .* is alive/);
  await waitExit(child);
}

// T-44: a stale lock is claimed by rename (no leftover claim directories, no
// owner-less lock ever visible); a lock without owner.json is treated as held;
// the index pointer is the authority for the latest attempt; recover waits for
// an orphan that ignores SIGTERM and escalates to SIGKILL before returning.
{
  const dir = tempDir();
  const p = state.paths(dir);
  fs.mkdirSync(p.lock, { recursive: true });
  write(dir, `${RUNTIME}/lock/owner.json`, JSON.stringify({ pid: 999999, host: os.hostname(), started: '2026-09-11T00:00:00Z', command: 'crashed' }));
  state.withLock(dir, () => { assert.ok(fs.existsSync(path.join(p.lock, 'owner.json')), 'a held lock always carries its owner file'); }, { waitMs: 500, log: () => {} });
  assert.deepEqual(fs.readdirSync(p.dir).filter(n => n.startsWith('lock.')), [], 'no claim or staging directories are left behind');
  fs.mkdirSync(p.lock, { recursive: true }); // an empty, owner-less directory cannot be a held lock: acquisition renames over it
  state.withLock(dir, () => { assert.equal(JSON.parse(read(dir, `${RUNTIME}/lock/owner.json`)).pid, process.pid, 'the acquirer owns the lock'); }, { waitMs: 300 });
  fs.mkdirSync(p.lock, { recursive: true }); write(dir, `${RUNTIME}/lock/stray.txt`, 'x'); // non-empty without owner.json: unknown holder, never reclaimed
  assert.throws(() => state.withLock(dir, () => {}, { waitMs: 300 }), /unknown owner/, 'a non-empty owner-less lock is treated as held');
  fs.rmSync(p.lock, { recursive: true });
  // Pointer authority.
  const passed = attempt('000001-20260911T000000Z-aaaaaa', 1, 'passed');
  const failed = attempt('000002-20260911T000001Z-bbbbbb', 2, 'failed');
  state.writeAttempt(dir, passed); state.writeAttempt(dir, failed);
  state.writeIndex(dir, { schema: 1, sequence: 2, current: { 'ticket:prd-v1:T-01': failed.id }, running: [] });
  fs.rmSync(path.join(p.attempts, `${failed.id}.json`));
  assert.equal(state.latestAttempt(dir, 'ticket:prd-v1:T-01'), null, 'a missing pointed-at record never falls back to an older pass');
  state.writeIndex(dir, { schema: 1, sequence: 2, current: {}, running: [] });
  assert.equal(state.latestAttempt(dir, 'ticket:prd-v1:T-01').id, passed.id, 'without a pointer the highest sequence on disk is used');
}
{
  const dir = tempDir();
  const stubborn = spawn('bash', ['-c', 'trap "" TERM; sleep 60'], { detached: true, stdio: 'ignore' });
  stubborn.unref();
  await sleep(300);
  const orphan = attempt('000001-20260911T000000Z-cccccc', 1, 'running', { pid: 999999, host: os.hostname() });
  orphan.child = { pid: stubborn.pid };
  state.writeAttempt(dir, orphan);
  state.writeIndex(dir, { schema: 1, sequence: 1, current: { 'ticket:prd-v1:T-01': orphan.id }, running: [orphan.id] });
  const started = Date.now();
  const out = rt(dir, 'recover');
  const took = Date.now() - started;
  assert.equal(out.status, 0, out.stderr);
  assert.ok(took >= 4500 && took < 12000, `recover waited the grace period before escalating (${took} ms)`);
  // The killed child is our own; reap it before checking (a zombie still answers signal 0).
  const exited = await Promise.race([new Promise(resolve => stubborn.once('exit', () => resolve(true))), sleep(2000).then(() => false)]);
  assert.equal(exited || stubborn.exitCode !== null || stubborn.signalCode !== null, true, 'an orphan that ignores SIGTERM is killed before recover returns');
  assert.equal(stubborn.signalCode, 'SIGKILL');
  const finalized = state.readAttempt(dir, orphan.id).attempt;
  assert.equal(finalized.outcome, 'interrupted');
  assert.ok(finalized.limitations.some(l => /ignored SIGTERM for 5 s and was sent SIGKILL/.test(l)), finalized.limitations.join('|'));
}
// Without local state there is nothing to recover and nothing is created.
{
  const dir = tempDir();
  assert.equal(rt(dir, 'recover').stdout, 'nothing to recover: no local runtime state\n');
  assert.ok(!fs.existsSync(path.join(dir, '.pincer')));
}
console.log('runtime state and locking tests passed');
