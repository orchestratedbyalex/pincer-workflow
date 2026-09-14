// PRD v6 T-68 (R-02, S-04..S-06): the coverage map is loaded strictly and resolved
// against the live inventory and the change's tickets into one validated graph.
// Omitted or invented rows, missing/wrong-change tickets and undeclared checks block
// with the exact IDs; shared checks, several tickets per scenario and a classified
// enabling ticket validate; malformed or duplicate-key JSON, unknown schemas and keys,
// duplicate entries and unsafe paths fail before anything is launched or written.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir, write, read, createTicket, createPrd } from './helpers.js';

const require = createRequire(import.meta.url);
const coverage = require(path.join(repo, 'template/scripts/pincer-runtime/coverage.cjs'));
const requirements = require(path.join(repo, 'template/scripts/pincer-runtime/requirements.cjs'));
const parse = require(path.join(repo, 'template/scripts/pincer-runtime/parse.cjs'));
const fx = path.join(repo, 'test/fixtures/prd-v6');
const record = { change: 'prd-v1', prd: '.prd/prd-v1.md', agreements: [] };
const snapshotTree = dir => {
  const out = {};
  const walk = rel => { for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) { const next = rel ? `${rel}/${e.name}` : e.name; if (e.isDirectory()) walk(next); else out[next] = fs.readFileSync(path.join(dir, next)).toString('base64'); } };
  walk(''); return out;
};
// A project carrying the strict fixture: PRD, tickets and map.
function fixture({ map = read(fx, 'strict/coverage/prd-v1.json') } = {}) {
  const dir = tempDir();
  write(dir, '.prd/prd-v1.md', read(fx, 'strict/prd-v1.md'));
  for (const f of fs.readdirSync(path.join(fx, 'strict/tickets'))) write(dir, `tickets/${f}`, read(fx, `strict/tickets/${f}`));
  write(dir, '.prd/coverage/prd-v1.json', map);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  return dir;
}
const detailsOf = result => result.graph ? result.graph.problems.map(p => p.detail) : result.problems;
const idsOf = result => result.graph.problems.flatMap(p => p.ids);

// --- S-05 (valid): shared checks, several tickets per scenario, an enabling ticket -----
{
  const dir = fixture();
  const before = snapshotTree(dir);
  const result = coverage.load(dir, record);
  assert.deepEqual(snapshotTree(dir), before, 'loading writes nothing');
  assert.ok(result.ok, JSON.stringify(result.problems));
  assert.equal(result.code, null);
  const g = result.graph;
  assert.ok(g.complete);
  assert.deepEqual(Object.keys(g.scenarios), ['S-01', 'S-02']);
  assert.deepEqual(g.scenarios['S-02'], { id: 'S-02', requirement: 'R-01', tickets: ['T-01', 'T-02'], checks: ['C-01', 'C-02'] }, 'several tickets and checks on one scenario');
  assert.deepEqual(g.checks['C-01'].scenarios, ['S-01', 'S-02'], 'a shared check resolves to both scenarios');
  assert.deepEqual(g.checks['C-02'].scenarios, ['S-02']);
  assert.equal(g.checks['C-01'].digest, parse.sha256('test "$(cat value.txt)" = good\ntimeout=60\n'), 'a command declaration digest is the attempt check digest');
  assert.equal(g.checks['C-02'].digest, parse.sha256('review\nread the diagnostic wording of S-02 against the PRD\n'), 'a review declaration digest');
  assert.deepEqual(g.tickets['T-01'].scenarios, ['S-01', 'S-02']); assert.equal(g.tickets['T-01'].role, 'implements');
  assert.deepEqual(g.tickets['T-03'], { id: 'T-03', role: 'enables', rationale: 'shared fixture harness used by C-01 and C-02; implements no scenario', scenarios: [], present: true, other: null }, 'an enabling ticket with a rationale validates without a scenario');
  assert.deepEqual(g.scope['S-03'], { id: 'S-03', requirement: 'R-02', disposition: 'deferred', decision: 'D-01', prior: null, note: 'deferred to the next change', live: true });
  assert.equal(result.map.digest, coverage.digestOf(result.map.normalized));
  assert.equal(Object.keys(result.tickets).length, 3);
  // The normalized text is stable under reformatting and reordering, not under value edits.
  const reformatted = JSON.stringify({ ...JSON.parse(result.map.text), scenarios: { 'S-02': { checks: ['C-02', 'C-01'], tickets: ['T-02', 'T-01'] }, 'S-01': { checks: ['C-01'], tickets: ['T-01'] } } }, null, 4);
  const dir2 = fixture({ map: reformatted });
  assert.equal(coverage.load(dir2, record).map.digest, result.map.digest, 'reformatting and reordering keep the map digest');
  const edited = fixture({ map: result.map.text.replace('"timeout": 60', '"timeout": 61') });
  assert.notEqual(coverage.load(edited, record).map.digest, result.map.digest, 'a value edit changes the map digest');
  assert.equal(coverage.validateText(result.map.text, { change: 'prd-v1', prd: '.prd/prd-v1.md' }).digest, result.map.digest, 'a snapshot text validates to the same digest');
}

