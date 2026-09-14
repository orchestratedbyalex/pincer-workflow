// PRD v6 T-74 (R-09, S-25, S-26): `coverage` and `impact` have human and JSON forms
// naming the same IDs, blockers and next action; status and resume carry a concise
// coverage summary and one next action with the v5 precedence; a fresh session
// locates the next ticket, check or decision from the reports and the referenced
// artifacts; a compact PRD and map get the same safeguards; reports launch no check,
// record no approval and write nothing; old modes are labeled unverified.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir, write, read, run, createPrd, createTicket } from './helpers.js';

const require = createRequire(import.meta.url);
const state = require(path.join(repo, 'template/scripts/pincer-runtime/state.cjs'));
const runtime = path.join(repo, 'template/scripts/pincer-runtime.cjs');
const fx = path.join(repo, 'test/fixtures/prd-v6');
const rt = (dir, ...args) => run(dir, process.execPath, [runtime, ...args], { timeout: 60000 });
function passes(result, label = '') { assert.equal(result.status, 0, `${label}\n${result.stdout}${result.stderr}`); return result.stdout; }
function refuses(result, status, pattern, label = '') { assert.equal(result.status, status, `${label}: exit ${status}\n${result.stdout}${result.stderr}`); assert.match(result.stdout + result.stderr, pattern, label); return result; }
function git(dir, ...args) { return passes(run(dir, 'git', args), `git ${args.join(' ')}`).trim(); }
function commit(dir, message) { git(dir, 'add', '-A'); git(dir, '-c', 'user.name=T', '-c', 'user.email=t@example.invalid', 'commit', '-q', '--allow-empty', '-m', message); return git(dir, 'rev-parse', 'HEAD'); }
const record = (dir, id = 'prd-v1') => JSON.parse(read(dir, `.prd/changes/${id}.json`));
const digestOf = (dir, id = 'prd-v1') => JSON.parse(passes(rt(dir, 'change', 'show', id, '--json'))).agreement.current;
const edit = (dir, file, from, to) => { const t = read(dir, file); assert.ok(t.includes(from), `${file} contains ${JSON.stringify(from)}`); write(dir, file, t.replace(from, to)); };
const json = (dir, ...args) => JSON.parse(passes(rt(dir, ...args, '--json')));
const attemptsCount = dir => (state.exists(dir) && fs.existsSync(path.join(dir, '.pincer/runtime/attempts')) ? fs.readdirSync(path.join(dir, '.pincer/runtime/attempts')).filter(n => n.endsWith('.json')).length : 0);
const snapshotTree = dir => {
  const out = {};
  const walk = rel => { for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) { if (e.name === '.git') continue; const next = rel ? `${rel}/${e.name}` : e.name; if (e.isDirectory()) { if (!/lock|journal/.test(e.name)) walk(next); } else out[next] = fs.readFileSync(path.join(dir, next), 'utf8'); } };
  walk(''); return out;
};
const lineOf = (text, label) => text.split('\n').find(l => l.startsWith(label)) || '';
// Human and JSON forms name the same blockers and the same next action.
function parity(dir, ...args) {
  const j = json(dir, 'coverage', ...args);
  const human = passes(rt(dir, 'coverage', ...args));
  for (const b of j.blockers) assert.ok(human.includes(`${b.code} ${b.detail}`), `human coverage carries blocker ${b.code}: ${b.detail}\n${human}`);
  assert.ok(human.includes(`Next       ${j.next.action}: ${j.next.command}`), `human coverage carries the JSON next action\n${human}`);
  if (!j.blockers.length) assert.match(human, /^Blockers   none$/m);
  const s = json(dir, 'status', ...args);
  assert.equal(s.schema, 3); assert.equal(s.runtime, 3);
  assert.equal(s.coverage.strict, j.strict);
  if (j.strict) {
    assert.equal(s.coverage.structure.complete, j.structure.complete);
    assert.deepEqual(s.coverage.structure.problems, j.structure.problems.map(p => ({ code: p.code, detail: p.detail })));
    assert.equal(s.coverage.implementation.complete, j.implementation.complete);
    assert.equal(s.coverage.candidate.evaluated, j.candidate.evaluated);
    const line = lineOf(passes(rt(dir, 'status', ...args)), 'Coverage strict');
    assert.match(line, j.structure.complete ? /structure complete/ : new RegExp(`structure incomplete \\(${j.structure.problems[0].code}\\)`));
  }
  const r = json(dir, 'resume', ...args);
  assert.equal(r.schema, 2); assert.equal(r.runtime, 3);
  assert.deepEqual(r.coverage, s.coverage, 'resume carries the same coverage summary as status');
  for (const p of j.structure ? j.structure.problems : []) assert.ok(r.blockers.some(b => b.code === p.code && b.detail === p.detail), `resume blocker ${p.code}`);
  return { j, s, r, human };
}

