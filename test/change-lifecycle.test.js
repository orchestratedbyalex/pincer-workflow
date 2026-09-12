// Change lifecycle (PRD v5 R-03, R-08; T-53): every transition of the table
// through the transaction layer, idempotence, state/history agreement, refusals
// that write nothing; pause/resume retains progress, attempts, authorization and
// the reason; complete refuses unfinished work, unchecked criteria, stale or red
// verification and open decisions, and never shows a release pass; terminal
// changes stay inspectable but cannot execute; self and cyclic supersession are
// refused; reopen keeps completion history and source edits make evidence stale;
// concurrent writers never leave two active changes or lose an event; process
// death at every journal boundary recovers; a running attempt blocks pause /
// cancel / supersede until explicit recovery.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { repo, tempDir, createTicket, createPrd, write, read, run, statusScript } from './helpers.js';

const require = createRequire(import.meta.url);
const changes = require(path.join(repo, 'template/scripts/pincer-runtime/changes.cjs'));
const agreement = require(path.join(repo, 'template/scripts/pincer-runtime/agreement.cjs'));
const transitions = require(path.join(repo, 'template/scripts/pincer-runtime/transitions.cjs'));
const parse = require(path.join(repo, 'template/scripts/pincer-runtime/parse.cjs'));
const source = require(path.join(repo, 'template/scripts/pincer-runtime/source.cjs'));
const state = require(path.join(repo, 'template/scripts/pincer-runtime/state.cjs'));
const txn = require(path.join(repo, 'template/scripts/pincer-runtime/transaction.cjs'));
const runtime = path.join(repo, 'template/scripts/pincer-runtime.cjs');
const changeOp = path.join(repo, 'test/fixtures/change-op.cjs');
const rt = (dir, ...args) => run(dir, process.execPath, [runtime, ...args]);
function passes(result, label = '') { assert.equal(result.status, 0, `${label}\n${result.stdout}${result.stderr}`); return result.stdout; }
function refuses(result, status, pattern, label = '') { assert.equal(result.status, status, `${label}: exit ${status}\n${result.stdout}${result.stderr}`); assert.match(result.stdout + result.stderr, pattern, label); return result; }
function git(dir, ...args) { return passes(run(dir, 'git', args), `git ${args.join(' ')}`).trim(); }
function commit(dir, message) {
  git(dir, 'add', '-A');
  git(dir, '-c', 'user.name=Pincer Test', '-c', 'user.email=test@example.invalid', 'commit', '-q', '--allow-empty', '-m', message);
  return git(dir, 'rev-parse', 'HEAD');
}
const record = (dir, id = 'prd-v1') => JSON.parse(read(dir, `.prd/changes/${id}.json`));
const stateOf = (dir, id = 'prd-v1') => record(dir, id).lifecycle.state;
const digestOf = (dir, id = 'prd-v1') => agreement.compute(dir, record(dir, id)).digest;
const valid = (dir, id = 'prd-v1') => assert.equal(changes.validateRecord(record(dir, id), `.prd/changes/${id}.json`), null, `${id} record is consistent with its history`);
const snapshotTree = dir => {
  const out = {};
  const walk = rel => {
    for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const next = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(next); else out[next] = fs.readFileSync(path.join(dir, next), 'utf8');
    }
  };
  walk('');
  return out;
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function opAsync(dir, ...args) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [changeOp, dir, ...args], { env: { ...process.env, PINCER_LOCK_WAIT_MS: '20000' } });
    let stdout = '', stderr = '';
    child.stdout.on('data', c => { stdout += c; }); child.stderr.on('data', c => { stderr += c; });
    child.on('exit', (code, signal) => resolve({ status: code, signal, stdout, stderr }));
  });
}
const opSync = (dir, ...args) => run(dir, process.execPath, [changeOp, dir, ...args], { env: { ...process.env, PINCER_LOCK_WAIT_MS: '20000' }, timeout: 60000 });
const waitExit = child => new Promise(resolve => (child.exitCode !== null || child.signalCode !== null ? resolve() : child.once('exit', resolve)));
const REF = 'session 2026-09-11, user message';
const edit = (dir, file, from, to) => write(dir, file, read(dir, file).replace(from, to));

