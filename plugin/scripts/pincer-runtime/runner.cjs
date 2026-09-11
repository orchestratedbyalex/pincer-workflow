'use strict';
// PINCER runtime — the attempt runner (docs/runtime-contracts.md, "Attempts",
// "Capture and sanitization"). Persists a `running` record before launch (which
// supersedes prior readiness for the context immediately), snapshots inputs
// before and after, executes the check through `bash -eo pipefail` in its own
// process group with bounded sanitized capture, enforces the timeout with
// escalation, handles signals, and finalizes the record from what actually
// happened. Nothing here decides readiness; readiness.cjs reads the records.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const parse = require('./parse.cjs');
const source = require('./source.cjs');
const state = require('./state.cjs');
const { sanitizeLine, sanitizeText } = require('./sanitize.cjs');
const { nowIso } = require('./fsutil.cjs');

const CAPTURE_LIMIT = 1024 * 1024;
const PARTIAL_LINE_LIMIT = 64 * 1024;
const GRACE_MS = 5000;
const DRAIN_MS = 2000;
const RUNNER_ARGS = ['-eo', 'pipefail', '-c'];

let bashInfo = null;
function runnerInfo() {
  if (bashInfo) return bashInfo;
  let shell = 'bash', version = 'unknown';
  try { shell = execFileSync('bash', ['-c', 'command -v bash'], { encoding: 'utf8' }).trim() || 'bash'; } catch { /* keep default */ }
  try { version = execFileSync('bash', ['--version'], { encoding: 'utf8' }).split('\n')[0]; } catch { /* keep default */ }
  bashInfo = { shell, args: RUNNER_ARGS, version };
  return bashInfo;
}

// A bounded, sanitized capture of one stream into a file, echoed to `echo` when given.
class Capture {
  constructor(file, echo) {
    this.file = file; this.echo = echo;
    this.fd = fs.openSync(file, 'w');
    this.bytes = 0; this.dropped = 0; this.redactions = 0; this.truncated = false;
    this.partial = ''; this.state = {}; this.failed = null;
  }
  write(chunk) {
    this.partial += chunk.toString('utf8');
    let index;
    while ((index = this.partial.indexOf('\n')) !== -1) {
      this.emit(this.partial.slice(0, index), true);
      this.partial = this.partial.slice(index + 1);
    }
    if (this.partial.length > PARTIAL_LINE_LIMIT) { this.emit(this.partial, false); this.partial = ''; }
  }
  emit(line, newline) {
    const { text, redactions } = sanitizeLine(line, this.state);
    this.redactions += redactions;
    const out = newline ? `${text}\n` : text;
    if (this.echo) this.echo.write(out);
    const buffer = Buffer.from(out, 'utf8');
    if (this.bytes + buffer.length <= CAPTURE_LIMIT) {
      try { fs.writeSync(this.fd, buffer); this.bytes += buffer.length; } catch (error) { this.failed = this.failed || error.message; }
    } else {
      if (!this.truncated) {
        const room = CAPTURE_LIMIT - this.bytes;
        if (room > 0) { try { fs.writeSync(this.fd, buffer.subarray(0, room)); this.bytes += room; } catch (error) { this.failed = this.failed || error.message; } }
        this.truncated = true;
        this.dropped += buffer.length - Math.max(room, 0);
      } else this.dropped += buffer.length;
    }
  }
  close() {
    if (this.partial) { this.emit(this.partial, false); this.partial = ''; }
    if (this.truncated) {
      try { fs.writeSync(this.fd, `\n[pincer: truncated, ${this.dropped} more bytes not stored]\n`); } catch (error) { this.failed = this.failed || error.message; }
    }
    fs.closeSync(this.fd);
    return { bytes: this.bytes, truncated: this.truncated, redactions: this.redactions, failed: this.failed };
  }
}

