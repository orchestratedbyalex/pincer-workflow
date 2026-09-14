// PRD v7 T-90 (R-04, S-10..S-12): `coverage scaffold --change <id> [--json]` projects
// the validated inventory, the change's tickets and any authored map into a reviewable
// draft. Every live scenario appears exactly once, authored content survives verbatim,
// unresolved entries stay visibly unresolved, and the draft is refused by every gate
// that accepts a real map. Malformed inputs, wrong-change tickets, unsupported schemas
// and escaping paths are refused before anything is read further; whole-tree snapshots
// prove the command writes nothing and launches nothing.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir, write, read, run } from './helpers.js';

const require = createRequire(import.meta.url);
const runtime = path.join(repo, 'template/scripts/pincer-runtime.cjs');
const scaffold = require(path.join(repo, 'template/scripts/pincer-runtime/scaffold.cjs'));
const coverage = require(path.join(repo, 'template/scripts/pincer-runtime/coverage.cjs'));
const fx = path.join(repo, 'test/fixtures/prd-v6');
const record = { change: 'prd-v1', prd: '.prd/prd-v1.md', agreements: [] };

const snapshotTree = dir => {
  const out = {};
  const walk = rel => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      if (e.name === '.git') continue;
      const next = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(next); else out[next] = fs.readFileSync(path.join(dir, next)).toString('base64');
    }
  };
  walk('');
  return out;
};

// A project carrying the strict fixture. `map` null leaves no map on disk at all,
// which is the state this command exists for.
function fixture({ map = null, prd = read(fx, 'strict/prd-v1.md'), tickets = null } = {}) {
  const dir = tempDir();
  write(dir, '.prd/prd-v1.md', prd);
  for (const f of fs.readdirSync(path.join(fx, 'strict/tickets'))) write(dir, `tickets/${f}`, read(fx, `strict/tickets/${f}`));
  if (tickets) for (const [file, text] of Object.entries(tickets)) write(dir, file, text);
  if (map !== null) write(dir, '.prd/coverage/prd-v1.json', map);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  return dir;
}
const complete = read(fx, 'strict/coverage/prd-v1.json');
const cli = (dir, args) => run(dir, process.execPath, [runtime, ...args]);

// The same fixture as a registered git project, so the CLI can resolve the change and
// the frozen exit codes are exercised through the real entry point rather than around it.
function project(options = {}) {
  const dir = fixture(options);
  write(dir, '.gitignore', '.pincer/\n');
  run(dir, 'git', ['init', '-q', '-b', 'main']);
  run(dir, 'git', ['config', 'user.email', 't@example.invalid']);
  run(dir, 'git', ['config', 'user.name', 't']);
  run(dir, 'git', ['config', 'commit.gpgsign', 'false']);
  run(dir, 'git', ['add', '-A']);
  run(dir, 'git', ['commit', '-q', '-m', 'base']);
  const registered = cli(dir, ['register', '--prd', '.prd/prd-v1.md']);
  assert.equal(registered.status, 0, registered.stderr);
  return dir;
}
const codesOf = d => d.unresolved.map(u => u.code);
const idsOf = d => d.unresolved.map(u => u.id);

