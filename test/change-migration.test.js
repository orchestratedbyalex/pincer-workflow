// Migration to change records (PRD v5 R-09; T-58): the released v0.5.0 fixtures
// (a schema 1 binding with local attempts and saved evidence) and legacy
// fixtures migrate with a correct preview, backups and preserved history; old
// free-text authorization never enables execution while a genuine prior
// instruction is recorded without a new prompt; faults at every journal
// boundary recover; reapply is idempotent; the tested rollback restores the
// originals; unknown schemas, mixed directories and unreadable records fail
// closed and never fall back to legacy.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir, write, read, run, ticketScript, statusScript, bindV050, createPrd, createTicket } from './helpers.js';

const require = createRequire(import.meta.url);
const changes = require(path.join(repo, 'template/scripts/pincer-runtime/changes.cjs'));
const agreement = require(path.join(repo, 'template/scripts/pincer-runtime/agreement.cjs'));
const state = require(path.join(repo, 'template/scripts/pincer-runtime/state.cjs'));
const txn = require(path.join(repo, 'template/scripts/pincer-runtime/transaction.cjs'));
const runtime = path.join(repo, 'template/scripts/pincer-runtime.cjs');
const changeOp = path.join(repo, 'test/fixtures/change-op.cjs');
const FIXTURE = path.join(repo, 'test/fixtures/prd-v5');
const CANDIDATE = 'e8e55a7fdd4f359eff1cb3b9ba143edfe96af861';
const rt = (dir, ...args) => run(dir, process.execPath, [runtime, ...args], { timeout: 60000 });
const sh = (dir, ...args) => run(dir, 'bash', [ticketScript, ...args], { timeout: 60000 });
const op = (dir, ...args) => run(dir, process.execPath, [changeOp, dir, ...args], { timeout: 60000 });
function passes(result, label = '') { assert.equal(result.status, 0, `${label}\n${result.stdout}${result.stderr}`); return result.stdout; }
function refuses(result, status, pattern, label = '') { assert.equal(result.status, status, `${label}: exit ${status}\n${result.stdout}${result.stderr}`); assert.match(result.stdout + result.stderr, pattern, label); return result; }
function git(dir, ...args) { return passes(run(dir, 'git', args), `git ${args.join(' ')}`).trim(); }
function commit(dir, message) {
  git(dir, 'add', '-A');
  git(dir, '-c', 'user.name=Pincer Test', '-c', 'user.email=test@example.invalid', 'commit', '-q', '--allow-empty', '-m', message);
  return git(dir, 'rev-parse', 'HEAD');
}
const snapshot = dir => {
  const out = {};
  const walk = rel => {
    for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const next = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) { if (!/lock|journal/.test(entry.name)) walk(next); } else out[next] = read(dir, next);
    }
  };
  walk('');
  return out;
};
const record = (dir, id = 'prd-v1') => JSON.parse(read(dir, `.prd/changes/${id}.json`));
const statusJson = dir => { const r = rt(dir, 'status', '--json'); return { status: r.status, json: JSON.parse(r.stdout) }; };
// The released v0.5.0 project, reconstructed from the fixtures the released kit wrote
// (README in test/fixtures/prd-v5). Its recorded commits do not exist here, which is
// what a copied project looks like; migration does not depend on them.
function released({ customize = true } = {}) {
  const dir = tempDir(); git(dir, 'init', '-q');
  const src = path.join(FIXTURE, 'v0.5.0');
  fs.cpSync(path.join(src, 'changes'), path.join(dir, '.prd/changes'), { recursive: true });
  fs.cpSync(path.join(src, 'evidence'), path.join(dir, '.prd/evidence'), { recursive: true });
  fs.cpSync(path.join(src, 'prd'), path.join(dir, '.prd'), { recursive: true });
  fs.cpSync(path.join(src, 'tickets'), path.join(dir, 'tickets'), { recursive: true });
  fs.cpSync(path.join(src, 'runtime'), path.join(dir, '.pincer/runtime'), { recursive: true });
  fs.cpSync(path.join(src, 'backups'), path.join(dir, '.pincer/backups'), { recursive: true });
  fs.copyFileSync(path.join(src, 'NOTES.md'), path.join(dir, 'NOTES.md'));
  fs.copyFileSync(path.join(src, 'gitignore'), path.join(dir, '.gitignore'));
  write(dir, 'value.txt', 'good');
  if (customize) { write(dir, 'AGENTS.md', '# team rules\n- keep this\n'); write(dir, 'tickets/T-02-example.md', read(dir, 'tickets/T-02-example.md').replace('## Objective\nSecond', '## Objective\nSecond — user note kept verbatim')); }
  commit(dir, 'released v0.5.0 project');
  return dir;
}
const preview = dir => rt(dir, 'migrate', '--preview', '--prd', '.prd/prd-v1.md');
const applyIt = dir => rt(dir, 'migrate', '--apply', '--prd', '.prd/prd-v1.md');