// Run one attempt. `context` is the attempt context (kind, change, prd, prd_revision,
// base, ticket/ticket_digest or candidate/check); `commands` the block lines;
// `timeoutSeconds` the effective timeout; `echo` when the output should also reach
// the terminal. Returns { attempt } or { code, problem } for refusals before launch.
async function runAttempt({ root, context, commands, timeoutSeconds, command = 'verify', echo = true, declared = {} }) {
  const block = commands.length ? `${commands.join('\n')}\n` : '';
  const checkDigest = parse.sha256(`${block}timeout=${timeoutSeconds}\n`);
  const display = sanitizeText(block).text.slice(0, 2000);
  const before = source.snapshot(root);
  if (before.problems.length) return { code: before.problems[0].code, problem: before.problems.map(p => `${p.code}: ${p.detail}`).join('\n'), problems: before.problems };

  const key = state.contextKey(context);
  let attempt, logDir, relLogDir;
  try {
    state.withLock(root, () => {
      const read = state.readIndex(root);
      if (read.error) { const e = new Error(read.error); e.code = 'INVALID'; throw e; }
      const index = read.index;
      const sequence = index.sequence + 1;
      const id = state.attemptId(sequence);
      source.storeManifest(root, before);
      relLogDir = `${state.RUNTIME_DIR}/attempts/${id}`;
      logDir = path.join(root, relLogDir);
      fs.mkdirSync(logDir, { recursive: true });
      attempt = {
        schema: 1, runtime: 1, id, sequence, context,
        check: { digest: checkDigest, display, timeout_seconds: timeoutSeconds },
        outcome: 'running', exit_code: null, signal: null,
        runner: runnerInfo(), cwd: '.',
        environment: { os: `${os.platform()} ${os.release()}`, node: process.version, declared },
        started: nowIso(), finished: null,
        source: { before: before.digest, after: null, files: before.files.length, limitations: before.limitations },
        artifacts: { stdout: { path: `${relLogDir}/stdout.log`, sha256: null, bytes: 0, truncated: false, redactions: 0 }, stderr: { path: `${relLogDir}/stderr.log`, sha256: null, bytes: 0, truncated: false, redactions: 0 } },
        owner: { pid: process.pid, ppid: process.ppid, host: os.hostname() }, child: null,
        limitations: [],
      };
      state.writeAttempt(root, attempt);
      index.sequence = sequence;
      index.current[key] = id;
      index.running.push(id);
      state.writeIndex(root, index);
    }, { command });
  } catch (error) {
    if (error.code === 'STATE_BUSY') return { code: 'STATE_BUSY', problem: error.message };
    if (error.code === 'INVALID') return { code: 'INPUT_INVALID', problem: error.message };
    return { code: 'ATTEMPT_ERROR', problem: `cannot persist the attempt record: ${error.message}` };
  }

  // Execute in a fresh process group so timeouts and signals reach every descendant.
  let child, launchError = null;
  const stdout = new Capture(path.join(logDir, 'stdout.log'), echo ? process.stdout : null);
  const stderr = new Capture(path.join(logDir, 'stderr.log'), echo ? process.stderr : null);
  let timedOut = false, interruptedBy = null, abandoned = false, killTimer = null, graceTimer = null, drainTimer = null, settle = null;
  const sent = [];
  // Signal the whole group, whether or not the shell itself has exited: a
  // background child that inherited the output pipes keeps the run alive and
  // must be terminated the same way. The bare pid is a fallback only while the
  // shell is known to be alive (after it is reaped the pid may be reused).
  const signalGroup = signal => {
    sent.push(signal);
    try { process.kill(-child.pid, signal); return; } catch { /* no group left */ }
    if (child.exitCode === null && child.signalCode === null) { try { process.kill(child.pid, signal); } catch { /* gone */ } }
  };
  const terminate = () => {
    if (!child || !child.pid || sent.length) return;
    signalGroup('SIGTERM');
    graceTimer = setTimeout(() => {
      signalGroup('SIGKILL');
      // Bound the wait for the pipes to close: a descendant that survives
      // SIGKILL (or was never reachable) must not hold the run open forever.
      drainTimer = setTimeout(() => {
        abandoned = true;
        try { child.stdout.destroy(); child.stderr.destroy(); child.unref(); } catch { /* best effort */ }
        settle({ code: child.exitCode, signal: child.signalCode });
      }, DRAIN_MS);
    }, GRACE_MS);
  };
  const onSignal = signal => { interruptedBy = signal; terminate(); };
  const exit = await new Promise(resolve => {
    let settled = false;
    settle = result => { if (!settled) { settled = true; resolve(result); } };
    try {
      child = spawn(runnerInfo().shell, [...RUNNER_ARGS, block], { cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
    } catch (error) { launchError = error.message; return settle({ code: null, signal: null }); }
    child.on('error', error => { launchError = error.message; });
    if (child.pid) {
      attempt.child = { pid: child.pid };
      try { state.withLock(root, () => state.writeAttempt(root, attempt), { command }); } catch { /* the final write records it */ }
    }
    child.stdout.on('data', chunk => stdout.write(chunk));
    child.stderr.on('data', chunk => stderr.write(chunk));
    process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal);
    killTimer = setTimeout(() => { timedOut = true; terminate(); }, timeoutSeconds * 1000);
    child.on('close', (code, signal) => settle({ code, signal }));
  });
  clearTimeout(killTimer); clearTimeout(graceTimer); clearTimeout(drainTimer);
  process.off('SIGINT', onSignal); process.off('SIGTERM', onSignal);
  const outInfo = stdout.close(), errInfo = stderr.close();
  const termination = `the child process group was sent ${sent.join(' then ')}${abandoned ? `; output capture was abandoned ${DRAIN_MS / 1000} s after SIGKILL and a descendant may still be running` : ''}`;

  const after = source.snapshot(root);
  const changed = after.digest && before.digest !== after.digest ? source.diffManifests(before, after) : [];
  attempt.finished = nowIso();
  attempt.exit_code = exit.code;
  attempt.signal = exit.signal;
  attempt.source.after = after.digest;
  for (const [name, info] of [['stdout', outInfo], ['stderr', errInfo]]) {
    const file = path.join(logDir, `${name}.log`);
    let sha = null;
    try { sha = parse.sha256(fs.readFileSync(file)); } catch { sha = null; }
    attempt.artifacts[name] = { ...attempt.artifacts[name], sha256: sha, bytes: info.bytes, truncated: info.truncated, redactions: info.redactions };
  }
  const captureFailure = outInfo.failed || errInfo.failed;
  if (launchError) { attempt.outcome = 'error'; attempt.error = `cannot launch the check: ${launchError}`; }
  else if (interruptedBy) { attempt.outcome = 'interrupted'; attempt.limitations.push(`interrupted by ${interruptedBy}; ${termination}`); }
  else if (timedOut) { attempt.outcome = 'timed_out'; attempt.limitations.push(`terminated after ${timeoutSeconds} s; ${termination}`); }
  else if (captureFailure) { attempt.outcome = 'error'; attempt.error = `capture failed: ${captureFailure}`; }
  else if (after.problems.length) { attempt.outcome = 'error'; attempt.error = `source view invalid after the run: ${after.problems[0].code} ${after.problems[0].detail}`; }
  else if (exit.code === 0 && changed.length) { attempt.outcome = 'error'; attempt.error = `SOURCE_CHANGED: the check mutated source: ${changed.slice(0, 5).join(', ')}${changed.length > 5 ? ` (+${changed.length - 5})` : ''}`; }
  else if (exit.code === 0) attempt.outcome = 'passed';
  else attempt.outcome = 'failed';
  if (changed.length && attempt.outcome !== 'error') attempt.limitations.push(`source changed during the run: ${changed.slice(0, 5).join(', ')}`);
  if (after.digest) { try { source.storeManifest(root, after); } catch { /* best effort; the digest is recorded */ } }

  try {
    state.withLock(root, () => {
      const read = state.readIndex(root);
      if (read.error) { const e = new Error(read.error); e.code = 'INVALID'; throw e; }
      const index = read.index;
      state.writeAttempt(root, attempt);
      index.running = index.running.filter(id => id !== attempt.id);
      state.writeIndex(root, index);
    }, { command });
  } catch (error) {
    return { code: 'ATTEMPT_ERROR', problem: `attempt ${attempt.id} finished ${attempt.outcome} but the record could not be finalized: ${error.message}`, attempt };
  }
  return { attempt, changed };
}

const exitFor = attempt => ({ passed: 0, failed: 1, timed_out: 124, interrupted: 130, error: 4 })[attempt.outcome] ?? 4;

module.exports = { runAttempt, exitFor, CAPTURE_LIMIT, GRACE_MS, DRAIN_MS, runnerInfo };
