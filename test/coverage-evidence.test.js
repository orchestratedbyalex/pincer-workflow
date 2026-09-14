// PRD v6 T-73 (R-07, S-19..S-21): a strict change's evidence (schema 3) records the
// complete inventory, every scenario's derived disposition, the coverage identity,
// the declared check identity and the adequacy judgment, and export and read-only
// release reconcile it independently with the committed candidate's authored
// inputs. Omitting or inventing a row, substituting the inventory or the map, or
// marking a failed linked check delivered refuses at export and at release; two
// changes evaluated on one candidate keep distinct identities; a fresh clone
// validates the saved record with its limitations, while tampered logs, missing
// snapshots, changed source and a newer applicable local failure block; release
// writes nothing.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir, write, read, run, createTicket } from './helpers.js';

const require = createRequire(import.meta.url);
const state = require(path.join(repo, 'template/scripts/pincer-runtime/state.cjs'));
const requirements = require(path.join(repo, 'template/scripts/pincer-runtime/requirements.cjs'));
const evidence = require(path.join(repo, 'template/scripts/pincer-runtime/evidence.cjs'));
const phases = require(path.join(repo, 'template/scripts/pincer-runtime/phases.cjs'));
const v5evidence = require(path.join(repo, 'test/fixtures/prd-v6/v5-kit/scripts/pincer-runtime/evidence.cjs'));
const runtime = path.join(repo, 'template/scripts/pincer-runtime.cjs');
const validator = path.join(repo, 'template/scripts/pincer-evidence.cjs');
const fx = path.join(repo, 'test/fixtures/prd-v6');
const rt = (dir, ...args) => run(dir, process.execPath, [runtime, ...args], { timeout: 60000 });
function passes(result, label = '') { assert.equal(result.status, 0, `${label}\n${result.stdout}${result.stderr}`); return result.stdout; }
function refuses(result, status, pattern, label = '') { assert.equal(result.status, status, `${label}: exit ${status}\n${result.stdout}${result.stderr}`); assert.match(result.stdout + result.stderr, pattern, label); return result; }
function git(dir, ...args) { return passes(run(dir, 'git', args), `git ${args.join(' ')}`).trim(); }
function commit(dir, message) { git(dir, 'add', '-A'); git(dir, '-c', 'user.name=T', '-c', 'user.email=t@example.invalid', 'commit', '-q', '--allow-empty', '-m', message); return git(dir, 'rev-parse', 'HEAD'); }
const record = (dir, id = 'prd-v1') => JSON.parse(read(dir, `.prd/changes/${id}.json`));
const digestOf = (dir, id) => JSON.parse(passes(rt(dir, 'change', 'show', id, '--json'))).agreement.current;
const edit = (dir, file, from, to) => { const t = read(dir, file); assert.ok(t.includes(from), `${file} contains ${JSON.stringify(from)}`); write(dir, file, t.replace(from, to)); };
const manifestOf = (dir, candidate, version = 1) => JSON.parse(read(dir, `.prd/evidence/prd-v${version}/${candidate}/manifest.json`));
const validate = (dir, candidate, version = 1, ...extra) => run(dir, process.execPath, [validator, 'validate', `.prd/evidence/prd-v${version}/${candidate}/manifest.json`, '--candidate', candidate, '--prd', `.prd/prd-v${version}.md`, ...extra]);
const snapshotTree = dir => {
  const out = {};
  const walk = rel => { for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) { if (e.name === '.git') continue; const next = rel ? `${rel}/${e.name}` : e.name; if (e.isDirectory()) { if (!/lock|journal/.test(e.name)) walk(next); } else out[next] = fs.readFileSync(path.join(dir, next), 'utf8'); } };
  walk(''); return out;
};
const COMMAND = 'test "$(cat value.txt)" = good && test ! -f .pincer/markers/fail';
const MAP = read(fx, 'strict/coverage/prd-v1.json').replace('"command": "test \\"$(cat value.txt)\\" = good", "timeout": 60', `"command": ${JSON.stringify(COMMAND)}, "timeout": 60`);