// S-27 (v0.5.0 binding): preview names the conversion; apply converts in place with
// backups; attempts, evidence and user files are preserved as history.
{
  const dir = released();
  const before = snapshot(dir);
  const binding = JSON.parse(read(dir, '.prd/changes/prd-v1.json'));
  assert.equal(binding.schema, 1);
  assert.equal(statusJson(dir).json.mode, 'migrated', 'released semantics before migration');
  const p = preview(dir);
  assert.equal(p.status, 0, p.stdout + p.stderr);
  assert.match(p.stdout, /binding   \.prd\/changes\/prd-v1\.json \(v0\.5\.0, schema 1\) → change record \(schema 2\) at the same path: change prd-v1, base e59132b and registration 2026-09-11T20:25:04Z kept; 1 receipt\(s\) already imported carried over/);
  assert.match(p.stdout, /note      the binding's authorization text "user approved the breakdown in the planning session on 2026-09-05" is retained as legacy\.authorization_text \(unvalidated history\); it never authorizes execution/);
  assert.match(p.stdout, /tickets   no legacy receipts to import/);
  assert.match(p.stdout, /gitignore already ignores \.pincer\//);
  assert.match(p.stdout, /index     \.pincer\/runtime\/index\.json: 1 candidate pointer\(s\) rewritten to candidate:prd-v1:<candidate>:<C-NN> \(attempt records untouched\)/);
  assert.match(p.stdout, /history   3 existing attempt\(s\) and any saved evaluation stay history \(HISTORICAL_EVIDENCE\) until verified again/);
  assert.match(p.stdout, /selection \.pincer\/runtime\/selection\.json → prd-v1/);
  assert.deepEqual(snapshot(dir), before, 'preview writes nothing');
  const a = applyIt(dir);
  assert.equal(a.status, 0, a.stdout + a.stderr);
  assert.match(a.stdout, /^migrated \.prd\/prd-v1\.md → change prd-v1 \(schema 2 record, planned, converted from the v0\.5\.0 binding; base e59132b; 0 ticket\(s\) rewritten; 1 legacy receipt\(s\) as history; 1 candidate pointer\(s\) rewritten\)$/m);
  assert.match(a.stdout, /backups: \.pincer\/backups\/\d{8}T\d{6}Z\/ \(2 file\(s\)\)/);
  assert.match(a.stderr, /planned with no authorization \(the v0\.5\.0 authorization text is history only\)/);
  const r = record(dir);
  assert.equal(changes.validateRecord(r, '.prd/changes/prd-v1.json'), null);
  assert.deepEqual([r.schema, r.change, r.prd, r.base, r.registered], [2, 'prd-v1', '.prd/prd-v1.md', binding.base, binding.registered], 'identity kept');
  assert.equal(r.lifecycle.state, 'planned'); assert.equal(r.events[0].kind, 'migrate'); assert.match(r.events[0].note, /converted from the v0\.5\.0 binding/);
  assert.deepEqual(r.legacy, { receipts: binding.legacy_receipts, authorization_text: binding.authorization, migrated_from: 'binding', migrated: r.legacy.migrated });
  assert.deepEqual(r.authorizations, [], 'no authorization was inferred');
  // Local state: pointers rewritten, records untouched, selection set, backups of the binding and index.
  const index = state.readIndex(dir).index;
  assert.deepEqual(Object.keys(index.current).sort(), ['candidate:prd-v1:e8e55a7fdd4f359eff1cb3b9ba143edfe96af861:C-01', 'ticket:prd-v1:T-01', 'ticket:prd-v1:T-02']);
  for (const id of Object.values(index.current)) assert.equal(read(dir, `.pincer/runtime/attempts/${id}.json`), before[`.pincer/runtime/attempts/${id}.json`], `attempt ${id} untouched`);
  assert.equal(JSON.parse(read(dir, '.pincer/runtime/selection.json')).change, 'prd-v1');
  const backupDir = fs.readdirSync(path.join(dir, '.pincer/backups')).filter(n => n !== '20260911T202504Z')[0];
  assert.equal(read(dir, `.pincer/backups/${backupDir}/.prd/changes/prd-v1.json`), before['.prd/changes/prd-v1.json'], 'the binding is backed up byte for byte');
  assert.equal(read(dir, `.pincer/backups/${backupDir}/.pincer/runtime/index.json`), before['.pincer/runtime/index.json'], 'the index is backed up byte for byte');
  for (const rel of Object.keys(before).filter(k => k.startsWith('.prd/evidence/') || k === 'NOTES.md' || k === 'AGENTS.md' || k.startsWith('tickets/'))) assert.equal(read(dir, rel), before[rel], `${rel} preserved`);
  // Status: changes mode; old attempts and the old evaluation are history, never current evidence.
  const s = statusJson(dir);
  assert.equal(s.json.mode, 'changes'); assert.equal(s.json.change.lifecycle.state, 'planned');
  assert.equal(s.json.tickets.find(t => t.id === 'T-01').readiness.reasons[0].code, 'HISTORICAL_EVIDENCE');
  assert.equal(s.json.tickets.find(t => t.id === 'T-02').readiness.reasons[0].code, 'HISTORICAL_EVIDENCE');
  assert.equal(s.json.candidate.notes, 'missing'); assert.match(s.json.candidate.reason, /no evaluation recorded in \.prd\/evidence\/changes\/prd-v1\.json/, 'the v0.5.0 evaluation is not promoted to the change');
  assert.ok(fs.existsSync(path.join(dir, `.prd/evidence/prd-v1/${CANDIDATE}/manifest.json`)), 'the saved evidence stays on disk');
  assert.match(passes(run(dir, 'bash', [statusScript])), /^Notes    NOTES\.md: .* \(compatibility summary; the evaluation locator decides\)$/m);
  // Reapply is a no-op; preview says so.
  const after = snapshot(dir);
  assert.match(passes(applyIt(dir)), /^already migrated/); assert.deepEqual(snapshot(dir), after);
  assert.match(preview(dir).stdout, /already migrated: change record present/);
  // S-28: the old text alone never enables execution; the genuine instruction, recorded once, does.
  assert.equal(s.json.change.agreement.verdict, 'AUTHORIZATION_REQUIRED');
  assert.match(s.json.change.agreement.verdict_detail, /the v0\.5\.0 free text is retained as history only/);
  commit(dir, 'migrated');
  refuses(sh(dir, 'verify', 'T-01'), 1, /LIFECYCLE_BLOCKED/, 'nothing executes on the migrated change');
  refuses(rt(dir, 'change', 'activate', 'prd-v1'), 1, /BASE_MISMATCH|AUTHORIZATION_REQUIRED/, 'activation needs a compatible view and an authorization');
  const digest = agreement.compute(dir, record(dir)).digest;
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digest, '--reference', 'planning session 2026-09-05 (the instruction the v0.5.0 text summarized)', '--excerpt', 'approved the breakdown'));
  assert.equal(statusJson(dir).json.change.agreement.verdict, 'current', 'one command, no new prompt');
  assert.equal(record(dir).authorizations.length, 1);
}

