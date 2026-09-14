// PRD v6 T-72 (R-06, S-16..S-18): in a strict change `check C-NN` runs the map's
// declaration and nothing else — a supplied command or timeout, an undeclared ID and
// a review obligation are refused before anything is prepared; the attempt records
// the declaration's digest and the strict identities; a changed declaration stales
// prior results and another change's C-01 is never borrowed; gate and declaration
// changes between the pre-launch guard and the lock are seen under the lock and
// refuse without launch, write or output; review obligations need a candidate-bound
// artifact with an explicit passed result, and passing command checks create no
// review result and no adequacy judgment.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir, write, read, run } from './helpers.js';

const require = createRequire(import.meta.url);
const state = require(path.join(repo, 'template/scripts/pincer-runtime/state.cjs'));
const coverage = require(path.join(repo, 'template/scripts/pincer-runtime/coverage.cjs'));
const checks = require(path.join(repo, 'template/scripts/pincer-runtime/checks.cjs'));
const phases = require(path.join(repo, 'template/scripts/pincer-runtime/phases.cjs'));
const runtime = path.join(repo, 'template/scripts/pincer-runtime.cjs');
const raceFixture = path.join(repo, 'test/fixtures/attempt-race.cjs');
const strengthen = path.join(repo, 'test/fixtures/strengthen-map.cjs');
const fx = path.join(repo, 'test/fixtures/prd-v6');
const rt = (dir, ...args) => run(dir, process.execPath, [runtime, ...args], { timeout: 60000 });
function passes(result, label = '') { assert.equal(result.status, 0, `${label}\n${result.stdout}${result.stderr}`); return result.stdout; }
function refuses(result, status, pattern, label = '') { assert.equal(result.status, status, `${label}: exit ${status}\n${result.stdout}${result.stderr}`); assert.match(result.stdout + result.stderr, pattern, label); return result; }
function git(dir, ...args) { return passes(run(dir, 'git', args), `git ${args.join(' ')}`).trim(); }
function commit(dir, message) { git(dir, 'add', '-A'); git(dir, '-c', 'user.name=T', '-c', 'user.email=t@example.invalid', 'commit', '-q', '--allow-empty', '-m', message); return git(dir, 'rev-parse', 'HEAD'); }
const record = (dir, id = 'prd-v1') => JSON.parse(read(dir, `.prd/changes/${id}.json`));
const currentDigest = dir => JSON.parse(passes(rt(dir, 'change', 'show', 'prd-v1', '--json'))).agreement.current;
const edit = (dir, file, from, to) => { const t = read(dir, file); assert.ok(t.includes(from), `${file} contains ${JSON.stringify(from)}`); write(dir, file, t.replace(from, to)); };
const launches = dir => (fs.existsSync(path.join(dir, '.pincer/markers/C-01')) ? read(dir, '.pincer/markers/C-01').split('\n').filter(Boolean).length : 0);
const attempts = dir => (state.exists(dir) ? state.listAttempts(dir).filter(a => a.context.kind === 'candidate') : []);
const COMMAND = 'mkdir -p .pincer/markers && echo run >> .pincer/markers/C-01 && test "$(cat value.txt)" = good';
const MAP = read(fx, 'strict/coverage/prd-v1.json').replace('"command": "test \\"$(cat value.txt)\\" = good", "timeout": 60', `"command": ${JSON.stringify(COMMAND)}, "timeout": 60`);

// A strict change, completed, with its candidate committed (PRD built): C-01 is a
// launch-marking command declaration, C-02 a required review obligation.
function candidateFixture() {
  const dir = tempDir(); git(dir, 'init', '-q');
  write(dir, '.gitignore', '.pincer/\n');
  write(dir, '.prd/prd-v1.md', read(fx, 'strict/prd-v1.md'));
  for (const f of fs.readdirSync(path.join(fx, 'strict/tickets'))) write(dir, `tickets/${f}`, read(fx, `strict/tickets/${f}`).replace('- [ ] expected behavior', '- [x] expected behavior'));
  write(dir, '.prd/coverage/prd-v1.json', MAP);
  write(dir, 'value.txt', 'good\n');
  commit(dir, 'base');
  passes(rt(dir, 'register', '--prd', '.prd/prd-v1.md')); passes(rt(dir, 'change', 'select', 'prd-v1'));
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', currentDigest(dir), '--reference', 'r', '--excerpt', 'e'));
  passes(rt(dir, 'change', 'activate', 'prd-v1'));
  passes(rt(dir, 'coverage', 'adopt', '--apply', '--change', 'prd-v1'));
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--summary', 'defer S-03 (impact report) to the next change'));
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--resolve', 'D-01', '--reference', 'chat 10:05', '--excerpt', 'agreed: S-03 is deferred'));
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', currentDigest(dir), '--reference', 'chat 10:06', '--excerpt', 'approved with S-03 deferred', '--decision', 'D-01'));
  for (const id of ['T-01', 'T-02', 'T-03']) { passes(rt(dir, 'verify', id)); passes(rt(dir, 'done', id)); }
  passes(rt(dir, 'change', 'complete', 'prd-v1'));
  edit(dir, '.prd/prd-v1.md', 'status: ticketed', 'status: built');
  const candidate = commit(dir, 'candidate');
  return { dir, candidate };
}

