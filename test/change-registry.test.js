// Change records (PRD v5 R-01, R-09; T-49): registration retains every earlier
// record; duplicate IDs and PRD ownership, malformed JSON, unresolved references,
// path escapes, unknown schemas, mixed schemas and pending transactions refuse
// before any write and never fall back to legacy; the v0.5.0 --replace deletion
// is refused with select/supersede guidance; list/show are read-only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir, createTicket, createPrd, write, read, run, bindV050, statusScript } from './helpers.js';

const require = createRequire(import.meta.url);
const changes = require(path.join(repo, 'template/scripts/pincer-runtime/changes.cjs'));
const identity = require(path.join(repo, 'template/scripts/pincer-runtime/identity.cjs'));
const runtime = path.join(repo, 'template/scripts/pincer-runtime.cjs');
const rt = (dir, ...args) => run(dir, process.execPath, [runtime, ...args]);
function passes(result, label = '') { assert.equal(result.status, 0, `${label}\n${result.stdout}${result.stderr}`); return result.stdout; }
function refuses(result, status, pattern, label = '') { assert.equal(result.status, status, `${label}: exit ${status}\n${result.stdout}${result.stderr}`); assert.match(result.stdout + result.stderr, pattern, label); return result; }
function git(dir, ...args) { return passes(run(dir, 'git', args), `git ${args.join(' ')}`).trim(); }
function commit(dir, message) {
  git(dir, 'add', '-A');
  git(dir, '-c', 'user.name=Pincer Test', '-c', 'user.email=test@example.invalid', 'commit', '-q', '--allow-empty', '-m', message);
  return git(dir, 'rev-parse', 'HEAD');
}
const snapshotTree = dir => {
  const out = {};
  const walk = rel => {
    for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const next = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(next); else out[next] = fs.readFileSync(path.join(dir, next), 'utf8');
    }
  };
  walk('');
  return out;
};
const record = (dir, id) => JSON.parse(read(dir, `.prd/changes/${id}.json`));
function fixture() {
  const dir = tempDir(); git(dir, 'init', '-q');
  createPrd(dir, 1); createPrd(dir, 2);
  createTicket(dir, { id: 'T-01', prd: '.prd/prd-v1.md' }); createTicket(dir, { id: 'T-02', prd: '.prd/prd-v2.md' });
  write(dir, 'src/app.js', '1\n');
  commit(dir, 'base');
  return dir;
}
// Every refusal leaves the tree byte for byte as it was and creates no local state.
function unchanged(dir, before, fn, label) {
  const result = fn();
  assert.deepEqual(snapshotTree(dir), before, `${label}: nothing written`);
  return result;
}

