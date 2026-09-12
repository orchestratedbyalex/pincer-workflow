// PRD v6 T-70 (R-05, S-13..S-15): structural, implementation and candidate coverage
// are separate fields computed over the validated graph. A mapped scenario with an
// open ticket, unticked criteria, a failed/interrupted/stale attempt or missing local
// evidence is visibly unfinished or unverified and blocks completion; completing all
// mapped work permits `change complete` before any candidate exists, while a missing
// map row still blocks it; complete structure with no candidate evidence is never
// labeled delivered or release-ready.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir, write, read, run } from './helpers.js';

const require = createRequire(import.meta.url);
const phases = require(path.join(repo, 'template/scripts/pincer-runtime/phases.cjs'));
const state = require(path.join(repo, 'template/scripts/pincer-runtime/state.cjs'));
const dispositions = require(path.join(repo, 'template/scripts/pincer-runtime/dispositions.cjs'));
const runtime = path.join(repo, 'template/scripts/pincer-runtime.cjs');
const fx = path.join(repo, 'test/fixtures/prd-v6');
const rt = (dir, ...args) => run(dir, process.execPath, [runtime, ...args]);
function passes(result, label = '') { assert.equal(result.status, 0, `${label}\n${result.stdout}${result.stderr}`); return result.stdout; }
function refuses(result, status, pattern, label = '') { assert.equal(result.status, status, `${label}: exit ${status}\n${result.stdout}${result.stderr}`); assert.match(result.stdout + result.stderr, pattern, label); return result; }
function git(dir, ...args) { return passes(run(dir, 'git', args), `git ${args.join(' ')}`).trim(); }
function commit(dir, message) { git(dir, 'add', '-A'); git(dir, '-c', 'user.name=T', '-c', 'user.email=t@example.invalid', 'commit', '-q', '--allow-empty', '-m', message); return git(dir, 'rev-parse', 'HEAD'); }
const record = (dir, id = 'prd-v1') => JSON.parse(read(dir, `.prd/changes/${id}.json`));
const currentDigest = dir => JSON.parse(passes(rt(dir, 'change', 'show', 'prd-v1', '--json'))).agreement.current;
const edit = (dir, file, from, to) => { const t = read(dir, file); assert.ok(t.includes(from), `${file} contains ${JSON.stringify(from)}`); write(dir, file, t.replace(from, to)); };
const report = dir => phases.compute(dir, record(dir));
const snapshotTree = dir => {
  const out = {};
  const walk = rel => { for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) { if (e.name === '.git') continue; const next = rel ? `${rel}/${e.name}` : e.name; if (e.isDirectory()) walk(next); else out[next] = fs.readFileSync(path.join(dir, next), 'utf8'); } };
  walk(''); return out;
};
// The complete blocked write test: the refusal names the code, and nothing changes on disk.
function completeRefused(dir, pattern, label) {
  const before = snapshotTree(dir);
  refuses(rt(dir, 'change', 'complete', 'prd-v1'), 1, pattern, label);
  assert.deepEqual(snapshotTree(dir), before, `${label}: nothing written`);
  assert.equal(record(dir).lifecycle.state, 'active');
}

// A strict, authorized, active project whose deferral of S-03 is authorized by D-01.
function strictFixture() {
  const dir = tempDir(); git(dir, 'init', '-q');
  write(dir, '.gitignore', '.pincer/\n');
  write(dir, '.prd/prd-v1.md', read(fx, 'strict/prd-v1.md'));
  for (const f of fs.readdirSync(path.join(fx, 'strict/tickets'))) write(dir, `tickets/${f}`, read(fx, `strict/tickets/${f}`));
  write(dir, '.prd/coverage/prd-v1.json', read(fx, 'strict/coverage/prd-v1.json'));
  write(dir, 'value.txt', 'good\n');
  commit(dir, 'base');
  passes(rt(dir, 'register', '--prd', '.prd/prd-v1.md')); passes(rt(dir, 'change', 'select', 'prd-v1'));
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', currentDigest(dir), '--reference', 'r', '--excerpt', 'e'));
  passes(rt(dir, 'change', 'activate', 'prd-v1'));
  passes(rt(dir, 'coverage', 'adopt', '--apply', '--change', 'prd-v1'));
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--summary', 'defer S-03 (impact report) to the next change'));
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--resolve', 'D-01', '--reference', 'chat 10:05', '--excerpt', 'agreed: S-03 is deferred'));
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', currentDigest(dir), '--reference', 'chat 10:06', '--excerpt', 'approved with S-03 deferred', '--decision', 'D-01'));
  commit(dir, 'strict');
  return dir;
}
const finish = (dir, id) => { passes(rt(dir, 'verify', id)); edit(dir, `tickets/${fs.readdirSync(path.join(dir, 'tickets')).find(f => f.startsWith(id))}`, '- [ ] expected behavior', '- [x] expected behavior'); passes(rt(dir, 'done', id)); };

