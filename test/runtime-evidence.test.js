// Evidence schema 2 and candidate checks (PRD v4 R-07): executable candidate
// checks run only on a clean view of the committed candidate and are exported
// from runtime attempts; schema 2 validates tamper, wrong-candidate and
// missing-artifact cases; schema 1 keeps validating with a legacy label.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir, createTicket, createPrd, write, read, run, ticketScript, statusScript, writeEvidence, writeNotes, bindV050 } from './helpers.js';

const runtime = path.join(repo, 'template/scripts/pincer-runtime.cjs');
const validator = path.join(repo, 'template/scripts/pincer-evidence.cjs');
const state = createRequire(import.meta.url)(path.join(repo, 'template/scripts/pincer-runtime/state.cjs'));
const rt = (dir, ...args) => run(dir, process.execPath, [runtime, ...args], { timeout: 60000 });
const sh = (dir, ...args) => run(dir, 'bash', [ticketScript, ...args], { timeout: 60000 });
const validate = (dir, manifest, ...args) => run(dir, process.execPath, [validator, 'validate', manifest, ...args]);
function passes(result, label = '') { assert.equal(result.status, 0, `${label}\n${result.stdout}${result.stderr}`); return result.stdout; }
function refuses(result, pattern, label = '') { assert.notEqual(result.status, 0, `${label}: must refuse\n${result.stdout}`); assert.match(result.stdout + result.stderr, pattern, `${label}\n${result.stdout}${result.stderr}`); return result; }
function git(dir, ...args) { return passes(run(dir, 'git', args), `git ${args.join(' ')}`).trim(); }
function commit(dir, message, paths = ['-A']) {
  git(dir, 'add', ...paths);
  git(dir, '-c', 'user.name=Pincer Test', '-c', 'user.email=test@example.invalid', 'commit', '-q', '--allow-empty', '-m', message);
  return git(dir, 'rev-parse', 'HEAD');
}
const statusJson = dir => JSON.parse(passes(rt(dir, 'status', '--json')));
const line = (out, key) => out.split('\n').find(l => l.startsWith(key)) || '';

// A migrated project built to a committed candidate: base → register → ticket done → PRD built.
function candidateFixture() {
  const dir = tempDir(); git(dir, 'init', '-q');
  write(dir, 'base.txt', 'original\n'); write(dir, '.gitignore', '.pincer/\n');
  const base = commit(dir, 'base');
  createPrd(dir);
  const file = createTicket(dir, { command: 'test "$(cat value.txt)" = good', criteria: '- [x] expected behavior' });
  write(dir, 'value.txt', 'good');
  commit(dir, 'prd and ticket');
  bindV050(dir); commit(dir, 'register');
  passes(sh(dir, 'start', 'T-01')); passes(sh(dir, 'verify', 'T-01')); passes(sh(dir, 'done', 'T-01'));
  assert.equal(git(dir, 'status', '--porcelain').trim(), 'M tickets/T-01-example.md', 'S-22: verify created no product diff; done wrote lifecycle fields only');
  commit(dir, 'T-01 done');
  write(dir, '.prd/prd-v1.md', read(dir, '.prd/prd-v1.md').replace('ticketed', 'built'));
  const candidate = commit(dir, 'PRD v1: built');
  return { dir, base, candidate, file, binding: JSON.parse(read(dir, '.prd/changes/prd-v1.json')) };
}
const evidenceDir = candidate => `.prd/evidence/prd-v1/${candidate}`;
function draftFor(dir, candidate, { required = true, extra = [] } = {}) {
  write(dir, `${evidenceDir(candidate)}/review/code-quality.md`, '# Review\nNo findings.\n');
  const draft = {
    environment: { tools: ['npm 10', 'git'], limitations: ['fixture project; no UI'] },
    coverage_review: 'R-01 maps to T-01 and C-01; C-03 is the reviewer record.',
    requirements: [{ id: 'R-01', disposition: 'delivered', tickets: ['T-01'], checks: ['C-01', 'C-03'] }],
    checks: [
      { id: 'C-01', kind: 'command', required },
      { id: 'C-02', kind: 'command', required: false },
      { id: 'C-03', kind: 'review', required: true, result: 'passed', timestamp: '2026-09-11T12:00:00Z', artifacts: [`${evidenceDir(candidate)}/review/code-quality.md`], note: 'reviewer record' },
      ...extra,
    ],
    visual_review: { applicable: false, reason: 'fixture has no UI' },
  };
  write(dir, '.pincer/drafts/candidate.json', JSON.stringify(draft, null, 2));
  return draft;
}

