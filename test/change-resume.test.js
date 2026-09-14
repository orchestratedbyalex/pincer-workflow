// The resume report (PRD v5 R-06; T-57): a fresh process reads the selected
// change's agreement, blockers and next command from files alone; competing
// blockers resolve by the documented precedence; an authored handoff note is
// labeled and never overrides computed state; repeated inspection writes nothing,
// launches nothing, records no approval and changes no selection; human output,
// JSON and the command gates agree.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { repo, tempDir, createTicket, createPrd, write, read, run, ticketScript, writeNotes } from './helpers.js';

const require = createRequire(import.meta.url);
const agreement = require(path.join(repo, 'template/scripts/pincer-runtime/agreement.cjs'));
const state = require(path.join(repo, 'template/scripts/pincer-runtime/state.cjs'));
const runtime = path.join(repo, 'template/scripts/pincer-runtime.cjs');
const rt = (dir, ...args) => run(dir, process.execPath, [runtime, ...args], { timeout: 60000 });
const sh = (dir, ...args) => run(dir, 'bash', [ticketScript, ...args], { timeout: 60000 });
function passes(result, label = '') { assert.equal(result.status, 0, `${label}\n${result.stdout}${result.stderr}`); return result.stdout; }
function git(dir, ...args) { return passes(run(dir, 'git', args), `git ${args.join(' ')}`).trim(); }
function commit(dir, message) {
  git(dir, 'add', '-A');
  git(dir, '-c', 'user.name=Pincer Test', '-c', 'user.email=test@example.invalid', 'commit', '-q', '--allow-empty', '-m', message);
  return git(dir, 'rev-parse', 'HEAD');
}
const record = (dir, id = 'prd-v1') => JSON.parse(read(dir, `.prd/changes/${id}.json`));
const digestOf = (dir, id = 'prd-v1') => agreement.compute(dir, record(dir, id)).digest;
// A fresh process with an empty environment apart from PATH: no conversation, no inherited state.
const fresh = (dir, ...args) => run(dir, process.execPath, [runtime, ...args], { env: { PATH: process.env.PATH, HOME: process.env.HOME }, timeout: 60000 });
const resumeJson = (dir, ...args) => { const r = fresh(dir, 'resume', '--json', ...args); assert.equal(r.status, 0, r.stdout + r.stderr); return JSON.parse(r.stdout); };
const snapshotTree = dir => {
  const out = {};
  const walk = rel => {
    for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const next = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) { if (!/lock|journal/.test(entry.name)) walk(next); } else out[next] = fs.readFileSync(path.join(dir, next), 'utf8');
    }
  };
  walk('');
  return out;
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const REF = 'session 2026-09-11 10:02, user message after /pincer-narrow';
const edit = (dir, file, from, to) => write(dir, file, read(dir, file).replace(from, to));
function fixture() {
  const dir = tempDir(); git(dir, 'init', '-q');
  createPrd(dir, 1); createPrd(dir, 2);
  write(dir, '.prd/prd-v1.md', read(dir, '.prd/prd-v1.md').replace('# Example PRD', '# Export orders as CSV'));
  createTicket(dir, { id: 'T-01', prd: '.prd/prd-v1.md', command: 'echo run >> .markers/a; test -f value.txt', criteria: '- [x] exports' });
  write(dir, 'tickets/T-01-example.md', read(dir, 'tickets/T-01-example.md').replace('## Objective\nExample', '## Objective\nWrite the CSV exporter'));
  createTicket(dir, { id: 'T-02', prd: '.prd/prd-v1.md', deps: 'T-01', command: 'echo run >> .markers/a2; true', criteria: '- [x] documented' });
  createTicket(dir, { id: 'T-03', prd: '.prd/prd-v2.md' });
  write(dir, 'value.txt', 'good\n'); write(dir, 'src/app.js', '1\n'); write(dir, '.gitignore', '.pincer/\n.markers/\n');
  fs.mkdirSync(path.join(dir, '.markers'));
  commit(dir, 'base');
  passes(rt(dir, 'register', '--prd', '.prd/prd-v1.md'));
  passes(rt(dir, 'register', '--prd', '.prd/prd-v2.md', '--change', 'feature-b'));
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digestOf(dir), '--reference', REF, '--excerpt', 'go ahead with the exporter', '--constraints', 'no new dependencies'));
  passes(rt(dir, 'change', 'select', 'prd-v1'));
  passes(rt(dir, 'change', 'activate', 'prd-v1'));
  passes(sh(dir, 'start', 'T-01')); passes(sh(dir, 'verify', 'T-01')); passes(sh(dir, 'done', 'T-01'));
  passes(rt(dir, 'change', 'pause', 'prd-v1', '--reason', 'switching to B for a hotfix', '--note', 'T-02 is next; the exporter lives in src/export.js'));
  commit(dir, 'A paused');
  return dir;
}
const launches = dir => { try { return read(dir, '.markers/a').split('\n').filter(Boolean).length; } catch { return 0; } };