// --- S-13: unfinished and unverified work is visible and blocks completion ---------------
{
  const dir = strictFixture();
  const r0 = report(dir);
  assert.ok(r0.strict); assert.equal(r0.label, 'strict');
  assert.ok(r0.structure.complete, JSON.stringify(r0.structure.problems));
  assert.deepEqual(r0.scope, [{ id: 'S-03', disposition: 'deferred', decision: 'D-01', authorization: 'A-02', excerpt: 'agreed: S-03 is deferred', reference: 'chat 10:05' }]);
  assert.equal(r0.implementation.complete, false);
  assert.equal(r0.implementation.scenarios['S-01'].implementation, 'unfinished');
  assert.deepEqual(r0.implementation.scenarios['S-01'].tickets, [{ id: 'T-01', status: 'open', ready: false, code: 'EVIDENCE_MISSING', detail: 'no runtime attempt recorded — verify' }]);
  assert.equal(r0.implementation.scenarios['S-02'].detail, 'T-01 is open, not done');
  assert.deepEqual(r0.implementation.scenarios['S-03'], { scope: 'deferred', requirement: 'R-02', implementation: 'not applicable', tickets: [], checks: [], detail: 'deferred by decision D-01' });
  assert.deepEqual(r0.implementation.problems.map(p => p.detail), ['S-01: T-01 is open, not done', 'T-02 is open, not done', 'T-03 is open, not done']);
  assert.deepEqual(r0.candidate, { evaluated: false, candidate: null, manifest: null, delivery: null, adequacy: null, scenarios: {}, problems: [{ code: 'EVIDENCE_MISSING', detail: 'candidate: not evaluated', ids: [] }] });
  completeRefused(dir, /LIFECYCLE_BLOCKED: T-01 is open, not done; finish every ticket before completing prd-v1/, 'open ticket');
  // A failed attempt.
  write(dir, 'value.txt', 'bad\n');
  refuses(rt(dir, 'verify', 'T-01'), 1, /FAILED/);
  const failed = report(dir);
  assert.equal(failed.implementation.scenarios['S-01'].implementation, 'unfinished', 'still in progress');
  assert.equal(failed.implementation.scenarios['S-01'].tickets[0].code, 'CHECK_FAILED');
  write(dir, 'value.txt', 'good\n');
  // Done but unticked, then stale, then interrupted, then missing local evidence: each visibly unverified.
  passes(rt(dir, 'verify', 'T-01'));
  refuses(rt(dir, 'done', 'T-01'), 1, /CRITERIA_UNTICKED/);
  finish(dir, 'T-01');
  assert.equal(report(dir).implementation.scenarios['S-01'].implementation, 'complete');
  assert.equal(report(dir).implementation.scenarios['S-02'].implementation, 'unfinished', 'S-02 still needs T-02');
  finish(dir, 'T-02'); finish(dir, 'T-03');
  assert.ok(report(dir).implementation.complete, JSON.stringify(report(dir).implementation.problems));
  write(dir, 'src.txt', 'new\n');
  const stale = report(dir);
  assert.equal(stale.implementation.complete, false);
  assert.equal(stale.implementation.scenarios['S-01'].implementation, 'unverified');
  assert.match(stale.implementation.scenarios['S-01'].detail, /^T-01 SOURCE_CHANGED: source changed since the passing attempt: src\.txt \(added\) — verify$/);
  assert.match(stale.implementation.problems[0].detail, /^S-01: T-01 SOURCE_CHANGED/);
  completeRefused(dir, /SOURCE_CHANGED: T-01: source changed since the passing attempt: src\.txt \(added\) — verify/, 'stale attempt');
  fs.rmSync(path.join(dir, 'src.txt'));
  assert.ok(report(dir).implementation.complete);
  // An interrupted attempt: the pointed-at record says so.
  const idx = state.readIndex(dir).index;
  const a = state.readAttempt(dir, idx.current['ticket:prd-v1:T-02']).attempt;
  state.writeAttempt(dir, { ...a, outcome: 'interrupted', exit_code: null, signal: 'SIGTERM' });
  const interrupted = report(dir);
  assert.equal(interrupted.implementation.scenarios['S-02'].implementation, 'unverified');
  assert.equal(interrupted.implementation.scenarios['S-02'].tickets.find(t => t.id === 'T-02').code, 'ATTEMPT_INTERRUPTED');
  completeRefused(dir, /ATTEMPT_INTERRUPTED: T-02: attempt \S+ was interrupted — verify/, 'interrupted attempt');
  state.writeAttempt(dir, a);
  // Missing local evidence (a fresh clone): unverified, and completion refuses.
  commit(dir, 'work done');
  const clone = tempDir(); git(clone, 'clone', '-q', dir, '.');
  passes(rt(clone, 'change', 'select', 'prd-v1'));
  const missing = report(clone);
  assert.equal(missing.implementation.scenarios['S-01'].tickets[0].code, 'EVIDENCE_MISSING');
  assert.equal(missing.implementation.scenarios['S-01'].implementation, 'unverified');
  completeRefused(clone, /EVIDENCE_MISSING: T-01: no runtime attempt recorded — verify/, 'missing local evidence');
  // Unticked criteria after the fact (a criterion unticked by hand) is unverified too.
  edit(dir, 'tickets/T-03-harness.md', '- [x] expected behavior', '- [ ] expected behavior');
  const unticked = report(dir);
  assert.match(unticked.implementation.problems.map(p => p.detail).join('\n'), /T-03 CRITERIA_UNTICKED/);
  completeRefused(dir, /CRITERIA_UNTICKED: T-03: unticked acceptance criteria — tick verified criteria/, 'unticked criteria');
}

