// Per-change evaluations (PRD v5 R-07, R-04; T-56): evaluating A then B keeps
// both evaluations addressable through their locators even though root NOTES.md
// names only one; complete → evaluate → read-only audit works without a lifecycle
// commit after evaluation; release preserves files, selection and attempts; a
// later source or agreement change, a newer applicable failure, and missing,
// cross-change or corrupt references block readiness and never revive a pass.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir, createTicket, createPrd, write, read, run, ticketScript, statusScript, writeNotes } from './helpers.js';

const require = createRequire(import.meta.url);
const agreement = require(path.join(repo, 'template/scripts/pincer-runtime/agreement.cjs'));
const locator = require(path.join(repo, 'template/scripts/pincer-runtime/locator.cjs'));
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
const record = (dir, id) => JSON.parse(read(dir, `.prd/changes/${id}.json`));
const digestOf = (dir, id) => agreement.compute(dir, record(dir, id)).digest;
const statusJson = (dir, ...args) => JSON.parse(passes(rt(dir, 'status', '--json', ...args)));
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
const REF = 'session 2026-09-11, user message';
function fixture() {
  const dir = tempDir(); git(dir, 'init', '-q');
  createPrd(dir, 1); createPrd(dir, 2);
  createTicket(dir, { id: 'T-01', prd: '.prd/prd-v1.md', command: 'test "$(cat value.txt)" = good', criteria: '- [x] a' });
  createTicket(dir, { id: 'T-02', prd: '.prd/prd-v2.md', command: 'test "$(cat other.txt)" = fine', criteria: '- [x] b' });
  write(dir, 'value.txt', 'good'); write(dir, 'other.txt', 'fine'); write(dir, 'src/app.js', '1\n'); write(dir, '.gitignore', '.pincer/\n');
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
// Evaluate the selected change at `candidate`: run C-01, export from a draft.
function evaluate(dir, id, prd, candidate, base, command) {
  const version = prd.match(/prd-v(\d+)/)[1];
  passes(rt(dir, 'change', 'select', id));
  passes(rt(dir, 'check', 'C-01', '--candidate', candidate, '--', command), `check for ${id}`);
  write(dir, `.prd/evidence/prd-v${version}/${candidate}/review/code-quality.md`, '# Review\nNo findings.\n');
  const draft = { environment: { tools: ['git'], limitations: ['fixture'] }, coverage_review: 'R-01 maps to C-01.', requirements: [{ id: 'R-01', disposition: 'delivered', tickets: [version === '1' ? 'T-01' : 'T-02'], checks: ['C-01', 'C-02'] }], checks: [{ id: 'C-01', kind: 'command', required: true }, { id: 'C-02', kind: 'review', required: true, result: 'passed', timestamp: '2026-09-11T12:00:00Z', artifacts: [`.prd/evidence/prd-v${version}/${candidate}/review/code-quality.md`], note: 'reviewer record' }], visual_review: { applicable: false, reason: 'fixture has no UI' } };
  write(dir, `.pincer/drafts/${id}.json`, JSON.stringify(draft));
  const out = passes(rt(dir, 'evidence', 'export', '--candidate', candidate, '--base', base, '--prd', prd, '--draft', `.pincer/drafts/${id}.json`), `export for ${id}`);
  assert.match(out, new RegExp(`recorded evaluation of change ${id} in \\.prd/evidence/changes/${id}\\.json \\(candidate ${candidate.slice(0, 7)}\\); commit it with the evidence`));
  return `.prd/evidence/prd-v${version}/${candidate}/manifest.json`;
}

// S-22: evaluate A then B; both stay addressable although NOTES names only B; a
// later source change makes A's candidate historical and selection does not revive it.
{
  const dir = fixture();
  workThrough(dir, 'a', 'T-01');
  workThrough(dir, 'b', 'T-02');
  write(dir, '.prd/prd-v1.md', read(dir, '.prd/prd-v1.md').replace('ticketed', 'built'));
  write(dir, '.prd/prd-v2.md', read(dir, '.prd/prd-v2.md').replace('ticketed', 'built'));
  const base = git(dir, 'rev-parse', 'HEAD');
  const candidate = commit(dir, 'both complete and built');
  const manifestA = evaluate(dir, 'a', '.prd/prd-v1.md', candidate, base, 'test "$(cat value.txt)" = good');
  const locA = JSON.parse(read(dir, '.prd/evidence/changes/a.json'));
  assert.equal(locA.schema, 1); assert.equal(locA.change, 'a'); assert.equal(locA.evaluations.length, 1);
  assert.deepEqual(Object.keys(locA.evaluations[0]), ['candidate', 'base', 'prd', 'prd_revision', 'agreement', 'manifest', 'recorded']);
  assert.equal(locA.evaluations[0].manifest, manifestA); assert.equal(locA.evaluations[0].agreement, digestOf(dir, 'a'));
  writeNotes(dir, { version: 1, base, candidate, evidence: manifestA });
  commit(dir, 'evaluate A');
  let sa = statusJson(dir);
  assert.equal(sa.candidate.notes, 'current'); assert.equal(sa.candidate.candidate, candidate); assert.equal(sa.candidate.locator, '.prd/evidence/changes/a.json');
  assert.equal(sa.candidate.evaluation.manifest, manifestA);
  assert.match(passes(run(dir, 'bash', [statusScript])), /^Evaluation \.prd\/evidence\/changes\/a\.json: current \([0-9a-f]{40}\)$/m);
  assert.match(sa.next, /\/pincer-release/, 'A is completed, evaluated and current');
  // Evaluate B on the same candidate and overwrite root NOTES with B's summary.
  const manifestB = evaluate(dir, 'b', '.prd/prd-v2.md', candidate, base, 'test "$(cat other.txt)" = fine');
  writeNotes(dir, { version: 2, base, candidate, evidence: manifestB });
  commit(dir, 'evaluate B');
  const sb = statusJson(dir);
  assert.equal(sb.change.id, 'b'); assert.equal(sb.candidate.notes, 'current'); assert.equal(sb.candidate.evaluation.manifest, manifestB);
  passes(rt(dir, 'change', 'select', 'a'));
  sa = statusJson(dir);
  assert.equal(sa.candidate.notes, 'current', 'A\'s evaluation is still addressable through its locator');
  assert.equal(sa.candidate.evaluation.manifest, manifestA);
  assert.match(passes(run(dir, 'bash', [statusScript])), /^Notes    NOTES\.md: stale: evaluation PRD does not match \(compatibility summary; the evaluation locator decides\)$/m, 'root NOTES names B; the locator decides for A');
  assert.match(passes(rt(dir, 'change', 'show', 'a')), /^Evaluations /m);
  assert.equal(JSON.parse(passes(rt(dir, 'change', 'show', 'a', '--json'))).evaluations.length, 1, 'show lists the locator entries');
  assert.match(passes(rt(dir, 'change', 'show', 'a')), new RegExp(`^Evaluations ${candidate.slice(0, 7)} ${manifestA.replace(/[.\/]/g, '\\$&')} recorded `, 'm'));
  // Exporting the same evaluation again (the view is still clean: only evidence and locators follow the candidate) is idempotent on the locator.
  const again = passes(rt(dir, 'evidence', 'export', '--candidate', candidate, '--base', base, '--prd', '.prd/prd-v1.md', '--draft', '.pincer/drafts/a.json'));
  assert.match(again, /already recorded evaluation of change a/);
  assert.equal(locator.read(dir, 'a').locator.evaluations.length, 1);
  git(dir, 'checkout', '--', '.prd/evidence');
  // Source changes afterwards: A's candidate is historical; selecting A does not revive it.
  write(dir, 'src/app.js', '2\n');
  commit(dir, 'later source change');
  const later = statusJson(dir);
  assert.equal(later.candidate.notes, 'stale'); assert.match(later.candidate.reason, /candidate changed after evaluation: src\/app\.js/);
  assert.equal(later.candidate.evaluation.manifest, manifestA, 'the historical evaluation is still referenced');
  assert.equal(rt(dir, 'ready').status, 1);
  passes(rt(dir, 'change', 'select', 'b')); passes(rt(dir, 'change', 'select', 'a'));
  assert.equal(statusJson(dir).candidate.notes, 'stale', 'selection revives nothing');
}

// S-23: complete → evaluate → read-only release audit without a lifecycle commit
// after evaluation; release writes nothing, selects nothing, runs nothing.
{
  const dir = fixture();
  workThrough(dir, 'a', 'T-01');
  write(dir, '.prd/prd-v1.md', read(dir, '.prd/prd-v1.md').replace('ticketed', 'built'));
  const base = git(dir, 'rev-parse', 'HEAD');
  const candidate = commit(dir, 'A complete and built');
  assert.equal(record(dir, 'a').lifecycle.state, 'completed');
  assert.match(rt(dir, 'ready').stdout, /^not ready: EVIDENCE_MISSING missing \(no evaluation recorded in \.prd\/evidence\/changes\/a\.json\)/m);
  const manifest = evaluate(dir, 'a', '.prd/prd-v1.md', candidate, base, 'test "$(cat value.txt)" = good');
  writeNotes(dir, { version: 1, base, candidate, evidence: manifest });
  const evaluateCommit = commit(dir, 'evaluate A');
  assert.equal(record(dir, 'a').lifecycle.state, 'completed', 'no lifecycle write after evaluation');
  assert.equal(git(dir, 'diff', '--name-only', candidate, evaluateCommit).split('\n').filter(l => l.startsWith('.prd/changes/')).length, 0, 'the evaluate commit touched no change record');
  const before = snapshotTree(dir);
  const attempts = state.listAttempts(dir).length;
  const ready = rt(dir, 'ready');
  assert.equal(ready.status, 0, ready.stdout + ready.stderr);
  assert.match(ready.stdout, new RegExp(`^ready candidate ${candidate}$`, 'm'));
  passes(rt(dir, 'status')); passes(rt(dir, 'status', '--json'));
  assert.deepEqual(snapshotTree(dir), before, 'release and status wrote nothing');
  assert.equal(state.listAttempts(dir).length, attempts, 'no check ran');
  assert.equal(JSON.parse(read(dir, '.pincer/runtime/selection.json')).change, 'a');
  assert.match(statusJson(dir).next, /^\/pincer-release — evaluation matches the current PRD and candidate/);
  // A lifecycle change after the evaluation is a candidate change (never exempt).
  passes(rt(dir, 'change', 'reopen', 'a', '--reason', 'late thought'));
  assert.match(statusJson(dir).candidate.reason, /working tree has changes outside the candidate's evidence: \.prd\/changes\/a\.json/);
  commit(dir, 'reopened');
  assert.match(statusJson(dir).candidate.reason, /candidate changed after evaluation: \.prd\/changes\/a\.json/);
  assert.equal(rt(dir, 'ready').status, 1);
  assert.match(rt(dir, 'ready').stdout, /LIFECYCLE_BLOCKED change a is active, not completed/);
}

// Blockers after evaluation: an agreement change, a newer same-source failure, and
// missing, cross-change or corrupt references never revive a pass.
{
  const dir = fixture();
  workThrough(dir, 'a', 'T-01');
  write(dir, '.prd/prd-v1.md', read(dir, '.prd/prd-v1.md').replace('ticketed', 'built'));
  const base = git(dir, 'rev-parse', 'HEAD');
  const candidate = commit(dir, 'A complete and built');
  const manifest = evaluate(dir, 'a', '.prd/prd-v1.md', candidate, base, 'test "$(cat value.txt)" = good');
  writeNotes(dir, { version: 1, base, candidate, evidence: manifest });
  commit(dir, 'evaluate A');
  assert.equal(rt(dir, 'ready').status, 0);
  // A newer failing attempt on the same source blocks until re-exported.
  refuses(rt(dir, 'check', 'C-01', '--candidate', candidate, '--', 'test "$(cat value.txt)" = other'), 1, /✗ C-01 failed/);
  assert.match(rt(dir, 'ready').stdout, /CHECK_FAILED C-01: newer local attempt \S+ failed on the same source inputs as the exported pass/);
  passes(rt(dir, 'check', 'C-01', '--candidate', candidate, '--', 'test "$(cat value.txt)" = good'));
  assert.match(rt(dir, 'ready').stdout, /CHECK_FAILED/, 'a later pass does not clear the newer failure until the candidate is re-exported');
  // An agreement change after evaluation blocks release (read-only, no write).
  write(dir, '.prd/prd-v1.md', `${read(dir, '.prd/prd-v1.md')}\nscope grew\n`);
  assert.match(rt(dir, 'ready').stdout, /^not ready: AGREEMENT_CHANGED/m);
  git(dir, 'checkout', '--', '.prd/prd-v1.md');
  // Locator corruption: dangling manifest, cross-change manifest, unknown schema, malformed JSON.
  const good = read(dir, '.prd/evidence/changes/a.json');
  const loc = JSON.parse(good);
  loc.evaluations[0].manifest = `.prd/evidence/prd-v1/${'0'.repeat(40)}/manifest.json`; loc.evaluations[0].candidate = '0'.repeat(40);
  write(dir, '.prd/evidence/changes/a.json', JSON.stringify(loc));
  let s = statusJson(dir);
  assert.equal(s.candidate.notes, 'stale'); assert.match(s.candidate.reason, /evaluation commits or ancestry unavailable/);
  assert.equal(rt(dir, 'ready').status, 1);
  const cross = JSON.parse(good); cross.evaluations[0].prd = '.prd/prd-v2.md'; cross.evaluations[0].manifest = cross.evaluations[0].manifest.replace('prd-v1', 'prd-v2');
  write(dir, '.prd/evidence/changes/a.json', JSON.stringify(cross));
  s = statusJson(dir);
  assert.match(s.candidate.reason, /the evaluation is for \.prd\/prd-v2\.md, not \.prd\/prd-v1\.md/);
  const other = JSON.parse(good); other.change = 'b';
  write(dir, '.prd/evidence/changes/a.json', JSON.stringify(other));
  assert.match(statusJson(dir).candidate.reason, /locator names change "b", not a/);
  write(dir, '.prd/evidence/changes/a.json', good.replace('"schema": 1', '"schema": 9'));
  assert.match(statusJson(dir).candidate.reason, /unsupported evaluation locator schema 9/);
  write(dir, '.prd/evidence/changes/a.json', '{"schema": 1, ');
  assert.match(statusJson(dir).candidate.reason, /a\.json: malformed JSON/);
  assert.equal(rt(dir, 'ready').status, 1);
  write(dir, '.prd/evidence/changes/a.json', good);
  // A manifest that records another change is stale for this one.
  const m = JSON.parse(read(dir, manifest)); m.change.id = 'b';
  write(dir, manifest, JSON.stringify(m, null, 2));
  assert.match(statusJson(dir).candidate.reason, /evidence invalid|records change b, not a/);
  git(dir, 'checkout', '--', manifest);
  assert.equal(statusJson(dir).candidate.notes, 'current');
  // Export refuses to append a locator entry for a change whose record is superseded (gate), so no cross-change entry can be recorded through the runtime.
  refuses(rt(dir, 'evidence', 'export', '--candidate', candidate, '--base', base, '--prd', '.prd/prd-v2.md', '--draft', '.pincer/drafts/a.json'), 1, /WRONG_CHANGE/);
}
console.log('change evaluation tests passed');