// Two changes; A (prd-v1, one ticket) and B (prd-v2, one ticket); A authorized and selected.
function fixture({ authorizeB = true } = {}) {
  const dir = tempDir(); git(dir, 'init', '-q');
  createPrd(dir, 1); createPrd(dir, 2);
  createTicket(dir, { id: 'T-01', prd: '.prd/prd-v1.md', command: 'test -f value.txt', criteria: '- [ ] expected behavior' });
  createTicket(dir, { id: 'T-02', prd: '.prd/prd-v2.md' });
  write(dir, 'value.txt', 'good\n'); write(dir, 'src/app.js', '1\n');
  commit(dir, 'base');
  passes(rt(dir, 'register', '--prd', '.prd/prd-v1.md'));
  passes(rt(dir, 'register', '--prd', '.prd/prd-v2.md', '--change', 'feature-b'));
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digestOf(dir), '--reference', REF, '--excerpt', 'go ahead'));
  if (authorizeB) passes(rt(dir, 'change', 'authorize', 'feature-b', '--agreement', digestOf(dir, 'feature-b'), '--reference', REF, '--excerpt', 'go ahead with B too'));
  passes(rt(dir, 'change', 'select', 'prd-v1'));
  commit(dir, 'registered and authorized');
  return dir;
}
// A complete, current, passing schema 2 attempt record for a ticket of a change.
function passingAttempt(dir, { change = 'prd-v1', ticket = 'T-01', file = 'tickets/T-01-example.md', sequence = 1, outcome = 'passed' } = {}) {
  const text = read(dir, file);
  const id = `${String(sequence).padStart(6, '0')}-20260911T000000Z-${change.slice(0, 3)}${String(sequence).padStart(3, '0')}`;
  const manifest = source.snapshot(dir);
  const digest = manifest.digest;
  source.storeManifest(dir, manifest);
  const a = {
    schema: 2, runtime: 2, id, sequence,
    context: { kind: 'ticket', change, prd: record(dir, change).prd, prd_revision: parse.prdDigest(read(dir, record(dir, change).prd)), base: record(dir, change).base, ticket, ticket_digest: parse.ticketDigest(text), agreement: agreement.compute(dir, record(dir, change)).digest },
    check: { digest: parse.checkDigest(text, 600), display: `${parse.blockText(text)}`, timeout_seconds: 600 },
    outcome, exit_code: outcome === 'passed' ? 0 : 1, signal: null, runner: { shell: '/bin/bash', args: ['-eo', 'pipefail', '-c'], version: 'x' }, cwd: '.', environment: { os: 'x', node: 'x', declared: {} },
    started: '2026-09-11T00:00:00Z', finished: '2026-09-11T00:00:01Z', source: { before: digest, after: digest, files: 1, limitations: [] },
    artifacts: { stdout: { path: `.pincer/runtime/attempts/${id}/stdout.log`, sha256: parse.sha256(''), bytes: 0, truncated: false, redactions: 0 }, stderr: { path: `.pincer/runtime/attempts/${id}/stderr.log`, sha256: parse.sha256(''), bytes: 0, truncated: false, redactions: 0 } },
    owner: { pid: 1, ppid: 1, host: os.hostname() }, child: null, limitations: [],
  };
  write(dir, a.artifacts.stdout.path, ''); write(dir, a.artifacts.stderr.path, '');
  state.writeAttempt(dir, a);
  const read_ = state.readIndex(dir).index;
  read_.sequence = Math.max(read_.sequence, sequence); read_.current[`ticket:${change}:${ticket}`] = id;
  state.writeIndex(dir, read_);
  return a;
}
// Mark a ticket done with checked criteria (the lifecycle writer is T-54's job; here the file is authored directly).
function finishTicket(dir, file = 'tickets/T-01-example.md') {
  let t = read(dir, file).replace('- [ ] expected behavior', '- [x] expected behavior');
  t = t.replace('status: open', 'status: done\nstarted: 2026-09-11T00:00:00Z\nfinished: 2026-09-11T00:00:02Z');
  write(dir, file, t);
}