// --- S-14: completion before any candidate; a missing map row still blocks -------------
{
  const dir = strictFixture();
  finish(dir, 'T-01'); finish(dir, 'T-02'); finish(dir, 'T-03');
  const ready = report(dir);
  assert.ok(ready.structure.complete && ready.implementation.complete);
  assert.equal(ready.candidate.evaluated, false, 'no candidate is demanded');
  // A missing row blocks completion even though every ticket is done and ready.
  const map = read(dir, '.prd/coverage/prd-v1.json');
  write(dir, '.prd/coverage/prd-v1.json', map.replace('"S-01": { "tickets": ["T-01"], "checks": ["C-01"] },\n', ''));
  assert.equal(JSON.parse(passes(rt(dir, 'change', 'show', 'prd-v1', '--json'))).authorization.verdict, 'AGREEMENT_CHANGED', 'the map edit changed the agreement');
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', currentDigest(dir), '--delegated', '--basis', 'A-02', '--explanation', 'row dropped by mistake'));
  const incomplete = report(dir);
  assert.equal(incomplete.structure.complete, false);
  assert.deepEqual(incomplete.structure.problems.map(p => [p.code, p.ids]), [['COVERAGE_INCOMPLETE', ['S-01']]]);
  assert.equal(incomplete.implementation.complete, false, 'implementation cannot be complete on an incomplete structure');
  completeRefused(dir, /COVERAGE_INCOMPLETE: S-01 has no row in scenarios or scope — complete needs structural coverage/, 'missing map row');
  write(dir, '.prd/coverage/prd-v1.json', map);
  assert.equal(JSON.parse(passes(rt(dir, 'change', 'show', 'prd-v1', '--json'))).authorization.verdict, 'current', 'back on A-02');
  // An unauthorized disposition and a missing obligation block too, before ticket readiness is consulted.
  write(dir, '.prd/coverage/prd-v1.json', map.replace('"decision": "D-01"', '"decision": "D-02"'));
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--summary', 'drop S-03'));
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--resolve', 'D-02', '--reference', 'x', '--excerpt', 'drop S-03'));
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', currentDigest(dir), '--delegated', '--basis', 'A-02', '--explanation', 'delegated cannot waive scope'));
  completeRefused(dir, /SCOPE_UNAUTHORIZED: S-03 \(deferred\): the current authorization A-04 descends from A-02, which does not name D-02/, 'unauthorized deferral');
  write(dir, '.prd/coverage/prd-v1.json', map);
  edit(dir, '.prd/prd-v1.md', '- **S-03** — Changing one scenario names that scenario and its requirement.\n', '');
  write(dir, '.prd/coverage/prd-v1.json', map.replace(`"scope": {\n    "S-03": { "disposition": "deferred", "decision": "D-01", "prior": null, "note": "deferred to the next change" }\n  }`, '"scope": {}'));
  { const r = rt(dir, 'change', 'complete', 'prd-v1'); assert.ok([1, 4].includes(r.status), `the deletion is refused (${r.status})`); assert.match(r.stderr, /INVENTORY_INVALID: \.prd\/prd-v1\.md: requirement R-02 at line \d+ has no scenario/, 'a requirement left without scenarios is an invalid inventory'); }
  edit(dir, '.prd/prd-v1.md', '> A quoted line mentioning **S-03:** is a reference, not a definition.\n', '> A quoted line mentioning **S-03:** is a reference, not a definition.\n\n- **S-04:** Something else.\n');
  write(dir, '.prd/coverage/prd-v1.json', read(dir, '.prd/coverage/prd-v1.json').replace('"S-02": { "tickets": ["T-01", "T-02"], "checks": ["C-01", "C-02"] }', '"S-02": { "tickets": ["T-01", "T-02"], "checks": ["C-01", "C-02"] },\n    "S-04": { "tickets": ["T-02"], "checks": ["C-02"] }'));
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', currentDigest(dir), '--reference', 'x', '--excerpt', 'S-04 instead'));
  const erased = report(dir);
  assert.deepEqual(erased.structure.problems.map(p => [p.code, p.ids]), [['OBLIGATION_MISSING', ['S-03']]]);
  completeRefused(dir, /OBLIGATION_MISSING: S-03 \(last defined by G-\d\d, authorized by A-\d\d\) of the reviewed inventory is defined neither in the PRD nor as a removed tombstone/, 'erased obligation');
  // Restore the authorized inputs: completion succeeds with no candidate, and the record says completed, not evaluated.
  git(dir, 'checkout', '--', '.prd/prd-v1.md', '.prd/coverage/prd-v1.json');
  // S-04 was reviewed (authorized) meanwhile, so it stays an obligation until a tombstone withdraws it; the resolved
  // decisions are agreement inputs, so the restored files need a fresh user authorization naming D-01 and D-03.
  const s04 = dispositions.baseline(dir, record(dir)).scenarios['S-04'];
  assert.match(s04.agreement, /^G-\d\d$/);
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--summary', 'withdraw S-04 again'));
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--resolve', 'D-03', '--reference', 'chat 12:00', '--excerpt', 'S-04 is withdrawn'));
  edit(dir, '.prd/coverage/prd-v1.json', '"scope": {\n', `"scope": {\n    "S-04": { "disposition": "removed", "decision": "D-03", "prior": "${s04.agreement}", "note": null },\n`);
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', currentDigest(dir), '--reference', 'chat 12:00', '--excerpt', 'back to the agreed scope, S-03 deferred, S-04 withdrawn', '--decision', 'D-01', '--decision', 'D-03'));
  assert.equal(JSON.parse(passes(rt(dir, 'change', 'show', 'prd-v1', '--json'))).authorization.verdict, 'current');
  assert.ok(report(dir).structure.complete, JSON.stringify(report(dir).structure.problems));
  // The map is source (v5 whole-source identity): editing it staled every attempt, so verify again.
  for (const id of ['T-01', 'T-02', 'T-03']) passes(rt(dir, 'verify', id));
  const out = passes(rt(dir, 'change', 'complete', 'prd-v1'));
  assert.match(out, /^completed change prd-v1: active → completed \(event \d+, authorization A-\d\d\)$/m);
  assert.equal(record(dir).lifecycle.state, 'completed');
  assert.ok(!fs.existsSync(path.join(dir, '.prd/evidence')), 'no evidence exists, and none was needed');
}