// S-17: a fresh process states the agreement, the blocker and the next command
// from files alone; the human report carries the same labeled facts.
{
  const dir = fixture();
  const r = resumeJson(dir);
  assert.equal(r.schema, 2); assert.equal(r.runtime, 3); assert.equal(r.mode, 'changes');
  assert.deepEqual(r.selection, { change: 'prd-v1', problem: null });
  assert.equal(r.change.id, 'prd-v1'); assert.equal(r.change.lifecycle.state, 'paused'); assert.equal(r.change.view.base_is_ancestor, true);
  assert.equal(r.agreement.verdict, 'current'); assert.equal(r.agreement.current, digestOf(dir));
  assert.deepEqual([r.agreement.authorized.id, r.agreement.authorized.agreement, r.agreement.authorized.disposition, r.agreement.authorized.excerpt, r.agreement.authorized.reference, r.agreement.authorized.constraints], ['A-01', 'G-01', 'user', 'go ahead with the exporter', REF, 'no new dependencies']);
  assert.deepEqual(r.agreement.decisions, { open: [], resolved: [] });
  assert.deepEqual(r.references.prd, { path: '.prd/prd-v1.md', title: 'Export orders as CSV' });
  assert.equal(r.references.snapshot, '.prd/changes/prd-v1/agreements/G-01.json');
  assert.deepEqual(r.references.tickets, [{ id: 'T-01', file: 'tickets/T-01-example.md', objective: 'Write the CSV exporter' }, { id: 'T-02', file: 'tickets/T-02-example.md', objective: 'Example' }]);
  assert.deepEqual(r.tickets.map(t => [t.id, t.status, t.readiness.ready, t.readiness.reasons[0] ? t.readiness.reasons[0].code : null]), [['T-01', 'done', true, null], ['T-02', 'open', false, 'EVIDENCE_MISSING']]);
  assert.equal(r.attempts.length, 1); assert.equal(r.attempts[0].ticket, 'T-01'); assert.equal(r.attempts[0].outcome, 'passed'); assert.equal(r.attempts[0].current, true);
  assert.equal(r.candidate.notes, 'missing'); assert.equal(r.candidate.locator, '.prd/evidence/changes/prd-v1.json');
  assert.deepEqual(r.handoff, { kind: 'pause', reason: 'switching to B for a hotfix', note: 'T-02 is next; the exporter lives in src/export.js', since: r.handoff.since, authored: true });
  assert.deepEqual(r.blockers, [], 'a paused change with a current agreement has no blocker');
  assert.deepEqual(r.next, { action: 'resume the change', command: 'node scripts/pincer-runtime.cjs change resume prd-v1', ticket: null, check: null, rule: 3 });
  const text = passes(fresh(dir, 'resume'));
  for (const label of ['Change     prd-v1 · .prd/prd-v1.md', 'Lifecycle  paused since', 'View       HEAD', 'Agreement  ', 'Authorization current — "go ahead with the exporter"', 'Decisions  none', 'References PRD .prd/prd-v1.md ("Export orders as CSV") · authorized snapshot .prd/changes/prd-v1/agreements/G-01.json', '  T-01  Write the CSV exporter', 'Tickets    T-01 done ready · T-02 open', 'Attempts   T-01 000001-', 'Candidate  .prd/evidence/changes/prd-v1.json: missing', 'Handoff (authored) pause since', 'Blockers   none', 'Next       resume the change: node scripts/pincer-runtime.cjs change resume prd-v1']) {
    assert.ok(text.includes(label), `human report has "${label}"\n${text}`);
  }
  assert.ok(!text.includes('exporter lives in src/export.js\nNext'), 'the note is labeled, not merged into the next action');
  // --change inspects another record without selecting it.
  const b = resumeJson(dir, '--change', 'feature-b');
  assert.equal(b.change.id, 'feature-b'); assert.deepEqual(b.selection, { change: 'prd-v1', problem: null });
  assert.equal(b.agreement.verdict, 'AUTHORIZATION_REQUIRED'); assert.equal(b.next.rule, 4);
  assert.match(b.next.command, /change authorize feature-b --agreement [0-9a-f]{64}/);
}