// S-21: check runs on the clean candidate view; export populates from attempts;
// tamper, wrong candidate, missing artifact and altered digest all fail validation.
{
  const { dir, base, candidate } = candidateFixture();
  const c1 = passes(rt(dir, 'check', 'C-01', '--candidate', candidate, '--', 'test', '"$(cat value.txt)"', '=', 'good'), 'check C-01');
  assert.match(c1, /^── C-01 candidate [0-9a-f]{7} ──\n  \$ test "\$\(cat value\.txt\)" = good\n✓ C-01 passed — attempt 000\d+-/);
  const c2 = rt(dir, 'check', 'C-02', '--candidate', candidate, '--', 'echo', 'audit-unavailable', '>&2;', 'exit', '2');
  assert.equal(c2.status, 1); assert.match(c2.stderr, /✗ C-02 failed \(exit 2\)/);
  const a1 = state.latestAttempt(dir, `candidate:${candidate}:C-01`);
  assert.equal(a1.context.kind, 'candidate'); assert.equal(a1.context.candidate, candidate); assert.equal(a1.outcome, 'passed');
  assert.equal(git(dir, 'status', '--porcelain'), '', 'check writes no tracked file');
  draftFor(dir, candidate);
  const exp = passes(rt(dir, 'evidence', 'export', '--candidate', candidate, '--base', base, '--prd', '.prd/prd-v1.md', '--draft', '.pincer/drafts/candidate.json'), 'export');
  const manifestPath = `${evidenceDir(candidate)}/manifest.json`;
  assert.match(exp, new RegExp(`^exported ${manifestPath.replace(/[./]/g, '\\$&')} \\(schema 2\\)`));
  const m = JSON.parse(read(dir, manifestPath));
  assert.equal(m.schema, 2); assert.equal(m.candidate, candidate); assert.equal(m.base, base);
  const bindingDoc = JSON.parse(read(dir, '.prd/changes/prd-v1.json'));
  assert.deepEqual(m.change, { id: 'prd-v1', prd_revision: bindingDoc.prd_revision, base: bindingDoc.base }, 'change identity copied from the binding');
  const C01 = m.checks.find(c => c.id === 'C-01');
  assert.equal(C01.provenance, 'runtime'); assert.equal(C01.result, 'passed'); assert.equal(C01.required, true);
  assert.equal(C01.command, 'test "$(cat value.txt)" = good'); assert.equal(C01.attempt.id, a1.id); assert.equal(C01.attempt.outcome, 'passed');
  assert.equal(C01.attempt.source_after, a1.source.after); assert.equal(C01.attempt.check_digest, a1.check.digest);
  assert.equal(C01.timestamp, a1.finished);
  const log = read(dir, `${evidenceDir(candidate)}/checks/C-01.log`);
  assert.match(log, /^\$ test "\$\(cat value\.txt\)" = good\n\n--- stdout ---\n\n--- stderr ---\n\n--- outcome passed \(exit 0\) ---\n$/);
  assert.equal(m.artifacts.find(a => a.path.endsWith('C-01.log')).sha256, C01.attempt.log_sha256);
  const C02 = m.checks.find(c => c.id === 'C-02');
  assert.equal(C02.result, 'failed'); assert.equal(C02.provenance, 'runtime'); assert.equal(C02.attempt.exit_code, 2);
  assert.match(read(dir, `${evidenceDir(candidate)}/checks/C-02.log`), /--- stderr ---\naudit-unavailable\n--- outcome failed \(exit 2\) ---/);
  const C03 = m.checks.find(c => c.id === 'C-03');
  assert.equal(C03.provenance, 'authored'); assert.ok(!('attempt' in C03), 'review judgments carry no attempt');
  assert.match(m.environment.node, /^v\d+/); assert.deepEqual(m.environment.tools, ['npm 10', 'git']);
  const ok = validate(dir, manifestPath, '--candidate', candidate, '--base', base, '--prd', '.prd/prd-v1.md');
  assert.equal(ok.status, 0, ok.stderr); assert.equal(ok.stdout, `ok ${candidate} schema 2\n`);
  // The export commit keeps the candidate current; status labels the provenance runtime.
  writeNotes(dir, { base, candidate, evidence: manifestPath });
  commit(dir, 'evaluate: PRD v1', ['NOTES.md', evidenceDir(candidate)]);
  const text = passes(run(dir, 'bash', [statusScript]));
  assert.match(line(text, 'Notes'), new RegExp(`current \\(${candidate}\\)`));
  assert.match(line(text, 'Evidence'), / · ok$/);
  const j = statusJson(dir);
  assert.equal(j.candidate.evidence.provenance, 'runtime'); assert.equal(j.candidate.evidence.schema, 2);
  assert.match(j.next, /pincer-release/);
  // S-22: a source change after the export commit is stale, as before.
  write(dir, 'value.txt', 'changed'); commit(dir, 'later source change');
  assert.match(line(passes(run(dir, 'bash', [statusScript])), 'Notes'), /stale: candidate changed after evaluation: value\.txt/);
  git(dir, 'reset', '-q', '--hard', 'HEAD~1');
  // Tamper cases.
  const original = read(dir, manifestPath);
  write(dir, `${evidenceDir(candidate)}/checks/C-01.log`, 'edited after export\n');
  refuses(validate(dir, manifestPath), /digest mismatch/, 'tampered log');
  git(dir, 'checkout', '--', `${evidenceDir(candidate)}/checks/C-01.log`);
  const altered = JSON.parse(original);
  altered.checks.find(c => c.id === 'C-01').attempt.log_sha256 = 'a'.repeat(64);
  write(dir, manifestPath, JSON.stringify(altered));
  refuses(validate(dir, manifestPath), /log artifact .*C-01\.log digest does not equal attempt\.log_sha256/, 'altered attempt digest');
  const flipped = JSON.parse(original);
  flipped.checks.find(c => c.id === 'C-02').result = 'passed';
  write(dir, manifestPath, JSON.stringify(flipped));
  refuses(validate(dir, manifestPath), /result passed disagrees with attempt outcome failed/, 'result cannot be flipped');
  const authoredPass = JSON.parse(original);
  const c1x = authoredPass.checks.find(c => c.id === 'C-01'); c1x.provenance = 'authored'; delete c1x.attempt;
  write(dir, manifestPath, JSON.stringify(authoredPass));
  refuses(validate(dir, manifestPath), /a passed command check must have runtime provenance/, 'authored pass refused');
  const wrongChange = JSON.parse(original); wrongChange.change.id = 'Bad ID';
  write(dir, manifestPath, JSON.stringify(wrongChange));
  refuses(validate(dir, manifestPath), /change\.id must be a change ID/, 'malformed change id');
  write(dir, manifestPath, original);
  refuses(validate(dir, manifestPath, '--candidate', 'c'.repeat(40)), /wrong candidate/, 'wrong candidate flag');
  fs.rmSync(path.join(dir, `${evidenceDir(candidate)}/review/code-quality.md`));
  refuses(validate(dir, manifestPath), /code-quality\.md: missing/, 'missing artifact');
  git(dir, 'checkout', '--', evidenceDir(candidate));
  assert.equal(validate(dir, manifestPath).status, 0, 'restored manifest validates again');
}