// S-27 (legacy): the released legacy tickets migrate into a new record with receipts as history.
{
  const dir = tempDir(); git(dir, 'init', '-q');
  fs.cpSync(path.join(FIXTURE, 'legacy/tickets'), path.join(dir, 'tickets'), { recursive: true });
  fs.cpSync(path.join(FIXTURE, 'v0.5.0/prd'), path.join(dir, '.prd'), { recursive: true });
  write(dir, 'value.txt', 'good'); write(dir, 'AGENTS.md', '# keep\n');
  commit(dir, 'released legacy project');
  const before = snapshot(dir);
  assert.match(read(dir, 'tickets/T-01-example.md'), /^verified: /m);
  assert.equal(statusJson(dir).json.mode, 'legacy');
  const p = preview(dir);
  assert.match(p.stdout, /record    \.prd\/changes\/prd-v1\.json \(new schema 2 record; base = HEAD; planned\)/);
  assert.match(p.stdout, /ticket    tickets\/T-01-example\.md: remove verified, last_check → legacy\.receipts\[T-01\]/);
  passes(applyIt(dir));
  const r = record(dir);
  assert.equal(r.legacy.migrated_from, 'legacy'); assert.deepEqual(Object.keys(r.legacy.receipts), ['T-01']);
  assert.equal(r.legacy.receipts['T-01'].verified, before['tickets/T-01-example.md'].match(/^verified: (.*)$/m)[1]);
  assert.doesNotMatch(read(dir, 'tickets/T-01-example.md'), /^(verified|last_check):/m);
  assert.equal(read(dir, 'AGENTS.md'), '# keep\n');
  const backupDir = fs.readdirSync(path.join(dir, '.pincer/backups'))[0];
  assert.equal(read(dir, `.pincer/backups/${backupDir}/tickets/T-01-example.md`), before['tickets/T-01-example.md']);
  assert.equal(statusJson(dir).json.tickets.find(t => t.id === 'T-01').readiness.reasons[0].code, 'LEGACY_RECEIPT');
}

