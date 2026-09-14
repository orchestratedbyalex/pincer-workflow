// PRD v6 T-67 (R-01, S-01..S-03): the requirement inventory is derived from real
// Markdown files under the frozen grammar — exact membership, owners, source spans
// and digests; references, tables and fenced examples define nothing; malformed
// inventories are refused with the contracted diagnostic and never returned partially;
// lifecycle and checkbox edits preserve identity while behavior changes do not; old
// PRDs stay readable without a strict verdict.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir, write, read, run, createPrd } from './helpers.js';

const require = createRequire(import.meta.url);
const requirements = require(path.join(repo, 'template/scripts/pincer-runtime/requirements.cjs'));
const parse = require(path.join(repo, 'template/scripts/pincer-runtime/parse.cjs'));
const runtime = path.join(repo, 'template/scripts/pincer-runtime.cjs');
const fx = path.join(repo, 'test/fixtures/prd-v6');
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const fileDigest = file => sha(fs.readFileSync(file));
const strictFile = path.join(fx, 'strict/prd-v1.md');
const strictText = fs.readFileSync(strictFile, 'utf8');
const lineOf = (text, needle) => text.split('\n').findIndex(l => l.includes(needle)) + 1;

// --- S-01: exact inventory from a real file ------------------------------------------
{
  const before = fileDigest(strictFile);
  const result = requirements.parseFile(strictFile, '.prd/prd-v1.md');
  assert.equal(fileDigest(strictFile), before, 'parsing writes nothing');
  assert.ok(result.ok, JSON.stringify(result.problems));
  const inv = result.inventory;
  assert.deepEqual(Object.keys(inv.requirements), ['R-01', 'R-02'], 'exactly two requirements');
  assert.deepEqual(Object.keys(inv.scenarios), ['S-01', 'S-02', 'S-03'], 'exactly three scenarios');
  assert.deepEqual(inv.requirements['R-01'].scenarios, ['S-01', 'S-02']);
  assert.deepEqual(inv.requirements['R-02'].scenarios, ['S-03']);
  for (const [id, owner] of [['S-01', 'R-01'], ['S-02', 'R-01'], ['S-03', 'R-02']]) assert.equal(inv.scenarios[id].requirement, owner, `${id} belongs to ${owner}`);
  // Source spans: the heading line to the last nonblank line of the section; the item line to its last continuation line.
  assert.equal(inv.requirements['R-01'].line, lineOf(strictText, '### R-01 — Parse the inventory'));
  assert.equal(inv.requirements['R-02'].line, lineOf(strictText, '### R-02: Report impact'));
  assert.equal(inv.requirements['R-02'].end, lineOf(strictText, '- **S-03** — Changing'), 'R-02 ends at its last nonblank line');
  assert.equal(inv.scenarios['S-01'].line, lineOf(strictText, '- **S-01:** A PRD with two requirements'));
  assert.equal(inv.scenarios['S-01'].end, inv.scenarios['S-01'].line + 1, 'S-01 spans its continuation line');
  assert.equal(inv.scenarios['S-02'].line, lineOf(strictText, '- [x] **S-02:**')); assert.equal(inv.scenarios['S-02'].end, inv.scenarios['S-02'].line);
  assert.equal(inv.scenarios['S-03'].line, lineOf(strictText, '- **S-03** — Changing'));
  // Normalized content and digests follow the contract formulas exactly.
  assert.equal(inv.scenarios['S-01'].text, 'A PRD with two requirements and three scenarios yields exactly those\nIDs, parent links, content digests and source locations.');
  assert.equal(inv.scenarios['S-02'].text, 'Duplicate IDs cause an actionable diagnostic.', 'the checkbox mark, marker and bold ID are removed');
  assert.equal(inv.scenarios['S-03'].text, 'Changing one scenario names that scenario and its requirement.', 'an em-dash separator after the bold ID is accepted');
  for (const [id, s] of Object.entries(inv.scenarios)) assert.equal(s.digest, sha(`scenario ${id}\n${s.text}\n`), `${id} digest formula`);
  assert.equal(inv.requirements['R-01'].title, 'Parse the inventory');
  assert.match(inv.requirements['R-01'].text, /^Parse the inventory\n\nEvery definition is derived from the PRD prose\. S-01 and S-02 belong here\.\n\n\| Scenario \| Ticket \|/, 'requirement text: title, then the section outside scenario definitions (table rows included)');
  assert.match(inv.requirements['R-01'].text, /```markdown\n- \*\*S-99:\*\* an example inside a fence is not a definition\n### R-99 — neither is a heading inside a fence\n```$/, 'fenced example text is part of the requirement, not a definition');
  assert.doesNotMatch(inv.requirements['R-01'].text, /\*\*S-01:\*\*|\*\*S-02:\*\*/, 'scenario definitions are not requirement text');
  for (const [id, r] of Object.entries(inv.requirements)) assert.equal(r.digest, sha(`requirement ${id}\n${r.text}\n`), `${id} digest formula`);
  for (const id of ['S-99', 'R-99', 'S-04']) assert.ok(!inv.requirements[id] && !inv.scenarios[id], `${id} is a reference, not a definition`);
  assert.equal(inv.projection, ['pincer inventory 1', 'prd .prd/prd-v1.md', `requirement R-01 ${inv.requirements['R-01'].digest}`, `requirement R-02 ${inv.requirements['R-02'].digest}`, `scenario S-01 R-01 ${inv.scenarios['S-01'].digest}`, `scenario S-02 R-01 ${inv.scenarios['S-02'].digest}`, `scenario S-03 R-02 ${inv.scenarios['S-03'].digest}`, ''].join('\n'), 'the exact projection text');
  assert.equal(inv.digest, sha(inv.projection));
  // The snapshot shape validates and recomputes; a tampered text is caught.
  const snap = requirements.snapshotOf(inv);
  assert.equal(requirements.validateSnapshot(snap, '.prd/prd-v1.md'), null);
  assert.match(requirements.validateSnapshot({ ...snap, scenarios: { ...snap.scenarios, 'S-01': { ...snap.scenarios['S-01'], text: 'changed' } } }, '.prd/prd-v1.md'), /S-01 text does not hash/);
  assert.match(requirements.validateSnapshot({ ...snap, digest: sha('x') }, '.prd/prd-v1.md'), /digest does not match/);
  // readInventory goes through the PRD validator first.
  const dir = tempDir();
  write(dir, '.prd/prd-v1.md', strictText);
  const viaRepo = requirements.readInventory(dir, '.prd/prd-v1.md');
  assert.ok(viaRepo.ok); assert.equal(viaRepo.inventory.digest, inv.digest);
  assert.equal(run(dir, process.execPath, [runtime, 'validate', '.prd/prd-v1.md']).status, 0, 'the old validator still accepts the strict PRD');
  // ID order: prefix in byte order, then numerically (supplied prefixes are kept verbatim).
  const supplied = requirements.parseInventory(`---\nversion: 1\nstatus: draft\n---\n## REQ-10 — Ten\n- **AC-2:** two\n- **AC-10:** ten\n## REQ-2 — Two\n- **AC-1:** one\n`, { prd: '.prd/prd-v1.md' });
  assert.ok(supplied.ok, JSON.stringify(supplied.problems));
  assert.deepEqual(Object.keys(supplied.inventory.requirements), ['REQ-2', 'REQ-10']);
  assert.deepEqual(Object.keys(supplied.inventory.scenarios), ['AC-1', 'AC-2', 'AC-10']);
  assert.deepEqual(supplied.inventory.requirements['REQ-10'].scenarios, ['AC-2', 'AC-10']);
}