// --- S-16: the declaration is the only source; substitutions and borrowing fail --------
{
  const { dir, candidate } = candidateFixture();
  const declared = checks.declaration(dir, { change: 'prd-v1', prd: '.prd/prd-v1.md' }, 'C-01');
  assert.equal(declared.digest, coverage.definitionDigest({ kind: 'command', command: COMMAND, timeout: 60 }));
  const out = passes(rt(dir, 'check', 'C-01', '--candidate', candidate), 'the declared check runs');
  assert.match(out, /^── C-01 candidate [0-9a-f]{7} \(declared in \.prd\/coverage\/prd-v1\.json\) ──\n  \$ mkdir -p \.pincer\/markers && echo run >> \.pincer\/markers\/C-01 && test "\$\(cat value\.txt\)" = good\n✓ C-01 passed/m);
  assert.equal(launches(dir), 1);
  const [a] = attempts(dir);
  assert.equal(a.schema, 3); assert.equal(a.check.digest, declared.digest, 'the attempt records the declaration digest as its check digest');
  assert.equal(a.check.timeout_seconds, 60); assert.equal(a.cwd, '.');
  assert.equal(a.context.coverage, record(dir).agreements.at(-1).coverage); assert.equal(a.context.inventory, record(dir).agreements.at(-1).inventory);
  assert.equal(state.readIndex(dir).index.current[`candidate:prd-v1:${candidate}:C-01`], a.id, 'keyed by change and candidate');
  assert.equal(state.latestAttempt(dir, `candidate:other:${candidate}:C-01`), null, "another change's C-01 has no pointer here: nothing to borrow");
  // Substitutions: a supplied command, a supplied timeout, an undeclared ID, a review obligation.
  const snapshot = () => JSON.stringify([launches(dir), attempts(dir).length, fs.readdirSync(path.join(dir, '.pincer/runtime/attempts')).length]);
  const before = snapshot();
  for (const [label, args, pattern] of [
    ['a supplied command', ['check', 'C-01', '--candidate', candidate, '--', 'true'], /^pincer: CHECK_UNDECLARED: C-01 runs its declaration in a strict change; --timeout and a command after -- are not accepted \(edit \.prd\/coverage\/prd-v1\.json and authorize the agreement instead\)$/m],
    ['a supplied timeout', ['check', 'C-01', '--candidate', candidate, '--timeout', '5'], /CHECK_UNDECLARED: C-01 runs its declaration in a strict change/],
    ['an undeclared ID', ['check', 'C-09', '--candidate', candidate], /^pincer: CHECK_UNDECLARED: C-09 is not declared in \.prd\/coverage\/prd-v1\.json \(declared: C-01, C-02\); declare it there and authorize the agreement$/m],
    ['a review obligation', ['check', 'C-02', '--candidate', candidate], /^pincer: CHECK_UNDECLARED: C-02 is a review obligation \("read the diagnostic wording of S-02 against the PRD"\); it is recorded in the evaluation draft with its candidate-bound artifact and result, never run as a command$/m],
  ]) {
    const r = refuses(rt(dir, ...args), 4, pattern, label);
    assert.equal(r.stdout, '', `${label}: nothing on stdout`);
    assert.equal(snapshot(), before, `${label}: nothing launched, nothing recorded`);
  }
  // A changed declaration: the recorded pass no longer matches, and the check runs afresh on the new candidate.
  edit(dir, '.prd/coverage/prd-v1.json', '"timeout": 60', '"timeout": 90');
  refuses(rt(dir, 'check', 'C-01', '--candidate', candidate), 1, /AGREEMENT_CHANGED/, 'the edited map changed the agreement');
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', currentDigest(dir), '--delegated', '--basis', 'A-02', '--explanation', 'longer timeout'));
  refuses(rt(dir, 'check', 'C-01', '--candidate', candidate), 1, /the working tree is not a clean view of the candidate: \.prd\/changes\/prd-v1\.json|\.prd\/coverage\/prd-v1\.json/, 'a declaration change is a candidate change');
  const candidate2 = commit(dir, 'candidate 2');
  const now = checks.declaration(dir, { change: 'prd-v1', prd: '.prd/prd-v1.md' }, 'C-01');
  assert.notEqual(now.digest, a.check.digest, 'the recorded pass does not satisfy the new declaration');
  passes(rt(dir, 'check', 'C-01', '--candidate', candidate2));
  const b = attempts(dir).find(x => x.context.candidate === candidate2);
  assert.equal(b.check.digest, now.digest); assert.equal(b.check.timeout_seconds, 90);
  assert.equal(launches(dir), 2);
  // Legacy invocation stays supported in a change without the capability (schema 2), and refuses a strict change even with the exact declared text.
  refuses(rt(dir, 'check', 'C-01', '--candidate', candidate2, '--', COMMAND), 4, /CHECK_UNDECLARED/, 'the exact command text is still a substitution');
}