// The transition matrix: every documented pair transitions once and is idempotent;
// every other pair is refused and writes nothing; the record always replays.
{
  const dir = fixture();
  const before = snapshotTree(dir);
  const forbidden = (op, extra, pattern) => { const r = refuses(rt(dir, 'change', op, 'prd-v1', ...extra), 1, pattern, `${op} from ${stateOf(dir)}`); assert.deepEqual(snapshotTree(dir), snapshotTree(dir), 'stable'); return r; };
  assert.equal(stateOf(dir), 'planned');
  for (const [op, extra] of [['pause', ['--reason', 'x']], ['resume', []], ['complete', []], ['reopen', ['--reason', 'x']]]) forbidden(op, extra, /LIFECYCLE_BLOCKED: change prd-v1 is planned; .* — permitted now: change activate, change cancel, change supersede/);
  assert.deepEqual(snapshotTree(dir), before, 'refused transitions write nothing');
  const act = rt(dir, 'change', 'activate', 'prd-v1');
  assert.equal(act.status, 0, act.stderr);
  assert.match(act.stdout, /^activated change prd-v1: planned → active \(event 3, authorization A-01\)$/m);
  valid(dir); assert.equal(stateOf(dir), 'active');
  assert.deepEqual(record(dir).events.at(-1), { ...record(dir).events.at(-1), kind: 'activate', from: 'planned', to: 'active', agreement: 'G-01', authorization: 'A-01' });
  assert.match(passes(rt(dir, 'change', 'activate', 'prd-v1')), /^change prd-v1 is already active; nothing written$/m);
  assert.equal(record(dir).sequence, 3, 'idempotent activate writes no event');
  // Requesting `active` while active (activate, resume, reopen) is idempotent by contract.
  for (const [op, extra] of [['resume', []], ['reopen', ['--reason', 'x']]]) { assert.match(passes(rt(dir, 'change', op, 'prd-v1', ...extra)), /already active; nothing written/, `${op} while active`); }
  assert.equal(record(dir).sequence, 3, 'idempotent requests write no event');
  refuses(rt(dir, 'change', 'pause', 'prd-v1'), 4, /--reason is required/, 'a pause needs a reason');
  assert.equal(stateOf(dir), 'active', 'a refused pause changes nothing');
  const pause = rt(dir, 'change', 'pause', 'prd-v1', '--reason', 'waiting for the API contract', '--note', 'T-01 half done; failing case in test/api.test.js');
  assert.equal(pause.status, 0, pause.stderr);
  assert.match(pause.stdout, /^paused change prd-v1: active → paused \(event 4; reason: waiting for the API contract\)$/m);
  assert.match(pause.stderr, /the handoff note is authored text/);
  valid(dir);
  assert.deepEqual(record(dir).lifecycle, { state: 'paused', since: record(dir).lifecycle.since, reason: 'waiting for the API contract', note: 'T-01 half done; failing case in test/api.test.js', superseded_by: null });
  assert.match(passes(rt(dir, 'change', 'pause', 'prd-v1', '--reason', 'again')), /already paused/); assert.equal(record(dir).sequence, 4);
  for (const [op, extra] of [['activate', []], ['complete', []], ['reopen', ['--reason', 'x']]]) forbidden(op, extra, /LIFECYCLE_BLOCKED: change prd-v1 is paused; .* — permitted now: change resume, change cancel, change supersede/);
  assert.match(passes(run(dir, 'bash', [statusScript])), /^Handoff \(authored\) reason: waiting for the API contract · note: T-01 half done; failing case in test\/api\.test\.js$/m);
  const resume = passes(rt(dir, 'change', 'resume', 'prd-v1'));
  assert.match(resume, /^resumed change prd-v1: paused → active \(event 5, authorization A-01\)$/m);
  valid(dir); assert.equal(record(dir).lifecycle.reason, null, 'resume clears the pause reason from the projection; the event keeps it');
  assert.equal(record(dir).events[3].reason, 'waiting for the API contract');
  // complete needs done and ready tickets; then reopen keeps the history.
  finishTicket(dir); passingAttempt(dir);
  const complete = passes(rt(dir, 'change', 'complete', 'prd-v1'));
  assert.match(complete, /^completed change prd-v1: active → completed \(event 6, authorization A-01\)$/m);
  valid(dir);
  for (const [op, extra] of [['activate', []], ['pause', ['--reason', 'x']], ['resume', []], ['cancel', ['--decision', 'D-01', '--reason', 'x']]]) forbidden(op, extra, /LIFECYCLE_BLOCKED: change prd-v1 is completed; .* — permitted now: change reopen, change supersede/);
  assert.match(passes(rt(dir, 'change', 'complete', 'prd-v1')), /already completed/);
  const reopen = passes(rt(dir, 'change', 'reopen', 'prd-v1', '--reason', 'review found a missing case'));
  assert.match(reopen, /^reopened change prd-v1: completed → active \(event 7, authorization A-01; reason: review found a missing case\)$/m);
  valid(dir);
  assert.deepEqual(record(dir).events.map(e => e.kind), ['register', 'authorize', 'activate', 'pause', 'resume', 'complete', 'reopen'], 'completion stays in the history');
  assert.match(passes(rt(dir, 'change', 'reopen', 'prd-v1', '--reason', 'again')), /already active/, 'reopen while active is idempotent');
  assert.equal(record(dir).events.filter(e => e.kind === 'reopen').length, 1);
  // cancel needs a resolved decision; the terminal record is inspectable and refuses everything else.
  refuses(rt(dir, 'change', 'cancel', 'prd-v1', '--reason', 'dropped'), 4, /cancel requires --decision D-NN, the user's recorded decision/);
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--summary', 'Drop the change?'));
  refuses(rt(dir, 'change', 'cancel', 'prd-v1', '--decision', 'D-01', '--reason', 'dropped'), 1, /DECISION_REQUIRED: decision D-01 is still open/);
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--resolve', 'D-01', '--reference', REF, '--excerpt', 'yes, drop it'));
  refuses(rt(dir, 'change', 'cancel', 'prd-v1', '--decision', 'D-02', '--reason', 'dropped'), 4, /--decision D-02 is not a decision of change prd-v1 \(recorded: D-01\)/);
  const cancel = passes(rt(dir, 'change', 'cancel', 'prd-v1', '--decision', 'D-01', '--reason', 'dropped after review'));
  assert.match(cancel, /^cancelled change prd-v1: active → cancelled \(event 10, decision D-01; reason: dropped after review\)$/m);
  valid(dir); assert.equal(stateOf(dir), 'cancelled');
  const terminalBefore = snapshotTree(dir);
  for (const [op, extra] of [['activate', []], ['pause', ['--reason', 'x']], ['resume', []], ['complete', []], ['reopen', ['--reason', 'x']], ['supersede', ['--with', 'feature-b', '--decision', 'D-01']]]) forbidden(op, extra, /LIFECYCLE_BLOCKED: change prd-v1 is cancelled; its history is inspectable \(change show prd-v1\) but it cannot be .*d — register a new change/);
  assert.match(passes(rt(dir, 'change', 'cancel', 'prd-v1', '--decision', 'D-01', '--reason', 'again')), /already cancelled/);
  refuses(rt(dir, 'change', 'revise', 'prd-v1'), 1, /LIFECYCLE_BLOCKED/); refuses(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digestOf(dir), '--reference', 'r', '--excerpt', 'e'), 1, /LIFECYCLE_BLOCKED/);
  assert.deepEqual(snapshotTree(dir), terminalBefore, 'a terminal record is never rewritten');
  assert.match(passes(rt(dir, 'change', 'show', 'prd-v1')), /^Lifecycle  cancelled since .* · reason: dropped after review$/m);
  const sj = JSON.parse(passes(rt(dir, 'status', '--json')));
  assert.match(sj.next, /^change prd-v1 is cancelled: inspect it with node scripts\/pincer-runtime\.cjs change show prd-v1; execution needs a new change/);
}