// --- S-10: a partial map yields a deterministic complete inventory -------------------
// Every live scenario is listed exactly once, authored entries are preserved verbatim,
// and what is still unauthored is separated from what has been reviewed.
{
  const dir = fixture();
  const before = snapshotTree(dir);
  const empty = scaffold.build(dir, record);
  assert.deepEqual(snapshotTree(dir), before, 'scaffolding writes nothing');
  assert.ok(empty.ok, JSON.stringify(empty.problems));
  const d = empty.draft;
  // Every live scenario exactly once, across scenarios and scope together.
  assert.deepEqual(Object.keys(d.scenarios), ['S-01', 'S-02', 'S-03'], 'every live scenario is listed');
  assert.deepEqual(Object.keys(d.scope), []);
  assert.equal(d.inventory.scenarios, 3);
  assert.equal(d.inventory.requirements, 2);
  assert.equal(d.scenarios['S-01'].requirement, 'R-01');
  assert.equal(d.scenarios['S-03'].requirement, 'R-02', 'each scenario carries its parent requirement');
  // With no map, nothing is resolved and nothing is invented.
  for (const id of ['S-01', 'S-02', 'S-03']) {
    assert.equal(d.scenarios[id].state, 'unresolved');
    assert.deepEqual(d.scenarios[id].tickets, [], 'no link is invented');
    assert.deepEqual(d.scenarios[id].checks, [], 'no check is invented');
  }
  assert.deepEqual(d.checks, {}, 'a check declaration is authored, never derived from a ticket');
  for (const id of ['T-01', 'T-02', 'T-03']) assert.equal(d.tickets[id].role, null, 'no ticket role is guessed');
  assert.deepEqual(codesOf(d).slice(0, 3), ['SCENARIO_UNLINKED', 'SCENARIO_UNLINKED', 'SCENARIO_UNLINKED']);
  assert.deepEqual(codesOf(d).slice(3), ['TICKET_UNCLASSIFIED', 'TICKET_UNCLASSIFIED', 'TICKET_UNCLASSIFIED']);
  assert.equal(d.authored.map, null);
  assert.equal(d.authored.digest, null);

  // A partly authored map: S-01 linked and C-01 declared, S-02/S-03 still open.
  const partialDoc = JSON.parse(complete);
  delete partialDoc.scenarios['S-02'];
  delete partialDoc.scope['S-03'];
  delete partialDoc.checks['C-02'];
  delete partialDoc.tickets['T-02'];
  const partial = fixture({ map: `${JSON.stringify(partialDoc, null, 2)}\n` });
  const p = scaffold.build(partial, record);
  assert.ok(p.ok, JSON.stringify(p.problems));
  const pd = p.draft;
  assert.deepEqual(Object.keys(pd.scenarios), ['S-01', 'S-02', 'S-03'], 'the unauthored scenarios are still listed');
  assert.equal(pd.scenarios['S-01'].state, 'authored');
  assert.deepEqual(pd.scenarios['S-01'].tickets, ['T-01'], 'the authored link is preserved');
  assert.deepEqual(pd.scenarios['S-01'].checks, ['C-01']);
  assert.equal(pd.scenarios['S-02'].state, 'unresolved');
  assert.equal(pd.scenarios['S-03'].state, 'unresolved', 'a scope row that was removed is unresolved again, not silently deferred');
  // Authored check declarations survive field for field.
  assert.deepEqual({ ...pd.checks['C-01'], state: undefined }, { ...partialDoc.checks['C-01'], state: undefined });
  assert.equal(pd.checks['C-01'].state, 'authored');
  assert.equal(pd.tickets['T-01'].state, 'authored');
  assert.equal(pd.tickets['T-01'].role, 'implements');
  assert.equal(pd.tickets['T-03'].rationale, partialDoc.tickets['T-03'].rationale, 'an enabling rationale is preserved verbatim');
  assert.equal(pd.tickets['T-02'].state, 'unresolved', 'a ticket with no row is unclassified, not classified for the reader');
  assert.deepEqual(idsOf(pd), ['S-02', 'S-03', 'T-02']);
  assert.equal(pd.authored.digest, coverage.readMap(partial, record).digest, 'the draft reports the authored map digest it read');

  // Candidate material is quoted with provenance, never promoted into a link.
  const c1 = pd.candidates.tickets['T-01'];
  assert.equal(c1.file, 'tickets/T-01-parse.md');
  assert.equal(c1.objective, 'Parse the inventory (fixture).');
  assert.deepEqual(c1.scenarios, ['S-01', 'S-02'], 'the ticket\'s own claim is reported');
  assert.equal(c1.verification, 'test "$(cat value.txt)" = good', 'its verification text is quoted verbatim');
  assert.deepEqual(pd.scenarios['S-02'].tickets, [], 'the claim did NOT become a link');
  // T-03 says "Implements: none (enables T-01, T-02)" — ticket IDs on a claim line are
  // not scenario claims, and an ID the inventory does not define is not reported.
  assert.deepEqual(pd.candidates.tickets['T-03'].scenarios, [], 'ticket IDs on the claim line are not read as scenarios');
  assert.deepEqual(pd.candidates.tickets['T-03'].implements, []);

  // Determinism: identical authored inputs produce byte-identical drafts, and the
  // draft body carries no timestamp that could make two calls differ.
  const partialProject = project({ map: `${JSON.stringify(partialDoc, null, 2)}\n` });
  const a = cli(partialProject, ['coverage', 'scaffold', '--change', 'prd-v1', '--json']);
  const b = cli(partialProject, ['coverage', 'scaffold', '--change', 'prd-v1', '--json']);
  assert.equal(a.status, 0, a.stderr);
  assert.equal(a.stdout, b.stdout, 'repeated calls with identical inputs are byte-identical');
  assert.ok(!/\d{4}-\d{2}-\d{2}T/.test(a.stdout), 'the draft body carries no timestamp');
  const human = cli(partialProject, ['coverage', 'scaffold', '--change', 'prd-v1']);
  assert.equal(human.status, 0);
  assert.equal(human.stdout, cli(partialProject, ['coverage', 'scaffold', '--change', 'prd-v1']).stdout);
  // Unresolved entries are visibly marked in the human rendering.
  assert.match(human.stdout, /\?\s+S-02/, 'an unresolved scenario is marked');
  assert.match(human.stdout, /^ {4}S-01/m, 'an authored scenario is not marked unresolved');
  assert.match(human.stdout, /Unresolved 3/);

  // A stale row — a map naming a scenario the PRD no longer defines — is preserved and
  // flagged, never deleted: dropping an obligation is a decision with its own gate.
  const staleDoc = JSON.parse(complete);
  staleDoc.scenarios['S-09'] = { tickets: ['T-01'], checks: ['C-01'] };
  const stale = fixture({ map: `${JSON.stringify(staleDoc, null, 2)}\n` });
  const sd = scaffold.build(stale, record).draft;
  assert.ok(sd.scenarios['S-09'], 'the stale row survives');
  assert.deepEqual(sd.scenarios['S-09'].tickets, ['T-01'], 'its authored links survive');
  assert.equal(sd.scenarios['S-09'].requirement, null);
  assert.ok(sd.unresolved.some(u => u.code === 'SCENARIO_STALE' && u.id === 'S-09'));
}