function strictFixture() {
  const dir = tempDir(); git(dir, 'init', '-q');
  write(dir, '.gitignore', '.pincer/\n');
  write(dir, '.prd/prd-v1.md', read(fx, 'strict/prd-v1.md'));
  for (const f of fs.readdirSync(path.join(fx, 'strict/tickets'))) write(dir, `tickets/${f}`, read(fx, `strict/tickets/${f}`).replace('- [ ] expected behavior', '- [x] expected behavior'));
  write(dir, '.prd/coverage/prd-v1.json', read(fx, 'strict/coverage/prd-v1.json'));
  write(dir, 'value.txt', 'good\n');
  commit(dir, 'base');
  passes(rt(dir, 'register', '--prd', '.prd/prd-v1.md')); passes(rt(dir, 'change', 'select', 'prd-v1'));
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digestOf(dir), '--reference', 'r', '--excerpt', 'e'));
  passes(rt(dir, 'change', 'activate', 'prd-v1'));
  passes(rt(dir, 'coverage', 'adopt', '--apply', '--change', 'prd-v1'));
  return dir;
}
const decideAndAuthorize = dir => {
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--summary', 'defer S-03 (impact report) to the next change'));
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--resolve', 'D-01', '--reference', 'chat 10:05', '--excerpt', 'agreed: S-03 is deferred'));
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digestOf(dir), '--reference', 'chat 10:06', '--excerpt', 'approved with S-03 deferred', '--decision', 'D-01'));
};
function evaluate(dir, candidate, base, version = 1) {
  const dirRel = `.prd/evidence/prd-v${version}/${candidate}`;
  passes(rt(dir, 'check', 'C-01', '--candidate', candidate));
  write(dir, `${dirRel}/review/wording.md`, '# reviewed\n');
  const draft = { environment: { tools: ['bash'], limitations: [] }, coverage_review: 'reviewed', adequacy: { verdict: 'adequate', note: 'the command and the review establish the scenarios' }, checks: [{ id: 'C-01' }, { id: 'C-02', result: 'passed', timestamp: '2026-09-12T12:00:00Z', artifacts: [`${dirRel}/review/wording.md`] }], visual_review: { applicable: false, reason: 'no UI' } };
  write(dir, `.pincer/drafts/${version}.json`, JSON.stringify(draft));
  passes(rt(dir, 'evidence', 'export', '--candidate', candidate, '--base', base, '--prd', `.prd/prd-v${version}.md`, '--draft', `.pincer/drafts/${version}.json`), 'export');
}

