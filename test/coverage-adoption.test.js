// PRD v6 T-69 (R-08, S-22, S-23): strict coverage is adopted explicitly — legacy,
// v0.5.0 and PRD v5 projects keep their files, attempts and evidence until
// `coverage adopt --apply`; preview writes nothing; apply is one backed-up,
// idempotent transaction that grants no authorization; the literal rollback
// restores the schema 2 record without deleting anything restored; death at every
// journal boundary and concurrent input edits leave complete old or new state;
// missing strict inputs, downgraded flags and unknown schemas refuse safely; a
// running attempt blocks adoption as it blocks v5 transitions; the pinned PRD v5
// readers refuse the new record and attempt schemas.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { repo, tempDir, write, read, run, createTicket, createPrd, bindV050 } from './helpers.js';

const require = createRequire(import.meta.url);
const changes = require(path.join(repo, 'template/scripts/pincer-runtime/changes.cjs'));
const state = require(path.join(repo, 'template/scripts/pincer-runtime/state.cjs'));
const adopt = require(path.join(repo, 'template/scripts/pincer-runtime/adopt.cjs'));
const v5changes = require(path.join(repo, 'test/fixtures/prd-v6/v5-kit/scripts/pincer-runtime/changes.cjs'));
const v5state = require(path.join(repo, 'test/fixtures/prd-v6/v5-kit/scripts/pincer-runtime/state.cjs'));
const runtime = path.join(repo, 'template/scripts/pincer-runtime.cjs');
const changeOp = path.join(repo, 'test/fixtures/change-op.cjs');
const fx = path.join(repo, 'test/fixtures/prd-v6');
const rt = (dir, ...args) => run(dir, process.execPath, [runtime, ...args]);
const op = (dir, ...args) => run(dir, process.execPath, [changeOp, dir, ...args]);
function passes(result, label = '') { assert.equal(result.status, 0, `${label}\n${result.stdout}${result.stderr}`); return result.stdout; }
function refuses(result, status, pattern, label = '') { assert.equal(result.status, status, `${label}: exit ${status}\n${result.stdout}${result.stderr}`); assert.match(result.stdout + result.stderr, pattern, label); return result; }
function git(dir, ...args) { return passes(run(dir, 'git', args), `git ${args.join(' ')}`).trim(); }
function commit(dir, message) { git(dir, 'add', '-A'); git(dir, '-c', 'user.name=T', '-c', 'user.email=t@example.invalid', 'commit', '-q', '--allow-empty', '-m', message); return git(dir, 'rev-parse', 'HEAD'); }
const record = (dir, id = 'prd-v1') => JSON.parse(read(dir, `.prd/changes/${id}.json`));
const snapshotTree = (dir, { skip = [] } = {}) => {
  const out = {};
  const walk = rel => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      if (e.name === '.git') continue;
      const next = rel ? `${rel}/${e.name}` : e.name;
      if (skip.some(s => next.startsWith(s))) continue;
      if (e.isDirectory()) walk(next); else out[next] = fs.readFileSync(path.join(dir, next), 'utf8');
    }
  };
  walk(''); return out;
};
const statusJson = dir => JSON.parse(rt(dir, 'status', '--json').stdout);
const preview = (dir, id = 'prd-v1') => rt(dir, 'coverage', 'adopt', '--preview', '--change', id);
const applyIt = (dir, id = 'prd-v1', ...extra) => rt(dir, 'coverage', 'adopt', '--apply', '--change', id, ...extra);
const V5_MAP = `{
  "schema": 1,
  "change": "prd-v1",
  "prd": ".prd/prd-v1.md",
  "scenarios": { "S-01": { "tickets": ["T-01"], "checks": ["C-01"] } },
  "scope": {},
  "tickets": { "T-01": { "role": "implements", "rationale": null } },
  "checks": { "C-01": { "kind": "command", "required": true, "command": "test \\"$(cat value.txt)\\" = good", "timeout": 600, "cwd": null, "obligation": null, "note": null } }
}
`;
// The PRD v5 project reconstructed from the fixtures the v5 runtime wrote (README in
// test/fixtures/prd-v6): a completed, evaluated schema 2 change with attempts.
function v5Project({ withMap = true } = {}) {
  const dir = tempDir(); git(dir, 'init', '-q');
  const src = path.join(fx, 'v5');
  fs.cpSync(path.join(src, 'changes'), path.join(dir, '.prd/changes'), { recursive: true });
  fs.cpSync(path.join(src, 'evidence'), path.join(dir, '.prd/evidence'), { recursive: true });
  fs.cpSync(path.join(src, 'prd'), path.join(dir, '.prd'), { recursive: true });
  fs.cpSync(path.join(src, 'tickets'), path.join(dir, 'tickets'), { recursive: true });
  fs.cpSync(path.join(src, 'runtime'), path.join(dir, '.pincer/runtime'), { recursive: true });
  fs.copyFileSync(path.join(src, 'gitignore'), path.join(dir, '.gitignore'));
  write(dir, 'value.txt', 'good\n');
  if (withMap) write(dir, '.prd/coverage/prd-v1.json', V5_MAP);
  commit(dir, 'v5 project');
  return dir;
}