// --- S-15: complete structure without candidate evidence is never delivered or release-ready
{
  const dir = strictFixture();
  finish(dir, 'T-01'); finish(dir, 'T-02'); finish(dir, 'T-03');
  passes(rt(dir, 'change', 'complete', 'prd-v1'));
  edit(dir, '.prd/prd-v1.md', 'status: ticketed', 'status: built');
  commit(dir, 'candidate');
  const r = report(dir);
  assert.ok(r.structure.complete && r.implementation.complete);
  assert.equal(r.candidate.evaluated, false); assert.equal(r.candidate.delivery, null); assert.equal(r.candidate.adequacy, null);
  const text = JSON.stringify(r);
  assert.doesNotMatch(text, /"delivered"|release-ready|release_ready/, 'never labeled delivered or release-ready');
  assert.deepEqual(r.blockers, [{ code: 'EVIDENCE_MISSING', detail: 'candidate: not evaluated' }]);
  assert.equal(phases.firstBlocker(r, 'implementation'), null, 'implementation has no blocker');
  assert.deepEqual(phases.firstBlocker(r, 'candidate'), { code: 'EVIDENCE_MISSING', detail: 'candidate: not evaluated', ids: [] });
  refuses(rt(dir, 'ready'), 1, /not ready: EVIDENCE_MISSING|not ready: CANDIDATE_STALE|not ready: INPUT_INVALID/, 'release readiness is not granted by structure and implementation');
  // A change without the capability is labeled unverified, never strict, whatever its tickets say.
  const plain = tempDir(); git(plain, 'init', '-q');
  write(plain, '.prd/prd-v1.md', read(fx, 'strict/prd-v1.md')); write(plain, '.gitignore', '.pincer/\n'); commit(plain, 'base');
  passes(rt(plain, 'register', '--prd', '.prd/prd-v1.md'));
  const u = phases.compute(plain, record(plain));
  assert.equal(u.strict, false); assert.equal(u.label, 'unverified'); assert.match(u.reason, /strict coverage not adopted/); assert.equal(u.structure, null);
}
console.log('coverage readiness tests passed');