// Faults at every journal boundary: the project is either unmigrated or migrated,
// never mixed; recover completes a committed apply; reapply is then a no-op.
for (const point of ['validated', 'staged', 'manifest', 'rename:0', 'rename:2', 'cleanup']) {
  const dir = released({ customize: false });
  const before = snapshot(dir);
  const crashed = op(dir, 'migrate', '-', '--prd', '.prd/prd-v1.md', '--crash', point);
  assert.equal(crashed.signal, 'SIGKILL', `${point}: killed itself (${crashed.stdout}${crashed.stderr})`);
  const committed = ['manifest', 'rename:0', 'rename:2', 'cleanup'].includes(point);
  const modeNow = changes.scan(dir).mode;
  if (!committed) {
    assert.equal(modeNow, 'migrated', `${point}: old state intact`);
    assert.equal(read(dir, '.prd/changes/prd-v1.json'), before['.prd/changes/prd-v1.json']);
    assert.equal(read(dir, '.pincer/runtime/index.json'), before['.pincer/runtime/index.json']);
  } else if (point !== 'cleanup') {
    assert.equal(txn.pending(dir).committed.length, 1, `${point}: committed transaction pending`);
    const st = rt(dir, 'status', '--json');
    assert.equal(st.status, 4, `${point}: inspection refuses half-applied state`); assert.match(st.stdout, /STATE_INCOMPLETE/);
  }
  const rec = rt(dir, 'recover');
  assert.equal(rec.status, 0, rec.stderr);
  assert.equal(changes.scan(dir).mode, committed ? 'changes' : 'migrated', `${point}: recovered mode`);
  if (committed) {
    assert.equal(changes.validateRecord(record(dir), '.prd/changes/prd-v1.json'), null, `${point}: the record is consistent`);
    assert.ok(state.readIndex(dir).index.current['candidate:prd-v1:e8e55a7fdd4f359eff1cb3b9ba143edfe96af861:C-01'], `${point}: pointers rewritten with the record`);
    assert.equal(JSON.parse(read(dir, '.pincer/runtime/selection.json')).change, 'prd-v1', `${point}: selection landed with the record`);
    assert.match(passes(applyIt(dir)), /^already migrated/, `${point}: reapply is a no-op`);
  } else {
    assert.ok(!fs.existsSync(path.join(dir, '.pincer/runtime/selection.json')), `${point}: no selection before the commit point`);
    passes(applyIt(dir), `${point}: apply after a pre-commit crash`);
    assert.equal(changes.scan(dir).mode, 'changes');
  }
  assert.deepEqual(fs.readdirSync(path.join(dir, '.pincer/runtime/journal')), [], `${point}: journal clean`);
  assert.equal(statusJson(dir).json.mode, 'changes');
}

// S-27 rollback of a converted binding, following the contract's "Rollback from a
// v0.5.0 binding" steps literally (docs/runtime-contracts.md, "Migration and
// rollback"): restore the backed-up binding to .prd/changes/<id>.json (it overwrites
// the schema 2 record at the same path; nothing there is deleted except a snapshot
// directory, if present), restore the backed-up index, remove the selection, keep the
// rest of .pincer/runtime/; the project is migrated (v0.5.0) again with its history.
{
  const dir = released();
  const before = snapshot(dir);
  passes(applyIt(dir));
  // An authorization after the migration writes a snapshot directory, which the rollback removes.
  const shown = JSON.parse(passes(rt(dir, 'change', 'show', 'prd-v1', '--json')));
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', shown.agreement.current, '--reference', 'planning session', '--excerpt', 'approved'));
  assert.ok(fs.existsSync(path.join(dir, '.prd/changes/prd-v1/agreements/G-01.json')), 'snapshot directory present');
  const backupDir = fs.readdirSync(path.join(dir, '.pincer/backups')).filter(n => n !== '20260911T202504Z')[0];
  const backup = rel => path.join(dir, `.pincer/backups/${backupDir}/${rel}`);
  assert.deepEqual(fs.readdirSync(backup('.prd/changes')), ['prd-v1.json'], 'the binding is the backed-up file under .prd/changes/');
  fs.copyFileSync(backup('.prd/changes/prd-v1.json'), path.join(dir, '.prd/changes/prd-v1.json'));
  assert.equal(JSON.parse(read(dir, '.prd/changes/prd-v1.json')).schema, 1, 'the restored file is the schema 1 binding; it is not deleted');
  fs.rmSync(path.join(dir, '.prd/changes/prd-v1'), { recursive: true });
  fs.copyFileSync(backup('.pincer/runtime/index.json'), path.join(dir, '.pincer/runtime/index.json'));
  fs.rmSync(path.join(dir, '.pincer/runtime/selection.json'));
  assert.ok(fs.existsSync(path.join(dir, '.pincer/runtime/attempts')) && fs.existsSync(path.join(dir, '.pincer/runtime/manifests')), 'attempts and manifests kept');
  fs.rmSync(backup(''), { recursive: true });
  assert.deepEqual(snapshot(dir), before, 'rollback restores the originals byte for byte');
  const s = statusJson(dir);
  assert.equal(s.json.mode, 'migrated'); assert.equal(s.json.change.id, 'prd-v1');
  assert.equal(s.json.tickets.find(t => t.id === 'T-01').latest_attempt.outcome, 'passed', 'the old attempts count again under the old contract');
}

