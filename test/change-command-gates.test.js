// Command gates (PRD v5 R-02..R-05, R-08; T-54): in changes mode start, verify,
// done, check and evidence export pass one guard before any side effect. A
// wrong selection, an unpermitted lifecycle state, an incompatible view, an open
// decision and a missing or unmatched authorization refuse before a child is
// launched or a ticket written (marker-emitting checks and file snapshots prove
// it); unchanged authorization survives start/verify/done and a fresh session;
// same-filename PRD edits and check changes block until their disposition; a
// delegated revision needs fresh verification but no new approval; read-only
// readiness gates agree with the execution guard; legacy suites stay green.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir, createTicket, createPrd, write, read, run, ticketScript, statusScript } from './helpers.js';

const require = createRequire(import.meta.url);
const changes = require(path.join(repo, 'template/scripts/pincer-runtime/changes.cjs'));
const agreement = require(path.join(repo, 'template/scripts/pincer-runtime/agreement.cjs'));
const state = require(path.join(repo, 'template/scripts/pincer-runtime/state.cjs'));
const runtime = path.join(repo, 'template/scripts/pincer-runtime.cjs');
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
const record = (dir, id = 'prd-v1') => JSON.parse(read(dir, `.prd/changes/${id}.json`));
const digestOf = (dir, id = 'prd-v1') => agreement.compute(dir, record(dir, id)).digest;
const launches = (dir, marker = 'a') => { try { return read(dir, `.markers/${marker}`).split('\n').filter(Boolean).length; } catch { return 0; } };
// Everything the guard must not touch: tickets, records, index, selection, and the launch markers.
const guarded = dir => {
  const out = {};
  const walk = rel => {
    if (!fs.existsSync(path.join(dir, rel))) return;
    for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const next = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) { if (!/lock|journal/.test(entry.name)) walk(next); } else out[next] = fs.readFileSync(path.join(dir, next), 'utf8');
    }
  };
  for (const rel of ['tickets', '.prd/changes', '.pincer/runtime', '.markers']) walk(rel);
  return out;
};
const REF = 'session 2026-09-11, user message';
const edit = (dir, file, from, to) => write(dir, file, read(dir, file).replace(from, to));
// A (prd-v1: T-01, T-02 depends on T-01) and B (prd-v2: T-03); checks append a launch marker in an ignored directory.
function fixture() {
  const dir = tempDir(); git(dir, 'init', '-q');
  createPrd(dir, 1); createPrd(dir, 2);
  createTicket(dir, { id: 'T-01', prd: '.prd/prd-v1.md', command: 'echo run >> .markers/a; test -f value.txt', criteria: '- [x] expected behavior' });
  createTicket(dir, { id: 'T-02', prd: '.prd/prd-v1.md', deps: 'T-01', command: 'echo run >> .markers/a2; true', criteria: '- [x] second' });
  createTicket(dir, { id: 'T-03', prd: '.prd/prd-v2.md', command: 'echo run >> .markers/b; true', criteria: '- [x] third' });
  write(dir, 'value.txt', 'good\n'); write(dir, 'src/app.js', '1\n'); write(dir, '.gitignore', '.pincer/\n.markers/\n');
  fs.mkdirSync(path.join(dir, '.markers'));
  commit(dir, 'base');
  passes(rt(dir, 'register', '--prd', '.prd/prd-v1.md'));
  passes(rt(dir, 'register', '--prd', '.prd/prd-v2.md', '--change', 'feature-b'));
  commit(dir, 'registered');
  return dir;
}
// The guard refuses with `code` and exit, launches nothing and mutates nothing.
function refusedWithoutSideEffects(dir, args, code, pattern, label, exit = 1) {
  const before = guarded(dir);
  const r = args[0] === 'sh' ? sh(dir, ...args.slice(1)) : rt(dir, ...args);
  assert.equal(r.status, exit, `${label}: exit ${exit}\n${r.stdout}${r.stderr}`);
  assert.match(r.stderr, new RegExp(`^pincer(-ticket)?: ${code}: `, 'm'), `${label}: code ${code}\n${r.stderr}`);
  if (pattern) assert.match(r.stderr, pattern, label);
  assert.equal(r.stdout, '', `${label}: nothing on stdout`);
  assert.deepEqual(guarded(dir), before, `${label}: no ticket, record, index, selection or launch changed`);
  return r;
}