// --- S-02: every malformed inventory is refused with the contracted diagnostic ---------
{
  const expected = JSON.parse(read(fx, 'invalid/prd/expected.json'));
  for (const [file, detail] of Object.entries(expected.files)) {
    const abs = path.join(fx, 'invalid/prd', file);
    const before = fileDigest(abs);
    const result = requirements.parseFile(abs, '.prd/prd-v1.md');
    assert.equal(result.ok, false, `${file} is refused`);
    assert.ok(!('inventory' in result), `${file}: no partial inventory is returned`);
    assert.ok(result.problems.includes(detail), `${file}: reports "${detail}" (got ${JSON.stringify(result.problems)})`);
    assert.equal(fileDigest(abs), before, `${file} is not mutated`);
    const dir = tempDir();
    write(dir, '.prd/prd-v1.md', fs.readFileSync(abs, 'utf8'));
    const viaRepo = requirements.readInventory(dir, '.prd/prd-v1.md');
    assert.equal(viaRepo.code, 'INVENTORY_INVALID');
    assert.equal(viaRepo.problems[0].startsWith('.prd/prd-v1.md: '), true, 'diagnostics name the file');
    assert.ok(viaRepo.problems.includes(`.prd/prd-v1.md: ${detail}`));
    assert.equal(run(dir, process.execPath, [runtime, 'validate', '.prd/prd-v1.md']).status, 0, `${file}: the frontmatter validator is unchanged (the grammar, not the metadata, fails)`);
  }
  // A PRD whose metadata is invalid is INPUT_INVALID before the grammar is read.
  const dir = tempDir();
  write(dir, '.prd/prd-v1.md', '---\nversion: 2\nstatus: ticketed\n---\n### R-01 — x\n- **S-01:** y\n');
  const bad = requirements.readInventory(dir, '.prd/prd-v1.md');
  assert.equal(bad.code, 'INPUT_INVALID'); assert.match(bad.problems[0], /version must match filename/);
  // Numbered list markers, level 1/5 headings and duplicate kinds are unsupported or duplicates, never silent.
  const numbered = requirements.parseInventory('---\nversion: 1\nstatus: draft\n---\n## R-01 — x\n1. **S-01:** one\n', {});
  assert.deepEqual(numbered.problems.filter(p => p.startsWith('unsupported scenario')), ['unsupported scenario definition syntax at line 6; use "- **S-NN:** text"']);
  const level1 = requirements.parseInventory('---\nversion: 1\nstatus: draft\n---\n# R-01 — x\n- **S-01:** one\n', {});
  assert.deepEqual(level1.problems, ['unsupported requirement definition syntax at line 5; use "### R-NN — Title"', 'orphan scenario S-01 at line 6', 'no requirement definitions']);
  const crossKind = requirements.parseInventory('---\nversion: 1\nstatus: draft\n---\n## R-01 — x\n- **R-01:** one\n', {});
  assert.deepEqual(crossKind.problems, ['duplicate definition R-01 at line 6', 'requirement R-01 at line 5 has no scenario']);
  const bothColons = requirements.parseInventory('---\nversion: 1\nstatus: draft\n---\n## R-01 — x\n- **S-01:**: one\n', {});
  assert.ok(bothColons.ok, 'a colon inside and after the bold is accepted');
  assert.equal(bothColons.inventory.scenarios['S-01'].text, 'one');
}