// --- S-04: omitted or invented rows, missing/wrong-change tickets, undeclared checks -----
{
  const base = read(fx, 'strict/coverage/prd-v1.json');
  const cases = [
    ['a scenario row removed from the map', base.replace('"S-01": { "tickets": ["T-01"], "checks": ["C-01"] },\n', ''), /^S-01 has no row in scenarios or scope$/, ['S-01']],
    ['an invented ID', base.replace('"S-02": {', '"S-08": { "tickets": ["T-01"], "checks": ["C-01"] },\n    "S-02": {'), /^S-08 is not a scenario of the inventory$/, ['S-08']],
    ['a requirement used as a scenario', base.replace('"S-02": {', '"R-01": { "tickets": ["T-01"], "checks": ["C-01"] },\n    "S-02": {'), /^R-01 is not a scenario of the inventory \(a requirement is covered through its scenarios\)$/, ['R-01']],
    ['a missing ticket', base.replace('"tickets": ["T-01"], "checks": ["C-01"]', '"tickets": ["T-09"], "checks": ["C-01"]'), /^S-01: ticket T-09 is not a ticket of this change \(no such ticket file\)$/, ['S-01', 'T-09']],
    ['an undeclared check', base.replace('"checks": ["C-01", "C-02"]', '"checks": ["C-01", "C-07"]'), /^S-02: check C-07 is not declared$/, ['C-07', 'S-02']],
  ];
  for (const [label, map, pattern, ids] of cases) {
    const dir = fixture({ map });
    const result = coverage.load(dir, record);
    assert.equal(result.ok, false, label); assert.equal(result.code, 'COVERAGE_INCOMPLETE', label);
    const hit = result.graph.problems.find(p => pattern.test(p.detail));
    assert.ok(hit, `${label}: ${JSON.stringify(detailsOf(result))}`);
    assert.deepEqual(hit.ids, ids, `${label}: exact affected IDs`);
    assert.ok(result.inventory && result.map, `${label}: the inputs stay usable for the agreement`);
  }
  // A ticket of another change linked from a scenario is named with WRONG_CHANGE.
  const dir = fixture({ map: base.replace('"tickets": ["T-01"], "checks": ["C-01"]', '"tickets": ["T-01", "T-04"], "checks": ["C-01"]').replace('"T-03": {', '"T-04": { "role": "implements", "rationale": null },\n    "T-03": {') });
  createPrd(dir, 2); createTicket(dir, { id: 'T-04', prd: '.prd/prd-v2.md' });
  const wrong = coverage.load(dir, record);
  assert.equal(wrong.code, 'COVERAGE_INCOMPLETE');
  assert.ok(detailsOf(wrong).includes('S-01: ticket T-04 is not a ticket of this change (WRONG_CHANGE: it belongs to .prd/prd-v2.md)'), JSON.stringify(detailsOf(wrong)));
  assert.ok(detailsOf(wrong).includes('T-04 is listed in tickets but is not a ticket of this change (WRONG_CHANGE: it belongs to .prd/prd-v2.md)'));
  // A scenario removed from the PRD leaves a stale row: named, never silently dropped.
  const stale = fixture();
  write(stale, '.prd/prd-v1.md', read(stale, '.prd/prd-v1.md').replace('- [x] **S-02:** Duplicate IDs cause an actionable diagnostic.\n', ''));
  const staleResult = coverage.load(stale, record);
  assert.equal(staleResult.code, 'COVERAGE_INCOMPLETE');
  assert.deepEqual(staleResult.graph.problems.map(p => p.detail), ['S-02 is not a scenario of the inventory']);
  // A whole requirement removed from the PRD: its deferred scope row is stale too.
  const gone = fixture();
  write(gone, '.prd/prd-v1.md', read(gone, '.prd/prd-v1.md').replace(/### R-02: Report impact[\s\S]*?requirement\.\n/, ''));
  const goneResult = coverage.load(gone, record);
  assert.deepEqual(goneResult.graph.problems.map(p => p.ids), [['S-03']]);
  assert.match(goneResult.graph.problems[0].detail, /^S-03 is not a scenario of the inventory \(a deferral applies to a defined scenario; a withdrawn one needs a removed tombstone\)$/);
  // Every invalid-fixture expectation for COVERAGE_INCOMPLETE holds against the real files.
  const expected = JSON.parse(read(fx, 'invalid/coverage/expected.json'));
  for (const [file, detail] of Object.entries(expected.COVERAGE_INCOMPLETE)) {
    const result = coverage.load(fixture({ map: read(fx, `invalid/coverage/${file}`) }), record);
    assert.equal(result.code, 'COVERAGE_INCOMPLETE', file);
    assert.ok(detailsOf(result).some(d => d.startsWith(detail)), `${file}: expected "${detail}", got ${JSON.stringify(detailsOf(result))}`);
    assert.ok(idsOf(result).length > 0, `${file}: affected IDs are listed`);
  }
}

// --- S-05 (invalid): an unclassified ticket, a scenario without work or check, roles -----
{
  const base = read(fx, 'strict/coverage/prd-v1.json');
  const unclassified = coverage.load(fixture({ map: base.replace(',\n    "T-03": { "role": "enables", "rationale": "shared fixture harness used by C-01 and C-02; implements no scenario" }', '') }), record);
  assert.deepEqual(unclassified.graph.problems, [{ code: 'COVERAGE_INCOMPLETE', detail: 'T-03 is not classified (every ticket of the change is listed with role implements or enables)', ids: ['T-03'] }]);
  const noWork = coverage.load(fixture({ map: base.replace('"S-01": { "tickets": ["T-01"], "checks": ["C-01"] }', '"S-01": { "tickets": [], "checks": [] }') }), record);
  assert.deepEqual(noWork.graph.problems.map(p => p.detail), ['S-01: no implementing ticket', 'S-01: no candidate check']);
  const enablesLinked = coverage.load(fixture({ map: base.replace('"tickets": ["T-01"], "checks": ["C-01"]', '"tickets": ["T-01", "T-03"], "checks": ["C-01"]') }), record);
  assert.deepEqual(enablesLinked.graph.problems.map(p => p.detail), ['S-01: ticket T-03 is classified enables, but the scenario links it as implementation', 'T-03 is classified enables but S-01 links it as implementation']);
  const idleImplements = coverage.load(fixture({ map: base.replace('"T-03": { "role": "enables", "rationale": "shared fixture harness used by C-01 and C-02; implements no scenario" }', '"T-03": { "role": "implements", "rationale": null }') }), record);
  assert.deepEqual(idleImplements.graph.problems.map(p => p.detail), ['T-03 is classified implements but no scenario links it (classify it enables with a rationale, or link it)']);
  const emptyRationale = coverage.readMap(fixture({ map: base.replace('"rationale": "shared fixture harness used by C-01 and C-02; implements no scenario"', '"rationale": " "') }), record);
  assert.equal(emptyRationale.code, 'COVERAGE_INVALID'); assert.match(emptyRationale.problems[0], /T-03: an enabling ticket needs a nonempty rationale/);
  // A removed tombstone is checked against the prior agreement's inventory when one is supplied.
  const tomb = base.replace('"S-03": { "disposition": "deferred", "decision": "D-01", "prior": null, "note": "deferred to the next change" }', '"S-03": { "disposition": "removed", "decision": "D-01", "prior": "G-01", "note": null }');
  const withoutPrior = coverage.load(fixture({ map: tomb }), record);
  assert.ok(withoutPrior.ok, 'shape-only when no prior reader is supplied');
  const priorInventory = gid => (gid === 'G-01' ? { scenarios: { 'S-01': { requirement: 'R-01' } } } : null);
  const priorMissing = coverage.load(fixture({ map: tomb }), record, { priorInventory });
  assert.deepEqual(priorMissing.graph.problems.map(p => p.detail), ['S-03: prior agreement G-01 does not define S-03']);
  const priorUnknown = coverage.load(fixture({ map: tomb.replace('"prior": "G-01"', '"prior": "G-02"') }), record, { priorInventory });
  assert.deepEqual(priorUnknown.graph.problems.map(p => p.detail), ['S-03: prior agreement G-02 is not a retained agreement with an inventory snapshot']);
  const priorOk = coverage.load(fixture({ map: tomb }), record, { priorInventory: () => ({ scenarios: { 'S-03': { requirement: 'R-02' } } }) });
  assert.ok(priorOk.ok); assert.equal(priorOk.graph.scope['S-03'].disposition, 'removed');
  // A tombstone for an ID the PRD no longer defines is resolved through its prior inventory.
  const gone = fixture({ map: tomb });
  write(gone, '.prd/prd-v1.md', read(gone, '.prd/prd-v1.md').replace(/### R-02: Report impact[\s\S]*?requirement\.\n/, ''));
  const goneOk = coverage.load(gone, record, { priorInventory: () => ({ scenarios: { 'S-03': { requirement: 'R-02' } } }) });
  assert.ok(goneOk.ok, JSON.stringify(goneOk.problems)); assert.deepEqual(goneOk.graph.scope['S-03'], { id: 'S-03', requirement: 'R-02', disposition: 'removed', decision: 'D-01', prior: 'G-01', note: null, live: false });
}

// --- S-06: malformed structure fails before mutation or launch -----------------------------
{
  const expected = JSON.parse(read(fx, 'invalid/coverage/expected.json'));
  for (const [file, detail] of Object.entries(expected.COVERAGE_INVALID)) {
    const dir = fixture({ map: read(fx, `invalid/coverage/${file}`) });
    const before = snapshotTree(dir);
    const result = coverage.load(dir, record);
    assert.equal(result.code, 'COVERAGE_INVALID', file);
    assert.ok(result.problems[0].includes(detail), `${file}: expected "${detail}", got ${result.problems[0]}`);
    assert.ok(result.problems[0].startsWith('.prd/coverage/prd-v1.json: '), `${file}: names the file`);
    assert.ok(!result.graph && !result.map, `${file}: nothing usable is returned`);
    assert.deepEqual(snapshotTree(dir), before, `${file}: nothing written`);
  }
  // JSON.parse would swallow the duplicate key; the strict parser refuses it, and every other JSON form is exact.
  assert.throws(() => coverage.parseStrict('{"a": 1, "a": 2}'), /duplicate key "a"/);
  assert.throws(() => coverage.parseStrict('{"a": {"b": 1, "b": 1}}'), /duplicate key "b"/);
  assert.throws(() => coverage.parseStrict('{"a": 1} x'), /trailing characters/);
  assert.throws(() => coverage.parseStrict('{"a": 01}'), /expected "," or "}"/);
  assert.throws(() => coverage.parseStrict("{'a': 1}"), /expected a string key/);
  assert.deepEqual(coverage.parseStrict(' {"a": [1, -2.5e3, "x\\n\\u0041", true, false, null, {}], "b": []} '), { a: [1, -2500, 'x\nA', true, false, null, {}], b: [] });
  // Paths: the map itself, and a command cwd, must be regular files/directories inside the repository, never symlinks.
  const linked = fixture();
  const outside = tempDir(); write(outside, 'map.json', read(fx, 'strict/coverage/prd-v1.json'));
  fs.rmSync(path.join(linked, '.prd/coverage/prd-v1.json')); fs.symlinkSync(path.join(outside, 'map.json'), path.join(linked, '.prd/coverage/prd-v1.json'));
  const viaLink = coverage.readMap(linked, record);
  assert.equal(viaLink.code, 'COVERAGE_INVALID'); assert.match(viaLink.problems[0], /is a symbolic link/);
  const linkedDir = fixture(); fs.rmSync(path.join(linkedDir, '.prd/coverage'), { recursive: true }); fs.symlinkSync(outside, path.join(linkedDir, '.prd/coverage'));
  assert.match(coverage.readMap(linkedDir, record).problems[0], /path component \.prd\/coverage is a symbolic link/);
  const base = read(fx, 'strict/coverage/prd-v1.json');
  const cwdOk = fixture({ map: base.replace('"cwd": null, "obligation": null', '"cwd": "src", "obligation": null') });
  assert.ok(coverage.load(cwdOk, record).ok, 'an existing directory is a valid cwd');
  const cwdMissing = fixture({ map: base.replace('"cwd": null, "obligation": null', '"cwd": "nope", "obligation": null') });
  assert.match(coverage.readMap(cwdMissing, record).problems[0], /C-01: cwd nope: missing/);
  const cwdLink = fixture({ map: base.replace('"cwd": null, "obligation": null', '"cwd": "link", "obligation": null') });
  fs.symlinkSync(outside, path.join(cwdLink, 'link'));
  assert.match(coverage.readMap(cwdLink, record).problems[0], /C-01: cwd link: is a symbolic link/);
  const cwdFile = fixture({ map: base.replace('"cwd": null, "obligation": null', '"cwd": "value.txt", "obligation": null') }); write(cwdFile, 'value.txt', 'good\n');
  assert.match(coverage.readMap(cwdFile, record).problems[0], /C-01: cwd value.txt: not a directory/);
  for (const bad of ['/abs', 'a/../b', 'a\\b', 'C:x', './a']) assert.ok(coverage.unsafePath(bad), `${bad} is unsafe`);
  assert.equal(coverage.unsafePath('a/b'), null);
  // Bounds: an oversized file, an oversized string, too many entries, a bad ID.
  const big = fixture({ map: base.replace('"note": null }\n  }\n}', `"note": ${JSON.stringify('x'.repeat(coverage.MAX_BYTES))} }\n  }\n}`) });
  assert.match(coverage.readMap(big, record).problems[0], /larger than 1048576 bytes/);
  const longText = fixture({ map: base.replace('"note": null }\n  }\n}', `"note": ${JSON.stringify('x'.repeat(2001))} }\n  }\n}`) });
  assert.match(coverage.readMap(longText, record).problems[0], /C-02: note must be null or a short string/);
  const badId = fixture({ map: base.replace('"S-01":', '"s-01":') });
  assert.match(coverage.readMap(badId, record).problems[0], /scenarios: "s-01" is not a valid ID/);
  const both = fixture({ map: base.replace('"scope": {', '"scope": {\n    "S-01": { "disposition": "deferred", "decision": "D-02", "prior": null, "note": null },') });
  assert.match(coverage.readMap(both, record).problems[0], /S-01: appears in both scenarios and scope/);
  const wrongChange = coverage.readMap(fixture(), { change: 'other', prd: '.prd/prd-v1.md' });
  assert.match(wrongChange.problems[0], /missing — author \.prd\/coverage\/other\.json first/);
  const wrongId = coverage.readMap(fixture({ map: base.replace('"change": "prd-v1"', '"change": "other"') }), record);
  assert.match(wrongId.problems[0], /change must be "prd-v1" \(got "other"\)/);
  const badBash = coverage.readMap(fixture({ map: base.replace('"command": "test \\"$(cat value.txt)\\" = good"', '"command": "if then"') }), record);
  assert.match(badBash.problems[0], /C-01: invalid bash syntax in command/);
  const reviewWithCommand = coverage.readMap(fixture({ map: base.replace('"kind": "review", "required": true, "command": null', '"kind": "review", "required": true, "command": "true"') }), record);
  assert.match(reviewWithCommand.problems[0], /C-02: command is null for a review check/);
  // An invalid inventory or an invalid ticket set is reported before the map is read.
  const badPrd = fixture(); write(badPrd, '.prd/prd-v1.md', read(fx, 'invalid/prd/orphan-scenario.md'));
  assert.equal(coverage.load(badPrd, record).code, 'INVENTORY_INVALID');
  const badTicket = fixture(); write(badTicket, 'tickets/T-02-diagnostics.md', 'not a ticket');
  const bt = coverage.load(badTicket, record); assert.equal(bt.code, 'INPUT_INVALID'); assert.match(bt.problems[0], /^pincer-ticket: tickets\/T-02-diagnostics\.md: /);
  assert.ok(bt.inventory && bt.map, 'the inventory and the map were read before the ticket set failed');
}
console.log('coverage map tests passed');