// Precedence: competing blockers resolve deterministically (rules 1..8).
{
  const dir = fixture();
  // 4 beats 3 for a paused change: an agreement gap comes before resuming; blockers list it first, then stale work.
  write(dir, '.prd/prd-v1.md', `${read(dir, '.prd/prd-v1.md')}\nR-02: also XML.\n`);
  write(dir, 'src/app.js', '2\n');
  let r = resumeJson(dir);
  assert.equal(r.next.rule, 4); assert.equal(r.next.action, 'record the disposition of the changed agreement');
  assert.match(r.next.command, /change authorize prd-v1 --agreement [0-9a-f]{64} .* --delegated --basis A-01 --explanation <text>/);
  assert.deepEqual(r.blockers.map(b => b.code), ['AGREEMENT_CHANGED', 'REVISION_CHANGED', 'SOURCE_CHANGED'], 'gate codes before readiness codes (the PRD edit also changed the revision the pass ran under)');
  // 2 beats 4: a running attempt.
  const live = spawn('bash', ['-c', 'sleep 30'], { stdio: 'ignore' }); await sleep(200);
  const running = { schema: 2, runtime: 2, id: '000009-20260911T000000Z-run001', sequence: 9, context: { kind: 'ticket', change: 'prd-v1', ticket: 'T-02' }, outcome: 'running', owner: { pid: live.pid, ppid: 1, host: os.hostname() }, child: null, started: '2026-09-11T00:00:00Z', finished: null, artifacts: {}, limitations: [] };
  state.writeAttempt(dir, running);
  const idx = state.readIndex(dir).index; idx.running.push(running.id); idx.sequence = 9; idx.current['ticket:prd-v1:T-02'] = running.id; state.writeIndex(dir, idx);
  r = resumeJson(dir);
  assert.equal(r.next.rule, 2); assert.equal(r.blockers[0].code, 'ATTEMPT_RUNNING'); assert.match(r.next.command, /^wait for attempt 000009-20260911T000000Z-run001, or node scripts\/pincer-runtime\.cjs recover if its owner died$/);
  live.kill('SIGKILL'); await new Promise(resolve => live.once('exit', resolve)); await sleep(100);
  r = resumeJson(dir);
  assert.equal(r.next.rule, 2); assert.equal(r.next.command, 'node scripts/pincer-runtime.cjs recover', 'a dead owner routes to recover');
  passes(rt(dir, 'recover'));
  const idx2 = state.readIndex(dir).index; delete idx2.current['ticket:prd-v1:T-02']; state.writeIndex(dir, idx2);
  // 3 beats 4: an incompatible view (orphan branch) outranks the agreement gap.
  const mainBranch = git(dir, 'symbolic-ref', '--short', 'HEAD');
  git(dir, 'checkout', '-q', '--', '.prd/prd-v1.md', 'src/app.js');
  passes(run(dir, 'git', ['checkout', '-q', '--orphan', 'unrelated'])); commit(dir, 'unrelated');
  write(dir, '.prd/prd-v1.md', `${read(dir, '.prd/prd-v1.md')}\nR-02: also XML.\n`);
  r = resumeJson(dir);
  assert.equal(r.next.rule, 3); assert.equal(r.blockers[0].code, 'BASE_MISMATCH'); assert.equal(r.blockers[1].code, 'AGREEMENT_CHANGED');
  assert.match(r.next.command, /^git checkout <branch with base [0-9a-f]{7}> — the recorded base/);
  git(dir, 'checkout', '-q', '--', '.prd/prd-v1.md'); git(dir, 'checkout', '-q', mainBranch);
  // 1 beats everything: no selection, then an incomplete transaction.
  fs.unlinkSync(path.join(dir, '.pincer/runtime/selection.json'));
  r = resumeJson(dir);
  assert.equal(r.change, null); assert.equal(r.blockers[0].code, 'SELECTION_REQUIRED'); assert.equal(r.next.rule, 1); assert.equal(r.next.command, 'node scripts/pincer-runtime.cjs change select <id>');
  passes(rt(dir, 'change', 'select', 'prd-v1'));
  write(dir, '.pincer/runtime/journal/txn-20260911T000000Z-abc123/01-prd-v1.json', read(dir, '.prd/changes/prd-v1.json'));
  write(dir, '.pincer/runtime/journal/txn-20260911T000000Z-abc123/manifest.json', JSON.stringify({ schema: 1, id: 'txn-20260911T000000Z-abc123', command: 'change pause prd-v1', started: '2026-09-11T00:00:00Z', writes: [{ target: '.prd/changes/prd-v1.json', staged: '01-prd-v1.json' }] }));
  const incomplete = fresh(dir, 'resume', '--json');
  assert.equal(incomplete.status, 4); r = JSON.parse(incomplete.stdout);
  assert.equal(r.blockers[0].code, 'STATE_INCOMPLETE'); assert.equal(r.next.command, 'node scripts/pincer-runtime.cjs recover'); assert.equal(r.next.rule, 1);
  passes(rt(dir, 'recover'));
  // 3: a terminal change routes to inspection, never execution, whatever else is wrong.
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--summary', 'drop?')); passes(rt(dir, 'change', 'decide', 'prd-v1', '--resolve', 'D-01', '--reference', REF, '--excerpt', 'drop it'));
  passes(rt(dir, 'change', 'cancel', 'prd-v1', '--decision', 'D-01', '--reason', 'dropped'));
  r = resumeJson(dir);
  assert.equal(r.next.rule, 3); assert.match(r.next.command, /^node scripts\/pincer-runtime\.cjs change show prd-v1 — then register a replacement/);
  assert.equal(r.blockers[0].code, 'LIFECYCLE_BLOCKED');
  // 5 → 6 → 7 → 8 on a healthy active change.
  const d = fixture();
  passes(rt(d, 'change', 'resume', 'prd-v1'));
  r = resumeJson(d);
  assert.deepEqual([r.next.rule, r.next.ticket, r.next.command], [5, 'T-02', 'scripts/pincer-ticket.sh start T-02'], 'unfinished work names the next ready ticket');
  passes(sh(d, 'start', 'T-02'));
  r = resumeJson(d); assert.deepEqual([r.next.rule, r.next.ticket], [5, 'T-02']); assert.match(r.next.command, /verify T-02/);
  passes(sh(d, 'verify', 'T-02')); passes(sh(d, 'done', 'T-02'));
  write(d, 'src/app.js', '3\n');
  r = resumeJson(d); assert.deepEqual([r.next.rule, r.next.ticket], [5, 'T-01']); assert.match(r.next.action, /re-verify T-01 \(SOURCE_CHANGED\)/, 'stale done work routes to verify with the ticket named');
  passes(sh(d, 'verify', 'T-01')); passes(sh(d, 'verify', 'T-02'));
  r = resumeJson(d); assert.deepEqual([r.next.rule, r.next.command], [6, 'node scripts/pincer-runtime.cjs change complete prd-v1']);
  passes(rt(d, 'change', 'complete', 'prd-v1'));
  r = resumeJson(d); assert.equal(r.next.rule, 7); assert.match(r.next.command, /^\/pincer-evaluate/);
  edit(d, '.prd/prd-v1.md', 'status: ticketed', 'status: built');
  const base = git(d, 'rev-parse', 'HEAD'); const candidate = commit(d, 'built');
  passes(rt(d, 'check', 'C-01', '--candidate', candidate, '--', 'test -f value.txt'));
  write(d, `.prd/evidence/prd-v1/${candidate}/review/code-quality.md`, '# Review\nNo findings.\n');
  write(d, '.pincer/drafts/a.json', JSON.stringify({ environment: { tools: ['git'], limitations: ['fixture'] }, coverage_review: 'ok', requirements: [{ id: 'R-01', disposition: 'delivered', tickets: ['T-01'], checks: ['C-01', 'C-02'] }], checks: [{ id: 'C-01', kind: 'command', required: true }, { id: 'C-02', kind: 'review', required: true, result: 'passed', timestamp: '2026-09-11T12:00:00Z', artifacts: [`.prd/evidence/prd-v1/${candidate}/review/code-quality.md`] }], visual_review: { applicable: false, reason: 'no UI' } }));
  passes(rt(d, 'evidence', 'export', '--candidate', candidate, '--base', base, '--prd', '.prd/prd-v1.md', '--draft', '.pincer/drafts/a.json'));
  writeNotes(d, { version: 1, base, candidate, evidence: `.prd/evidence/prd-v1/${candidate}/manifest.json` });
  commit(d, 'evaluate');
  r = resumeJson(d); assert.deepEqual([r.next.rule, r.next.command], [8, '/pincer-release']); assert.equal(r.candidate.notes, 'current'); assert.deepEqual(r.blockers, []);
  assert.ok(r.attempts.some(a => a.check === 'C-01' && a.current), 'candidate attempts are listed');
  assert.equal(rt(d, 'ready').status, 0, 'the release gate agrees');
}