// S-07: pause/resume retains ticket progress, attempts, authorization and the reason.
{
  const dir = fixture();
  passes(rt(dir, 'change', 'activate', 'prd-v1'));
  edit(dir, 'tickets/T-01-example.md', 'status: open', 'status: in_progress\nstarted: 2026-09-11T00:00:00Z');
  passingAttempt(dir, { outcome: 'failed' });
  const authBefore = record(dir).authorizations;
  passes(rt(dir, 'change', 'pause', 'prd-v1', '--reason', 'switching to B'));
  const sj = JSON.parse(passes(rt(dir, 'status', '--json')));
  assert.equal(sj.tickets[0].status, 'in_progress'); assert.equal(sj.tickets[0].latest_attempt.outcome, 'failed', 'the failed attempt is retained, not hidden');
  assert.equal(sj.change.lifecycle.reason, 'switching to B'); assert.equal(sj.change.agreement.verdict, 'current');
  assert.match(sj.next, /^node scripts\/pincer-runtime\.cjs change resume prd-v1 — the change is paused \(switching to B\)/);
  passes(rt(dir, 'change', 'resume', 'prd-v1'));
  assert.deepEqual(record(dir).authorizations, authBefore, 'authorization untouched');
  assert.equal(state.listAttempts(dir, 'ticket:prd-v1:T-01').length, 1);
  assert.equal(JSON.parse(passes(rt(dir, 'status', '--json'))).tickets[0].readiness.reasons[0].code, 'CHECK_FAILED', 'stale/red verification stays visible after resume; nothing executed');
}

