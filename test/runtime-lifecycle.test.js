// Ticket lifecycle on the runtime (PRD v4 R-06, R-02, R-01): migrated closure
// consumes the current passing attempt without a duplicate run and without
// rewriting receipts; every blocked case names its reason and next step;
// deleting local state never revives a legacy receipt; a fresh clone must verify
// before closing; the legacy wrapper keeps working with the Bash library gone.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir, createTicket, createPrd, write, read, run, ticketScript, statusScript } from './helpers.js';

const runtime = path.join(repo, 'template/scripts/pincer-runtime.cjs');
const state = createRequire(import.meta.url)(path.join(repo, 'template/scripts/pincer-runtime/state.cjs'));
const rt = (dir, ...args) => run(dir, process.execPath, [runtime, ...args], { timeout: 60000 });
const sh = (dir, ...args) => run(dir, 'bash', [ticketScript, ...args], { timeout: 60000 });
function passes(result, label = '') { assert.equal(result.status, 0, `${label}\n${result.stdout}${result.stderr}`); return result.stdout; }
function refuses(result, pattern, label = '') { assert.notEqual(result.status, 0, `${label}: must refuse\n${result.stdout}`); assert.match(result.stderr, pattern, `${label}\n${result.stderr}`); return result; }
function git(dir, ...args) { return passes(run(dir, 'git', args), `git ${args.join(' ')}`).trim(); }
function commit(dir, message) {
  git(dir, 'add', '-A');
  git(dir, '-c', 'user.name=Pincer Test', '-c', 'user.email=test@example.invalid', 'commit', '-q', '--allow-empty', '-m', message);
  return git(dir, 'rev-parse', 'HEAD');
}
// A registered fixture whose T-01 check counts its runs in an ignored file.
function migrated({ command = 'mkdir -p .runs && echo run >> .runs/count; test "$(cat value.txt)" = good', criteria = '- [ ] expected behavior' } = {}) {
  const dir = tempDir(); git(dir, 'init', '-q'); createPrd(dir);
  const file = createTicket(dir, { command, criteria });
  write(dir, 'src/app.js', 'module.exports = 1;\n');
  write(dir, 'value.txt', 'good');
  write(dir, '.gitignore', '.pincer/\n.runs/\n');
  fs.mkdirSync(path.join(dir, '.runs'));
  commit(dir, 'base');
  passes(rt(dir, 'register', '--prd', '.prd/prd-v1.md'), 'register');
  commit(dir, 'register');
  return { dir, file };
}
const runs = dir => { try { return read(dir, '.runs/count').split('\n').filter(Boolean).length; } catch { return 0; } };
const attempts = dir => state.listAttempts(dir, 'ticket:prd-v1:T-01');
const tick = (dir, file) => write(dir, file, read(dir, file).replace('- [ ] expected behavior', '- [x] expected behavior'));
const front = (dir, file, key) => (read(dir, file).match(new RegExp(`^${key}: *([^#\\n]*)`, 'm')) || [, ''])[1].trim();

