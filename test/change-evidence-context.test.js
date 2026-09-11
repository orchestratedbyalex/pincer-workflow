// Change-scoped verification identity (PRD v5 R-07; T-55): two changes sharing a
// check ID and a candidate commit keep distinct attempts and verdicts, and a
// pass or failure is never attributed to the other change; a record pointed at
// for the wrong change or a pre-migration (schema 1) record is never current
// evidence; B changing source while A is paused invalidates A's verification
// without touching A's authorization; the v4 safeguards (incomplete record,
// altered log, failed recheck, background child) stay in force for schema 2.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir, createTicket, createPrd, write, read, run, ticketScript } from './helpers.js';

const require = createRequire(import.meta.url);
const agreement = require(path.join(repo, 'template/scripts/pincer-runtime/agreement.cjs'));
const state = require(path.join(repo, 'template/scripts/pincer-runtime/state.cjs'));
const runtime = path.join(repo, 'template/scripts/pincer-runtime.cjs');
const validator = path.join(repo, 'template/scripts/pincer-evidence.cjs');
const rt = (dir, ...args) => run(dir, process.execPath, [runtime, ...args], { timeout: 60000 });
const sh = (dir, ...args) => run(dir, 'bash', [ticketScript, ...args], { timeout: 60000 });
function passes(result, label = '') { assert.equal(result.status, 0, `${label}\n${result.stdout}${result.stderr}`); return result.stdout; }
function refuses(result, status, pattern, label = '') { assert.equal(result.status, status, `${label}: exit ${status}\n${result.stdout}${result.stderr}`); assert.match(result.stdout + result.stderr, pattern, label); return result; }
function git(dir, ...args) { return passes(run(dir, 'git', args), `git ${args.join(' ')}`).trim(); }
function commit(dir, message) {
  git(dir, 'add', '-A');
  git(dir, '-c', 'user.name=Pincer Test', '-c', 'user.email=test@example.invalid', 'commit', '-q', '--allow-empty', '-m', message);
  return git(dir, 'rev-parse', 'HEAD');
}
const record = (dir, id) => JSON.parse(read(dir, `.prd/changes/${id}.json`));
const digestOf = (dir, id) => agreement.compute(dir, record(dir, id)).digest;
const statusJson = (dir, ...args) => JSON.parse(passes(rt(dir, 'status', '--json', ...args)));
const REF = 'session 2026-09-11, user message';
// Two authorized changes with one ticket each; A's ticket checks value.txt, B's checks other.txt.
function fixture() {
  const dir = tempDir(); git(dir, 'init', '-q');
  createPrd(dir, 1); createPrd(dir, 2);
  createTicket(dir, { id: 'T-01', prd: '.prd/prd-v1.md', command: 'test "$(cat value.txt)" = good', criteria: '- [x] a' });
  createTicket(dir, { id: 'T-02', prd: '.prd/prd-v2.md', command: 'test "$(cat other.txt)" = fine', criteria: '- [x] b' });
  write(dir, 'value.txt', 'good'); write(dir, 'other.txt', 'fine'); write(dir, '.gitignore', '.pincer/\n');
  commit(dir, 'base');
  passes(rt(dir, 'register', '--prd', '.prd/prd-v1.md', '--change', 'a'));
  passes(rt(dir, 'register', '--prd', '.prd/prd-v2.md', '--change', 'b'));
  passes(rt(dir, 'change', 'authorize', 'a', '--agreement', digestOf(dir, 'a'), '--reference', REF, '--excerpt', 'A ok'));
  passes(rt(dir, 'change', 'authorize', 'b', '--agreement', digestOf(dir, 'b'), '--reference', REF, '--excerpt', 'B ok'));
  commit(dir, 'registered');
  return dir;
}
function workThrough(dir, id, ticket) {
  passes(rt(dir, 'change', 'select', id)); passes(rt(dir, 'change', 'activate', id));
  passes(sh(dir, 'start', ticket)); passes(sh(dir, 'verify', ticket)); passes(sh(dir, 'done', ticket));
  passes(rt(dir, 'change', 'complete', id));
}
function draftFor(dir, prd, candidate, { required = true } = {}) {
  const version = prd.match(/prd-v(\d+)/)[1];
  write(dir, `.prd/evidence/prd-v${version}/${candidate}/review/code-quality.md`, '# Review\nNo findings.\n');
  const draft = {
    environment: { tools: ['git'], limitations: ['fixture'] },
    coverage_review: 'R-01 maps to C-01.',
    requirements: [{ id: 'R-01', disposition: 'delivered', tickets: ['T-01'], checks: ['C-01', 'C-02'] }],
    checks: [{ id: 'C-01', kind: 'command', required }, { id: 'C-02', kind: 'review', required: true, result: 'passed', timestamp: '2026-09-11T12:00:00Z', artifacts: [`.prd/evidence/prd-v${version}/${candidate}/review/code-quality.md`], note: 'reviewer record' }],
    visual_review: { applicable: false, reason: 'fixture has no UI' },
  };
  write(dir, `.pincer/drafts/${prd.replace(/[^a-z0-9]/g, '')}.json`, JSON.stringify(draft));
  return `.pincer/drafts/${prd.replace(/[^a-z0-9]/g, '')}.json`;
}