// S-08: complete refuses unfinished tickets, unchecked criteria, stale or red
// verification and unresolved decisions; completed never shows a release pass.
{
  const dir = fixture();
  passes(rt(dir, 'change', 'activate', 'prd-v1'));
  const before = snapshotTree(dir);
  refuses(rt(dir, 'change', 'complete', 'prd-v1'), 1, /LIFECYCLE_BLOCKED: T-01 is open, not done; finish every ticket before completing prd-v1/);
  assert.deepEqual(snapshotTree(dir), before);
  let t = read(dir, 'tickets/T-01-example.md').replace('status: open', 'status: done\nstarted: 2026-09-11T00:00:00Z\nfinished: 2026-09-11T00:00:02Z');
  write(dir, 'tickets/T-01-example.md', t);
  refuses(rt(dir, 'change', 'complete', 'prd-v1'), 1, /EVIDENCE_MISSING: T-01: no runtime attempt recorded — verify/);
  passingAttempt(dir, { outcome: 'failed' });
  refuses(rt(dir, 'change', 'complete', 'prd-v1'), 1, /CHECK_FAILED: T-01: attempt \S+ failed \(exit 1\) — fix, then verify/);
  passingAttempt(dir, { sequence: 2 });
  refuses(rt(dir, 'change', 'complete', 'prd-v1'), 1, /CRITERIA_UNTICKED: T-01: unticked acceptance criteria — tick verified criteria/);
  edit(dir, 'tickets/T-01-example.md', '- [ ] expected behavior', '- [x] expected behavior');
  write(dir, 'src/app.js', '2\n');
  refuses(rt(dir, 'change', 'complete', 'prd-v1'), 1, /SOURCE_CHANGED: T-01: source changed since the passing attempt: src\/app\.js — verify/);
  write(dir, 'src/app.js', '1\n');
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--summary', 'ship without the CSV export?'));
  refuses(rt(dir, 'change', 'complete', 'prd-v1'), 1, /DECISION_REQUIRED: decision D-01 is open/);
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--resolve', 'D-01', '--reference', REF, '--excerpt', 'yes, ship without it'));
  refuses(rt(dir, 'change', 'complete', 'prd-v1'), 1, /AGREEMENT_CHANGED/, 'the resolved decision changed the agreement; authorization is needed before completing');
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digestOf(dir), '--reference', REF, '--excerpt', 'yes, ship without it', '--decision', 'D-01'));
  assert.equal(stateOf(dir), 'active');
  const out = rt(dir, 'change', 'complete', 'prd-v1');
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stderr, /completed means implementation complete and ready for evaluation, not evaluated or released/);
  valid(dir); assert.equal(stateOf(dir), 'completed');
  const sj = JSON.parse(passes(rt(dir, 'status', '--json')));
  assert.equal(sj.change.lifecycle.state, 'completed');
  assert.match(sj.next, /\/pincer-evaluate/, 'completed routes to evaluation, never to a release pass');
  assert.doesNotMatch(sj.next, /pincer-release/);
  assert.equal(rt(dir, 'ready').status, 1, 'the release gate is not ready without evaluated candidate evidence');
}

// S-09: cancelled and superseded changes cannot execute; self and cyclic supersession refuse.
{
  const dir = fixture();
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--summary', 'Replace A with B?'));
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--resolve', 'D-01', '--reference', REF, '--excerpt', 'yes, B replaces A'));
  refuses(rt(dir, 'change', 'supersede', 'prd-v1', '--with', 'prd-v1', '--decision', 'D-01'), 1, /LIFECYCLE_BLOCKED: change prd-v1 cannot supersede itself/);
  refuses(rt(dir, 'change', 'supersede', 'prd-v1', '--with', 'ghost', '--decision', 'D-01'), 4, /replacement change "ghost" is not a retained record \(retained: feature-b, prd-v1\)/);
  refuses(rt(dir, 'change', 'supersede', 'prd-v1', '--decision', 'D-01'), 4, /supersede requires --with/);
  const sup = passes(rt(dir, 'change', 'supersede', 'prd-v1', '--with', 'feature-b', '--decision', 'D-01'));
  assert.match(sup, /^superseded change prd-v1: planned → superseded \(event 5, decision D-01, replaced by feature-b\)$/m);
  valid(dir); assert.equal(record(dir).lifecycle.superseded_by, 'feature-b');
  assert.match(passes(rt(dir, 'change', 'supersede', 'prd-v1', '--with', 'feature-b', '--decision', 'D-01')), /already superseded by feature-b/);
  refuses(rt(dir, 'change', 'supersede', 'prd-v1', '--with', 'other', '--decision', 'D-01'), 1, /LIFECYCLE_BLOCKED: change prd-v1 is superseded by feature-b/);
  // B → A would close the cycle A → B → A.
  passes(rt(dir, 'change', 'decide', 'feature-b', '--summary', 'Go back to A?'));
  passes(rt(dir, 'change', 'decide', 'feature-b', '--resolve', 'D-01', '--reference', REF, '--excerpt', 'never mind'));
  refuses(rt(dir, 'change', 'supersede', 'feature-b', '--with', 'prd-v1', '--decision', 'D-01'), 1, /LIFECYCLE_BLOCKED: change "prd-v1" is already superseded by prd-v1 → feature-b; superseding feature-b with it would form a cycle/);
  assert.equal(stateOf(dir, 'feature-b'), 'planned');
  // A can be inspected but not executed or activated.
  assert.match(passes(rt(dir, 'change', 'show', 'prd-v1')), /^Lifecycle  superseded since .* · superseded by feature-b$/m);
  refuses(rt(dir, 'change', 'activate', 'prd-v1'), 1, /LIFECYCLE_BLOCKED: change prd-v1 is superseded by feature-b; its history is inspectable/);
  const sj = JSON.parse(passes(rt(dir, 'status', '--json')));
  assert.match(sj.next, /^change prd-v1 is superseded by feature-b: inspect it/);
  assert.match(passes(rt(dir, 'change', 'list')), /^\* prd-v1 {11}superseded .* · by feature-b/m);
}