// --- S-17: gate and declaration changes between the guard and the lock -----------------
{
  let { dir, candidate } = candidateFixture();
  const race = (injected, command) => run(dir, process.execPath, [raceFixture, dir, ...injected, '--', ...command], { timeout: 60000 });
  const snapshot = () => JSON.stringify([launches(dir), attempts(dir).length, record(dir).sequence]);
  // A lifecycle change committed between the guard and the lock refuses the check.
  const reopened = race(['change', 'reopen', 'prd-v1', '--reason', 'race'], ['check', 'C-01', '--candidate', candidate]);
  assert.match(reopened.stderr, /\[race\] injected "change reopen prd-v1 --reason race" exited 0/);
  assert.equal(reopened.status, 1, reopened.stdout + reopened.stderr);
  assert.match(reopened.stderr, /^pincer: LIFECYCLE_BLOCKED: check refused: change prd-v1 is active \(check runs on completed changes\)/m);
  assert.equal(reopened.stdout, '', 'nothing on stdout'); assert.equal(launches(dir), 0, 'nothing launched'); assert.equal(attempts(dir).length, 0, 'nothing recorded');
  passes(rt(dir, 'change', 'complete', 'prd-v1'));
  candidate = commit(dir, 'completed again (a record edit after the candidate is a candidate change)');
  // A declaration change re-authorized between the guard and the lock refuses with CHECK_UNDECLARED.
  const before = snapshot();
  const strengthened = race(['--script', strengthen, 'prd-v1', '"timeout": 60', '"timeout": 61', 'A-02'], ['check', 'C-01', '--candidate', candidate]);
  assert.match(strengthened.stderr, /\[race\] injected .* exited 0: recorded authorization A-03 \(delegated, basis A-02\)/, strengthened.stderr);
  assert.equal(strengthened.status, 4, strengthened.stdout + strengthened.stderr);
  assert.match(strengthened.stderr, /^pincer: CHECK_UNDECLARED: the declaration of C-01 changed since the command was prepared \([0-9a-f]{12} → [0-9a-f]{12}\); run the check again$/m);
  assert.equal(strengthened.stdout, '', 'nothing on stdout');
  assert.equal(launches(dir), 0, 'the old declaration never launched'); assert.equal(attempts(dir).length, 0, 'no attempt record');
  assert.equal(record(dir).authorizations.at(-1).id, 'A-03', 'the injected authorization is the only write');
  assert.notEqual(snapshot(), before);
  git(dir, 'checkout', '--', '.prd/coverage/prd-v1.json');
  candidate = commit(dir, 'restored map, A-03 recorded');
  // The restored map is the A-02 agreement again; a harmless concurrent write (an idempotent revise) lets the check proceed and record the inputs validated under the lock.
  const fine = race(['change', 'revise', 'prd-v1'], ['check', 'C-01', '--candidate', candidate]);
  assert.equal(fine.status, 0, fine.stdout + fine.stderr);
  assert.match(fine.stderr, /\[race\] injected "change revise prd-v1" exited 0/);
  assert.equal(launches(dir), 1);
  const [a] = attempts(dir);
  assert.equal(a.context.agreement, currentDigest(dir), 'the attempt records the agreement current under the lock');
  assert.equal(a.context.coverage, coverage.readMap(dir, record(dir)).digest);
  // An open decision raised between the guard and the lock refuses too (the revise above recorded G-05: commit it first).
  candidate = commit(dir, 'G-05 recorded');
  const decided = race(['change', 'decide', 'prd-v1', '--summary', 'wait'], ['check', 'C-01', '--candidate', candidate]);
  assert.equal(decided.status, 1); assert.match(decided.stderr, /^pincer: DECISION_REQUIRED: check refused: decision D-02 is open/m);
  assert.equal(launches(dir), 1); assert.equal(attempts(dir).length, 1);
}