// --- S-11: refusals happen before any read goes further, and nothing is written ------
{
  // A map that cannot be interpreted is a hard refusal: silently dropping authored
  // content is the one failure this command must never have.
  const malformed = project({ map: '{ "schema": 1, ' });
  const m = cli(malformed, ['coverage', 'scaffold', '--change', 'prd-v1']);
  assert.equal(m.status, 4, 'malformed JSON exits 4');
  assert.match(m.stderr, /COVERAGE_INVALID/);
  assert.match(m.stderr, /malformed JSON/);
  assert.equal(m.stdout, '', 'no draft is printed for an unreadable map');

  const duplicate = project({ map: complete.replace('"scope": {', '"scenarios": { "S-01": { "tickets": [], "checks": [] } },\n  "scope": {') });
  assert.match(cli(duplicate, ['coverage', 'scaffold', '--change', 'prd-v1']).stderr, /duplicate key/);

  const unsupported = project({ map: complete.replace('"schema": 1', '"schema": 2') });
  const u = cli(unsupported, ['coverage', 'scaffold', '--change', 'prd-v1']);
  assert.equal(u.status, 4);
  assert.match(u.stderr, /unsupported coverage map schema 2/);

  // A ticket of another PRD is not this change's ticket.
  const foreign = fixture({ tickets: { 'tickets/T-09-other.md': read(fx, 'strict/tickets/T-01-parse.md').replace('ticket: T-01', 'ticket: T-09').replace('.prd/prd-v1.md', '.prd/prd-v2.md') } });
  write(foreign, '.prd/prd-v2.md', '---\nversion: 2\nstatus: ticketed\ndate: 2026-09-14\n---\n# Other\n');
  const f = scaffold.build(foreign, record);
  assert.ok(f.ok, JSON.stringify(f.problems));
  assert.ok(!f.draft.tickets['T-09'], 'a ticket of another PRD is not listed as this change\'s ticket');
  assert.ok(!f.draft.candidates.tickets['T-09']);
  // ...but a map row naming it is authored content, preserved and flagged.
  const foreignRow = fixture({ map: complete.replace('"T-03": {', '"T-09": { "role": "implements", "rationale": null },\n    "T-03": {'), tickets: { 'tickets/T-09-other.md': read(fx, 'strict/tickets/T-01-parse.md').replace('ticket: T-01', 'ticket: T-09').replace('.prd/prd-v1.md', '.prd/prd-v2.md') } });
  write(foreignRow, '.prd/prd-v2.md', '---\nversion: 2\nstatus: ticketed\ndate: 2026-09-14\n---\n# Other\n');
  const fr = scaffold.build(foreignRow, record).draft;
  assert.equal(fr.tickets['T-09'].state, 'unresolved');
  assert.ok(fr.unresolved.some(u => u.code === 'TICKET_FOREIGN' && u.id === 'T-09'), 'a foreign ticket row is named as foreign');

  // An invalid inventory is refused before the map is considered.
  const badPrd = project({ map: complete, prd: read(fx, 'invalid/prd/orphan-scenario.md') });
  const bp = cli(badPrd, ['coverage', 'scaffold', '--change', 'prd-v1']);
  assert.equal(bp.status, 4);
  assert.match(bp.stderr, /INVENTORY_INVALID/);

  // An invalid ticket set is refused too.
  const badTicket = project({ map: complete });
  write(badTicket, 'tickets/T-02-diagnostics.md', 'not a ticket');
  assert.match(cli(badTicket, ['coverage', 'scaffold', '--change', 'prd-v1']).stderr, /INPUT_INVALID/);

  // Containment: a symlinked map escapes the tree and is refused, not followed.
  const escaping = project();
  const outside = tempDir();
  fs.writeFileSync(path.join(outside, 'elsewhere.json'), complete);
  fs.mkdirSync(path.join(escaping, '.prd/coverage'), { recursive: true });
  fs.symlinkSync(path.join(outside, 'elsewhere.json'), path.join(escaping, '.prd/coverage/prd-v1.json'));
  const esc = cli(escaping, ['coverage', 'scaffold', '--change', 'prd-v1']);
  assert.equal(esc.status, 4, 'a symlinked map is refused');
  assert.match(esc.stderr, /symbolic link/);
  assert.equal(esc.stdout, '');

  // Usage errors, before anything is read.
  const dir = project({ map: complete });
  const noChange = cli(dir, ['coverage', 'scaffold']);
  assert.equal(noChange.status, 2);
  assert.match(noChange.stderr, /coverage scaffold requires --change <id>/);
  const positional = cli(dir, ['coverage', 'scaffold', '--change', 'prd-v1', 'extra']);
  assert.equal(positional.status, 2);
  assert.match(positional.stderr, /unexpected argument extra/);
  const unknown = cli(dir, ['coverage', 'scaffold', '--change', 'prd-v1', '--apply']);
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /unknown option --apply/);

  // Read-only, over the whole tree, for every one of the calls above.
  const readOnly = project({ map: complete });
  const before = snapshotTree(readOnly);
  for (const args of [['coverage', 'scaffold', '--change', 'prd-v1'], ['coverage', 'scaffold', '--change', 'prd-v1', '--json'], ['coverage', 'scaffold', '--change', 'missing']]) cli(readOnly, args);
  assert.deepEqual(snapshotTree(readOnly), before, 'no call writes, adopts, selects or launches anything');
  // The tree snapshot already covers `.pincer/`; name the two things that would appear
  // if the draft ever launched or adopted anything, so a regression says which it was.
  // `register` creates the empty runtime skeleton, so the claim is that it stays empty.
  assert.deepEqual(fs.readdirSync(path.join(readOnly, '.pincer/runtime/attempts')), [], 'scaffolding records no attempt');
  assert.ok(!fs.existsSync(path.join(readOnly, '.pincer/backups')), 'scaffolding adopts nothing, so it backs up nothing');
}