// A strict project built here (its base commit exists, so execution gates reach the agreement).
function freshStrict({ adopt: doAdopt = true, prepare = null } = {}) {
  const dir = tempDir(); git(dir, 'init', '-q');
  write(dir, '.gitignore', '.pincer/\n');
  write(dir, '.prd/prd-v1.md', read(fx, 'strict/prd-v1.md'));
  for (const f of fs.readdirSync(path.join(fx, 'strict/tickets'))) write(dir, `tickets/${f}`, read(fx, `strict/tickets/${f}`));
  write(dir, '.prd/coverage/prd-v1.json', read(fx, 'strict/coverage/prd-v1.json'));
  write(dir, 'value.txt', 'good\n');
  if (prepare) prepare(dir);
  commit(dir, 'base');
  passes(rt(dir, 'register', '--prd', '.prd/prd-v1.md')); passes(rt(dir, 'change', 'select', 'prd-v1'));
  const digest = () => JSON.parse(passes(rt(dir, 'change', 'show', 'prd-v1', '--json'))).agreement.current;
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digest(), '--reference', 'r', '--excerpt', 'e'));
  passes(rt(dir, 'change', 'activate', 'prd-v1'));
  if (!doAdopt) return dir;
  passes(applyIt(dir));
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', digest(), '--reference', 'r', '--excerpt', 'strict'));
  commit(dir, 'strict');
  return dir;
}