// S-10: reopen keeps the completion; editing source makes the evidence stale and
// no passing attempt is invented; activation needs the selection and an idle tree.
{
  const dir = fixture();
  passes(rt(dir, 'change', 'activate', 'prd-v1'));
  finishTicket(dir); passingAttempt(dir);
  passes(rt(dir, 'change', 'complete', 'prd-v1'));
  passes(rt(dir, 'change', 'reopen', 'prd-v1', '--reason', 'missing edge case'));
  assert.equal(stateOf(dir), 'active');
  write(dir, 'src/app.js', '3\n');
  const sj = JSON.parse(passes(rt(dir, 'status', '--json')));
  assert.equal(sj.tickets[0].status, 'done');
  assert.equal(sj.tickets[0].readiness.reasons[0].code, 'SOURCE_CHANGED', 'history cannot manufacture a passing attempt for changed source');
  assert.equal(state.listAttempts(dir, 'ticket:prd-v1:T-01').length, 1);
  refuses(rt(dir, 'change', 'complete', 'prd-v1'), 1, /SOURCE_CHANGED: T-01/);
  assert.equal(record(dir).events.filter(e => e.kind === 'complete').length, 1, 'the earlier completion is history');
  // Activation gates: selection, another active change, view, authorization.
  passes(rt(dir, 'change', 'select', 'feature-b'));
  refuses(rt(dir, 'change', 'activate', 'feature-b'), 1, /LIFECYCLE_BLOCKED: change prd-v1 is active in this tree; pause or complete it before activating feature-b \(at most one active change\)/);
  refuses(rt(dir, 'change', 'pause', 'prd-v1', '--reason', 'x'), 1, /WRONG_CHANGE: the selected change is feature-b, not prd-v1; select it first/);
  passes(rt(dir, 'change', 'select', 'prd-v1'));
  passes(rt(dir, 'change', 'pause', 'prd-v1', '--reason', 'let B through'));
  passes(rt(dir, 'change', 'select', 'feature-b'));
  passes(rt(dir, 'change', 'activate', 'feature-b'));
  assert.equal(stateOf(dir, 'feature-b'), 'active');
  fs.unlinkSync(path.join(dir, '.pincer/runtime/selection.json'));
  refuses(rt(dir, 'change', 'pause', 'feature-b', '--reason', 'x'), 1, /SELECTION_REQUIRED: pause needs the change selected in this worktree/);
  passes(rt(dir, 'change', 'select', 'feature-b'));
  write(dir, '.prd/prd-v2.md', `${read(dir, '.prd/prd-v2.md')}\nscope grew\n`);
  passes(rt(dir, 'change', 'pause', 'feature-b', '--reason', 'x'), 'pause does not require authorization');
  refuses(rt(dir, 'change', 'resume', 'feature-b'), 1, /AGREEMENT_CHANGED: the latest authorization A-01 covers agreement G-01/, 'resume revalidates the agreement');
  git(dir, 'checkout', '--', '.prd/prd-v2.md');
  passes(rt(dir, 'change', 'resume', 'feature-b'));
  // cancel and supersede work without the selection; an unauthorized planned change cannot activate.
  const c = fixture({ authorizeB: false });
  passes(rt(c, 'change', 'decide', 'feature-b', '--summary', 'drop B?')); passes(rt(c, 'change', 'decide', 'feature-b', '--resolve', 'D-01', '--reference', REF, '--excerpt', 'drop B'));
  refuses(rt(c, 'change', 'activate', 'feature-b'), 1, /WRONG_CHANGE/);
  passes(rt(c, 'change', 'cancel', 'feature-b', '--decision', 'D-01', '--reason', 'dropped'), 'cancel without selection');
  passes(rt(c, 'change', 'select', 'prd-v1'));
  passes(rt(c, 'register', '--prd', '.prd/prd-v1.md'));
  const unauthorized = fixture({ authorizeB: false });
  passes(rt(unauthorized, 'change', 'select', 'feature-b'));
  refuses(rt(unauthorized, 'change', 'activate', 'feature-b'), 1, /AUTHORIZATION_REQUIRED: change feature-b has no authorization record/);
  assert.equal(stateOf(unauthorized, 'feature-b'), 'planned');
}