// A strict change (the fixture PRD, tickets and map; S-03 deferred by D-01), completed at a committed candidate.
function candidateFixture() {
  const dir = tempDir(); git(dir, 'init', '-q');
  write(dir, '.gitignore', '.pincer/\n');
  write(dir, '.prd/prd-v1.md', read(fx, 'strict/prd-v1.md'));
  for (const f of fs.readdirSync(path.join(fx, 'strict/tickets'))) write(dir, `tickets/${f}`, read(fx, `strict/tickets/${f}`).replace('- [ ] expected behavior', '- [x] expected behavior'));
  write(dir, '.prd/coverage/prd-v1.json', MAP);
  write(dir, 'value.txt', 'good\n');
  commit(dir, 'base');
  strictify(dir, 'prd-v1', ['T-01', 'T-02', 'T-03'], true);
  edit(dir, '.prd/prd-v1.md', 'status: ticketed', 'status: built');
  const candidate = commit(dir, 'candidate');
  return { dir, candidate, base: git(dir, 'rev-parse', 'HEAD~1') };
}
function strictify(dir, id, tickets, deferral) {
  passes(rt(dir, 'register', '--prd', id === 'prd-v1' ? '.prd/prd-v1.md' : '.prd/prd-v2.md', '--change', id)); passes(rt(dir, 'change', 'select', id));
  passes(rt(dir, 'change', 'authorize', id, '--agreement', digestOf(dir, id), '--reference', 'r', '--excerpt', 'e'));
  passes(rt(dir, 'change', 'activate', id));
  passes(rt(dir, 'coverage', 'adopt', '--apply', '--change', id));
  if (deferral) {
    passes(rt(dir, 'change', 'decide', id, '--summary', 'defer S-03 (impact report) to the next change'));
    passes(rt(dir, 'change', 'decide', id, '--resolve', 'D-01', '--reference', 'chat 10:05', '--excerpt', 'agreed: S-03 is deferred'));
    passes(rt(dir, 'change', 'authorize', id, '--agreement', digestOf(dir, id), '--reference', 'chat 10:06', '--excerpt', 'approved with S-03 deferred', '--decision', 'D-01'));
  } else passes(rt(dir, 'change', 'authorize', id, '--agreement', digestOf(dir, id), '--reference', 'chat 10:06', '--excerpt', 'approved as mapped'));
  for (const t of tickets) { passes(rt(dir, 'verify', t)); passes(rt(dir, 'done', t)); }
  passes(rt(dir, 'change', 'complete', id));
}
// Run C-01, save the review artifact, write the draft, export. Returns the export result.
function evaluate(dir, { candidate, base, version = 1, review = 'passed', adequacy = 'adequate', draftPatch = d => d, artifact = true, check = true } = {}) {
  const dirRel = `.prd/evidence/prd-v${version}/${candidate}`;
  if (check) passes(rt(dir, 'check', 'C-01', '--candidate', candidate), 'C-01');
  if (artifact) write(dir, `${dirRel}/review/wording.md`, '# reviewed the diagnostic wording against the PRD\n');
  const draft = draftPatch({
    environment: { tools: ['bash'], limitations: [] },
    coverage_review: 'C-01 exercises the parser fixture; C-02 reviewed the wording; S-03 is deferred by D-01.',
    adequacy: { verdict: adequacy, note: adequacy === 'adequate' ? 'C-01 runs the real command and C-02 was read against the PRD text' : 'C-01 only checks a fixture value; it does not establish S-01' },
    checks: [{ id: 'C-01' }, { id: 'C-02', result: review, timestamp: '2026-09-12T12:00:00Z', artifacts: artifact ? [`${dirRel}/review/wording.md`] : [], note: 'reviewer record' }],
    visual_review: { applicable: false, reason: 'no UI' },
  });
  write(dir, `.pincer/drafts/${version}.json`, JSON.stringify(draft));
  return rt(dir, 'evidence', 'export', '--candidate', candidate, '--base', base, '--prd', `.prd/prd-v${version}.md`, '--draft', `.pincer/drafts/${version}.json`);
}