// S-01: register A then B; both records are retained with their identity and
// history; the ticket association of A still resolves to A.
{
  const dir = fixture();
  const out = passes(rt(dir, 'register', '--prd', '.prd/prd-v1.md'), 'register A');
  assert.match(out, /^registered change prd-v1 → \.prd\/prd-v1\.md base [0-9a-f]{7} · planned \(\.prd\/changes\/prd-v1\.json\)$/m);
  const a = record(dir, 'prd-v1');
  assert.equal(changes.validateRecord(a, '.prd/changes/prd-v1.json'), null, 'a valid schema 2 record');
  assert.equal(a.schema, 2); assert.equal(a.runtime, 2); assert.equal(a.base, git(dir, 'rev-parse', 'HEAD'));
  assert.deepEqual(Object.keys(a), changes.RECORD_KEYS, 'the documented keys in order');
  assert.equal(a.lifecycle.state, 'planned'); assert.equal(a.sequence, 1); assert.equal(a.events[0].kind, 'register');
  assert.deepEqual(a.legacy, { receipts: {}, authorization_text: null, migrated_from: null, migrated: null });
  assert.match(read(dir, '.gitignore'), /^\.pincer\/$/m, 'registration ignores the runtime state');
  const aText = read(dir, '.prd/changes/prd-v1.json');
  commit(dir, 'register A');
  passes(rt(dir, 'register', '--prd', '.prd/prd-v2.md', '--change', 'feature-b'), 'register B');
  assert.equal(read(dir, '.prd/changes/prd-v1.json'), aText, 'A is retained byte for byte');
  const b = record(dir, 'feature-b');
  assert.equal(b.prd, '.prd/prd-v2.md'); assert.equal(changes.validateRecord(b, '.prd/changes/feature-b.json'), null);
  assert.equal(read(dir, '.gitignore').split('\n').filter(l => l.trim() === '.pincer/').length, 1, 'the ignore line is added once');
  const loaded = changes.loadRecords(dir);
  assert.equal(loaded.mode, 'changes'); assert.deepEqual(loaded.problems, []);
  assert.deepEqual([...loaded.records.keys()], ['feature-b', 'prd-v1']);
  assert.equal(changes.ownerOf(loaded, '.prd/prd-v1.md')[0], 'prd-v1', 'T-01\'s PRD resolves to A');
  assert.equal(changes.ownerOf(loaded, '.prd/prd-v2.md')[0], 'feature-b', 'T-02\'s PRD resolves to B');
  // list/show report both, human and JSON; show returns the record as stored.
  const list = passes(rt(dir, 'change', 'list'), 'list');
  assert.match(list, /^Changes  2 retained · no selection$/m);
  assert.match(list, /^  feature-b        planned    \.prd\/prd-v2\.md · since \d{4}-.* · sequence 1 · authorization AUTHORIZATION_REQUIRED$/m);
  assert.match(list, /^  prd-v1           planned    \.prd\/prd-v1\.md/m);
  const listJson = JSON.parse(passes(rt(dir, 'change', 'list', '--json')));
  assert.equal(listJson.schema, 1); assert.equal(listJson.mode, 'changes');
  assert.deepEqual(listJson.changes.map(c => [c.id, c.prd, c.state, c.sequence]), [['feature-b', '.prd/prd-v2.md', 'planned', 1], ['prd-v1', '.prd/prd-v1.md', 'planned', 1]]);
  const show = passes(rt(dir, 'change', 'show', 'prd-v1'), 'show');
  assert.match(show, /^Change     prd-v1 · \.prd\/prd-v1\.md · base [0-9a-f]{7} · registered .* · sequence 1 \(\.prd\/changes\/prd-v1\.json\)$/m);
  assert.match(show, /^Lifecycle  planned since /m);
  assert.match(show, /^Authorizations none$/m);
  assert.match(show, /^ {4}1 \S+ register {3}— → planned$/m);
  const showJson = JSON.parse(passes(rt(dir, 'change', 'show', 'prd-v1', '--json')));
  assert.deepEqual(showJson.record, a, 'show returns the stored record');
  // Registration is idempotent and grants nothing.
  const again = rt(dir, 'register', '--prd', '.prd/prd-v1.md');
  assert.equal(again.status, 0); assert.match(again.stdout, /^unchanged change prd-v1/);
  assert.doesNotMatch(again.stderr, /note/, 'no note on an unchanged registration');
  assert.equal(record(dir, 'prd-v1').sequence, 1, 'no event for an idempotent registration');
  // Status in changes mode: schema 2, no legacy, no selection, never the highest PRD.
  const treeBeforeInspection = snapshotTree(dir);
  const status = JSON.parse(passes(rt(dir, 'status', '--json')));
  assert.equal(status.schema, 3); assert.equal(status.mode, 'changes'); assert.equal(status.change, null);
  assert.equal(status.selection.change, null); assert.equal(status.selection.problem.code, 'SELECTION_REQUIRED');
  assert.deepEqual(status.changes.map(c => c.id), ['feature-b', 'prd-v1']);
  assert.deepEqual(status.tickets, []);
  const human = passes(run(dir, 'bash', [statusScript]));
  assert.match(human, /^Runtime  changes · no selection · change select <id>$/m);
  assert.match(human, /^Changes  2 retained: feature-b \(planned\), prd-v1 \(planned\)$/m);
  assert.match(human, /^PRD      none selected$/m);
  assert.match(human, /^Next     node scripts\/pincer-runtime\.cjs change select <id>/m);
  assert.deepEqual(snapshotTree(dir), treeBeforeInspection, 'inspection writes nothing (registration itself only created the ignored lock layout)');
  assert.ok(!fs.existsSync(path.join(dir, '.pincer/runtime/selection.json')), 'nothing is selected implicitly');
}