// --- S-25: the same IDs and blockers in every form; a fresh session finds its next action
{
  const dir = strictFixture();
  // Adopted, not yet authorized, S-03 deferred without a decision: authorization first, then the scope decision.
  let { j } = parity(dir);
  assert.equal(j.strict, true); assert.equal(j.label, 'strict'); assert.equal(j.agreement.verdict, 'AGREEMENT_CHANGED');
  assert.deepEqual(j.structure.problems.map(p => [p.code, p.ids]), [['SCOPE_UNAUTHORIZED', ['S-03']]]);
  assert.equal(j.next.action, "record the user's authorization of the current agreement");
  assert.match(j.next.command, /^node scripts\/pincer-runtime\.cjs change authorize prd-v1 --agreement [0-9a-f]{64} --reference <text> --excerpt <text>$/);
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digestOf(dir), '--reference', 'r', '--excerpt', 'strict'));
  ({ j } = parity(dir));
  assert.equal(j.next.action, 'record the scope decision and its user authorization'); assert.equal(j.next.decision, 'D-01');
  const rs = json(dir, 'resume');
  assert.equal(rs.next.rule, 4); assert.equal(rs.next.decision, 'D-01', 'resume names the decision to record');
  assert.ok(rs.blockers.some(b => b.code === 'SCOPE_UNAUTHORIZED'));
  assert.match(passes(rt(dir, 'status')), /^Next     SCOPE_UNAUTHORIZED: S-03 \(deferred\): no decision D-01 on change prd-v1 — see: node scripts\/pincer-runtime\.cjs coverage$/m);
  decideAndAuthorize(dir);
  // A missing map row: coverage, status and resume name S-02 and point at the map.
  const map = read(dir, '.prd/coverage/prd-v1.json');
  write(dir, '.prd/coverage/prd-v1.json', map.replace('"S-02": { "tickets": ["T-01", "T-02"], "checks": ["C-01", "C-02"] }', '').replace('"S-01": { "tickets": ["T-01"], "checks": ["C-01"] },', '"S-01": { "tickets": ["T-01"], "checks": ["C-01"] }'));
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digestOf(dir), '--delegated', '--basis', 'A-03', '--explanation', 'row lost'));
  ({ j } = parity(dir));
  assert.deepEqual(j.structure.problems.map(p => [p.code, p.ids]), [['COVERAGE_INCOMPLETE', ['S-02']], ['COVERAGE_INCOMPLETE', ['T-02']]]);
  assert.equal(j.next.action, 'author the missing coverage rows, then authorize'); assert.match(j.next.command, /^edit \.prd\/coverage\/prd-v1\.json: S-02 has no row in scenarios or scope; then node scripts\/pincer-runtime\.cjs change authorize prd-v1/);
  assert.equal(json(dir, 'resume').next.rule, 4);
  assert.match(lineOf(passes(rt(dir, 'resume')), 'Coverage'), /^Coverage   strict · structure incomplete \(COVERAGE_INCOMPLETE\)/);
  write(dir, '.prd/coverage/prd-v1.json', map);
  assert.equal(json(dir, 'change', 'show', 'prd-v1').authorization.verdict, 'current', 'back on the user authorization A-03');
  // Work: the next ticket, then a stale one, then completion, evaluation and release — each located from the reports.
  ({ j } = parity(dir));
  assert.ok(j.structure.complete);
  assert.equal(j.next.action, 'finish T-01'); assert.equal(j.next.ticket, 'T-01');
  passes(rt(dir, 'verify', 'T-01')); passes(rt(dir, 'done', 'T-01'));
  ({ j } = parity(dir));
  assert.equal(j.implementation.scenarios['S-01'].implementation, 'complete'); assert.equal(j.next.ticket, 'T-02');
  const r2 = json(dir, 'resume');
  assert.equal(r2.next.ticket, 'T-02'); assert.equal(r2.next.rule, 5); assert.match(r2.next.command, /start T-02/);
  assert.match(passes(rt(dir, 'status')), /^Next     \/pincer-code — next ready ticket: T-02$/m);
  passes(rt(dir, 'verify', 'T-02')); passes(rt(dir, 'done', 'T-02')); passes(rt(dir, 'verify', 'T-03')); passes(rt(dir, 'done', 'T-03'));
  write(dir, 'src.txt', 'new\n');
  ({ j } = parity(dir));
  assert.equal(j.next.action, 're-verify T-01 (SOURCE_CHANGED)'); assert.equal(j.next.ticket, 'T-01');
  assert.equal(json(dir, 'resume').next.ticket, 'T-01');
  fs.rmSync(path.join(dir, 'src.txt'));
  ({ j } = parity(dir));
  assert.ok(j.implementation.complete); assert.equal(j.next.action, 'complete the change');
  assert.equal(json(dir, 'resume').next.rule, 6);
  passes(rt(dir, 'change', 'complete', 'prd-v1'));
  edit(dir, '.prd/prd-v1.md', 'status: ticketed', 'status: built');
  const candidate = commit(dir, 'candidate'), base = git(dir, 'rev-parse', 'HEAD~1');
  ({ j } = parity(dir));
  assert.equal(j.candidate.evaluated, false); assert.equal(j.next.action, 'evaluate the candidate');
  assert.deepEqual(j.blockers, [{ code: 'EVIDENCE_MISSING', detail: 'candidate: not evaluated' }]);
  assert.equal(json(dir, 'resume').next.rule, 7);
  // A fresh session before evaluation finds the same next action from the report alone.
  const clone1 = tempDir(); git(clone1, 'clone', '-q', dir, '.'); passes(rt(clone1, 'change', 'select', 'prd-v1'));
  assert.equal(json(clone1, 'coverage').next.action, 'evaluate the candidate');
  assert.equal(json(clone1, 'resume').next.rule, 7);
  evaluate(dir, candidate, base);
  commit(dir, 'evaluate');
  ({ j } = parity(dir));
  assert.ok(j.candidate.evaluated); assert.deepEqual(j.candidate.delivery, { original: false, agreed: true }); assert.equal(j.candidate.adequacy.verdict, 'adequate');
  assert.deepEqual(j.blockers, []); assert.equal(j.next.action, 'read-only release audit');
  assert.equal(json(dir, 'resume').next.rule, 8);
  assert.match(lineOf(passes(rt(dir, 'status')), 'Coverage'), /candidate delivery original false, agreed true, adequacy adequate$/);
  // A fresh clone after evaluation: the saved evidence is the next action's basis, with the artifacts referenced.
  const clone2 = tempDir(); git(clone2, 'clone', '-q', dir, '.'); passes(rt(clone2, 'change', 'select', 'prd-v1'));
  const fresh = json(clone2, 'coverage');
  assert.equal(fresh.next.action, 'read-only release audit'); assert.equal(fresh.candidate.manifest, `.prd/evidence/prd-v1/${candidate}/manifest.json`);
  assert.ok(fs.existsSync(path.join(clone2, fresh.candidate.manifest)), 'the referenced manifest exists in the clone');
  const snapshotRef = json(clone2, 'resume').references.snapshot;
  const bound = record(clone2).authorizations.find(a => a.digest === json(clone2, 'change', 'show', 'prd-v1').agreement.current);
  assert.equal(snapshotRef, record(clone2).agreements.find(g => g.id === bound.agreement).snapshot, 'the snapshot of the authorization binding the current agreement is referenced');
  assert.ok(fs.existsSync(path.join(clone2, snapshotRef)), 'the referenced snapshot exists in the clone');
  // Impact is inspectable with the same IDs; `--change` inspects without selecting.
  // The default impact baseline is the latest authorization's agreement (the delegated one recorded while the
  // row was missing): the restored row is a link change against it, and nothing against the user's A-03.
  const other = json(dir, 'impact');
  assert.equal(other.verdict, 'changed'); assert.deepEqual(other.links.added, ['S-02']); assert.deepEqual(other.affected.scenarios, [{ id: 'S-02', because: ['links added (a row the baseline lacked)'] }]); assert.deepEqual(other.scenarios.unchanged, ['S-01', 'S-02', 'S-03']);
  assert.equal(json(dir, 'impact', '--from', 'A-03').verdict, 'unchanged');
  passes(rt(dir, 'coverage', '--change', 'prd-v1')); passes(rt(dir, 'impact', '--change', 'prd-v1'));
  // Malformed state is a diagnostic (exit 4), never a report.
  const good = read(dir, '.prd/changes/prd-v1.json');
  write(dir, '.prd/changes/prd-v1.json', '{ "schema": 3,');
  // The selected record is unreadable: SELECTION_INVALID (exit 1) naming MALFORMED, as every v5 command reports it; an explicit --change is MALFORMED (exit 4).
  for (const command of ['coverage', 'impact']) { const r = rt(dir, command); assert.equal(r.status, 1, `${command}: ${r.stdout}${r.stderr}`); assert.match(r.stderr, /SELECTION_INVALID: .*MALFORMED: \.prd\/changes\/prd-v1\.json: malformed JSON/, command); assert.equal(r.stdout, '', `${command}: no report on a malformed record`); }
  refuses(rt(dir, 'coverage', '--change', 'prd-v1'), 4, /MALFORMED: \.prd\/changes\/prd-v1\.json: malformed JSON/, 'explicit inspection of a malformed record');
  write(dir, '.prd/changes/prd-v1.json', good);
  fs.rmSync(path.join(dir, '.prd/coverage/prd-v1.json'));
  const missingMap = json(dir, 'coverage');
  assert.deepEqual(missingMap.structure.problems.map(p => p.code), ['COVERAGE_INVALID']); assert.equal(missingMap.next.action, 'repair the coverage map', 'without the map the agreement cannot be computed'); assert.match(missingMap.next.command, /\.prd\/coverage\/prd-v1\.json: missing/);
  git(dir, 'checkout', '--', '.prd/coverage/prd-v1.json');
}