// --- S-12: a draft is not a map and confers no readiness ----------------------------
{
  const dir = project({ map: complete });
  const json = cli(dir, ['coverage', 'scaffold', '--change', 'prd-v1', '--json']);
  assert.equal(json.status, 0, json.stderr);
  const draft = JSON.parse(json.stdout);
  assert.equal(draft.draft, 1);
  assert.equal(draft.kind, 'coverage-draft');
  assert.ok(!('schema' in draft), 'the draft envelope carries no map schema');
  assert.deepEqual(draft.unresolved, [], 'the complete fixture map leaves nothing unresolved');

  // Saved in the map's place, every gate that reads a map refuses it.
  const posing = fixture({ map: json.stdout });
  const asMap = coverage.readMap(posing, record);
  assert.equal(asMap.ok, false);
  assert.equal(asMap.code, 'COVERAGE_INVALID');
  assert.match(asMap.problems[0], /unsupported coverage map schema undefined/);
  const load = coverage.load(posing, record);
  assert.equal(load.ok, false);
  assert.equal(load.code, 'COVERAGE_INVALID');
  // ...including the adoption gate, which is the one that could grant strict coverage.
  const adopt = require(path.join(repo, 'template/scripts/pincer-runtime/adopt.cjs'));
  const changes = require(path.join(repo, 'template/scripts/pincer-runtime/changes.cjs'));
  const posed = project({ map: json.stdout });
  const preview = cli(posed, ['coverage', 'adopt', '--preview', '--change', 'prd-v1']);
  assert.equal(preview.status, 1, 'adoption of a draft is a conflict');
  assert.match(preview.stdout, /COVERAGE_INVALID/);
  assert.ok(!changes.isStrict(changes.loadRecord(posed, 'prd-v1').record), 'the change did not become strict');

  // The authored map, by contrast, passes the existing validator and adoption gates,
  // and editing the inputs afterwards still yields the stale-agreement refusal.
  write(posed, '.prd/coverage/prd-v1.json', complete);
  run(posed, 'git', ['add', '-A']);
  run(posed, 'git', ['commit', '-q', '-m', 'author the map']);
  assert.equal(coverage.load(posed, changes.loadRecord(posed, 'prd-v1').record).code, null, 'the authored map validates');
  const applied = cli(posed, ['coverage', 'adopt', '--apply', '--change', 'prd-v1']);
  assert.equal(applied.status, 0, applied.stderr);
  const strict = changes.loadRecord(posed, 'prd-v1').record;
  assert.ok(changes.isStrict(strict), 'the authored map adopts');
  // A draft never granted this: adoption required the real map and its own command.
  const digest = strict.agreements.at(-1).digest;
  assert.equal(cli(posed, ['change', 'authorize', 'prd-v1', '--agreement', digest, '--reference', 'op', '--excerpt', 'go']).status, 0);
  // Editing the PRD after authorization changes the agreement: the gate still refuses.
  // Inside R-02, so the new scenario is a definition rather than an orphan.
  write(posed, '.prd/prd-v1.md', read(posed, '.prd/prd-v1.md').replace('## 7. Out of Scope', '- **S-04:** A later scenario, added after the agreement was authorized.\n\n## 7. Out of Scope'));
  assert.equal(cli(posed, ['change', 'select', 'prd-v1']).status, 0);
  const after = cli(posed, ['resume', '--json']);
  const report = JSON.parse(after.stdout);
  assert.equal(report.agreement.verdict, 'AGREEMENT_CHANGED', 'the stale-agreement refusal survives scaffolding');
  // ...and the draft now reports the new scenario as unresolved rather than covering it.
  const afterDraft = JSON.parse(cli(posed, ['coverage', 'scaffold', '--change', 'prd-v1', '--json']).stdout);
  assert.equal(afterDraft.scenarios['S-04'].state, 'unresolved');
  assert.ok(afterDraft.unresolved.some(u => u.id === 'S-04'), 'the draft never claims the new scenario is covered');
  assert.match(cli(posed, ['coverage', 'scaffold', '--change', 'prd-v1']).stdout, /This is a draft, not a coverage map/);
}

console.log('coverage scaffold tests passed');
