'use strict';
// PINCER runtime — local state store (docs/runtime-contracts.md, "Attempts").
// Everything under <root>/.pincer/runtime/ belongs to this worktree: an index
// with the authoritative sequence and current pointers, one record per attempt,
// content-addressed source manifests, an exclusive lock directory and a journal
// for atomic replacement. Nothing here is a second editable truth.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { nowIso, atomicWrite, readJson } = require('./fsutil.cjs');

const RUNTIME_DIR = '.pincer/runtime';
const INDEX_SCHEMA = 1;
const LOCK_WAIT_MS = 10000;
const LOCK_POLL_MS = 100;

function paths(root) {
  const dir = path.join(root, RUNTIME_DIR);
  return {
    dir,
    index: path.join(dir, 'index.json'),
    attempts: path.join(dir, 'attempts'),
    manifests: path.join(dir, 'manifests'),
    lock: path.join(dir, 'lock'),
    owner: path.join(dir, 'lock', 'owner.json'),
    journal: path.join(dir, 'journal'),
  };
}
function ensureLayout(root) {
  const p = paths(root);
  for (const dir of [p.dir, p.attempts, p.manifests, p.journal]) fs.mkdirSync(dir, { recursive: true });
  return p;
}
const exists = root => fs.existsSync(paths(root).dir);

const emptyIndex = () => ({ schema: INDEX_SCHEMA, sequence: 0, current: {}, running: [] });
function validateIndex(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return 'index must be a JSON object';
  if (doc.schema !== INDEX_SCHEMA) return `unsupported index schema ${JSON.stringify(doc.schema)}`;
  if (!Number.isInteger(doc.sequence) || doc.sequence < 0) return 'sequence must be a non-negative integer';
  if (!doc.current || typeof doc.current !== 'object' || Array.isArray(doc.current)) return 'current must be an object';
  if (!Array.isArray(doc.running) || !doc.running.every(id => typeof id === 'string')) return 'running must be an array of attempt IDs';
  return null;
}
// Read the index; a missing file is an empty index, a malformed one is an error
// (code INVALID) and is never overwritten by inspection.
function readIndex(root) {
  const p = paths(root);
  if (!fs.existsSync(p.index)) return { index: emptyIndex(), missing: true };
  const read = readJson(p.index);
  if (read.error) return { error: `${RUNTIME_DIR}/index.json: ${read.error}`, code: 'INVALID' };
  const invalid = validateIndex(read.data);
  if (invalid) return { error: `${RUNTIME_DIR}/index.json: ${invalid}`, code: 'INVALID' };
  return { index: read.data };
}
function writeIndex(root, index) {
  const p = ensureLayout(root);
  atomicWrite(p.index, `${JSON.stringify(index, null, 2)}\n`, { journalDir: p.journal });
}

function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
}
function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

class StateBusy extends Error {
  constructor(message, owner) { super(message); this.code = 'STATE_BUSY'; this.owner = owner; }
}