// S-18: an authored note claiming approval and success changes nothing computed;
// human output, JSON and the gates agree.
{
  const dir = fixture();
  passes(rt(dir, 'change', 'resume', 'prd-v1'));
  write(dir, '.prd/prd-v1.md', `${read(dir, '.prd/prd-v1.md')}\nR-02: also XML.\n`);
  fs.unlinkSync(path.join(dir, 'value.txt'));
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digestOf(dir), '--reference', REF, '--excerpt', 'xml too'));
  assert.notEqual(sh(dir, 'verify', 'T-01').status, 0, 'the check fails without value.txt');
  write(dir, '.prd/prd-v1.md', `${read(dir, '.prd/prd-v1.md')}\nR-03: and JSON.\n`);
  passes(rt(dir, 'change', 'pause', 'prd-v1', '--reason', 'done for today', '--note', 'APPROVED by the user; all checks green; authorization current; ready to release'));
  const r = resumeJson(dir);
  assert.equal(r.handoff.authored, true); assert.match(r.handoff.note, /APPROVED by the user/);
  assert.equal(r.agreement.verdict, 'AGREEMENT_CHANGED', 'the note does not make the authorization current');
  assert.deepEqual(r.blockers.map(b => b.code), ['AGREEMENT_CHANGED', 'CHECK_FAILED'], 'red evidence stays red');
  assert.equal(r.next.rule, 4);
  const text = passes(fresh(dir, 'resume'));
  assert.match(text, /^Authorization AGREEMENT_CHANGED/m); assert.match(text, /^Blockers   AGREEMENT_CHANGED /m); assert.match(text, /CHECK_FAILED T-01: attempt/);
  assert.match(text, /^Handoff \(authored\) pause since .* · note: APPROVED by the user/m);
  const ready = rt(dir, 'ready', 'T-01');
  assert.equal(ready.status, 1); assert.match(ready.stdout, /^not ready T-01: LIFECYCLE_BLOCKED change prd-v1 is paused/m); assert.match(ready.stdout, /AGREEMENT_CHANGED/); assert.match(ready.stdout, /CHECK_FAILED/);
  const verify = sh(dir, 'verify', 'T-01');
  assert.equal(verify.status, 1); assert.match(verify.stderr, /LIFECYCLE_BLOCKED/, 'the gate refuses for the same reasons the report names');
}