// S-02: duplicate IDs, duplicate PRD ownership, malformed records, unresolved
// references, path escapes, unknown and mixed schemas and pending transactions
// refuse before mutation, and never make the project legacy or migrated.
{
  const dir = fixture();
  passes(rt(dir, 'register', '--prd', '.prd/prd-v1.md'));
  const good = read(dir, '.prd/changes/prd-v1.json');
  let before = snapshotTree(dir);
  unchanged(dir, before, () => refuses(rt(dir, 'register', '--prd', '.prd/prd-v2.md', '--change', 'prd-v1'), 4, /INPUT_INVALID: \.prd\/changes\/prd-v1\.json already names change "prd-v1" for \.prd\/prd-v1\.md; choose another --change ID/), 'duplicate change ID');
  unchanged(dir, before, () => refuses(rt(dir, 'register', '--prd', '.prd/prd-v1.md', '--change', 'other'), 4, /INPUT_INVALID: \.prd\/prd-v1\.md is already owned by change "prd-v1" \(\.prd\/changes\/prd-v1\.json\); work on it with: node scripts\/pincer-runtime\.cjs change select prd-v1/), 'duplicate PRD ownership at registration');
  unchanged(dir, before, () => refuses(rt(dir, 'register', '--prd', '.prd/prd-v7.md'), 4, /PRD does not exist/), 'missing PRD');
  unchanged(dir, before, () => refuses(rt(dir, 'register', '--prd', '.prd/prd-v2.md', '--change', 'Bad_ID'), 4, /change ID must match/), 'bad id');
  // Two records owning one PRD (a hand copy): everything refuses until repaired; no legacy fallback.
  write(dir, '.prd/changes/copy.json', good.replace('"change": "prd-v1"', '"change": "copy"'));
  before = snapshotTree(dir);
  const dup = /INPUT_INVALID: duplicate PRD ownership: \.prd\/prd-v1\.md is owned by change "copy" and change "prd-v1"/;
  unchanged(dir, before, () => refuses(rt(dir, 'change', 'list'), 4, dup), 'list with duplicate ownership');
  unchanged(dir, before, () => refuses(rt(dir, 'change', 'show', 'prd-v1'), 4, dup), 'show with duplicate ownership');
  unchanged(dir, before, () => refuses(rt(dir, 'register', '--prd', '.prd/prd-v2.md'), 4, dup), 'register with duplicate ownership');
  const st = refuses(rt(dir, 'status', '--json'), 4, /duplicate PRD ownership: \.prd\/prd-v1\.md is owned by change/, 'status with duplicate ownership');
  assert.equal(JSON.parse(st.stdout).mode, 'changes', 'still changes mode, not legacy');
  assert.equal(JSON.parse(st.stdout).reasons[0].code, 'INPUT_INVALID');
  refuses(rt(dir, 'status'), 4, dup, 'human status with duplicate ownership');
  assert.equal(identity.loadBinding(dir).code, 'CHANGES_MODE', 'a binding loader never sees schema 2 records as a binding');
  fs.unlinkSync(path.join(dir, '.prd/changes/copy.json'));
  // Malformed, unknown schema, unresolved references, path escape, history
  // mismatch, dangling supersession: each refuses with its code and writes nothing.
  const broken = [
    ['malformed JSON', '{"schema": 2, "change": "prd-v1",', 'MALFORMED', /malformed JSON/],
    ['unknown schema', good.replace('"schema": 2', '"schema": 4'), 'UNSUPPORTED_SCHEMA', /unsupported schema 4/],
    ['unknown key', good.replace('"evaluations": []', '"evaluations": [], "extra": 1'), 'MALFORMED', /unknown key "extra"/],
    ['sequence without history', good.replace('"sequence": 1', '"sequence": 2'), 'HISTORY_INVALID', /sequence is 2 but the history has 1 event/],
    ['projection without event', good.replace('"state": "planned"', '"state": "active"'), 'HISTORY_INVALID', /lifecycle\.state is active but the history ends at planned/],
    ['dangling authorization reference', good.replace('"authorizations": []', '"authorizations": [{"id": "A-01", "agreement": "G-01", "digest": "0000000000000000000000000000000000000000000000000000000000000000", "disposition": "user", "reference": "r", "excerpt": "e", "constraints": null, "basis": null, "explanation": null, "decisions": [], "recorded": "2026-09-11T00:00:00Z"}]'), 'HISTORY_INVALID', /A-01: references unknown agreement "G-01"/],
    ['snapshot path escape', good.replace('"agreements": []', '"agreements": [{"id": "G-01", "digest": "0000000000000000000000000000000000000000000000000000000000000000", "prd_revision": "0000000000000000000000000000000000000000000000000000000000000000", "breakdown": "0000000000000000000000000000000000000000000000000000000000000000", "tickets": ["T-01"], "decisions": [], "snapshot": "../../etc/passwd", "recorded": "2026-09-11T00:00:00Z"}]'), 'MALFORMED', /G-01: snapshot must be \.prd\/changes\/prd-v1\/agreements\/G-01\.json/],
    ['filename mismatch', good.replace('"change": "prd-v1"', '"change": "renamed"'), 'MALFORMED', /filename does not match change "renamed"/],
    ['conflict markers', `<<<<<<< HEAD\n${good}=======\n${good}>>>>>>> other\n`, 'MALFORMED', /malformed JSON/],
    ['supersession without record', good.replace('"state": "planned"', '"state": "superseded"').replace('"superseded_by": null', '"superseded_by": "ghost"').replace('"kind": "register", "from": null, "to": "planned"', '"kind": "register", "from": null, "to": "planned"'), 'HISTORY_INVALID', /lifecycle\.state is superseded but the history ends at planned/],
  ];
  for (const [label, content, code, pattern] of broken) {
    write(dir, '.prd/changes/prd-v1.json', content);
    before = snapshotTree(dir);
    const r = unchanged(dir, before, () => refuses(rt(dir, 'register', '--prd', '.prd/prd-v2.md'), 4, pattern, label), label);
    assert.match(r.stderr, new RegExp(`^pincer: ${code}:`, 'm'), `${label}: code ${code}`);
    refuses(rt(dir, 'status'), 4, pattern, `${label}: status`);
    const s = rt(dir, 'status', '--json');
    assert.equal(s.status, 4, `${label}: status --json exits 4`);
    assert.ok(['changes', 'invalid'].includes(JSON.parse(s.stdout).mode), `${label}: an unreadable record never turns the project legacy or migrated (${JSON.parse(s.stdout).mode})`);
    unchanged(dir, before, () => refuses(rt(dir, 'change', 'show', 'prd-v1'), 4, pattern, `${label}: show`), `${label}: show`);
    assert.ok(!fs.existsSync(path.join(dir, '.prd/changes/prd-v2.json')), `${label}: no record written`);
  }
  write(dir, '.prd/changes/prd-v1.json', good);
  // A dangling superseded_by and a supersession cycle are directory-level history errors.
  const superseded = (id, by, prd) => {
    const r = JSON.parse(good.replace('"change": "prd-v1"', `"change": "${id}"`).replace('.prd/prd-v1.md', prd));
    r.lifecycle = { ...r.lifecycle, state: 'superseded', superseded_by: by };
    r.decisions = [{ id: 'D-01', status: 'resolved', summary: 'retire', reference: 'session', excerpt: 'retire it', raised: r.registered, resolved: r.registered }];
    r.events.push({ sequence: 2, kind: 'decide', from: 'planned', to: 'planned', at: r.registered, reason: null, agreement: null, authorization: null, decision: 'D-01', replacement: null, note: null });
    r.events.push({ sequence: 3, kind: 'supersede', from: 'planned', to: 'superseded', at: r.registered, reason: null, agreement: null, authorization: null, decision: 'D-01', replacement: by, note: null });
    r.sequence = 3;
    return `${JSON.stringify(r, null, 2)}\n`;
  };
  write(dir, '.prd/changes/prd-v1.json', superseded('prd-v1', 'ghost', '.prd/prd-v1.md'));
  refuses(rt(dir, 'change', 'list'), 4, /HISTORY_INVALID: \.prd\/changes\/prd-v1\.json: superseded by "ghost", which is not a retained change record/);
  write(dir, '.prd/changes/prd-v1.json', superseded('prd-v1', 'prd-v2', '.prd/prd-v1.md'));
  write(dir, '.prd/changes/prd-v2.json', superseded('prd-v2', 'prd-v1', '.prd/prd-v2.md'));
  refuses(rt(dir, 'change', 'list'), 4, /HISTORY_INVALID: .*supersession returns to "prd-v1" \(a cycle\)/);
  assert.equal(changes.validateRecord(JSON.parse(superseded('prd-v1', 'prd-v1', '.prd/prd-v1.md')), '.prd/changes/prd-v1.json').problem, '.prd/changes/prd-v1.json: a change cannot supersede itself');
  fs.unlinkSync(path.join(dir, '.prd/changes/prd-v2.json'));
  write(dir, '.prd/changes/prd-v1.json', good);
  // A schema 1 binding next to a schema 2 record is a mixed directory: invalid, not migrated.
  bindV050(dir, { prd: '.prd/prd-v2.md' });
  before = snapshotTree(dir);
  unchanged(dir, before, () => refuses(rt(dir, 'change', 'list'), 4, /INPUT_INVALID: \.prd\/changes\/ mixes a schema 1 binding \(prd-v2\.json\) with schema 2 change records \(prd-v1\.json\)/), 'mixed schemas');
  assert.equal(identity.loadBinding(dir).code, 'INPUT_INVALID');
  refuses(rt(dir, 'status'), 4, /mixes a schema 1 binding/);
  fs.unlinkSync(path.join(dir, '.prd/changes/prd-v2.json'));
  // A committed-but-unapplied transaction blocks inspection with STATE_INCOMPLETE until recover.
  write(dir, '.pincer/runtime/journal/txn-20260911T000000Z-abc123/01-prd-v1.json', good);
  write(dir, '.pincer/runtime/journal/txn-20260911T000000Z-abc123/manifest.json', JSON.stringify({ schema: 1, id: 'txn-20260911T000000Z-abc123', command: 'register prd-v1', started: '2026-09-11T00:00:00Z', writes: [{ target: '.prd/changes/prd-v1.json', staged: '01-prd-v1.json' }] }));
  before = snapshotTree(dir);
  unchanged(dir, before, () => refuses(rt(dir, 'change', 'list'), 4, /STATE_INCOMPLETE: a committed transaction \(register prd-v1\) was not fully applied; run: node scripts\/pincer-runtime\.cjs recover/), 'pending transaction');
  refuses(rt(dir, 'status'), 4, /STATE_INCOMPLETE/);
  assert.match(passes(rt(dir, 'recover')), /completed transaction txn-20260911T000000Z-abc123 \(register prd-v1\)/);
  assert.deepEqual(changes.loadRecords(dir).problems, [], 'inspection resumes after recover');
}