// S-18: two successful verify runs on an unchanged project create two attempts
// and no tracked diff; done consumes the current pass without a duplicate run;
// repeated done is read-only and idempotent; the wrapper delegates every call.
{
  const { dir, file } = migrated();
  const started = passes(sh(dir, 'start', 'T-01'), 'start');
  assert.match(started, /^▶ T-01 started \d{4}-\d\d-\d\dT[\d:]+Z — tickets\/T-01-example\.md$/m);
  assert.equal(front(dir, file, 'status'), 'in_progress');
  commit(dir, 'started');
  passes(sh(dir, 'verify', 'T-01'), 'verify 1');
  passes(sh(dir, 'verify', 'T-01'), 'verify 2');
  assert.equal(attempts(dir).length, 2, 'two attempts recorded');
  assert.equal(git(dir, 'status', '--porcelain'), '', 'verify leaves no tracked diff');
  assert.equal(front(dir, file, 'verified'), '', 'no receipt written into the ticket');
  assert.equal(front(dir, file, 'last_check'), '');
  assert.equal(runs(dir), 2);
  refuses(sh(dir, 'done', 'T-01'), /CRITERIA_UNTICKED: unticked acceptance criteria[\s\S]*next: tick verified criteria/, 'unticked blocks closure');
  tick(dir, file);
  const closed = passes(sh(dir, 'done', 'T-01'), 'done');
  assert.match(closed, /^✓ T-01 done\. Inspect staged work, stage only this ticket's paths, review git diff --cached, then commit: T-01: example$/m);
  assert.equal(runs(dir), 2, 'done consumed the current pass without launching the check again');
  assert.equal(front(dir, file, 'status'), 'done'); assert.match(front(dir, file, 'finished'), /Z$/);
  assert.equal(attempts(dir).length, 2);
  const after = read(dir, file);
  const again = passes(sh(dir, 'done', 'T-01'), 'done again');
  assert.match(again, /^T-01 already done — current attempt 000002-.* passed$/m);
  assert.equal(read(dir, file), after, 'repeated done is read-only');
  assert.equal(runs(dir), 2);
  const text = passes(run(dir, 'bash', [statusScript]));
  assert.match(text, /^Runtime  change prd-v1/m);
  assert.match(text, /T-01 +done +S +started \d\d:\d\d · finished \d\d:\d\d/);
  assert.doesNotMatch(text, /WARN/);
  assert.equal(rt(dir, 'ready', 'T-01').status, 0);
  assert.match(text, /^Next +\/pincer-evaluate/m);
}

// S-19: stale inputs, a later failure, a missing log, missing local state and an
// unticked criterion each block done with a code and a next step.
{
  const { dir, file } = migrated();
  passes(sh(dir, 'start', 'T-01')); tick(dir, file); commit(dir, 'started');
  passes(sh(dir, 'verify', 'T-01'));
  write(dir, 'src/app.js', 'module.exports = 2;\n');
  refuses(sh(dir, 'done', 'T-01'), /SOURCE_CHANGED: source changed since the passing attempt: src\/app\.js[\s\S]*next: verify/, 'stale inputs');
  git(dir, 'checkout', '--', 'src/app.js');
  passes(sh(dir, 'done', 'T-01'), 'closes once inputs are current again');
  write(dir, 'value.txt', 'bad');
  refuses(sh(dir, 'verify', 'T-01'), /FAILED \(exit 1\)/, 'later failure');
  refuses(sh(dir, 'done', 'T-01'), /CHECK_FAILED: attempt .* failed \(exit 1\)[\s\S]*next: fix, then verify/, 'later failure blocks the done ticket');
  write(dir, 'value.txt', 'good');
  passes(sh(dir, 'verify', 'T-01'));
  const latest = state.latestAttempt(dir, 'ticket:prd-v1:T-01');
  fs.rmSync(path.join(dir, latest.artifacts.stdout.path));
  refuses(sh(dir, 'done', 'T-01'), /EVIDENCE_MISSING: the attempt's captured log is missing[\s\S]*next: verify/, 'missing log');
  passes(sh(dir, 'verify', 'T-01'));
  fs.rmSync(path.join(dir, `.pincer/runtime/attempts/${state.latestAttempt(dir, 'ticket:prd-v1:T-01').id}.json`));
  refuses(sh(dir, 'done', 'T-01'), /EVIDENCE_MISSING: no runtime attempt recorded[\s\S]*next: verify/, 'a missing pointed-at record is not replaced by an older pass');
  fs.rmSync(path.join(dir, '.pincer/runtime'), { recursive: true });
  refuses(sh(dir, 'done', 'T-01'), /EVIDENCE_MISSING: no runtime attempt recorded[\s\S]*next: verify/, 'missing local state');
  passes(sh(dir, 'verify', 'T-01'));
  write(dir, file, read(dir, file).replace('- [x] expected behavior', '- [ ] expected behavior'));
  refuses(sh(dir, 'done', 'T-01'), /CRITERIA_UNTICKED/, 'unticked');
  write(dir, file, read(dir, file).replace('= good', '= good && true').replace('- [ ] expected behavior', '- [x] expected behavior'));
  const r = sh(dir, 'done', 'T-01');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /CHECK_CHANGED|SOURCE_CHANGED/, 'a changed block cannot close on the earlier pass');
}

// S-20: deleting local state cannot revive a legacy receipt; a fresh clone sees
// the committed candidate evidence separately and must verify before closing.
{
  const { dir, file } = migrated();
  // A migrated ticket still carrying a legacy receipt from before migration.
  write(dir, file, read(dir, file).replace('status: open', 'status: in_progress\nstarted: 2026-09-11T00:00:00Z\nlast_check: 2026-09-11T00:01:00Z passed 000000000000\nverified: 2026-09-11T00:01:00Z 000000000000').replace('- [ ] expected behavior', '- [x] expected behavior'));
  commit(dir, 'legacy receipt');
  refuses(sh(dir, 'done', 'T-01'), /LEGACY_RECEIPT: migrated legacy receipt .* is history, not runtime evidence[\s\S]*next: verify/, 'legacy receipt is not evidence');
  fs.rmSync(path.join(dir, '.pincer'), { recursive: true, force: true });
  refuses(sh(dir, 'done', 'T-01'), /LEGACY_RECEIPT/, 'deleting local state does not revive the receipt');
  passes(sh(dir, 'verify', 'T-01'));
  passes(sh(dir, 'done', 'T-01'), 'a fresh runtime pass closes it');
  assert.match(front(dir, file, 'verified'), /000000000000/, 'legacy fields are left alone until migration removes them');
  commit(dir, 'done');
  const clone = tempDir();
  passes(run(dir, 'git', ['clone', '-q', dir, path.join(clone, 'repo')]), 'clone');
  const fresh = path.join(clone, 'repo');
  const j = JSON.parse(passes(rt(fresh, 'status', '--json'), 'status in clone'));
  assert.equal(j.mode, 'migrated');
  assert.equal(j.candidate.local_attempts, 'unavailable');
  assert.equal(j.tickets[0].readiness.reasons[0].code, 'LEGACY_RECEIPT');
  refuses(sh(fresh, 'done', 'T-01'), /LEGACY_RECEIPT|EVIDENCE_MISSING/, 'a fresh clone cannot close on history');
  passes(sh(fresh, 'verify', 'T-01'), 'verify in the clone');
  passes(sh(fresh, 'done', 'T-01'), 'closes after a local pass');
}

// S-01 after migration: a source regression fails, the revert passes, both
// attempts are retained and no tracked file changed; no restore is needed.
{
  const { dir, file } = migrated();
  passes(sh(dir, 'start', 'T-01')); tick(dir, file); commit(dir, 'started');
  passes(sh(dir, 'verify', 'T-01')); passes(sh(dir, 'done', 'T-01')); commit(dir, 'done');
  write(dir, 'value.txt', 'regressed');
  refuses(sh(dir, 'verify', 'T-01'), /FAILED/, 'regression');
  assert.equal(git(dir, 'status', '--porcelain').trim(), 'M value.txt', 'only the injected regression is dirty');
  git(dir, 'checkout', '--', 'value.txt');
  passes(sh(dir, 'verify', 'T-01'), 'repaired pass');
  assert.deepEqual(attempts(dir).map(a => a.outcome), ['passed', 'failed', 'passed'], 'failure retained beside the repaired pass');
  assert.equal(git(dir, 'status', '--porcelain'), '', 'no tracked file changed; nothing to restore');
  assert.equal(rt(dir, 'ready', 'T-01').status, 0);
}

// Dependencies in migrated mode use attempt readiness; start writes only lifecycle fields.
{
  const { dir, file } = migrated();
  createTicket(dir, { id: 'T-02', deps: 'T-01', prd: '.prd/prd-v1.md' });
  commit(dir, 'T-02');
  refuses(sh(dir, 'start', 'T-02'), /T-02 depends on T-01, which is 'open'/, 'dependency not done');
  passes(sh(dir, 'verify', 'T-01'));
  assert.equal(front(dir, file, 'status'), 'in_progress', 'verify on an open ticket starts it');
  tick(dir, file); passes(sh(dir, 'done', 'T-01'));
  write(dir, 'src/app.js', 'changed\n');
  refuses(sh(dir, 'start', 'T-02'), /T-02 depends on T-01: SOURCE_CHANGED/, 'a done dependency with stale inputs is not ready');
  git(dir, 'checkout', '--', 'src/app.js');
  passes(sh(dir, 'start', 'T-02'), 'ready dependency');
  assert.deepEqual(git(dir, 'status', '--porcelain').split('\n').map(l => l.trim()).sort(), ['M tickets/T-01-example.md', 'M tickets/T-02-example.md'], 'only lifecycle projections changed');
}

// Legacy wrapper parity: no binding means the v0.4.1 contract, byte for byte where pinned.
{
  const dir = tempDir(); createPrd(dir);
  const file = createTicket(dir, { criteria: '- [ ] it works' });
  assert.match(passes(sh(dir, 'verify', '1')), /T-01 started[\s\S]*receipt: \d{4}-[^ ]+Z [0-9a-f]{12}/);
  assert.match(read(dir, file), /^last_check: .* passed [0-9a-f]{12}$/m);
  refuses(sh(dir, 'done', 'T-01'), /unticked acceptance criteria on T-01:\n- \[ \] it works\nTick each verified criterion/);
  write(dir, file, read(dir, file).replace('- [ ] it works', '- [x] it works'));
  assert.match(passes(sh(dir, 'done', 'T-01')), /✓ T-01 done\. Inspect staged work/);
  assert.match(passes(sh(dir, 'verify', 'T-01')), /T-01 is done — re-running its check and updating the latest outcome/);
  assert.equal(sh(dir).status, 2, 'no action prints usage');
  assert.match(sh(dir, 'frobnicate', 'T-01').stdout + sh(dir, 'frobnicate', 'T-01').stderr, /start|verify/);
  assert.ok(!fs.existsSync(path.join(dir, '.pincer')), 'legacy mode never writes local state');
  assert.ok(!fs.existsSync(path.join(repo, 'template/scripts/pincer-ticket-lib.sh')), 'the Bash policy library is gone');
}

// Review fixes (T-45): an attempt record is evidence only when it is complete,
// belongs to the ticket it is read for, and its captured logs still match the
// digests it recorded. Readiness, ready, status and done agree on each case.
{
  const { dir, file } = migrated();
  passes(sh(dir, 'start', 'T-01')); passes(sh(dir, 'verify', 'T-01')); tick(dir, file);
  const key = 'ticket:prd-v1:T-01';
  const good = state.latestAttempt(dir, key);
  assert.equal(good.outcome, 'passed');
  const record = path.join(dir, `.pincer/runtime/attempts/${good.id}.json`);
  const original = fs.readFileSync(record, 'utf8');
  const codeOf = () => JSON.parse(passes(rt(dir, 'status', '--json'))).tickets[0].readiness.reasons[0].code;
  // An incomplete record keeps only the pointer identity and the outcome.
  fs.writeFileSync(record, JSON.stringify({ id: good.id, outcome: 'passed' }));
  assert.equal(codeOf(), 'ATTEMPT_ERROR', 'an incomplete record is not a pass');
  assert.equal(rt(dir, 'ready', 'T-01').status, 1, 'ready refuses an incomplete record');
  assert.match(rt(dir, 'ready', 'T-01').stdout, /ATTEMPT_ERROR .*incomplete|ATTEMPT_ERROR .*malformed/);
  refuses(sh(dir, 'done', 'T-01'), /ATTEMPT_ERROR/, 'done refuses an incomplete record');
  assert.equal(front(dir, file, 'status'), 'in_progress');
  // A complete record for another ticket, pointed at by this ticket's index entry.
  const foreign = JSON.parse(original); foreign.context.ticket = 'T-02';
  fs.writeFileSync(record, JSON.stringify(foreign));
  assert.equal(codeOf(), 'ATTEMPT_ERROR', 'a record for another context is not this ticket\'s evidence');
  refuses(sh(dir, 'done', 'T-01'), /ATTEMPT_ERROR/, 'done refuses a mismatched record');
  fs.writeFileSync(record, original);
  // A captured log replaced after the run no longer matches its recorded digest.
  const stdoutLog = path.join(dir, good.artifacts.stdout.path);
  const stdoutOriginal = fs.readFileSync(stdoutLog);
  fs.writeFileSync(stdoutLog, 'REPLACED OUTPUT\n');
  assert.equal(codeOf(), 'EVIDENCE_MISSING', 'an altered log is not evidence');
  assert.match(rt(dir, 'ready', 'T-01').stdout, /EVIDENCE_MISSING .*altered/);
  refuses(sh(dir, 'done', 'T-01'), /EVIDENCE_MISSING: .*altered/, 'done refuses an altered log');
  fs.writeFileSync(stdoutLog, stdoutOriginal);
  assert.equal(passes(rt(dir, 'ready', 'T-01')).trim(), 'ready T-01', 'the restored record and log are evidence again');
  passes(sh(dir, 'done', 'T-01'));
}
console.log('runtime lifecycle tests passed');