// S-04, S-11, S-12, S-13: the selection, lifecycle and authorization gates on the
// ticket commands, with markers and snapshots.
{
  const dir = fixture();
  // No selection: every execution refuses; inspection works.
  refusedWithoutSideEffects(dir, ['sh', 'start', 'T-01'], 'SELECTION_REQUIRED', /execution needs the selected change/, 'start without selection');
  refusedWithoutSideEffects(dir, ['sh', 'verify', 'T-01'], 'SELECTION_REQUIRED', null, 'verify without selection');
  refusedWithoutSideEffects(dir, ['sh', 'done', 'T-01'], 'SELECTION_REQUIRED', null, 'done without selection');
  passes(rt(dir, 'status')); passes(rt(dir, 'change', 'list'));
  // Wrong change: B's ticket while A is selected (S-04).
  passes(rt(dir, 'change', 'select', 'prd-v1'));
  refusedWithoutSideEffects(dir, ['sh', 'start', 'T-03'], 'WRONG_CHANGE', /T-03 \(\.prd\/prd-v2\.md\) belongs to change feature-b, but prd-v1 is selected; select it first: node scripts\/pincer-runtime\.cjs change select feature-b/, 'start B\'s ticket');
  refusedWithoutSideEffects(dir, ['sh', 'verify', 'T-03'], 'WRONG_CHANGE', null, 'verify B\'s ticket');
  assert.equal(launches(dir, 'b'), 0, 'B\'s check never launched');
  // Planned: lifecycle before authorization.
  refusedWithoutSideEffects(dir, ['sh', 'start', 'T-01'], 'LIFECYCLE_BLOCKED', /change prd-v1 is planned \(start runs on active changes\); activate it first/, 'start on a planned change');
  assert.match(rt(dir, 'ready', 'T-01').stdout, /^not ready T-01: AUTHORIZATION_REQUIRED/m, 'the read-only gate names the same blockers');
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digestOf(dir), '--reference', REF, '--excerpt', 'go ahead with A'));
  refusedWithoutSideEffects(dir, ['sh', 'verify', 'T-01'], 'LIFECYCLE_BLOCKED', /activate it first/, 'verify on a planned change');
  passes(rt(dir, 'change', 'activate', 'prd-v1'));
  // S-11: with the authorization recorded once, start/verify/done run and ask nothing.
  assert.match(passes(sh(dir, 'start', 'T-01')), /^▶ T-01 started/);
  const v = sh(dir, 'verify', 'T-01');
  assert.equal(v.status, 0, v.stderr); assert.match(v.stdout, /✓ T-01 verified — attempt 000001-/);
  assert.equal(launches(dir), 1, 'the check launched once');
  const attempt = state.listAttempts(dir, 'ticket:prd-v1:T-01')[0];
  assert.equal(attempt.context.agreement, digestOf(dir), 'the attempt records the agreement it ran under');
  assert.equal(attempt.context.change, 'prd-v1');
  assert.match(passes(sh(dir, 'done', 'T-01')), /✓ T-01 done/);
  assert.equal(launches(dir), 1, 'done consumed the pass without relaunching');
  assert.equal(record(dir).authorizations.length, 1, 'no duplicate authorization was recorded by routine work');
  // S-13: ticking, starting and closing tickets keep the authorization; a dependency check follows the change's attempts.
  assert.equal(JSON.parse(passes(rt(dir, 'status', '--json'))).change.agreement.verdict, 'current');
  assert.match(passes(sh(dir, 'start', 'T-02')), /started/);
  passes(sh(dir, 'verify', 'T-02')); passes(sh(dir, 'done', 'T-02'));
  assert.equal(launches(dir, 'a2'), 1);
  // Fresh session: a new process resumes under the same authorization with no repeat approval.
  passes(rt(dir, 'change', 'pause', 'prd-v1', '--reason', 'end of session'));
  passes(rt(dir, 'change', 'resume', 'prd-v1'));
  assert.equal(record(dir).authorizations.length, 1);
  assert.match(passes(sh(dir, 'verify', 'T-01')), /✓ T-01 verified/, 'verify runs again on a done ticket of an active change');
  assert.equal(launches(dir), 2);
  // S-14/S-12: a same-filename PRD edit blocks execution until its disposition; nothing launches meanwhile.
  write(dir, '.prd/prd-v1.md', `${read(dir, '.prd/prd-v1.md')}\nR-02: also export CSV.\n`);
  refusedWithoutSideEffects(dir, ['sh', 'verify', 'T-01'], 'AGREEMENT_CHANGED', /verify refused: the latest authorization A-01 covers agreement G-01/, 'verify after a PRD edit');
  refusedWithoutSideEffects(dir, ['sh', 'done', 'T-01'], 'AGREEMENT_CHANGED', null, 'done after a PRD edit');
  refusedWithoutSideEffects(dir, ['sh', 'start', 'T-02'], 'AGREEMENT_CHANGED', null, 'start after a PRD edit');
  assert.equal(launches(dir), 2);
  assert.match(rt(dir, 'ready', 'T-01').stdout, /^not ready T-01: AGREEMENT_CHANGED/m);
  assert.match(rt(dir, 'ready').stdout, /^not ready: AGREEMENT_CHANGED/m, 'the release gate reports it too');
  // Lifecycle-only edits never block: the PRD status line is not agreement input.
  git(dir, 'checkout', '--', '.prd/prd-v1.md');
  edit(dir, '.prd/prd-v1.md', 'status: ticketed', 'status: built');
  assert.match(passes(sh(dir, 'verify', 'T-01')), /✓ T-01 verified/);
  edit(dir, '.prd/prd-v1.md', 'status: built', 'status: ticketed');
  // S-16: an open decision blocks execution; inspection and recovery still work.
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--summary', 'archive export too?'));
  refusedWithoutSideEffects(dir, ['sh', 'verify', 'T-01'], 'DECISION_REQUIRED', /decision D-01 is open/, 'verify with an open decision');
  passes(rt(dir, 'status')); passes(rt(dir, 'recover')); passes(rt(dir, 'change', 'show', 'prd-v1'));
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--resolve', 'D-01', '--reference', REF, '--excerpt', 'no, skip archives'));
  refusedWithoutSideEffects(dir, ['sh', 'verify', 'T-01'], 'AGREEMENT_CHANGED', /decisions resolved: D-01/, 'verify after the decision changed the agreement');
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digestOf(dir), '--reference', REF, '--excerpt', 'no, skip archives', '--decision', 'D-01'));
  assert.match(passes(sh(dir, 'verify', 'T-01')), /✓ T-01 verified/);
  // S-15: a delegated check change needs fresh verification but no new user approval.
  edit(dir, 'tickets/T-01-example.md', 'test -f value.txt', 'test -f value.txt && test -s value.txt');
  refusedWithoutSideEffects(dir, ['sh', 'verify', 'T-01'], 'AGREEMENT_CHANGED', /tickets changed: T-01 \(verification\)/, 'verify after a check edit');
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digestOf(dir), '--delegated', '--basis', 'A-01', '--explanation', 'regression check for approved behavior'));
  refuses(sh(dir, 'done', 'T-01'), 1, /CHECK_CHANGED/, 'the changed check needs a fresh pass before closure');
  assert.match(passes(sh(dir, 'verify', 'T-01')), /✓ T-01 verified/);
  passes(sh(dir, 'done', 'T-01'));
  assert.equal(record(dir).authorizations.filter(a => a.disposition === 'user').length, 2, 'no additional user approval was recorded');
  // S-08/S-09: completed changes allow verify but not start/done; terminal changes allow nothing.
  refuses(rt(dir, 'change', 'complete', 'prd-v1'), 1, /SOURCE_CHANGED: T-02: source changed since the passing attempt: tickets\/T-01-example\.md/, 'the check edit invalidated T-02\'s pass too (whole-source identity)');
  assert.match(passes(sh(dir, 'verify', 'T-02')), /✓ T-02 verified/);
  passes(rt(dir, 'change', 'complete', 'prd-v1'));
  refusedWithoutSideEffects(dir, ['sh', 'start', 'T-02'], 'LIFECYCLE_BLOCKED', /change prd-v1 is completed \(start runs on active changes\); start needs an active change; reopen it first/, 'start on a completed change');
  refusedWithoutSideEffects(dir, ['sh', 'done', 'T-02'], 'LIFECYCLE_BLOCKED', null, 'done on a completed change');
  assert.match(passes(sh(dir, 'verify', 'T-02')), /✓ T-02 verified/, 'verify runs on a completed change');
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--summary', 'drop?')); passes(rt(dir, 'change', 'decide', 'prd-v1', '--resolve', 'D-02', '--reference', REF, '--excerpt', 'drop'));
  passes(rt(dir, 'change', 'supersede', 'prd-v1', '--with', 'feature-b', '--decision', 'D-02'));
  for (const cmd of ['start', 'verify', 'done']) refusedWithoutSideEffects(dir, ['sh', cmd, 'T-02'], 'LIFECYCLE_BLOCKED', /the change is superseded by feature-b; register a new change/, `${cmd} on a superseded change`);
  assert.match(passes(rt(dir, 'change', 'show', 'prd-v1')), /^Lifecycle  superseded/m, 'history stays inspectable');
  assert.match(passes(run(dir, 'bash', [statusScript])), /^Runtime  changes · selected prd-v1 · superseded/m);
}