// S-03: the v0.5.0 destructive --replace is refused with select/supersede guidance;
// a v0.5.0 binding is never converted silently; list/show are read-only.
{
  const dir = fixture();
  passes(rt(dir, 'register', '--prd', '.prd/prd-v1.md'));
  const before = snapshotTree(dir);
  unchanged(dir, before, () => refuses(rt(dir, 'register', '--prd', '.prd/prd-v2.md', '--replace'), 1, /LIFECYCLE_BLOCKED: --replace is not supported for change records \(they are retained\); work on another change with `change select <id>`, retire one with `change supersede <id> --with <replacement> --decision D-NN` or `change cancel/), '--replace');
  unchanged(dir, before, () => refuses(rt(dir, 'register', '--prd', '.prd/prd-v1.md', '--rebind'), 1, /AGREEMENT_CHANGED: --rebind is not supported for change records; record the revised agreement with `change revise <id>`/), '--rebind');
  unchanged(dir, before, () => refuses(rt(dir, 'register', '--prd', '.prd/prd-v1.md', '--authorization', 'approved'), 1, /AUTHORIZATION_REQUIRED: --authorization is not recorded on change records \(free text cannot become approval\); record the user's instruction with `change authorize/), '--authorization');
  assert.ok(fs.existsSync(path.join(dir, '.prd/changes/prd-v1.json')), 'A is still there');
  assert.ok(!fs.existsSync(path.join(dir, '.prd/changes/prd-v2.json')));
  // Migrated mode (released v0.5.0 binding): same PRD keeps the v0.5.0 semantics;
  // another PRD or --replace requires the migration; the binding is untouched.
  const mig = fixture();
  bindV050(mig, { prd: '.prd/prd-v1.md', authorization: 'old free text' });
  const bindingText = read(mig, '.prd/changes/prd-v1.json');
  const beforeMig = snapshotTree(mig);
  assert.match(passes(rt(mig, 'register', '--prd', '.prd/prd-v1.md')), /^unchanged change prd-v1 → \.prd\/prd-v1\.md revision/, 'v0.5.0 idempotent registration');
  unchanged(mig, beforeMig, () => refuses(rt(mig, 'register', '--prd', '.prd/prd-v2.md'), 1, /MIGRATION_REQUIRED: \.prd\/changes\/prd-v1\.json binds \.prd\/prd-v1\.md as change "prd-v1"; one binding per worktree in migrated mode — migrate to change records first: node scripts\/pincer-runtime\.cjs migrate --preview --prd \.prd\/prd-v1\.md, then register \.prd\/prd-v2\.md/), 'second PRD in migrated mode');
  unchanged(mig, beforeMig, () => refuses(rt(mig, 'register', '--prd', '.prd/prd-v2.md', '--replace'), 1, /MIGRATION_REQUIRED: --replace would delete \.prd\/changes\/prd-v1\.json; change records are retained instead — migrate first/), '--replace in migrated mode');
  assert.equal(read(mig, '.prd/changes/prd-v1.json'), bindingText, 'the v0.5.0 binding is never converted or deleted');
  assert.equal(JSON.parse(passes(rt(mig, 'status', '--json'))).mode, 'migrated', 'v0.5.0 inspection behavior is kept');
  assert.match(passes(rt(mig, 'change', 'list')), /^Changes  v0\.5\.0 binding \(migrated mode\); migrate to change records/);
  // list/show never write: no lock, no journal, no .pincer, no record change.
  const listed = snapshotTree(dir);
  passes(rt(dir, 'change', 'list')); passes(rt(dir, 'change', 'list', '--json')); passes(rt(dir, 'change', 'show', 'prd-v1')); passes(rt(dir, 'change', 'show', 'prd-v1', '--json'));
  assert.deepEqual(snapshotTree(dir), listed, 'inspection is read-only (the ignored lock layout came from registration, not from list/show)');
  refuses(rt(dir, 'change', 'show', 'nope'), 4, /INPUT_INVALID: no change record \.prd\/changes\/nope\.json \(retained: prd-v1\)/);
  refuses(rt(dir, 'change', 'show'), 2, /exactly one change ID/);
  refuses(rt(dir, 'change', 'frobnicate', 'prd-v1'), 2, /unknown change subcommand frobnicate/);
  // Legacy project: list says so and register creates the first record (no migration needed without receipts).
  const legacy = fixture();
  assert.match(passes(rt(legacy, 'change', 'list')), /^Changes  none \(legacy project; register with/);
  assert.equal(changes.loadRecord(legacy, 'prd-v1').code, 'CHANGE_REQUIRED');
}
console.log('change registry tests passed');

// PRD v6 T-68: an authored coverage map is inert until a change adopts strict
// coverage — registration, listing and inspection of schema 2 records ignore
// `.prd/coverage/` entirely, and the map file is never written by the runtime.
{
  const dir = fixture();
  write(dir, '.prd/coverage/prd-v1.json', read(path.join(repo, 'test/fixtures/prd-v6'), 'strict/coverage/prd-v1.json'));
  const before = read(dir, '.prd/coverage/prd-v1.json');
  passes(rt(dir, 'register', '--prd', '.prd/prd-v1.md'), 'register with a map present');
  const loaded = changes.loadRecords(dir);
  assert.deepEqual(loaded.problems, []); assert.equal(loaded.mode, 'changes');
  const shown = passes(rt(dir, 'change', 'show', 'prd-v1'));
  assert.match(shown, /^Coverage   unverified \(strict coverage not adopted/m, 'a schema 2 record is labeled unverified'); assert.doesNotMatch(shown, /strict since/, 'no capability');
  assert.equal(read(dir, '.prd/coverage/prd-v1.json'), before, 'the map is untouched');
  assert.equal(record(dir, 'prd-v1').schema, 2);
}
console.log('change registry tests passed (coverage map inert before adoption)');