// S-20: A and B share C-01 and the same candidate; each keeps its own attempt and
// verdict; wrong-change and historical pointers are never current evidence.
{
  const dir = fixture();
  workThrough(dir, 'a', 'T-01');
  workThrough(dir, 'b', 'T-02');
  write(dir, '.prd/prd-v1.md', read(dir, '.prd/prd-v1.md').replace('ticketed', 'built'));
  write(dir, '.prd/prd-v2.md', read(dir, '.prd/prd-v2.md').replace('ticketed', 'built'));
  const candidate = commit(dir, 'both complete and built');
  const base = git(dir, 'rev-parse', 'HEAD~1');
  // The attempts the tickets recorded are schema 2 and carry the change and agreement.
  const ta = state.listAttempts(dir, 'ticket:a:T-01')[0];
  assert.equal(ta.schema, 2); assert.equal(ta.runtime, 2); assert.equal(ta.context.change, 'a'); assert.match(ta.context.agreement, /^[0-9a-f]{64}$/);
  assert.equal(state.validateAttempt(ta, 'ticket:a:T-01', ta.id), null);
  assert.ok(!('mode' in ta.context), 'the key hint is not persisted');
  // C-01 for A passes; C-01 for B (same command name, different content) fails.
  passes(rt(dir, 'change', 'select', 'a'));
  passes(rt(dir, 'check', 'C-01', '--candidate', candidate, '--', 'test "$(cat value.txt)" = good'));
  passes(rt(dir, 'change', 'select', 'b'));
  refuses(rt(dir, 'check', 'C-01', '--candidate', candidate, '--', 'test "$(cat other.txt)" = wrong'), 1, /✗ C-01 failed/);
  const index = state.readIndex(dir).index;
  const keyA = `candidate:a:${candidate}:C-01`, keyB = `candidate:b:${candidate}:C-01`;
  assert.ok(index.current[keyA] && index.current[keyB] && index.current[keyA] !== index.current[keyB], 'distinct pointers per change');
  const aAttempt = state.readAttempt(dir, index.current[keyA]).attempt, bAttempt = state.readAttempt(dir, index.current[keyB]).attempt;
  assert.equal(aAttempt.outcome, 'passed'); assert.equal(bAttempt.outcome, 'failed');
  assert.equal(aAttempt.context.change, 'a'); assert.equal(bAttempt.context.change, 'b');
  assert.equal(aAttempt.context.agreement, digestOf(dir, 'a')); assert.equal(bAttempt.context.agreement, digestOf(dir, 'b'));
  // Export for A succeeds from A's pass; export for B refuses on B's failure (nothing borrowed).
  passes(rt(dir, 'change', 'select', 'a'));
  const draftA = draftFor(dir, '.prd/prd-v1.md', candidate);
  assert.match(passes(rt(dir, 'evidence', 'export', '--candidate', candidate, '--base', base, '--prd', '.prd/prd-v1.md', '--draft', draftA)), /^exported \.prd\/evidence\/prd-v1\//);
  const manifestA = JSON.parse(read(dir, `.prd/evidence/prd-v1/${candidate}/manifest.json`));
  assert.equal(manifestA.change.id, 'a'); assert.equal(manifestA.checks[0].attempt.id, aAttempt.id); assert.equal(manifestA.checks[0].result, 'passed');
  commit(dir, 'evaluate A');
  passes(rt(dir, 'change', 'select', 'b'));
  const draftB = draftFor(dir, '.prd/prd-v2.md', candidate);
  refuses(rt(dir, 'evidence', 'export', '--candidate', candidate, '--base', base, '--prd', '.prd/prd-v2.md', '--draft', draftB), 1, /required check C-01 is failed/, 'B\'s export uses B\'s failed attempt');
  assert.ok(!fs.existsSync(path.join(dir, `.prd/evidence/prd-v2/${candidate}/manifest.json`)) || JSON.parse(read(dir, `.prd/evidence/prd-v2/${candidate}/manifest.json`)).checks[0].result === 'failed');
  // A's pass copied under B's key is refused: it belongs to another change.
  const copy = { ...aAttempt };
  const idx = state.readIndex(dir).index; idx.current[keyB] = aAttempt.id; state.writeIndex(dir, idx);
  refuses(rt(dir, 'evidence', 'export', '--candidate', candidate, '--base', base, '--prd', '.prd/prd-v2.md', '--draft', draftB), 1, /draft check C-01: attempt \S+ record belongs to candidate:a:/, 'a pointer at another change\'s record is refused');
  idx.current[keyB] = bAttempt.id; state.writeIndex(dir, idx);
  // A ticket pointer at another change's attempt is ATTEMPT_ERROR, never a pass.
  const idx2 = state.readIndex(dir).index; idx2.current['ticket:b:T-02'] = ta.id; state.writeIndex(dir, idx2);
  const sb = statusJson(dir);
  assert.equal(sb.tickets[0].readiness.reasons[0].code, 'ATTEMPT_ERROR'); assert.match(sb.tickets[0].readiness.reasons[0].detail, /belongs to ticket:a:T-01, not ticket:b:T-02/);
  // A schema 1 record (pre-migration shape) under a changes-mode pointer is historical, never current.
  const legacyShaped = JSON.parse(JSON.stringify(state.listAttempts(dir, 'ticket:b:T-02')[0]));
  legacyShaped.schema = 1; legacyShaped.runtime = 1; delete legacyShaped.context.agreement; legacyShaped.id = '000099-20260911T000000Z-legacy'; legacyShaped.sequence = 99;
  for (const k of ['stdout', 'stderr']) { legacyShaped.artifacts[k].path = `.pincer/runtime/attempts/${legacyShaped.id}/${k}.log`; write(dir, legacyShaped.artifacts[k].path, ''); legacyShaped.artifacts[k].sha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'; legacyShaped.artifacts[k].bytes = 0; }
  state.writeAttempt(dir, legacyShaped);
  const idx3 = state.readIndex(dir).index; idx3.current['ticket:b:T-02'] = legacyShaped.id; idx3.sequence = 99; state.writeIndex(dir, idx3);
  assert.equal(state.validateAttempt(legacyShaped, 'ticket:b:T-02', legacyShaped.id), null, 'the schema 1 record is complete');
  const hist = statusJson(dir);
  assert.equal(hist.tickets[0].readiness.reasons[0].code, 'HISTORICAL_EVIDENCE');
  assert.match(hist.tickets[0].readiness.reasons[0].detail, /recorded under schema 1 \(before this project used change records\) and is history, not current evidence/);
  const legacyCandidate = JSON.parse(JSON.stringify(bAttempt)); legacyCandidate.schema = 1; legacyCandidate.runtime = 1; delete legacyCandidate.context.agreement; legacyCandidate.outcome = 'passed'; legacyCandidate.exit_code = 0;
  state.writeAttempt(dir, legacyCandidate);
  refuses(rt(dir, 'evidence', 'export', '--candidate', candidate, '--base', base, '--prd', '.prd/prd-v2.md', '--draft', draftB), 1, /(record belongs to candidate:[0-9a-f]{40}:C-01, not candidate:b:[0-9a-f]{40}:C-01|was recorded under schema 1 \(before this project used change records\) and is history); run the check again/, 'export never promotes a historical record (its pre-migration key never matches a change-scoped pointer)');
  passes(rt(dir, 'change', 'reopen', 'b', '--reason', 'historical evidence check'));
  refuses(sh(dir, 'done', 'T-02'), 1, /HISTORICAL_EVIDENCE/, 'closure never consumes historical evidence');
}

// S-21: B changes source while A is paused; back on A the authorization stays
// current and A's verification is stale until a fresh pass.
{
  const dir = fixture();
  passes(rt(dir, 'change', 'select', 'a')); passes(rt(dir, 'change', 'activate', 'a'));
  passes(sh(dir, 'start', 'T-01')); passes(sh(dir, 'verify', 'T-01')); passes(sh(dir, 'done', 'T-01'));
  assert.equal(statusJson(dir).tickets[0].readiness.ready, true);
  passes(rt(dir, 'change', 'pause', 'a', '--reason', 'switching to B'));
  passes(rt(dir, 'change', 'select', 'b')); passes(rt(dir, 'change', 'activate', 'b'));
  write(dir, 'src/new-feature.js', 'module.exports = 2;\n');
  passes(sh(dir, 'start', 'T-02')); passes(sh(dir, 'verify', 'T-02')); passes(sh(dir, 'done', 'T-02'));
  commit(dir, 'B work');
  passes(rt(dir, 'change', 'pause', 'b', '--reason', 'back to A'));
  passes(rt(dir, 'change', 'select', 'a'));
  const back = statusJson(dir);
  assert.equal(back.change.agreement.verdict, 'current', 'A keeps its authorization');
  assert.equal(back.change.lifecycle.state, 'paused');
  assert.equal(back.tickets[0].status, 'done');
  assert.equal(back.tickets[0].readiness.reasons[0].code, 'SOURCE_CHANGED');
  assert.match(back.tickets[0].readiness.reasons[0].detail, /src\/new-feature\.js \(added\)/, 'the changed paths are named');
  passes(rt(dir, 'change', 'resume', 'a'));
  refuses(rt(dir, 'change', 'complete', 'a'), 1, /SOURCE_CHANGED: T-01/, 'closure needs a fresh pass');
  assert.match(passes(sh(dir, 'verify', 'T-01')), /✓ T-01 verified/);
  assert.equal(statusJson(dir).tickets[0].readiness.ready, true);
  passes(rt(dir, 'change', 'complete', 'a'));
  assert.equal(record(dir, 'a').authorizations.length, 1, 'no new authorization was needed');
}

// The v4 safeguards hold for schema 2 records: a stripped record, an altered log,
// a failed recheck and a background child keep the ticket non-ready.
{
  const dir = fixture();
  passes(rt(dir, 'change', 'select', 'a')); passes(rt(dir, 'change', 'activate', 'a'));
  passes(sh(dir, 'start', 'T-01')); passes(sh(dir, 'verify', 'T-01'));
  const a = state.listAttempts(dir, 'ticket:a:T-01')[0];
  assert.equal(statusJson(dir).tickets[0].readiness.ready, true);
  fs.appendFileSync(path.join(dir, a.artifacts.stdout.path), 'tampered\n');
  let s = statusJson(dir);
  assert.equal(s.tickets[0].readiness.reasons[0].code, 'EVIDENCE_MISSING'); assert.match(s.tickets[0].readiness.reasons[0].detail, /stdout log was altered/);
  refuses(sh(dir, 'done', 'T-01'), 1, /EVIDENCE_MISSING/);
  write(dir, a.artifacts.stdout.path, read(dir, a.artifacts.stdout.path).replace('tampered\n', ''));
  assert.equal(statusJson(dir).tickets[0].readiness.ready, true);
  const stripped = { id: a.id, outcome: 'passed', schema: 2, runtime: 2, context: a.context };
  state.writeAttempt(dir, stripped);
  s = statusJson(dir);
  assert.equal(s.tickets[0].readiness.reasons[0].code, 'ATTEMPT_ERROR'); assert.match(s.tickets[0].readiness.reasons[0].detail, /incomplete or malformed/);
  refuses(sh(dir, 'done', 'T-01'), 1, /ATTEMPT_ERROR/);
  state.writeAttempt(dir, a);
  write(dir, 'value.txt', 'bad');
  refuses(sh(dir, 'verify', 'T-01'), 1, /FAILED/);
  assert.equal(statusJson(dir).tickets[0].readiness.reasons[0].code, 'CHECK_FAILED');
  write(dir, 'value.txt', 'good');
  refuses(sh(dir, 'done', 'T-01'), 1, /CHECK_FAILED/, 'a later source fix does not revive the failed attempt');
  // A check that exits 0 leaving a background child on the pipes is timed out, not passed.
  write(dir, 'tickets/T-01-example.md', read(dir, 'tickets/T-01-example.md').replace('test "$(cat value.txt)" = good', 'sleep 30 &\ntrue').replace('size: S', 'size: S\ntimeout: 2'));
  passes(rt(dir, 'change', 'authorize', 'a', '--agreement', digestOf(dir, 'a'), '--delegated', '--basis', 'A-01', '--explanation', 'test fixture'));
  const bg = sh(dir, 'verify', 'T-01');
  assert.equal(bg.status, 124, bg.stdout + bg.stderr);
  assert.equal(statusJson(dir).tickets[0].readiness.reasons[0].code, 'ATTEMPT_TIMED_OUT');
  const latest = state.listAttempts(dir, 'ticket:a:T-01').at(-1);
  assert.equal(latest.schema, 2); assert.equal(latest.outcome, 'timed_out');
  assert.equal(run(dir, process.execPath, [validator, 'validate', 'nothing.json']).status, 1, 'validator binary still runs');
}
console.log('change evidence context tests passed');