// --- S-26: a small fix uses the same safeguards; reports launch nothing and record no approval
{
  const dir = tempDir(); git(dir, 'init', '-q');
  write(dir, '.gitignore', '.pincer/\n');
  write(dir, '.prd/prd-v1.md', '---\nversion: 1\nstatus: ticketed\ndate: 2026-09-12\n---\n# Fix the greeting\n\n### R-01 — Greeting\n\n- **S-01:** `hello.txt` says hello.\n');
  createTicket(dir, { id: 'T-01', command: 'test "$(cat hello.txt)" = hello', criteria: '- [x] greets' });
  write(dir, '.prd/coverage/prd-v1.json', JSON.stringify({ schema: 1, change: 'prd-v1', prd: '.prd/prd-v1.md', scenarios: { 'S-01': { tickets: ['T-01'], checks: ['C-01'] } }, scope: {}, tickets: { 'T-01': { role: 'implements', rationale: null } }, checks: { 'C-01': { kind: 'command', required: true, command: 'test "$(cat hello.txt)" = hello', timeout: 30, cwd: null, obligation: null, note: null } } }, null, 2) + '\n');
  write(dir, 'hello.txt', 'hello\n');
  commit(dir, 'base');
  passes(rt(dir, 'register', '--prd', '.prd/prd-v1.md')); passes(rt(dir, 'change', 'select', 'prd-v1'));
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digestOf(dir), '--reference', 'chat', '--excerpt', 'fix the greeting'));
  passes(rt(dir, 'change', 'activate', 'prd-v1'));
  passes(rt(dir, 'coverage', 'adopt', '--apply', '--change', 'prd-v1'));
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digestOf(dir), '--reference', 'chat', '--excerpt', 'fix the greeting, one check'));
  const compact = json(dir, 'coverage');
  assert.ok(compact.structure.complete, JSON.stringify(compact.structure.problems)); assert.equal(compact.inventory.scenarios.length, 1); assert.equal(compact.map.checks.length, 1);
  assert.equal(compact.next.ticket, 'T-01');
  // Reports are pure: repeated status/resume/coverage/impact launch nothing, record nothing and write nothing.
  const before = snapshotTree(dir);
  const attempts = attemptsCount(dir), auths = record(dir).authorizations.length, decisions = record(dir).decisions.length;
  for (let i = 0; i < 2; i++) { passes(rt(dir, 'status')); passes(rt(dir, 'resume')); passes(rt(dir, 'coverage')); passes(rt(dir, 'impact')); passes(rt(dir, 'status', '--json')); passes(rt(dir, 'resume', '--json')); passes(rt(dir, 'coverage', '--json')); passes(rt(dir, 'impact', '--json')); }
  assert.deepEqual(snapshotTree(dir), before, 'reports write nothing');
  assert.equal(attemptsCount(dir), attempts, 'no check launched'); assert.equal(record(dir).authorizations.length, auths, 'no authorization recorded'); assert.equal(record(dir).decisions.length, decisions, 'no decision raised');
  const a = json(dir, 'resume'), b = json(dir, 'resume');
  const strip = x => { const { generated, ...rest } = x; return rest; };
  assert.deepEqual(strip(a), strip(b), 'resume is byte-identical apart from generated');
  assert.equal(a.next.rule, 5); assert.match(a.next.command, /start T-01/);
  // The same safeguards: a substituted check command is refused, and the deferred-scope path needs a decision.
  passes(rt(dir, 'verify', 'T-01')); passes(rt(dir, 'done', 'T-01')); passes(rt(dir, 'change', 'complete', 'prd-v1'));
  edit(dir, '.prd/prd-v1.md', 'status: ticketed', 'status: built');
  const candidate = commit(dir, 'candidate');
  refuses(rt(dir, 'check', 'C-01', '--candidate', candidate, '--', 'true'), 4, /CHECK_UNDECLARED/);
  passes(rt(dir, 'check', 'C-01', '--candidate', candidate));
  write(dir, '.pincer/drafts/1.json', JSON.stringify({ environment: { tools: ['bash'], limitations: [] }, coverage_review: 'one check', adequacy: { verdict: 'adequate', note: 'the check reads the file' }, checks: [{ id: 'C-01' }], visual_review: { applicable: false, reason: 'no UI' } }));
  passes(rt(dir, 'evidence', 'export', '--candidate', candidate, '--base', git(dir, 'rev-parse', 'HEAD~1'), '--prd', '.prd/prd-v1.md', '--draft', '.pincer/drafts/1.json'));
  commit(dir, 'evaluate');
  assert.deepEqual(json(dir, 'coverage').candidate.delivery, { original: true, agreed: true });
  assert.match(passes(rt(dir, 'ready')), /^ready candidate /m);
  // Old modes stay honestly unverified in every report.
  const plain = tempDir(); git(plain, 'init', '-q'); write(plain, '.gitignore', '.pincer/\n'); createPrd(plain, 1); createTicket(plain); commit(plain, 'base');
  passes(rt(plain, 'register', '--prd', '.prd/prd-v1.md')); passes(rt(plain, 'change', 'select', 'prd-v1'));
  const u = json(plain, 'coverage');
  assert.equal(u.strict, false); assert.equal(u.label, 'unverified'); assert.match(u.reason, /strict coverage not adopted/); assert.equal(u.structure, null);
  assert.match(passes(rt(plain, 'coverage')), /^Change     prd-v1 · coverage unverified \(strict coverage not adopted/m);
  assert.deepEqual(json(plain, 'status').coverage, { strict: false, label: 'unverified', reason: 'strict coverage not adopted (node scripts/pincer-runtime.cjs coverage adopt --preview --change prd-v1)', structure: null, implementation: null, candidate: null, next: null });
  assert.match(lineOf(passes(rt(plain, 'status')), 'Coverage'), /^Coverage unverified · strict coverage not adopted/);
  assert.match(lineOf(passes(rt(plain, 'resume')), 'Coverage'), /^Coverage   unverified · strict coverage not adopted/);
  const legacy = tempDir(); git(legacy, 'init', '-q'); createPrd(legacy, 1); createTicket(legacy); commit(legacy, 'base');
  const ls = json(legacy, 'status');
  assert.equal(ls.schema, 1); assert.deepEqual(ls.coverage, { strict: false, label: 'unverified', reason: 'legacy project (no change record); strict coverage needs change records' });
  refuses(rt(legacy, 'coverage'), 1, /CHANGE_REQUIRED/, 'no change record to report on');
}