// check refuses a dirty tree, a HEAD that is not the candidate, and an untracked stray file.
{
  const { dir, candidate } = candidateFixture();
  write(dir, 'value.txt', 'dirty');
  refuses(rt(dir, 'check', 'C-01', '--candidate', candidate, '--', 'true'), /not a clean view of the candidate: value\.txt/, 'dirty tree');
  git(dir, 'checkout', '--', 'value.txt');
  write(dir, 'stray.txt', 'x');
  refuses(rt(dir, 'check', 'C-01', '--candidate', candidate, '--', 'true'), /not a clean view of the candidate: stray\.txt/, 'stray file');
  fs.unlinkSync(path.join(dir, 'stray.txt'));
  write(dir, 'NOTES.md', '# draft notes\n');
  write(dir, `${evidenceDir(candidate)}/review/notes.md`, 'allowed\n');
  passes(rt(dir, 'check', 'C-01', '--candidate', candidate, '--', 'true'), 'NOTES.md and the evidence directory may differ');
  fs.unlinkSync(path.join(dir, 'NOTES.md'));
  const evidenceOnly = commit(dir, 'evidence-only descendant');
  passes(rt(dir, 'check', 'C-01', '--candidate', candidate, '--', 'true'), 'an evidence-only descendant is still a clean view of the candidate');
  assert.notEqual(evidenceOnly, candidate);
  write(dir, 'base.txt', 'changed\n');
  const later = commit(dir, 'later source commit');
  refuses(rt(dir, 'check', 'C-01', '--candidate', candidate, '--', 'true'), new RegExp(`HEAD is ${later.slice(0, 7)}, not the candidate ${candidate.slice(0, 7)} and differs from it in: base\\.txt`), 'HEAD moved past the candidate');
  assert.equal(git(dir, 'rev-parse', 'HEAD'), later, 'check never resets or checks out for you');
  assert.equal(git(dir, 'status', '--porcelain'), '', 'check never stashes or commits');
  assert.equal(rt(dir, 'check', 'C-1', '--candidate', candidate, '--', 'true').status, 2, 'usage: check ID');
  assert.equal(rt(dir, 'check', 'C-01', '--candidate', 'short', '--', 'true').status, 2, 'usage: candidate');
}