// Repository view and dangling selection gates; the ready gate agrees with the guard.
{
  const dir = fixture();
  passes(rt(dir, 'change', 'select', 'prd-v1'));
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digestOf(dir), '--reference', REF, '--excerpt', 'ok'));
  passes(rt(dir, 'change', 'activate', 'prd-v1'));
  passes(sh(dir, 'start', 'T-01'));
  commit(dir, 'authorized, active, T-01 started');
  // An unrelated branch whose history lacks the base: BASE_MISMATCH before authorization.
  const mainBranch = git(dir, 'symbolic-ref', '--short', 'HEAD');
  passes(run(dir, 'git', ['checkout', '-q', '--orphan', 'unrelated']));
  commit(dir, 'unrelated root');
  refusedWithoutSideEffects(dir, ['sh', 'verify', 'T-01'], 'BASE_MISMATCH', /is not an ancestor of HEAD [0-9a-f]{7} \(branch unrelated\)/, 'verify on an unrelated branch');
  assert.match(rt(dir, 'ready', 'T-01').stdout, /^not ready T-01: BASE_MISMATCH/m);
  git(dir, 'checkout', '-q', mainBranch);
  assert.match(passes(sh(dir, 'verify', 'T-01')), /✓ T-01 verified/);
  // The selected record vanishes: SELECTION_INVALID, no fallback to B.
  fs.unlinkSync(path.join(dir, '.prd/changes/prd-v1.json'));
  refusedWithoutSideEffects(dir, ['sh', 'verify', 'T-01'], 'SELECTION_INVALID', /the selected change "prd-v1" does not exist \(retained: feature-b\)/, 'verify with a dangling selection');
  git(dir, 'checkout', '--', '.prd/changes/prd-v1.json');
  // Unreadable state never turns permissive: a malformed record refuses with exit 4.
  const good = read(dir, '.prd/changes/feature-b.json');
  write(dir, '.prd/changes/feature-b.json', '{"schema": 2,');
  refusedWithoutSideEffects(dir, ['sh', 'verify', 'T-01'], 'MALFORMED', /feature-b\.json: malformed JSON/, 'verify with an unreadable sibling record', 4);
  write(dir, '.prd/changes/feature-b.json', good);
  assert.match(passes(sh(dir, 'verify', 'T-01')), /✓ T-01 verified/);
}