// --- S-22: old projects keep everything until explicit adoption ------------------------
{
  // Legacy: no record at all.
  const legacy = tempDir(); git(legacy, 'init', '-q'); createPrd(legacy, 1); createTicket(legacy); write(legacy, '.prd/coverage/prd-v1.json', V5_MAP); commit(legacy, 'legacy');
  passes(run(legacy, 'bash', [path.join(repo, 'template/scripts/pincer-ticket.sh'), 'verify', 'T-01']));
  const legacyBefore = snapshotTree(legacy);
  refuses(preview(legacy), 1, /conflict  CHANGE_REQUIRED: no change record under \.prd\/changes\/ — register the change first .*; migration and registration never adopt strict coverage/);
  refuses(applyIt(legacy), 1, /CHANGE_REQUIRED/);
  assert.deepEqual(snapshotTree(legacy), legacyBefore, 'legacy: nothing written, receipts kept');
  assert.equal(statusJson(legacy).mode, 'legacy');
  // v0.5.0 binding (migrated mode).
  const migrated = tempDir(); git(migrated, 'init', '-q'); createPrd(migrated, 1); createTicket(migrated); write(migrated, '.prd/coverage/prd-v1.json', V5_MAP); commit(migrated, 'base'); bindV050(migrated);
  const migratedBefore = snapshotTree(migrated);
  refuses(preview(migrated), 1, /conflict  MIGRATION_REQUIRED: \.prd\/changes\/ holds a v0\.5\.0 binding; migrate to change records first/);
  refuses(applyIt(migrated), 1, /MIGRATION_REQUIRED/);
  assert.deepEqual(snapshotTree(migrated), migratedBefore, 'v0.5.0: nothing written');
  assert.equal(statusJson(migrated).mode, 'migrated');
  // PRD v5 (schema 2): preview writes nothing; the record, attempts and evidence are untouched and labeled unverified.
  const dir = v5Project();
  passes(rt(dir, 'change', 'select', 'prd-v1'));
  const before = snapshotTree(dir);
  assert.equal(record(dir).schema, 2);
  const p = passes(preview(dir));
  assert.match(p, /^adoption plan for change prd-v1 \(\.prd\/changes\/prd-v1\.json, completed\)$/m);
  assert.match(p, /inventory 1 requirement\(s\), 1 scenario\(s\) · digest [0-9a-f]{12}/);
  assert.match(p, /map       \.prd\/coverage\/prd-v1\.json · digest [0-9a-f]{12} · structure complete/);
  assert.match(p, /agreement G-02 [0-9a-f]{12} \(projection 2/);
  assert.match(p, /history   2 existing attempt\(s\) of this change become HISTORICAL_EVIDENCE until verified again/);
  assert.match(p, /adoption grants no authorization/);
  assert.match(p, /^apply with: node scripts\/pincer-runtime\.cjs coverage adopt --apply --change prd-v1 --agreement [0-9a-f]{64}$/m);
  assert.deepEqual(snapshotTree(dir), before, 'preview writes nothing');
  assert.match(passes(rt(dir, 'change', 'show', 'prd-v1')), /^Coverage   unverified \(strict coverage not adopted; preview with: node scripts\/pincer-runtime\.cjs coverage adopt --preview --change prd-v1\)$/m);
  const s0 = statusJson(dir);
  assert.equal(s0.candidate.notes, 'stale', 'the fixture commits do not exist here (a copied project); adoption does not depend on them');
  assert.deepEqual(s0.tickets[0].readiness.reasons.map(x => x.code), ['SOURCE_CHANGED'], 'the v5 attempt is evaluated as evidence before adoption (the copied project has a different source tree)');
  // Apply: schema 3, backup, everything else untouched; then idempotent.
  const digest = p.match(/--agreement ([0-9a-f]{64})/)[1];
  const out = passes(applyIt(dir, 'prd-v1', '--agreement', digest));
  assert.match(out, /^adopted strict coverage for change prd-v1 \(schema 3 record; agreement G-02 [0-9a-f]{12}; inventory 1 requirement\(s\), 1 scenario\(s\); map [0-9a-f]{12}; 2 earlier attempt\(s\) are history\)$/m);
  const backupRel = out.match(/^backup: (\.pincer\/backups\/[0-9TZ]+\/\.prd\/changes\/prd-v1\.json)/m)[1];
  assert.equal(read(dir, backupRel), before['.prd/changes/prd-v1.json'], 'the backup is the byte-identical schema 2 record');
  const r = record(dir);
  assert.equal(r.schema, 3); assert.equal(r.runtime, 3); assert.deepEqual(Object.keys(r), changes.RECORD_KEYS_STRICT);
  assert.deepEqual(r.coverage, { map: '.prd/coverage/prd-v1.json', adopted: r.events.at(-1).at, agreement: 'G-02' });
  assert.equal(r.events.at(-1).kind, 'adopt'); assert.equal(r.events.at(-1).agreement, 'G-02'); assert.equal(r.sequence, r.events.length);
  assert.equal(r.agreements[0].inventory, null); assert.match(r.agreements[1].inventory, /^[0-9a-f]{64}$/); assert.match(r.agreements[1].coverage, /^[0-9a-f]{64}$/);
  assert.equal(r.authorizations.length, 1, 'no authorization was created or copied');
  assert.equal(changes.validateRecord(r, '.prd/changes/prd-v1.json'), null);
  assert.ok(fs.existsSync(path.join(dir, '.prd/changes/prd-v1/agreements/G-02.json')), 'the adoption snapshot');
  assert.equal(JSON.parse(read(dir, '.prd/changes/prd-v1/agreements/G-02.json')).schema, 2);
  const after = snapshotTree(dir, { skip: ['.pincer/backups/'] });
  const touched = Object.keys(after).filter(k => after[k] !== before[k]);
  assert.deepEqual(touched.sort(), ['.prd/changes/prd-v1.json', '.prd/changes/prd-v1/agreements/G-02.json'], 'only the record and the adoption snapshot changed; tickets, attempts, index, selection, evidence and map are untouched');
  const s1 = statusJson(dir);
  assert.equal(s1.change.agreement.verdict, 'AGREEMENT_CHANGED', 'the strict agreement needs the user');
  assert.deepEqual(s1.tickets[0].readiness.reasons.map(x => x.code), ['HISTORICAL_EVIDENCE'], 'the v5 attempt is history after adoption');
  assert.match(s1.tickets[0].readiness.reasons[0].detail, /recorded under schema 2 \(before this change adopted strict coverage\)/);
  assert.match(passes(applyIt(dir)), /^already adopted: change prd-v1 is strict since .* \(agreement G-02\); nothing changed$/m);
  assert.match(passes(preview(dir)), /^already adopted/m);
  assert.deepEqual(snapshotTree(dir, { skip: ['.pincer/backups/'] }), after, 'repeated apply and preview write nothing');
  assert.match(passes(rt(dir, 'change', 'show', 'prd-v1')), /^Coverage   strict since .* · map \.prd\/coverage\/prd-v1\.json · adoption agreement G-02$/m);
  // Rollback, following the contract literally: restore the backed-up record over the
  // schema 3 one (nothing under .prd/changes/ is deleted); the snapshot may stay; keep the map,
  // .pincer/runtime and the evidence.
  fs.copyFileSync(path.join(dir, backupRel), path.join(dir, '.prd/changes/prd-v1.json'));
  fs.rmSync(path.join(dir, backupRel), { force: true });
  assert.equal(record(dir).schema, 2, 'the restored file is the schema 2 record; it is not deleted');
  assert.ok(fs.existsSync(path.join(dir, '.prd/changes/prd-v1/agreements/G-02.json')), 'the adoption snapshot left in place is unreferenced');
  assert.equal(changes.loadRecords(dir).problems.length, 0, 'an unreferenced snapshot is not a problem');
  fs.rmSync(path.join(dir, '.prd/changes/prd-v1/agreements/G-02.json'));
  fs.rmSync(path.join(dir, '.pincer/backups'), { recursive: true });
  assert.deepEqual(snapshotTree(dir), before, 'rollback restores the project byte for byte, map and runtime state kept');
  const s2 = statusJson(dir);
  assert.equal(s2.change.agreement.verdict, 'current'); assert.deepEqual(s2.tickets[0].readiness.reasons.map(x => x.code), ['SOURCE_CHANGED'], 'the v5 attempt is evidence again, not history');
}

// --- S-23: faults, concurrent edits, missing or downgraded strict state, running attempts, old runtimes
{
  // Death at every journal boundary: before the manifest the schema 2 record stays and
  // staging is discarded; after it the adoption is complete or completed by recover.
  for (const point of ['validated', 'staged', 'manifest', 'rename:0', 'cleanup']) {
    const dir = v5Project();
    passes(rt(dir, 'change', 'select', 'prd-v1'));
    const before = snapshotTree(dir);
    const r = op(dir, 'adopt', 'prd-v1', '--crash', point);
    assert.equal(r.signal, 'SIGKILL', `${point}: the writer killed itself`);
    const committed = ['manifest', 'rename:0', 'cleanup'].includes(point);
    const rec = JSON.parse(read(dir, '.prd/changes/prd-v1.json'));
    if (!committed) {
      assert.equal(rec.schema, 2, `${point}: the old record stays`);
      const skip = ['.pincer/runtime/journal/', '.pincer/runtime/lock', '.pincer/backups/'];
      assert.deepEqual(snapshotTree(dir, { skip }), Object.fromEntries(Object.entries(before).filter(([k]) => !skip.some(s => k.startsWith(s)))), `${point}: nothing else changed`);
      passes(rt(dir, 'recover'));
      assert.equal(JSON.parse(read(dir, '.prd/changes/prd-v1.json')).schema, 2);
      passes(applyIt(dir), `${point}: a later apply succeeds`);
    } else {
      const st = rt(dir, 'status', '--json');
      if (point !== 'cleanup') refuses(st, 4, /STATE_INCOMPLETE/, `${point}: read-only inspection reports the incomplete transaction and repairs nothing`);
      passes(rt(dir, 'recover'));
      const done = JSON.parse(read(dir, '.prd/changes/prd-v1.json'));
      assert.equal(done.schema, 3, `${point}: the adoption is complete after recover`);
      assert.equal(changes.validateRecord(done, '.prd/changes/prd-v1.json'), null);
      assert.ok(fs.existsSync(path.join(dir, '.prd/changes/prd-v1/agreements/G-02.json')), `${point}: the snapshot and the record land together`);
      assert.match(passes(applyIt(dir)), /already adopted/);
    }
    assert.equal(JSON.parse(read(dir, '.prd/changes/prd-v1.json')).schema, 3);
    assert.deepEqual(fs.readdirSync(path.join(dir, '.pincer/runtime/journal')), [], `${point}: no staging left behind`);
  }
  // Concurrent input change: the digest the preview printed no longer matches at commit.
  {
    const dir = v5Project();
    passes(rt(dir, 'change', 'select', 'prd-v1'));
    const digest = passes(preview(dir)).match(/--agreement ([0-9a-f]{64})/)[1];
    write(dir, '.prd/coverage/prd-v1.json', V5_MAP.replace('"timeout": 600', '"timeout": 601'));
    const before = snapshotTree(dir);
    refuses(applyIt(dir, 'prd-v1', '--agreement', digest), 1, /AGREEMENT_CHANGED: adoption refused; nothing was written: --agreement [0-9a-f]{12} is not the agreement adoption would record now/);
    assert.deepEqual(snapshotTree(dir), before, 'nothing written for a stale adoption');
    assert.equal(record(dir).schema, 2);
    // Overlapping adoptions of the same change: one adopts, the other reports already.
    const a = op(dir, 'adopt', 'prd-v1', '--hold', '300'), b = op(dir, 'adopt', 'prd-v1');
    assert.equal(a.status, 0, a.stdout + a.stderr); assert.equal(b.status, 0, b.stdout + b.stderr);
    assert.deepEqual([a.stdout.trim(), b.stdout.trim()].sort(), ['adopted prd-v1', 'already prd-v1'], 'one writer adopts, the other finds it adopted');
    assert.equal(record(dir).events.filter(e => e.kind === 'adopt').length, 1, 'exactly one adopt event');
  }
  // Missing strict inputs never fall back to legacy or to unverified: the map is required once adopted.
  {
    const dir = freshStrict();
    passes(rt(dir, 'verify', 'T-01'), 'execution works on the strict change');
    fs.rmSync(path.join(dir, '.prd/coverage/prd-v1.json'));
    const s = statusJson(dir);
    assert.equal(s.mode, 'changes'); assert.equal(s.change.agreement.current, null);
    assert.equal(s.change.agreement.verdict, 'COVERAGE_INVALID');
    assert.match(s.change.agreement.verdict_detail, /\.prd\/coverage\/prd-v1\.json: missing — author \.prd\/coverage\/prd-v1\.json first/);
    refuses(rt(dir, 'verify', 'T-01'), 4, /COVERAGE_INVALID: verify refused: \.prd\/coverage\/prd-v1\.json: missing/);
    refuses(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', 'a'.repeat(64), '--reference', 'x', '--excerpt', 'y'), 4, /COVERAGE_INVALID/);
    write(dir, '.prd/coverage/prd-v1.json', read(fx, 'strict/coverage/prd-v1.json'));
    passes(rt(dir, 'verify', 'T-01'), 'restored');
    write(dir, '.prd/prd-v1.md', read(dir, '.prd/prd-v1.md').replace('- **S-01:**', '- S-01:'));
    refuses(rt(dir, 'verify', 'T-01'), 4, /INVENTORY_INVALID: verify refused: \.prd\/prd-v1\.md: unsupported scenario definition syntax at line \d+/);
    assert.equal(statusJson(dir).change.agreement.verdict, 'INVENTORY_INVALID');
  }
  // Downgraded flags and unknown schemas refuse safely and never make the project legacy or migrated.
  {
    const dir = freshStrict();
    const good = read(dir, '.prd/changes/prd-v1.json');
    const cases = [
      ['coverage: null', good.replace(/"coverage": \{[^}]*\}/, '"coverage": null'), 4, /MALFORMED: .*the strict coverage capability cannot be removed by editing the record; restore the backed-up schema 2 record instead/],
      ['coverage removed', good.replace(/,\n  "coverage": \{[^}]*\}/, ''), 4, /MALFORMED: .*the strict coverage capability cannot be removed by editing the record/],
      ['schema downgraded with the adopt event kept', good.replace('"schema": 3', '"schema": 2').replace('"runtime": 3', '"runtime": 2').replace(/,\n  "coverage": \{[^}]*\}/, ''), 4, /MALFORMED: .*(agreements\[0\]\.inventory is not allowed|kind must be one of)/],
      ['schema 4', good.replace('"schema": 3', '"schema": 4'), 4, /\.prd\/changes\/prd-v1\.json: unsupported schema 4/],
      ['adopt event dropped', good.replace(/,\n    \{\n      "sequence": \d+,\n      "kind": "adopt"[\s\S]*?\n    \}\n  \]/, '\n  ]'), 4, /HISTORY_INVALID/],
    ];
    for (const [label, text, status, pattern] of cases) {
      write(dir, '.prd/changes/prd-v1.json', text);
      refuses(rt(dir, 'status'), status, pattern, label);
      assert.notEqual(statusJson(dir).mode, 'legacy', `${label}: never legacy`);
      { const r = rt(dir, 'verify', 'T-01'); assert.ok([1, 4].includes(r.status), `${label}: execution refused (${r.status})`); assert.match(r.stdout + r.stderr, /MALFORMED|UNSUPPORTED_SCHEMA|HISTORY_INVALID/, `${label}: execution refused`); }
      refuses(applyIt(dir), 1, /conflict  (MALFORMED|UNSUPPORTED_SCHEMA|HISTORY_INVALID)/, `${label}: adoption refused`);
    }
    write(dir, '.prd/changes/prd-v1.json', good);
    passes(rt(dir, 'status'));
    // A schema 2 record beside a strict one is fine (each change adopts on its own); a schema 2
    // record carrying the capability or an adopt event is refused, under this runtime and under v5.
    createPrd(dir, 2); passes(rt(dir, 'register', '--prd', '.prd/prd-v2.md'));
    assert.deepEqual([...changes.loadRecords(dir).records.values()].map(e => e.record.schema), [3, 2]);
    const two = JSON.parse(read(dir, '.prd/changes/prd-v2.json'));
    assert.match(changes.validateRecord({ ...two, coverage: record(dir).coverage }, '.prd/changes/prd-v2.json').problem, /unknown key "coverage" \(a schema 2 record carries no strict coverage capability/);
    assert.match(v5changes.validateRecord({ ...two, coverage: record(dir).coverage }, '.prd/changes/prd-v2.json').problem, /unknown key "coverage"/);
    const withAdopt = { ...two, sequence: 2, events: [...two.events, { sequence: 2, kind: 'adopt', from: 'planned', to: 'planned', at: two.events[0].at, reason: null, agreement: null, authorization: null, decision: null, replacement: null, note: null }] };
    assert.match(changes.validateRecord(withAdopt, '.prd/changes/prd-v2.json').problem, /kind must be one of .* \(a schema 2 record carries no adopt event/);
    assert.match(v5changes.validateRecord(withAdopt, '.prd/changes/prd-v2.json').problem, /kind must be one of/);
    // The pinned PRD v5 readers refuse the adopted record and a strict attempt.
    assert.equal(v5changes.validateRecord(record(dir), '.prd/changes/prd-v1.json').code, 'UNSUPPORTED_SCHEMA');
    const v5scan = v5changes.scan(dir);
    assert.ok(v5scan.mode !== 'legacy' && v5scan.mode !== 'migrated', 'the v5 reader never interprets a strict change as legacy or migrated');
    assert.ok(v5scan.problems.some(p => p.code === 'UNSUPPORTED_SCHEMA' && /prd-v1\.json: unsupported schema 3/.test(p.detail)), JSON.stringify(v5scan.problems));
  }
  // A running attempt blocks adoption (and, as in v5, the transitions) without being terminated.
  {
    const dir = freshStrict({ adopt: false, prepare: d => write(d, 'tickets/T-03-harness.md', read(d, 'tickets/T-03-harness.md').replace('```bash\ntrue\n```', '```bash\nsleep 4\n```')) });
    const child = spawn(process.execPath, [runtime, 'verify', 'T-03'], { cwd: dir, env: { ...process.env, CLAUDE_PROJECT_DIR: dir }, stdio: ['ignore', 'pipe', 'pipe'] });
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline && !(state.exists(dir) && state.readIndex(dir).index.running.length)) await new Promise(r => setTimeout(r, 50));
    assert.ok(state.readIndex(dir).index.running.length, 'an attempt is running');
    refuses(preview(dir), 1, /conflict  ATTEMPT_RUNNING: attempt [0-9A-Za-z-]+ of change prd-v1 is running \(pid \d+ is still running\); adoption waits for it/);
    refuses(applyIt(dir), 1, /ATTEMPT_RUNNING/);
    refuses(rt(dir, 'change', 'pause', 'prd-v1', '--reason', 'x'), 1, /ATTEMPT_RUNNING/, 'v5 rule preserved');
    await new Promise(resolve => child.on('exit', resolve));
    assert.equal(record(dir).schema, 2);
    passes(applyIt(dir), 'adoption proceeds once the attempt finished');
    assert.equal(state.readAttempt(dir, state.readIndex(dir).index.current['ticket:prd-v1:T-03']).attempt.outcome, 'passed', 'the attempt was never terminated');
  }
  // Module-level: the plan refuses a terminal change and an unknown one; migration never adopts.
  {
    const dir = freshStrict({ adopt: false });
    assert.deepEqual(adopt.plan(dir, { change: 'nope' }).conflicts.map(c => c.code), ['INPUT_INVALID']);
    assert.deepEqual(adopt.plan(dir, { change: 'Bad Id' }).conflicts.map(c => c.code), ['INPUT_INVALID']);
    passes(rt(dir, 'change', 'decide', 'prd-v1', '--summary', 'stop'));
    passes(rt(dir, 'change', 'decide', 'prd-v1', '--resolve', 'D-01', '--reference', 'x', '--excerpt', 'stop it'));
    passes(rt(dir, 'change', 'cancel', 'prd-v1', '--decision', 'D-01', '--reason', 'done'));
    refuses(preview(dir), 1, /conflict  LIFECYCLE_BLOCKED: change prd-v1 is cancelled; its history cannot adopt strict coverage/);
    assert.equal(record(dir).schema, 2);
    const fresh = v5Project({ withMap: false });
    passes(rt(fresh, 'change', 'select', 'prd-v1'));
    refuses(preview(fresh), 1, /conflict  COVERAGE_INVALID: \.prd\/coverage\/prd-v1\.json: missing — author/);
    write(fresh, '.prd/coverage/prd-v1.json', V5_MAP.replace('"S-01": { "tickets": ["T-01"], "checks": ["C-01"] }', ''));
    refuses(preview(fresh), 1, /conflict  COVERAGE_INCOMPLETE: S-01 has no row in scenarios or scope/);
    assert.equal(record(fresh).schema, 2);
    assert.doesNotMatch(passes(rt(fresh, 'migrate', '--preview', '--prd', '.prd/prd-v1.md')), /adopt|strict/i, 'migration output never mentions adoption; it is a separate explicit step');
  }
}
console.log('coverage adoption tests passed');