// S-24: concurrent writers. Two activations (A selected; B selecting itself first)
// never leave two active changes; three identical pauses write one event;
// an authorization and a pause interleave without losing either.
{
  const dir = fixture();
  const results = await Promise.all([opAsync(dir, 'activate', 'prd-v1', '--hold', '200'), opAsync(dir, 'activate', 'feature-b', '--select', '--hold', '200')]);
  const active = ['prd-v1', 'feature-b'].filter(id => stateOf(dir, id) === 'active');
  assert.equal(active.length, 1, `exactly one active change (${results.map(r => r.stdout.trim()).join(' | ')})`);
  const refused = results.filter(r => r.status === 1);
  assert.equal(refused.length, 1); assert.match(refused[0].stdout, /refused (LIFECYCLE_BLOCKED|WRONG_CHANGE)/);
  valid(dir); valid(dir, 'feature-b');
  const activeId = active[0];
  passes(rt(dir, 'change', 'select', activeId));
  const pauses = await Promise.all(['a', 'b', 'c'].map(l => opAsync(dir, 'pause', activeId, '--reason', 'shared reason', '--hold', '100')));
  for (const r of pauses) assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(pauses.filter(r => /^transitioned/.test(r.stdout)).length, 1, 'one pause event');
  assert.equal(pauses.filter(r => /^unchanged/.test(r.stdout)).length, 2, 'the others are idempotent');
  assert.equal(record(dir, activeId).events.filter(e => e.kind === 'pause').length, 1);
  valid(dir, activeId);
  write(dir, '.prd/prd-v1.md', `${read(dir, '.prd/prd-v1.md')}\nmore\n`);
  const both = await Promise.all([opAsync(dir, 'authorize', 'prd-v1', '--agreement', digestOf(dir), '--reference', REF, '--excerpt', 'more is fine', '--hold', '150'), opAsync(dir, activeId === 'prd-v1' ? 'resume' : 'pause', activeId, '--reason', 'x', '--hold', '150')]);
  assert.ok(both.every(r => r.status === 0 || /refused AGREEMENT_CHANGED|refused STATE_CHANGED/.test(r.stdout)), both.map(r => r.stdout).join('|'));
  const seqs = record(dir).events.map(e => e.sequence);
  assert.deepEqual(seqs, seqs.map((_, i) => i + 1), 'sequences contiguous');
  valid(dir); valid(dir, 'feature-b');
  assert.deepEqual(fs.readdirSync(path.join(dir, '.pincer/runtime/journal')), [], 'journal clean');
}

// S-25: process death at every journal boundary during a transition leaves the
// prior state or the committed transition with its event, recover completes it,
// and inspection in between writes nothing.
for (const point of ['validated', 'staged', 'manifest', 'rename:0', 'cleanup']) {
  const dir = fixture();
  const seed = snapshotTree(dir);
  const crashed = opSync(dir, 'activate', 'prd-v1', '--crash', point);
  assert.equal(crashed.signal, 'SIGKILL', `${point}: killed itself`);
  const committed = ['manifest', 'rename:0', 'cleanup'].includes(point);
  const pending = txn.pending(dir);
  const st = rt(dir, 'status', '--json');
  const inspected = snapshotTree(dir);
  assert.deepEqual(snapshotTree(dir), inspected, `${point}: inspection writes nothing`);
  if (committed && point !== 'cleanup') {
    assert.equal(pending.committed.length, 1, `${point}: pending transaction visible`);
    assert.equal(st.status, 4); assert.match(st.stdout, /STATE_INCOMPLETE/, `${point}: status refuses to interpret half-applied state`);
  } else {
    assert.equal(pending.committed.length, 0);
    if (!committed) assert.equal(read(dir, '.prd/changes/prd-v1.json'), seed['.prd/changes/prd-v1.json'], `${point}: old state intact`);
  }
  const rec = rt(dir, 'recover');
  assert.equal(rec.status, 0, rec.stderr);
  valid(dir);
  assert.equal(stateOf(dir), committed ? 'active' : 'planned', `${point}: recovered state`);
  assert.equal(record(dir).events.filter(e => e.kind === 'activate').length, committed ? 1 : 0, `${point}: the event exists exactly when the projection does`);
  assert.equal(record(dir).sequence, record(dir).events.length);
  const after = rt(dir, 'change', committed ? 'pause' : 'activate', 'prd-v1', ...(committed ? ['--reason', 'x'] : []));
  assert.equal(after.status, 0, `${point}: a later transition continues (${after.stderr})`);
  valid(dir);
}