// Candidate commands: check and export need a selected, completed, authorized change
// that owns the PRD; a candidate attempt is keyed by the change; refusals launch nothing.
{
  const dir = fixture();
  passes(rt(dir, 'change', 'select', 'prd-v1'));
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digestOf(dir), '--reference', REF, '--excerpt', 'ok'));
  passes(rt(dir, 'change', 'activate', 'prd-v1'));
  for (const t of ['T-01', 'T-02']) { passes(sh(dir, 'start', t)); passes(sh(dir, 'verify', t)); passes(sh(dir, 'done', t)); }
  commit(dir, 'tickets done');
  const head = git(dir, 'rev-parse', 'HEAD');
  refusedWithoutSideEffects(dir, ['check', 'C-01', '--candidate', head, '--', 'echo run >> .markers/c; true'], 'LIFECYCLE_BLOCKED', /check refused: change prd-v1 is active \(check runs on completed changes\); check needs a completed change; complete it first/, 'check on an active change');
  assert.equal(launches(dir, 'c'), 0);
  passes(rt(dir, 'change', 'complete', 'prd-v1'));
  edit(dir, '.prd/prd-v1.md', 'status: ticketed', 'status: built');
  const candidate = commit(dir, 'completed and built');
  const check = rt(dir, 'check', 'C-01', '--candidate', candidate, '--', 'echo run >> .markers/c; true');
  assert.equal(check.status, 0, check.stderr);
  assert.equal(launches(dir, 'c'), 1);
  const index = state.readIndex(dir).index;
  assert.ok(index.current[`candidate:prd-v1:${candidate}:C-01`], 'candidate attempts are keyed by the change in changes mode');
  const a = state.readAttempt(dir, index.current[`candidate:prd-v1:${candidate}:C-01`]).attempt;
  assert.equal(a.context.change, 'prd-v1'); assert.equal(a.context.agreement, digestOf(dir));
  // Export for another PRD than the selected change's is a wrong change; for the selected one it needs the same gates.
  refusedWithoutSideEffects(dir, ['evidence', 'export', '--candidate', candidate, '--base', head, '--prd', '.prd/prd-v2.md', '--draft', 'x.json'], 'WRONG_CHANGE', /export refused: \.prd\/prd-v2\.md belongs to change feature-b, but prd-v1 is selected/, 'export for another change');
  write(dir, '.prd/prd-v1.md', `${read(dir, '.prd/prd-v1.md')}\nlate edit\n`);
  refusedWithoutSideEffects(dir, ['check', 'C-02', '--candidate', candidate, '--', 'echo run >> .markers/c; true'], 'AGREEMENT_CHANGED', null, 'check after an agreement change');
  git(dir, 'checkout', '--', '.prd/prd-v1.md');
  // The release gate: not ready until an evaluation exists, and blocked by the lifecycle for an active change.
  assert.match(rt(dir, 'ready').stdout, /^not ready: /m);
  assert.doesNotMatch(rt(dir, 'ready').stdout, /LIFECYCLE_BLOCKED/, 'a completed change is not lifecycle-blocked for release');
  passes(rt(dir, 'change', 'reopen', 'prd-v1', '--reason', 'more work'));
  assert.match(rt(dir, 'ready').stdout, /^not ready: LIFECYCLE_BLOCKED change prd-v1 is active, not completed; release audits completed changes only/m);
  // Without any selection the release gate is blocked and says so.
  fs.unlinkSync(path.join(dir, '.pincer/runtime/selection.json'));
  assert.match(rt(dir, 'ready').stdout, /SELECTION_REQUIRED/);
}
console.log('change command gate tests passed');