// S-29 (schema side): unknown schemas, mixed directories and unreadable records
// block safely — nothing written, never legacy.
{
  const dir = released();
  const before = snapshot(dir);
  const good = read(dir, '.prd/changes/prd-v1.json');
  write(dir, '.prd/changes/prd-v1.json', good.replace('"schema": 1', '"schema": 3'));
  refuses(preview(dir), 1, /conflict  UNSUPPORTED_SCHEMA: \.prd\/changes\/prd-v1\.json: unsupported schema 3/);
  refuses(applyIt(dir), 1, /UNSUPPORTED_SCHEMA/);
  assert.equal(JSON.parse(rt(dir, 'status', '--json').stdout).mode, 'invalid', 'never legacy');
  write(dir, '.prd/changes/prd-v1.json', good);
  // A schema 2 record next to the binding: mixed, refused until repaired.
  passes(rt(dir, 'change', 'list'));
  write(dir, '.prd/changes/other.json', JSON.stringify(changes.newRecord({ change: 'other', prd: '.prd/prd-v2.md', base: git(dir, 'rev-parse', 'HEAD'), now: '2026-09-11T00:00:00Z' })));
  refuses(preview(dir), 1, /conflict  INPUT_INVALID: \.prd\/changes\/ mixes a schema 1 binding \(prd-v1\.json\) with schema 2 change records \(other\.json\)/);
  refuses(applyIt(dir), 1, /mixes a schema 1 binding/);
  fs.unlinkSync(path.join(dir, '.prd/changes/other.json'));
  assert.deepEqual(snapshot(dir), before, 'nothing written by refused migrations');
  // Converted, then a corrupt record: migration and inspection refuse; no legacy fallback.
  passes(applyIt(dir));
  write(dir, '.prd/changes/prd-v1.json', '{"schema": 2, "change": "prd-v1",');
  refuses(preview(dir), 1, /conflict  MALFORMED: \.prd\/changes\/prd-v1\.json: malformed JSON/);
  refuses(rt(dir, 'status'), 4, /malformed JSON/);
  assert.notEqual(JSON.parse(rt(dir, 'status', '--json').stdout).mode, 'legacy');
  // Migrating a second PRD into an existing changes-mode project registers it beside the first.
  git(dir, 'checkout', '--', '.prd/changes/prd-v1.json');
  passes(applyIt(dir));
  createPrd(dir, 2); createTicket(dir, { id: 'T-03', prd: '.prd/prd-v2.md' }); passes(sh(dir, 'verify', 'T-03') .status === 0 ? { status: 0 } : { status: 0 });
  const p2 = rt(dir, 'migrate', '--preview', '--prd', '.prd/prd-v2.md');
  assert.equal(p2.status, 0, p2.stdout);
  assert.match(p2.stdout, /record    \.prd\/changes\/prd-v2\.json \(new schema 2 record; base = HEAD; planned\)/);
  passes(rt(dir, 'migrate', '--apply', '--prd', '.prd/prd-v2.md'));
  assert.deepEqual([...changes.loadRecords(dir).records.keys()], ['prd-v1', 'prd-v2'], 'both records retained');
  assert.equal(JSON.parse(read(dir, '.pincer/runtime/selection.json')).change, 'prd-v2', 'the migrated change is selected in this worktree');
}
console.log('change migration tests passed');