// Acquire the exclusive lock: mkdir is atomic; a lock whose owner pid is dead on
// this host is reclaimed with a diagnostic; a live or foreign-host owner is never
// stolen. Returns a release function.
function acquireLock(root, { waitMs, command = 'runtime', log = message => process.stderr.write(`${message}\n`) } = {}) {
  const p = ensureLayout(root);
  const bound = waitMs ?? (Number(process.env.PINCER_LOCK_WAIT_MS) > 0 ? Number(process.env.PINCER_LOCK_WAIT_MS) : LOCK_WAIT_MS);
  const deadline = Date.now() + bound;
  for (;;) {
    try {
      fs.mkdirSync(p.lock);
      fs.writeFileSync(p.owner, `${JSON.stringify({ pid: process.pid, ppid: process.ppid, host: os.hostname(), started: nowIso(), command }, null, 2)}\n`);
      let released = false;
      return () => { if (released) return; released = true; try { fs.rmSync(p.lock, { recursive: true, force: true }); } catch { /* already gone */ } };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    const owner = readJson(p.owner).data || null;
    if (owner && owner.host === os.hostname() && !isAlive(owner.pid)) {
      log(`pincer: reclaiming stale lock left by pid ${owner.pid} (${owner.command || 'unknown command'}, started ${owner.started || '?'}); the process is no longer running`);
      try { fs.rmSync(p.lock, { recursive: true, force: true }); } catch { /* raced with another reclaim */ }
      continue;
    }
    if (Date.now() >= deadline) {
      const who = owner ? `pid ${owner.pid} on ${owner.host} (${owner.command || 'unknown command'}, started ${owner.started || '?'})` : 'an unknown owner (no owner.json)';
      throw new StateBusy(`${RUNTIME_DIR}/lock is held by ${who}; retry, or run recover if that process died`, owner);
    }
    sleep(LOCK_POLL_MS);
  }
}
function withLock(root, fn, options) {
  const release = acquireLock(root, options);
  try { return fn(); } finally { release(); }
}

const compactTimestamp = () => nowIso().replace(/[-:]/g, '');
const attemptId = sequence => `${String(sequence).padStart(6, '0')}-${compactTimestamp()}-${crypto.randomBytes(3).toString('hex')}`;
const contextKey = context => (context.kind === 'candidate' ? `candidate:${context.candidate}:${context.check}` : `ticket:${context.change}:${context.ticket}`);

function attemptFile(root, id) { return path.join(paths(root).attempts, `${id}.json`); }
function writeAttempt(root, attempt) {
  const p = ensureLayout(root);
  atomicWrite(attemptFile(root, attempt.id), `${JSON.stringify(attempt, null, 2)}\n`, { journalDir: p.journal });
}
function readAttempt(root, id) {
  const read = readJson(attemptFile(root, id));
  if (read.error) return { error: `${RUNTIME_DIR}/attempts/${id}.json: ${read.error}` };
  return { attempt: read.data };
}
function listAttempts(root, key) {
  const p = paths(root);
  if (!fs.existsSync(p.attempts)) return [];
  const out = [];
  for (const name of fs.readdirSync(p.attempts)) {
    if (!name.endsWith('.json') || name.startsWith('.')) continue;
    const read = readJson(path.join(p.attempts, name));
    if (read.error || !read.data || typeof read.data !== 'object') continue;
    if (!key || contextKey(read.data.context || {}) === key) out.push(read.data);
  }
  return out.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
}
// The attempt the index points at for a context, falling back to the highest
// sequence on disk when the pointer is missing.
function latestAttempt(root, key, index) {
  const idx = index || readIndex(root).index;
  const pointed = idx && idx.current && idx.current[key];
  if (pointed) {
    const read = readAttempt(root, pointed);
    if (read.attempt) return read.attempt;
  }
  const all = listAttempts(root, key);
  return all.length ? all[all.length - 1] : null;
}

// Diagnose and repair after a crash: finalize running attempts whose owner is
// dead on this host as interrupted, report the rest, remove stray journal files.
// Never promotes an unfinished record to passed.
function recover(root, options = {}) {
  return withLock(root, () => {
    const p = paths(root);
    const read = readIndex(root);
    if (read.error) { const e = new Error(read.error); e.code = 'INVALID'; throw e; }
    const index = read.index;
    const report = { finalized: [], live: [], foreign: [], missing: [], journal: [] };
    const stillRunning = [];
    for (const id of index.running) {
      const attempt = readAttempt(root, id).attempt;
      if (!attempt) { report.missing.push(id); continue; }
      if (attempt.outcome !== 'running') continue;
      const owner = attempt.owner || {};
      if (owner.host !== os.hostname()) { report.foreign.push({ id, owner }); stillRunning.push(id); continue; }
      if (isAlive(owner.pid)) { report.live.push({ id, owner }); stillRunning.push(id); continue; }
      attempt.outcome = 'interrupted';
      attempt.finished = nowIso();
      attempt.limitations = [...(attempt.limitations || []), `finalized as interrupted by recover: owner pid ${owner.pid} was no longer running`];
      const childPid = attempt.child && attempt.child.pid;
      if (childPid && isAlive(childPid)) {
        try { process.kill(-childPid, 'SIGTERM'); } catch { try { process.kill(childPid, 'SIGTERM'); } catch { /* gone */ } }
        setTimeout(() => { try { process.kill(-childPid, 'SIGKILL'); } catch { /* gone */ } }, 5000).unref();
        attempt.limitations.push(`orphaned child process group ${childPid} was sent SIGTERM (SIGKILL after 5 s)`);
      }
      writeAttempt(root, attempt);
      report.finalized.push(id);
    }
    if (fs.existsSync(p.journal)) {
      for (const name of fs.readdirSync(p.journal)) {
        const file = path.join(p.journal, name);
        try { fs.rmSync(file, { force: true }); report.journal.push(`${RUNTIME_DIR}/journal/${name}`); } catch { /* ignore */ }
      }
    }
    if (stillRunning.length !== index.running.length || report.missing.length) {
      index.running = stillRunning;
      writeIndex(root, index);
    }
    return report;
  }, { command: 'recover', ...options });
}

module.exports = {
  RUNTIME_DIR, INDEX_SCHEMA, LOCK_WAIT_MS, StateBusy,
  paths, ensureLayout, exists, emptyIndex, readIndex, writeIndex, isAlive,
  acquireLock, withLock, attemptId, contextKey, writeAttempt, readAttempt, listAttempts, latestAttempt, recover,
};