// --- S-18: review obligations need a candidate-bound artifact and a passed result --------
{
  const { dir, candidate } = candidateFixture();
  const map = coverage.readMap(dir, record(dir)).map;
  const dirRel = `.prd/evidence/prd-v1/${candidate}`;
  const problems = drafts => checks.reviewProblems(map, drafts, { dirRel, root: dir });
  assert.deepEqual(problems({}), [{ code: 'REVIEW_MISSING', detail: 'C-02 (required review obligation: read the diagnostic wording of S-02 against the PRD) is not recorded in the evaluation draft', ids: ['C-02'] }]);
  assert.deepEqual(problems({ 'C-02': { result: 'unverified', artifacts: [] } }).map(p => p.detail), ['C-02 (required review obligation: read the diagnostic wording of S-02 against the PRD) is unverified; a required review must pass on this candidate']);
  assert.deepEqual(problems({ 'C-02': { result: 'failed', artifacts: [`${dirRel}/review/notes.md`] } }).map(p => p.code), ['REVIEW_MISSING']);
  assert.deepEqual(problems({ 'C-02': { result: 'passed', artifacts: [] } }).map(p => p.detail), ['C-02 (required review obligation: read the diagnostic wording of S-02 against the PRD) has no candidate-bound artifact under .prd/evidence/prd-v1/' + candidate + '/ (none listed)']);
  assert.match(problems({ 'C-02': { result: 'passed', artifacts: ['docs/review.md'] } })[0].detail, /has no candidate-bound artifact under .* \(listed: docs\/review\.md\)/, 'an artifact outside the candidate directory is not candidate-bound');
  assert.match(problems({ 'C-02': { result: 'passed', artifacts: [`${dirRel}/../other/notes.md`] } })[0].detail, /has no candidate-bound artifact/, 'a traversal is not candidate-bound');
  assert.match(problems({ 'C-02': { result: 'passed', artifacts: [`${dirRel}/review/notes.md`] } })[0].detail, /has no candidate-bound artifact/, 'a listed artifact that does not exist yet');
  write(dir, `${dirRel}/review/notes.md`, '# reviewed S-02 wording against the PRD\n');
  assert.deepEqual(problems({ 'C-02': { result: 'passed', artifacts: [`${dirRel}/review/notes.md`] } }), [], 'a passed review with an existing candidate-bound artifact satisfies the obligation');
  fs.rmSync(path.join(dir, '.prd/evidence'), { recursive: true });
  // An optional obligation missing from the draft is incomplete, not REVIEW_MISSING; a declared command is never a review.
  const optional = { ...map, checks: { ...map.checks, 'C-02': { ...map.checks['C-02'], required: false } } };
  assert.deepEqual(checks.reviewProblems(optional, {}, { dirRel, root: dir }).map(p => p.code), ['COVERAGE_INCOMPLETE']);
  assert.deepEqual(checks.reviewProblems(optional, { 'C-02': { result: 'unverified', artifacts: [] } }, { dirRel, root: dir }), [], 'an optional obligation may be unverified');
  // Passing the command check creates no review result and no adequacy judgment.
  passes(rt(dir, 'check', 'C-01', '--candidate', candidate));
  const report = phases.compute(dir, record(dir));
  assert.ok(report.structure.complete && report.implementation.complete);
  assert.equal(report.candidate.evaluated, false); assert.equal(report.candidate.adequacy, null);
  assert.deepEqual(report.candidate.problems, [{ code: 'EVIDENCE_MISSING', detail: 'candidate: not evaluated', ids: [] }]);
  assert.doesNotMatch(JSON.stringify(report), /"delivered"|adequate/, 'no delivery or adequacy verdict from a passing syntax check');
}
console.log('coverage checks tests passed');