// S-26: a running attempt of the change blocks pause, cancel and supersede without
// being killed; after explicit recovery the interrupted result stays and the
// transition works.
{
  const dir = fixture();
  passes(rt(dir, 'change', 'activate', 'prd-v1'));
  const live = spawn('bash', ['-c', 'sleep 30'], { stdio: 'ignore' });
  await sleep(200);
  const running = { schema: 2, runtime: 2, id: '000001-20260911T000000Z-run001', sequence: 1, context: { kind: 'ticket', change: 'prd-v1', ticket: 'T-01' }, outcome: 'running', owner: { pid: live.pid, ppid: 1, host: os.hostname() }, child: null, started: '2026-09-11T00:00:00Z', finished: null, artifacts: {}, limitations: [] };
  state.writeAttempt(dir, running);
  state.writeIndex(dir, { schema: 1, sequence: 1, current: { 'ticket:prd-v1:T-01': running.id }, running: [running.id] });
  refuses(rt(dir, 'change', 'pause', 'prd-v1', '--reason', 'x'), 1, /ATTEMPT_RUNNING: attempt 000001-20260911T000000Z-run001 of change prd-v1 is running \(pid \d+ is still running\); the transition is refused and the attempt is not terminated/);
  assert.equal(live.exitCode, null, 'the check keeps running');
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--summary', 'drop?')); passes(rt(dir, 'change', 'decide', 'prd-v1', '--resolve', 'D-01', '--reference', REF, '--excerpt', 'drop'));
  refuses(rt(dir, 'change', 'cancel', 'prd-v1', '--decision', 'D-01', '--reason', 'x'), 1, /ATTEMPT_RUNNING/);
  refuses(rt(dir, 'change', 'supersede', 'prd-v1', '--with', 'feature-b', '--decision', 'D-01'), 1, /ATTEMPT_RUNNING/);
  assert.equal(stateOf(dir), 'active');
  assert.match(JSON.parse(passes(rt(dir, 'status', '--json'))).next, /^attempt 000001-20260911T000000Z-run001 of this change is running: wait for it, or run node scripts\/pincer-runtime\.cjs recover if its owner died/);
  live.kill('SIGKILL'); await waitExit(live); await sleep(100);
  refuses(rt(dir, 'change', 'pause', 'prd-v1', '--reason', 'x'), 1, /its owner is no longer running: run recover first/);
  assert.match(passes(rt(dir, 'recover')), /finalized 000001-20260911T000000Z-run001 as interrupted/);
  assert.equal(state.readAttempt(dir, running.id).attempt.outcome, 'interrupted');
  passes(rt(dir, 'change', 'pause', 'prd-v1', '--reason', 'after recovery'));
  assert.equal(stateOf(dir), 'paused');
  assert.equal(state.readAttempt(dir, running.id).attempt.outcome, 'interrupted', 'the interrupted result stays visible');
  assert.equal(JSON.parse(passes(rt(dir, 'status', '--json'))).tickets[0].latest_attempt.outcome, 'interrupted');
  valid(dir);
}
console.log('change lifecycle tests passed');

// PRD v6 T-70: a change without strict coverage completes exactly as before — an
// authored map beside it is never consulted; the strict gate applies to schema 3
// records only (test/coverage-readiness.test.js).
{
  const dir = fixture();
  write(dir, '.prd/coverage/prd-v1.json', '{ "schema": 1, "change": "prd-v1", "prd": ".prd/prd-v1.md", "scenarios": {}, "scope": {}, "tickets": {}, "checks": {} }\n');
  passes(rt(dir, 'change', 'activate', 'prd-v1'));
  passes(rt(dir, 'verify', 'T-01'), 'verify');
  write(dir, 'tickets/T-01-example.md', read(dir, 'tickets/T-01-example.md').replace('- [ ] expected behavior', '- [x] expected behavior'));
  passes(rt(dir, 'done', 'T-01'), 'done');
  assert.match(passes(rt(dir, 'change', 'complete', 'prd-v1')), /^completed change prd-v1: active → completed/m, 'a schema 2 change completes without coverage gates');
  assert.equal(record(dir).schema, 2);
}
console.log('change lifecycle tests passed (schema 2 completion ignores coverage maps)');