// S-23: a schema-1 manifest validates with a legacy label; a draft naming a
// command check with no attempt refuses export; an authored command result is refused.
{
  const dir = tempDir(); git(dir, 'init', '-q');
  write(dir, 'base.txt', 'original\n'); const base = commit(dir, 'base');
  createPrd(dir); createTicket(dir, { command: 'test -f value.txt', criteria: '- [x] ok' }); write(dir, 'value.txt', 'good');
  passes(sh(dir, 'verify', 'T-01')); passes(sh(dir, 'done', 'T-01'));
  write(dir, '.prd/prd-v1.md', read(dir, '.prd/prd-v1.md').replace('ticketed', 'built'));
  const candidate = commit(dir, 'candidate');
  const ev = writeEvidence(dir, { base, candidate });
  writeNotes(dir, { base, candidate, evidence: ev.manifest });
  commit(dir, 'evaluate', ['NOTES.md', ev.dir]);
  const ok = validate(dir, ev.manifest);
  assert.equal(ok.status, 0); assert.equal(ok.stdout, `ok ${candidate}\n`, 'schema 1 output unchanged');
  const j = statusJson(dir);
  assert.equal(j.candidate.evidence.provenance, 'legacy'); assert.equal(j.candidate.evidence.schema, 1);
  assert.match(j.next, /pincer-release/, 'schema 1 remains release-ready under the legacy contract');
  const legacyLabelled = passes(run(dir, 'bash', [statusScript]));
  assert.match(line(legacyLabelled, 'Evidence'), / · ok$/);
  // A v0.5.0 binding (migrated mode), then ask for runtime evidence without having run the checks.
  write(dir, '.gitignore', '.pincer/\n');
  bindV050(dir);
  const migrated = commit(dir, 'migrated');
  draftFor(dir, migrated, { required: true });
  const none = rt(dir, 'evidence', 'export', '--candidate', migrated, '--base', JSON.parse(read(dir, '.prd/changes/prd-v1.json')).base, '--prd', '.prd/prd-v1.md', '--draft', '.pincer/drafts/candidate.json');
  assert.equal(none.status, 1);
  assert.match(none.stderr, /draft check C-01: no runtime attempt for candidate .*; run: node scripts\/pincer-runtime\.cjs check C-01 --candidate/);
  assert.ok(!fs.existsSync(path.join(dir, `${evidenceDir(migrated)}/manifest.json`)), 'no manifest without attempts');
  const authored = JSON.parse(read(dir, '.pincer/drafts/candidate.json'));
  authored.checks[0] = { id: 'C-01', kind: 'command', required: true, result: 'passed', command: 'npm test', timestamp: '2026-09-11T12:00:00Z', artifacts: [] };
  write(dir, '.pincer/drafts/candidate.json', JSON.stringify(authored));
  const refused = rt(dir, 'evidence', 'export', '--candidate', migrated, '--base', JSON.parse(read(dir, '.prd/changes/prd-v1.json')).base, '--prd', '.prd/prd-v1.md', '--draft', '.pincer/drafts/candidate.json');
  assert.equal(refused.status, 1); assert.match(refused.stderr, /a passed command result cannot be authored/);
  // T-44: draft check ids and artifact paths are validated before any write.
  for (const [label, mutate, pattern] of [
    ['bad check id', d => { d.checks[0] = { id: 'check-1', kind: 'command', required: true }; }, /check ID such as C-01/],
    ['traversal artifact', d => { d.checks[2].artifacts = [`${evidenceDir(migrated)}/../../../outside.md`]; }, /normalized and repository-relative/],
    ['artifact outside the evidence directory', d => { d.checks[2].artifacts = ['README.md']; }, /outside the evidence directory/],
  ]) {
    const bad = JSON.parse(read(dir, '.pincer/drafts/candidate.json'));
    bad.checks[0] = { id: 'C-01', kind: 'command', required: true };
    mutate(bad);
    write(dir, '.pincer/drafts/candidate.json', JSON.stringify(bad));
    const r = rt(dir, 'evidence', 'export', '--candidate', migrated, '--base', JSON.parse(read(dir, '.prd/changes/prd-v1.json')).base, '--prd', '.prd/prd-v1.md', '--draft', '.pincer/drafts/candidate.json');
    assert.equal(r.status, 1, label); assert.match(r.stderr, pattern, label);
    assert.ok(!fs.existsSync(path.join(dir, `${evidenceDir(migrated)}/manifest.json`)) && !fs.existsSync(path.join(dir, `${evidenceDir(migrated)}/checks`)), `${label}: nothing written`);
  }
  // A schema-1 manifest cannot pose as schema 2 by relabelling.
  const relabelled = JSON.parse(read(dir, ev.manifest)); relabelled.schema = 2;
  write(dir, ev.manifest, JSON.stringify(relabelled));
  refuses(validate(dir, ev.manifest), /missing "change"|provenance must be runtime or authored/, 'relabelled schema 1 fails schema 2 rules');
  git(dir, 'checkout', '--', ev.manifest);
}