// --- S-03: identity is stable under lifecycle and checkbox edits, not under behavior edits
{
  const base = requirements.parseFile(strictFile, '.prd/prd-v1.md').inventory;
  const same = text => { const r = requirements.parseInventory(text, { prd: '.prd/prd-v1.md' }); assert.ok(r.ok, JSON.stringify(r.problems)); return r.inventory; };
  const built = same(strictText.replace('status: ticketed', 'status: built'));
  assert.equal(built.digest, base.digest, 'the PRD status line is not an inventory input');
  assert.equal(built.projection, base.projection);
  const toggled = same(strictText.replace('- [x] **S-02:**', '- [ ] **S-02:**').replace('- **S-01:** A PRD', '- [X] **S-01:** A PRD'));
  assert.equal(toggled.digest, base.digest, 'checkbox marks are normalized away');
  assert.deepEqual(toggled.scenarios['S-02'], base.scenarios['S-02']);
  const trailing = same(strictText.replace('- [x] **S-02:** Duplicate IDs cause an actionable diagnostic.', '- [x] **S-02:** Duplicate IDs cause an actionable diagnostic.   '));
  assert.equal(trailing.digest, base.digest, 'trailing whitespace is not identity');
  const reordered = same(strictText.replace(/### R-02: Report impact[\s\S]*?- \*\*S-03\*\* — Changing one scenario names that scenario and its requirement\.\n/, '').replace('### R-01 — Parse the inventory', '### R-02: Report impact\n\n> A quoted line mentioning **S-03:** is a reference, not a definition.\n\n- **S-03** — Changing one scenario names that scenario and its requirement.\n\n### R-01 — Parse the inventory'));
  assert.equal(reordered.digest, base.digest, 'reordering sections keeps the inventory digest (prd_revision changes instead)');
  assert.notEqual(parse.prdDigest(strictText.replace('### R-01', '### R-01 ')), parse.prdDigest(strictText), 'sanity: the PRD revision is a separate identity');
  const reworded = same(strictText.replace('Duplicate IDs cause an actionable diagnostic.', 'Duplicate IDs are silently merged.'));
  assert.notEqual(reworded.scenarios['S-02'].digest, base.scenarios['S-02'].digest, 'changed scenario behavior changes its digest');
  assert.equal(reworded.scenarios['S-01'].digest, base.scenarios['S-01'].digest);
  assert.equal(reworded.requirements['R-01'].digest, base.requirements['R-01'].digest, 'the owning requirement text is unchanged');
  assert.notEqual(reworded.digest, base.digest);
  const moved = same(strictText.replace('- [x] **S-02:** Duplicate IDs cause an actionable diagnostic.\n', '').replace('- **S-03** — Changing', '- [x] **S-02:** Duplicate IDs cause an actionable diagnostic.\n- **S-03** — Changing'));
  assert.equal(moved.scenarios['S-02'].digest, base.scenarios['S-02'].digest, 'moving a scenario keeps its content digest');
  assert.equal(moved.scenarios['S-02'].requirement, 'R-02');
  assert.notEqual(moved.digest, base.digest, 'but changes the inventory digest through the owner line');
  const d = requirements.difference(requirements.snapshotOf(base), requirements.snapshotOf(moved));
  assert.deepEqual(d.scenarios.changed, [{ id: 'S-02', parts: ['requirement'] }]);
  assert.deepEqual(d.requirements.changed.map(r => r.id), ['R-01', 'R-02']);
  const d2 = requirements.difference(requirements.snapshotOf(base), requirements.snapshotOf(reworded));
  assert.deepEqual(d2.scenarios.changed, [{ id: 'S-02', parts: ['text'] }]); assert.deepEqual(d2.requirements.changed, []); assert.deepEqual(d2.requirements.unchanged, ['R-01', 'R-02']);
  // Existing-format PRDs remain readable by the old validator; the strict reading names why no verdict exists, without throwing.
  const dir = tempDir(); createPrd(dir);
  assert.ok(parse.validatePrd(dir, '.prd/prd-v1.md').ok);
  const old = requirements.readInventory(dir, '.prd/prd-v1.md');
  assert.equal(old.code, 'INVENTORY_INVALID'); assert.deepEqual(old.problems, ['.prd/prd-v1.md: no requirement definitions']);
  for (const prd of fs.readdirSync(path.join(repo, '.prd')).filter(n => /^prd-v\d+\.md$/.test(n))) {
    const text = read(repo, `.prd/${prd}`);
    assert.ok(parse.validateMetadata(text).ok, `${prd} keeps valid metadata`);
    const r = requirements.parseInventory(text, { prd: `.prd/${prd}` });
    if (r.ok) assert.ok(Object.keys(r.inventory.requirements).length > 0); else assert.ok(r.problems.length > 0, `${prd} reports its grammar problems`);
  }
  const v6 = requirements.parseInventory(read(repo, '.prd/prd-v6.md'), { prd: '.prd/prd-v6.md' });
  assert.ok(v6.ok, JSON.stringify(v6.problems));
  assert.equal(Object.keys(v6.inventory.requirements).length, 10); assert.equal(Object.keys(v6.inventory.scenarios).length, 30, 'PRD v6 itself yields R-01..R-10 and S-01..S-30');
}
console.log('coverage inventory tests passed');