// --- T-80 (R-09; PRD v5 R-06 precedence, S-18): every state routes to a command the
// runtime will accept, and coverage, resume and status agree about which one. The
// defect was that coverage tested implementation problems before lifecycle state, so
// the lifecycle branch was unreachable exactly when there was unfinished work.
{
  const nextOf = (dir, cmd, ...args) => json(dir, cmd, ...args).next;
  // They must agree on the routing decision, not on its phrasing: for work in
  // progress coverage names the whole arc (start → verify → done) where resume names
  // the immediate step, and both are commands the runtime accepts.
  const routeOf = next => next.ticket || next.check || next.command;
  const agreeOn = (dir, label, ...args) => {
    const c = nextOf(dir, 'coverage', ...args), r = nextOf(dir, 'resume', ...args);
    assert.equal(routeOf(c), routeOf(r), `${label}: coverage and resume route to the same thing\ncoverage: ${c.command}\nresume:   ${r.command}`);
    return c;
  };

  // Paused, with work still open: the report must not send anyone to a ticket command.
  {
    const dir = strictFixture();
    decideAndAuthorize(dir);
    passes(rt(dir, 'change', 'pause', 'prd-v1', '--reason', 'waiting on the API review'));
    const next = agreeOn(dir, 'paused');
    assert.match(next.command, /change resume prd-v1/, `paused routes to resume, not to a ticket: ${next.command}`);
    refuses(rt(dir, 'start', 'T-01'), 1, /LIFECYCLE_BLOCKED/, 'the ticket command the old report suggested is refused');
    passes(rt(dir, 'change', 'resume', 'prd-v1'), 'the recommended command succeeds');
  }

  // Pause then resume returns to ordinary work routing.
  {
    const dir = strictFixture();
    decideAndAuthorize(dir);
    passes(rt(dir, 'change', 'pause', 'prd-v1', '--reason', 'hold'));
    passes(rt(dir, 'change', 'resume', 'prd-v1'));
    const next = agreeOn(dir, 'active');
    assert.ok(/pincer-ticket\.sh|change (complete|authorize|decide)/.test(next.command), `active routes to real work: ${next.command}`);
  }

  // Cancelled: historical changes route to inspection and a replacement, never to
  // execution and never to authorize — PRD v5 R-06 and S-09 say so explicitly.
  {
    const dir = strictFixture();
    passes(rt(dir, 'change', 'decide', 'prd-v1', '--summary', 'drop this change'));
    passes(rt(dir, 'change', 'decide', 'prd-v1', '--resolve', 'D-01', '--reference', 'chat', '--excerpt', 'dropped'));
    passes(rt(dir, 'change', 'cancel', 'prd-v1', '--decision', 'D-01', '--reason', 'dropped'));
    const next = agreeOn(dir, 'cancelled');
    assert.match(next.command, /change show prd-v1/, `cancelled routes to inspection: ${next.command}`);
    assert.ok(!/pincer-ticket\.sh|change authorize/.test(next.command), `no execution or authorization on a terminal change: ${next.command}`);
    const blockers = json(dir, 'coverage').blockers.map(b => b.code);
    assert.ok(blockers.includes('LIFECYCLE_BLOCKED') || /historical/.test(next.action), `the terminal state is visible: ${JSON.stringify(blockers)}`);
  }

  // A change inspected with --change that this worktree has not selected: the printed
  // ticket command is refused with WRONG_CHANGE unless the selection changes first.
  {
    const dir = strictFixture();
    decideAndAuthorize(dir);
    write(dir, '.prd/prd-v2.md', read(dir, '.prd/prd-v1.md').replace(/^version: 1$/m, 'version: 2'));
    commit(dir, 'second PRD');
    passes(rt(dir, 'register', '--prd', '.prd/prd-v2.md', '--change', 'prd-v2'));
    passes(rt(dir, 'change', 'select', 'prd-v2'));
    const next = nextOf(dir, 'coverage', '--change', 'prd-v1');
    if (/pincer-ticket\.sh/.test(next.command)) assert.match(next.command, /change select prd-v1, then/, `a ticket command for a non-selected change names the selection first: ${next.command}`);
  }
}

console.log('coverage report tests passed');