// Review fixes (T-45): export refuses a captured log that no longer matches the
// digest its attempt recorded, and an attempt record that is incomplete or
// belongs to another check; the restored state exports again.
{
  const { dir, base, candidate } = candidateFixture();
  passes(rt(dir, 'check', 'C-01', '--candidate', candidate, '--', 'echo', 'original-output'), 'check C-01');
  passes(rt(dir, 'check', 'C-02', '--candidate', candidate, '--', 'true'), 'check C-02');
  draftFor(dir, candidate);
  const exportNow = () => rt(dir, 'evidence', 'export', '--candidate', candidate, '--base', base, '--prd', '.prd/prd-v1.md', '--draft', '.pincer/drafts/candidate.json');
  const a = state.latestAttempt(dir, `candidate:${candidate}:C-01`);
  const stdoutLog = path.join(dir, a.artifacts.stdout.path);
  const stdoutOriginal = fs.readFileSync(stdoutLog);
  fs.writeFileSync(stdoutLog, 'REPLACED OUTPUT\n');
  refuses(exportNow(), /C-01: attempt .* captured stdout .*does not match the digest the attempt recorded/, 'altered captured log');
  assert.ok(!fs.existsSync(path.join(dir, `${evidenceDir(candidate)}/checks/C-01.log`)), 'nothing exported for the altered log');
  fs.writeFileSync(stdoutLog, stdoutOriginal);
  const record = path.join(dir, `.pincer/runtime/attempts/${a.id}.json`);
  const original = fs.readFileSync(record, 'utf8');
  fs.writeFileSync(record, JSON.stringify({ id: a.id, outcome: 'passed' }));
  refuses(exportNow(), /C-01: attempt .* record is (incomplete|malformed)/, 'incomplete attempt record');
  const foreign = JSON.parse(original); foreign.context.check = 'C-02';
  fs.writeFileSync(record, JSON.stringify(foreign));
  refuses(exportNow(), /C-01: attempt .* belongs to candidate:[0-9a-f]{40}:C-02/, 'record for another check');
  fs.writeFileSync(record, original);
  // T-46: the first C-01 record copied over the one the index points at; a record
  // finalized by an old recover without log digests.
  passes(rt(dir, 'check', 'C-01', '--candidate', candidate, '--', 'echo', 'second-run'), 'check C-01 again');
  const pointed = state.readIndex(dir).index.current[`candidate:${candidate}:C-01`];
  assert.notEqual(pointed, a.id);
  const pointedRecord = path.join(dir, `.pincer/runtime/attempts/${pointed}.json`);
  const pointedOriginal = fs.readFileSync(pointedRecord, 'utf8');
  fs.writeFileSync(pointedRecord, original);
  refuses(exportNow(), /C-01: attempt .* is not the attempt the index points at/, 'copied record');
  const oldRecover = JSON.parse(pointedOriginal);
  oldRecover.outcome = 'interrupted'; oldRecover.exit_code = null;
  for (const k of ['stdout', 'stderr']) oldRecover.artifacts[k].sha256 = null;
  fs.writeFileSync(pointedRecord, JSON.stringify(oldRecover));
  refuses(exportNow(), /C-01: attempt .* has no recorded digest/, 'interrupted record without digests');
  fs.writeFileSync(pointedRecord, pointedOriginal);
  passes(exportNow(), 'restored state exports');
  assert.match(read(dir, `${evidenceDir(candidate)}/checks/C-01.log`), /--- stdout ---\nsecond-run\n/);
}
console.log('runtime evidence tests passed');

// PRD v6 T-73: the validator names schema 3 as such and refuses it outside strict
// coverage semantics only through the reconciliation rules (test/coverage-evidence.test.js);
// a schema 1 or 2 manifest keeps validating exactly as before, and an unknown schema is refused.
{
  const dir = tempDir();
  const candidate = 'a'.repeat(40);
  write(dir, '.prd/prd-v1.md', '---\nversion: 1\nstatus: built\n---\n# p\n');
  write(dir, `.prd/evidence/prd-v1/${candidate}/manifest.json`, JSON.stringify({ schema: 4 }));
  const r = run(dir, process.execPath, [validator, 'validate', `.prd/evidence/prd-v1/${candidate}/manifest.json`]);
  assert.equal(r.status, 1); assert.match(r.stderr, /unknown evidence schema 4 — this runtime validates schemas 1, 2 and 3/);
}
console.log('runtime evidence tests passed (schema 4 refused)');