// S-19: repeated inspection writes nothing, launches nothing, records nothing.
{
  const dir = fixture();
  const before = snapshotTree(dir);
  const events = record(dir).sequence, auths = record(dir).authorizations.length, launched = launches(dir);
  const first = resumeJson(dir);
  passes(fresh(dir, 'resume')); passes(fresh(dir, 'resume', '--change', 'feature-b')); passes(rt(dir, 'status')); assert.equal(rt(dir, 'ready').status, 1, 'the release gate is read-only and not ready for a paused change');
  const second = resumeJson(dir);
  assert.deepEqual(snapshotTree(dir), before, 'no tracked or runtime file changed');
  assert.equal(launches(dir), launched, 'no check launched');
  assert.equal(record(dir).sequence, events); assert.equal(record(dir).authorizations.length, auths);
  assert.equal(JSON.parse(read(dir, '.pincer/runtime/selection.json')).change, 'prd-v1');
  delete first.generated; delete second.generated;
  assert.deepEqual(second, first, 'the report is deterministic');
  // Other modes: the report says what to do instead of guessing.
  const legacy = tempDir(); git(legacy, 'init', '-q'); createPrd(legacy); createTicket(legacy); commit(legacy, 'base');
  const l = fresh(legacy, 'resume', '--json');
  assert.equal(JSON.parse(l.stdout).selection.problem.code, 'CHANGE_REQUIRED'); assert.match(JSON.parse(l.stdout).next.command, /register --prd/);
  assert.match(passes(fresh(legacy, 'resume')), /^Selection  none · CHANGE_REQUIRED: this project keeps no change records/m);
}
console.log('change resume tests passed');

// PRD v6 T-74: resume JSON schema 2 carries the coverage summary (unverified without
// adoption) and the human report a Coverage line; nothing else about the v5 report changed.
{
  const dir = fixture();
  passes(rt(dir, 'change', 'select', 'prd-v1'));
  const r = JSON.parse(passes(rt(dir, 'resume', '--json')));
  assert.equal(r.schema, 2); assert.equal(r.runtime, 3);
  assert.equal(r.coverage.strict, false); assert.equal(r.coverage.label, 'unverified'); assert.match(r.coverage.reason, /strict coverage not adopted/);
  assert.match(passes(rt(dir, 'resume')), /^Coverage   unverified · strict coverage not adopted/m);
}
console.log('change resume tests passed (coverage summary)');