// --- S-19: export and independent release refuse omitted, invented, substituted and false rows
{
  const { dir, candidate, base } = candidateFixture();
  const dirRel = `.prd/evidence/prd-v1/${candidate}`;
  const noManifest = label => assert.ok(!fs.existsSync(path.join(dir, dirRel, 'manifest.json')), `${label}: no manifest written`);
  // Export refusals before anything is written.
  refuses(evaluate(dir, { candidate, base, draftPatch: d => ({ ...d, requirements: [{ id: 'R-01', disposition: 'delivered', tickets: ['T-01'], checks: ['C-01'] }] }) }), 1, /draft: unknown key "requirements" \(allowed: environment, coverage_review, adequacy, checks, visual_review\) — dispositions are derived from the map and the outcomes in a strict change/, 'authored requirements');
  noManifest('authored requirements');
  refuses(evaluate(dir, { candidate, base, check: false, draftPatch: d => ({ ...d, checks: d.checks.filter(c => c.id !== 'C-02') }) }), 1, /draft check C-02 \(required review\) is missing: every declared check appears in the draft — an unused failing required check cannot be omitted/, 'omitted declared check');
  refuses(evaluate(dir, { candidate, base, check: false, draftPatch: d => ({ ...d, checks: [...d.checks, { id: 'C-03', kind: 'review', required: false, result: 'passed', timestamp: '2026-09-12T12:00:00Z', artifacts: [] }] }) }), 1, /draft check C-03 is not declared in the coverage map/, 'undeclared check');
  refuses(evaluate(dir, { candidate, base, check: false, draftPatch: d => { const { adequacy, ...rest } = d; return rest; } }), 1, /draft\.adequacy must be \{ verdict: "adequate" \| "inadequate", note \}/, 'missing adequacy');
  refuses(evaluate(dir, { candidate, base, check: false, artifact: false }), 1, /REVIEW_MISSING: C-02 \(required review obligation: read the diagnostic wording of S-02 against the PRD\) has no candidate-bound artifact under/, 'review without artifact');
  refuses(evaluate(dir, { candidate, base, check: false, review: 'unverified' }), 1, /REVIEW_MISSING: C-02 .* is unverified; a required review must pass on this candidate/, 'unverified review');
  refuses(evaluate(dir, { candidate, base, check: false, draftPatch: d => ({ ...d, checks: [{ id: 'C-01', kind: 'command', required: false }, d.checks[1]] }) }), 1, /draft check C-01: required false disagrees with the declaration \(true\)/, 'a declaration cannot be weakened in the draft');
  refuses(evaluate(dir, { candidate, base, check: false, draftPatch: d => ({ ...d, checks: [{ id: 'C-01', kind: 'command', required: true, result: 'passed' }, d.checks[1]] }) }), 1, /draft check C-01: a command result cannot be authored/, 'authored command result');
  noManifest('refusals');
  // An honest complete evaluation: schema 3 with derived rows, snapshots and the adequacy judgment.
  const out = passes(evaluate(dir, { candidate, base, check: false }), 'export');
  assert.match(out, /^exported \.prd\/evidence\/prd-v1\/[0-9a-f]{40}\/manifest\.json \(schema 3\) — delivery: original false, agreed true — validate:/m);
  const m = manifestOf(dir, candidate);
  assert.equal(m.schema, 3);
  assert.deepEqual(Object.keys(m), ['schema', 'prd', 'base', 'candidate', 'created', 'environment', 'coverage_review', 'requirements', 'checks', 'visual_review', 'artifacts', 'change', 'coverage', 'scenarios', 'adequacy', 'delivery']);
  const r = record(dir);
  assert.deepEqual(m.coverage, { agreement: r.agreements.at(-1).digest, authorization: 'A-02', inventory: r.agreements.at(-1).inventory, map: r.agreements.at(-1).coverage, snapshots: { inventory: `${dirRel}/coverage/inventory.json`, map: `${dirRel}/coverage/map.json` } });
  assert.deepEqual(m.scenarios.map(s => [s.id, s.disposition, s.decision, s.authorization]), [['S-01', 'delivered', null, null], ['S-02', 'delivered', null, null], ['S-03', 'deferred', 'D-01', 'A-02']]);
  assert.deepEqual(m.requirements.map(x => [x.id, x.disposition, x.scenarios]), [['R-01', 'delivered', ['S-01', 'S-02']], ['R-02', 'deferred', ['S-03']]]);
  assert.deepEqual(m.delivery, { original: false, agreed: true }, 'delivery with an authorized deferral is not delivery of every original obligation');
  assert.deepEqual(m.adequacy, { verdict: 'adequate', note: 'C-01 runs the real command and C-02 was read against the PRD text' });
  assert.equal(m.checks.find(c => c.id === 'C-01').declared, m.checks.find(c => c.id === 'C-01').attempt.check_digest, 'the command attempt ran the declaration');
  assert.ok(m.artifacts.some(a => a.path === `${dirRel}/coverage/inventory.json`) && m.artifacts.some(a => a.path === `${dirRel}/coverage/map.json`), 'snapshots are listed artifacts');
  assert.equal(JSON.parse(read(dir, `${dirRel}/coverage/inventory.json`)).digest, m.coverage.inventory);
  assert.ok(!JSON.stringify(JSON.parse(read(dir, `${dirRel}/coverage/map.json`))).includes(m.coverage.agreement), 'no snapshot carries a digest of the manifest or the agreement');
  assert.match(passes(validate(dir, candidate)), /^ok [0-9a-f]{40} schema 3$/m);
  assert.deepEqual(v5evidence.validate(path.join(dir, dirRel, 'manifest.json'), { candidate }, dir), ['unknown evidence schema 3 — this runtime validates schemas 1 and 2'], 'the PRD v5 validator refuses schema 3');
  const evaluated = commit(dir, 'evaluate');
  assert.match(passes(rt(dir, 'ready')), /^ready candidate /m);
  const report = phases.compute(dir, record(dir));
  assert.ok(report.candidate.evaluated); assert.deepEqual(report.candidate.delivery, { original: false, agreed: true }); assert.deepEqual(report.candidate.problems, []);
  assert.equal(report.candidate.scenarios['S-03'].disposition, 'deferred');
  // Mutations of the committed manifest: export-side validation and independent release validation refuse each.
  const manifestRel = `${dirRel}/manifest.json`;
  const original = read(dir, manifestRel);
  const mutate = (label, fn, pattern) => {
    const doc = JSON.parse(original); fn(doc); write(dir, manifestRel, JSON.stringify(doc, null, 2) + '\n');
    refuses(validate(dir, candidate), 1, pattern, `${label}: validator`);
    refuses(rt(dir, 'ready'), 1, /not ready: CANDIDATE_STALE/, `${label}: release`);
    assert.deepEqual(evidence.validate(path.join(dir, manifestRel), { candidate, prd: '.prd/prd-v1.md' }, dir).some(p => pattern.test(p)), true, `${label}: module`);
    write(dir, manifestRel, original);
  };
  mutate('omitted row', d => { d.scenarios = d.scenarios.filter(s => s.id !== 'S-02'); }, /scenario S-02 of the inventory snapshot has no row \(an omitted obligation\)/);
  mutate('invented row', d => { d.scenarios.push({ ...d.scenarios[0], id: 'S-09' }); }, /scenario S-09 is not a scenario of the inventory snapshot \(an invented row\)/);
  mutate('invented requirement', d => { d.requirements.push({ ...d.requirements[0], id: 'R-09', scenarios: [] }); }, /requirement R-09 is not a requirement of the inventory snapshot/);
  mutate('a failed linked check marked delivered', d => { d.checks.find(c => c.id === 'C-02').result = 'failed'; }, /scenario S-02: disposition delivered is not what the map and the outcomes give \(blocked\)/);
  mutate('a false delivery summary', d => { d.delivery.original = true; }, /delivery \{ original: false, agreed: true \} is what the rows give, not \{ original: true, agreed: true \}/);
  mutate('inadequate judged adequate', d => { d.adequacy = { verdict: 'inadequate', note: 'C-01 is a fixture check' }; }, /adequacy verdict is inadequate \("C-01 is a fixture check"\) — readiness is blocked/);
  mutate('a substituted declaration digest', d => { d.checks.find(c => c.id === 'C-01').declared = 'f'.repeat(64); }, /check C-01: declared ffffffffffff is not the declaration's digest/);
  mutate('a substituted attempt digest', d => { d.checks.find(c => c.id === 'C-01').attempt.check_digest = 'e'.repeat(64); }, /check C-01: the attempt ran eeeeeeeeeeee, not the declared command and timeout/);
  mutate('a dispositioned row without authorization', d => { d.scenarios.find(s => s.id === 'S-03').authorization = null; }, /scenario S-03: a deferred row names the user authorization A-NN that covers its decision/);
  // Substituted snapshots: a consistent fake inventory or map is caught by the committed candidate.
  const invRel = `${dirRel}/coverage/inventory.json`, mapRel = `${dirRel}/coverage/map.json`;
  const invOriginal = read(dir, invRel), mapOriginal = read(dir, mapRel);
  {
    const fake = requirements.parseInventory(read(dir, '.prd/prd-v1.md').replace('- [x] **S-02:** Duplicate IDs cause an actionable diagnostic.\n', ''), { prd: '.prd/prd-v1.md' }).inventory;
    const snap = requirements.snapshotOf(fake);
    write(dir, invRel, JSON.stringify({ schema: 1, prd: '.prd/prd-v1.md', ...snap }, null, 2) + '\n');
    const doc = JSON.parse(original);
    doc.artifacts.find(a => a.path === invRel).sha256 = evidence.digestFile(path.join(dir, invRel));
    doc.coverage.inventory = snap.digest;
    doc.scenarios = doc.scenarios.filter(s => s.id !== 'S-02'); doc.requirements[0].scenarios = ['S-01']; doc.requirements[0].tickets = ['T-01']; doc.requirements[0].checks = ['C-01'];
    write(dir, manifestRel, JSON.stringify(doc, null, 2) + '\n');
    const problems = evidence.validate(path.join(dir, manifestRel), { candidate, prd: '.prd/prd-v1.md' }, dir);
    assert.ok(problems.some(p => /coverage\.inventory does not equal the inventory of the candidate's PRD: the candidate's PRD defines S-02, which the manifest omits/.test(p)), JSON.stringify(problems));
    assert.ok(problems.some(p => /agreement G-\d\d binds inventory .*, not the manifest's/.test(p)), 'the change record disagrees too');
    refuses(rt(dir, 'ready'), 1, /CANDIDATE_STALE/, 'a substituted inventory blocks release');
    write(dir, invRel, invOriginal); write(dir, manifestRel, original);
  }
  {
    const doc = JSON.parse(original);
    const fakeMap = JSON.parse(mapOriginal); fakeMap.map.checks['C-02'].required = false; fakeMap.digest = 'd'.repeat(64);
    write(dir, mapRel, JSON.stringify(fakeMap, null, 2) + '\n');
    doc.artifacts.find(a => a.path === mapRel).sha256 = evidence.digestFile(path.join(dir, mapRel));
    write(dir, manifestRel, JSON.stringify(doc, null, 2) + '\n');
    const problems = evidence.validate(path.join(dir, manifestRel), { candidate, prd: '.prd/prd-v1.md' }, dir);
    assert.ok(problems.some(p => /coverage\.map .* does not equal the map snapshot digest/.test(p)), JSON.stringify(problems));
    fakeMap.digest = require(path.join(repo, 'template/scripts/pincer-runtime/coverage.cjs')).digestOf(require(path.join(repo, 'template/scripts/pincer-runtime/coverage.cjs')).normalize(fakeMap.map));
    doc.coverage.map = fakeMap.digest;
    write(dir, mapRel, JSON.stringify(fakeMap, null, 2) + '\n'); doc.artifacts.find(a => a.path === mapRel).sha256 = evidence.digestFile(path.join(dir, mapRel));
    write(dir, manifestRel, JSON.stringify(doc, null, 2) + '\n');
    const deeper = evidence.validate(path.join(dir, manifestRel), { candidate, prd: '.prd/prd-v1.md' }, dir);
    assert.ok(deeper.some(p => /check C-02: required true disagrees with the declaration \(false\)/.test(p)) || deeper.some(p => /coverage\.map does not equal the digest of the candidate's \.prd\/coverage\/prd-v1\.json \(a substituted map\)/.test(p)), JSON.stringify(deeper));
    assert.ok(deeper.some(p => /a substituted map/.test(p)), 'the committed candidate\'s map is the authority');
    refuses(rt(dir, 'ready'), 1, /CANDIDATE_STALE/);
    write(dir, mapRel, mapOriginal); write(dir, manifestRel, original);
  }
  assert.equal(git(dir, 'status', '--porcelain'), '', 'every mutation was undone');
  assert.match(passes(rt(dir, 'ready')), /^ready candidate /m);
  // Inadequate at export time: the manifest records the judgment, and release is blocked by it.
  git(dir, 'checkout', '-q', '--detach', candidate);
  fs.rmSync(path.join(dir, '.prd/evidence'), { recursive: true, force: true });
  // Like a failed required check, an inadequate judgment is recorded honestly and blocks: the manifest is written, validation names it.
  refuses(evaluate(dir, { candidate, base, check: false, adequacy: 'inadequate' }), 1, /adequacy verdict is inadequate \("C-01 only checks a fixture value; it does not establish S-01"\) — readiness is blocked/, 'an inadequate judgment');
  assert.deepEqual(manifestOf(dir, candidate).adequacy, { verdict: 'inadequate', note: 'C-01 only checks a fixture value; it does not establish S-01' }, 'the judgment is recorded, not hidden');
  refuses(validate(dir, candidate), 1, /adequacy verdict is inadequate/);
  const blocked = phases.compute(dir, record(dir));
  assert.equal(blocked.candidate.evaluated, false, 'a refused export records no evaluation in the locator');
  assert.doesNotMatch(JSON.stringify(blocked.candidate.problems), /release-ready/);
  git(dir, 'checkout', '-q', '.'); git(dir, 'clean', '-fdq'); git(dir, 'checkout', '-q', '-');
  assert.equal(git(dir, 'rev-parse', 'HEAD'), evaluated);
}

// --- S-20: two changes evaluated on one candidate keep distinct identities and locators
{
  const dir = tempDir(); git(dir, 'init', '-q');
  write(dir, '.gitignore', '.pincer/\n');
  write(dir, '.prd/prd-v1.md', read(fx, 'strict/prd-v1.md'));
  for (const f of fs.readdirSync(path.join(fx, 'strict/tickets'))) write(dir, `tickets/${f}`, read(fx, `strict/tickets/${f}`).replace('- [ ] expected behavior', '- [x] expected behavior'));
  write(dir, '.prd/coverage/prd-v1.json', MAP);
  write(dir, '.prd/prd-v2.md', '---\nversion: 2\nstatus: ticketed\ndate: 2026-09-12\n---\n# Second change\n\n### R-01 — Other value\n\n- **S-01:** other.txt holds fine.\n');
  createTicket(dir, { id: 'T-04', prd: '.prd/prd-v2.md', command: 'test "$(cat other.txt)" = fine', criteria: '- [x] b' });
  write(dir, '.prd/coverage/b.json', JSON.stringify({ schema: 1, change: 'b', prd: '.prd/prd-v2.md', scenarios: { 'S-01': { tickets: ['T-04'], checks: ['C-01'] } }, scope: {}, tickets: { 'T-04': { role: 'implements', rationale: null } }, checks: { 'C-01': { kind: 'command', required: true, command: 'test "$(cat other.txt)" = fine', timeout: 30, cwd: null, obligation: null, note: null }, 'C-02': { kind: 'review', required: true, command: null, timeout: null, cwd: null, obligation: 'read the other value', note: null } } }, null, 2) + '\n');
  write(dir, 'value.txt', 'good\n'); write(dir, 'other.txt', 'fine\n');
  commit(dir, 'base');
  strictify(dir, 'prd-v1', ['T-01', 'T-02', 'T-03'], true);
  strictify(dir, 'b', ['T-04'], false);
  edit(dir, '.prd/prd-v1.md', 'status: ticketed', 'status: built'); edit(dir, '.prd/prd-v2.md', 'status: ticketed', 'status: built');
  const candidate = commit(dir, 'shared candidate'); const base = git(dir, 'rev-parse', 'HEAD~1');
  passes(rt(dir, 'change', 'select', 'prd-v1'));
  passes(evaluate(dir, { candidate, base }), 'evaluate A');
  commit(dir, 'evaluate A');
  passes(rt(dir, 'change', 'select', 'b'));
  passes(evaluate(dir, { candidate, base, version: 2 }), 'evaluate B on the same candidate');
  commit(dir, 'evaluate B');
  const a = manifestOf(dir, candidate, 1), b = manifestOf(dir, candidate, 2);
  assert.equal(a.change.id, 'prd-v1'); assert.equal(b.change.id, 'b');
  assert.notEqual(a.coverage.agreement, b.coverage.agreement); assert.notEqual(a.coverage.map, b.coverage.map);
  assert.equal(b.scenarios.length, 1); assert.deepEqual(b.delivery, { original: true, agreed: true });
  const idx = state.readIndex(dir).index;
  assert.ok(idx.current[`candidate:prd-v1:${candidate}:C-01`] && idx.current[`candidate:b:${candidate}:C-01`] && idx.current[`candidate:prd-v1:${candidate}:C-01`] !== idx.current[`candidate:b:${candidate}:C-01`], 'distinct attempts per change');
  assert.equal(a.checks.find(c => c.id === 'C-01').attempt.id, idx.current[`candidate:prd-v1:${candidate}:C-01`]);
  assert.equal(b.checks.find(c => c.id === 'C-01').attempt.id, idx.current[`candidate:b:${candidate}:C-01`]);
  assert.match(passes(rt(dir, 'ready')), /^ready candidate /m, 'B is ready');
  passes(rt(dir, 'change', 'select', 'prd-v1'));
  assert.match(passes(rt(dir, 'ready')), /^ready candidate /m, 'A is still ready after B\'s evaluation commit');
  for (const id of ['prd-v1', 'b']) assert.equal(JSON.parse(read(dir, `.prd/evidence/changes/${id}.json`)).evaluations.length, 1);
  // Arbitrary unlisted evidence and a malformed locator remain candidate changes after the candidate.
  write(dir, `.prd/evidence/prd-v1/${candidate}/extra.txt`, 'unlisted\n');
  refuses(rt(dir, 'ready'), 1, /CANDIDATE_STALE .*extra\.txt/, 'an unlisted file under the evidence directory');
  fs.rmSync(path.join(dir, `.prd/evidence/prd-v1/${candidate}/extra.txt`));
  write(dir, '.prd/evidence/changes/b.json', '{ "schema": 1, "change": "b", "evaluations": [ {');
  refuses(rt(dir, 'ready'), 1, /CANDIDATE_STALE/, 'a malformed locator of the other change is a candidate change');
  git(dir, 'checkout', '--', '.prd/evidence/changes/b.json');
  assert.match(passes(rt(dir, 'ready')), /^ready candidate /m);
}

// --- S-21: a fresh clone validates the saved evidence with its limits; tampering, changed source and newer failures block; release writes nothing
{
  const { dir, candidate, base } = candidateFixture();
  passes(evaluate(dir, { candidate, base }));
  commit(dir, 'evaluate');
  const clone = tempDir(); git(clone, 'clone', '-q', dir, '.');
  passes(rt(clone, 'change', 'select', 'prd-v1'));
  const before = snapshotTree(clone);
  assert.match(passes(rt(clone, 'ready')), /^ready candidate /m, 'a fresh clone validates the saved schema 3 evidence');
  assert.deepEqual(snapshotTree(clone), before, 'release inspection writes nothing');
  const st = JSON.parse(passes(rt(clone, 'status', '--json')));
  assert.equal(st.candidate.local_attempts, 'unavailable'); assert.equal(st.candidate.evidence.schema, 3);
  const ok = validate(clone, candidate);
  assert.equal(ok.status, 0, ok.stderr); assert.equal(ok.stderr, '', 'inside the repository the reconciliation runs without limitations');
  // Copied outside any repository: the snapshots validate against themselves and the limitation is printed, never claimed.
  const copy = tempDir();
  fs.cpSync(path.join(clone, '.prd'), path.join(copy, '.prd'), { recursive: true });
  const copied = run(copy, process.execPath, [validator, 'validate', `.prd/evidence/prd-v1/${candidate}/manifest.json`, '--candidate', candidate, '--prd', '.prd/prd-v1.md'], { env: { ...process.env, CLAUDE_PROJECT_DIR: copy } });
  assert.equal(copied.status, 0, copied.stderr);
  assert.match(copied.stderr, /^evidence: limitation: the candidate [0-9a-f]{7} is not available in this repository; the snapshots were validated against themselves only$/m);
  // Tampered log, missing snapshot, changed source.
  const logRel = `.prd/evidence/prd-v1/${candidate}/checks/C-01.log`;
  write(clone, logRel, read(clone, logRel).replace('outcome passed', 'outcome passed (edited)'));
  refuses(validate(clone, candidate), 1, /digest mismatch — the file changed after the evidence was recorded/);
  refuses(rt(clone, 'ready'), 1, /CANDIDATE_STALE/, 'tampered log');
  git(clone, 'checkout', '--', logRel);
  fs.rmSync(path.join(clone, `.prd/evidence/prd-v1/${candidate}/coverage/map.json`));
  refuses(validate(clone, candidate), 1, /coverage\/map\.json: missing/);
  refuses(rt(clone, 'ready'), 1, /CANDIDATE_STALE/, 'missing snapshot');
  git(clone, 'checkout', '--', `.prd/evidence/prd-v1/${candidate}/coverage/map.json`);
  write(clone, 'value.txt', 'good\n\n'); commit(clone, 'source changed after evaluation');
  refuses(rt(clone, 'ready'), 1, /CANDIDATE_STALE stale: candidate changed after evaluation: value\.txt/, 'changed source');
  // A newer applicable local failure on the same source blocks in the original repository.
  fs.mkdirSync(path.join(dir, '.pincer/markers'), { recursive: true }); write(dir, '.pincer/markers/fail', '');
  refuses(rt(dir, 'check', 'C-01', '--candidate', candidate), 1, /C-01 failed/);
  refuses(rt(dir, 'ready'), 1, /not ready: CHECK_FAILED C-01: newer local attempt \S+ failed on the same source inputs as the exported pass/, 'newer same-source failure');
  const rep = phases.compute(dir, record(dir));
  assert.ok(rep.candidate.evaluated, 'the saved evidence is still inspectable');
}
console.log('coverage evidence tests passed');

// --- T-83 (R-07, S-19): three manifests the independent validator used to accept.
// `pincer-evidence.cjs validate` is what a reviewer runs on evidence they did not
// produce, so each of these returned `ok` while certifying something the candidate
// does not support.
{
  const { dir, candidate, base } = candidateFixture();
  const dirRel = `.prd/evidence/prd-v1/${candidate}`;
  const manifestRel = `${dirRel}/manifest.json`, mapRel = `${dirRel}/coverage/map.json`;
  passes(evaluate(dir, { candidate, base }), 'export for the T-83 cases');
  const original = read(dir, manifestRel), mapOriginal = read(dir, mapRel);
  const cov = require(path.join(repo, 'template/scripts/pincer-runtime/coverage.cjs'));
  const problemsNow = () => evidence.validate(path.join(dir, manifestRel), { candidate, prd: '.prd/prd-v1.md' }, dir);

  // 1. A scenario linked to a check the snapshot does not declare was treated as
  //    vacuously satisfied and derived `delivered` — an obligation nothing verified.
  {
    const snap = JSON.parse(mapOriginal);
    snap.map.scenarios['S-01'].checks = ['C-09'];
    snap.digest = cov.digestOf(cov.normalize(snap.map));
    write(dir, mapRel, JSON.stringify(snap, null, 2) + '\n');
    const doc = JSON.parse(original);
    doc.artifacts.find(a => a.path === mapRel).sha256 = evidence.digestFile(path.join(dir, mapRel));
    doc.coverage.map = snap.digest;
    doc.scenarios.find(s => s.id === 'S-01').checks = ['C-09'];
    write(dir, manifestRel, JSON.stringify(doc, null, 2) + '\n');
    const problems = problemsNow();
    assert.ok(problems.some(p => /links S-01 to C-09, which it does not declare/.test(p)), `undeclared link is refused: ${JSON.stringify(problems)}`);
    refuses(validate(dir, candidate), 1, /links S-01 to C-09, which it does not declare/, 'undeclared link at the CLI');
    write(dir, mapRel, mapOriginal); write(dir, manifestRel, original);
  }

  // 2. A candidate whose PRD blob cannot be read was reported as "not available in
  //    this repository" — false when the commit is present — and the map and change
  //    record were left unreconciled with it.
  {
    const prdText = read(dir, '.prd/prd-v1.md');
    fs.rmSync(path.join(dir, '.prd/prd-v1.md'));
    const without = commit(dir, 'remove the PRD from the tree');
    assert.equal(git(dir, 'cat-file', '-t', without), 'commit', 'the candidate commit resolves');
    const snap = JSON.parse(mapOriginal);
    snap.map.checks['C-02'].required = false;                 // the fault the early return hid
    snap.digest = cov.digestOf(cov.normalize(snap.map));
    write(dir, mapRel, JSON.stringify(snap, null, 2) + '\n');
    const doc = JSON.parse(original);
    doc.candidate = without;
    doc.artifacts.find(a => a.path === mapRel).sha256 = evidence.digestFile(path.join(dir, mapRel));
    doc.coverage.map = snap.digest;
    write(dir, manifestRel, JSON.stringify(doc, null, 2) + '\n');
    const problems = evidence.validate(path.join(dir, manifestRel), { candidate: without, prd: '.prd/prd-v1.md' }, dir);
    assert.ok(problems.some(p => /the candidate carries no \.prd\/prd-v1\.md/.test(p)), `a present commit missing a blob is a problem, not a limitation: ${JSON.stringify(problems)}`);
    assert.ok(problems.some(p => /a substituted map/.test(p)), `the map is still reconciled with the candidate: ${JSON.stringify(problems)}`);
    write(dir, mapRel, mapOriginal); write(dir, manifestRel, original);
    write(dir, '.prd/prd-v1.md', prdText);
  }

  // 3. A deferred row's authorization was shape-checked and never resolved, so a
  //    non-delivery could be backed by an authorization that does not exist.
  {
    const doc = JSON.parse(original);
    doc.scenarios.find(s => s.id === 'S-03').authorization = 'A-99';
    const req = doc.requirements.find(r => r.scenarios.includes('S-03'));
    if (req && 'authorization' in req) req.authorization = 'A-99';
    write(dir, manifestRel, JSON.stringify(doc, null, 2) + '\n');
    const problems = problemsNow();
    assert.ok(problems.some(p => /scenario S-03: authorization A-99 is not an authorization of the candidate's change record/.test(p)), `an invented authorization is refused: ${JSON.stringify(problems)}`);
    // The independent validator and the local report now agree; before, `ready` said
    // SCOPE_UNAUTHORIZED on this tree while `validate` said ok.
    refuses(rt(dir, 'ready'), 1, /not ready/, 'the local report refuses the same evidence');
    write(dir, manifestRel, original);
  }
  assert.equal(problemsNow().length, 0, 'the exported manifest still validates unchanged');
}

console.log('coverage evidence tests passed (T-83: undeclared link, missing PRD blob, invented authorization)');
