import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Static authored-contract checks only. No runtime behavior or observation is inferred.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const contracts = read('docs/prd-v8-contracts.md');
const obligations = read('docs/prd-v8-obligation-map.md');
const manifest = JSON.parse(read('docs/prd-v7-artifacts/v6-preservation.json'));
const expectedOwners = [100,100,100,105,106,101,110,110,100,112,112,112,113,113,111,113,111,113,111,111,111,107,115,101,115,116,114,119,119,119];
const baseline = 'c7cb6bc9906ecd418e9edddfc08d3bdd353f8aab';
const candidate = 'ce98abdbc6edd4e8d4f5736fee35dd765b930452';

function validateDocuments(contract, overlay) {
  const flat = contract.replace(/\s+/g, ' ');
  const rows = overlay.split('\n').filter(line => /^\| S-\d{2} \|/.test(line));
  assert.equal(rows.length, 30, 'all v7 scenarios need exactly one row');
  const seen = new Set();
  for (const row of rows) {
    const [, scenario, oldTicket, owner, disposition] = row.split('|').map(x => x.trim());
    assert.ok(!seen.has(scenario), 'duplicate v7 scenario'); seen.add(scenario);
    const n = Number(scenario.slice(2));
    assert.ok(n >= 1 && n <= 30, 'known v7 scenario');
    assert.equal(owner, `T-${expectedOwners[n - 1]}`, `${scenario}: declared successor owner`);
    for (const ticket of [oldTicket, owner]) {
      const matches = fs.readdirSync(path.join(root, 'tickets')).filter(f => f.startsWith(`${ticket}-`));
      assert.equal(matches.length, 1, `${ticket}: actual ticket reference`);
    }
    assert.ok(disposition.length > 20, `${scenario}: substantive disposition`);
  }
  assert.ok(overlay.includes(baseline), 'reviewed baseline named');
  assert.ok(overlay.includes(candidate), 'historical candidate named');
  assert.match(overlay, /original temporal obligation\s+is \*\*unsatisfied\*\*/);
  assert.match(overlay, /not a recorded user decision/);
  assert.match(overlay, /later pilots cannot retroactively/);
  assert.match(overlay, /T-89, T-90, T-91, T-92, T-93, T-95, T-96, T-97/);
  for (const finding of ['Runtime stale-lock race', 'Hook heredoc false positive', 'Obsolete installed-file cleanup']) {
    const row = overlay.split('\n').find(line => line.startsWith(`| ${finding} |`));
    assert.ok(row, `${finding}: disposition exists`);
    const cells = row.split('|').map(x => x.trim());
    assert.match(cells[3], /^Defer /, `${finding}: no speculative fix`);
    assert.match(cells[4], /T-119/, `${finding}: final follow-up owner`);
    assert.match(cells[4], /fix ticket/, `${finding}: separate reproduced fix scope`);
  }
  for (const phrase of [
    'every execution/scoring helper including new sibling modules',
    'before any workspace, record or session mutation',
    'no secret values, secret-value hashes',
    'Exactly one concurrent claimant may launch',
    'unique run/attempt/session/event identities',
    'aggregate null with a specific reason',
    'account-limit, ambiguous-exit and evaluator-exception',
    'Guide writes no map, selection, authorization, attempt, lifecycle state or cache',
    'executes no proposed check',
    'Exit 0', 'Exit 2', 'Exit 4',
    'Preview writes nothing',
    'No post-candidate version exception or broader artifact allowlist is permitted',
  ]) assert.ok(flat.includes(phrase), `missing contract: ${phrase}`);
  assert.ok(flat.includes('coverage guide --change <id> [--scenario <id>] [--proposal <path>] [--json]'));
  assert.ok(flat.includes('node scripts/prepare-release.cjs --version <semver> --preview|--apply'));
  const blocks = [...contract.matchAll(/```json\n([\s\S]*?)\n```/g)];
  assert.equal(blocks.length, 1, 'one guide success envelope');
  const guide = JSON.parse(blocks[0][1]);
  assert.deepEqual(Object.keys(guide).sort(), ['guide','kind','change','context_digest','focus','context','unresolved','proposal','next'].sort());
  assert.equal(guide.guide, 1); assert.equal(guide.kind, 'coverage-guide');
  assert.ok(!Object.hasOwn(guide, 'schema'), 'report cannot masquerade as a map');
  // Every current regression citation really exists; planned suites remain in tickets.
  for (const match of contract.matchAll(/`(test\/[\w-]+\.test\.js)`/g)) {
    assert.ok(fs.existsSync(path.join(root, match[1])), `missing regression: ${match[1]}`);
  }
  for (const doc of [contract, overlay]) for (const match of doc.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
    if (!match[1].includes('://')) assert.ok(fs.existsSync(path.resolve(root, 'docs', match[1])), `missing document: ${match[1]}`);
  }
}

validateDocuments(contracts, obligations);

// The operational smoke supplies native observations, so it must be reachable
// without prematurely closing T-102. Measured work still has both completion gates.
function validateV8Dependencies(dependencies) {
  assert.deepEqual(dependencies['T-106'], ['T-105']);
  assert.deepEqual(dependencies['T-109'], ['T-106', 'T-107', 'T-108', 'T-121']);
  assert.deepEqual(dependencies['T-120'], []);
  assert.deepEqual(dependencies['T-121'], ['T-120']);
  assert.deepEqual(dependencies['T-110'], ['T-102', 'T-109']);
  const visit = (id, ancestors = []) => {
    assert.ok(!ancestors.includes(id), `dependency cycle: ${[...ancestors, id].join(' -> ')}`);
    assert.ok(Object.hasOwn(dependencies, id), `unknown predecessor ${id}`);
    for (const predecessor of dependencies[id]) visit(predecessor, [...ancestors, id]);
  };
  for (const id of Object.keys(dependencies)) visit(id);
}
const v8Dependencies = {};
for (const file of fs.readdirSync(path.join(root, 'tickets')).filter(name => /^T-1(?:[01]\d|2[01])-/.test(name))) {
  const content = read(`tickets/${file}`);
  const id = content.match(/^ticket: (T-\d+)$/m)[1];
  const field = content.match(/^depends_on: \[([^\]]*)\]$/m);
  v8Dependencies[id] = field ? field[1].split(',').map(value => value.trim()).filter(Boolean) : [];
}
validateV8Dependencies(v8Dependencies);
for (const [id, dependencies] of [['T-106', ['T-102', 'T-105']], ['T-110', ['T-109']], ['T-109', ['T-106', 'T-107', 'T-108']], ['T-120', ['T-109']]]) {
  assert.throws(() => validateV8Dependencies({ ...v8Dependencies, [id]: dependencies }));
}
// Fault the authored controls, not fake runtime outcomes. Each mutation must be rejected.
const mutations = [
  [contracts, obligations.replace(/^\| S-07 .*\n/m, '')],
  [contracts, obligations.replace('| S-08 |', '| S-07 |')],
  [contracts, obligations.replace('| S-20 | T-93 | T-111 |', '| S-20 | T-93 | T-115 |')],
  [contracts, obligations.replace('**unsatisfied**', '**satisfied**')],
  [contracts, obligations.replace('not a recorded user decision', 'a recorded user decision')],
  [contracts, obligations.replace(baseline, 'unknown')],
  [contracts, obligations.replaceAll(candidate, 'unknown')],
  [contracts, obligations.replace('| Defer speculative fix;', '| Fixed;')],
  [contracts.replace('Exactly one concurrent\nclaimant may launch', 'Any claimant may launch'), obligations],
  [contracts.replace('aggregate null with a\nspecific reason', 'aggregate zero'), obligations],
  [contracts.replace('every execution/scoring helper including\nnew sibling modules', 'selected helpers'), obligations],
  [contracts.replace('executes no proposed check', 'executes proposed checks'), obligations],
  [contracts.replace('No post-candidate version exception or broader\nartifact allowlist is permitted', 'Version changes are exempt'), obligations],
  [contracts.replace('"guide": 1,', '"guide": 1, "schema": 1,'), obligations],
  [contracts.replace('test/runtime-runner.test.js', 'test/nonexistent-regression.test.js'), obligations],
];
for (const [index, [contract, overlay]] of mutations.entries()) assert.throws(() => validateDocuments(contract, overlay), `mutation ${index + 1} must fail`);

// Bind snapshot assertions to the reviewed commit, so later ticket progress is allowed.
const atBaseline = rel => execFileSync('git', ['show', `${baseline}:${rel}`], {cwd: root, encoding:'utf8'});
assert.equal(JSON.parse(atBaseline('package.json')).version, '0.6.0');
assert.match(atBaseline('NOTES.md'), new RegExp(`^candidate: ${candidate}$`, 'm'));
for (const n of [89,90,91,92,93,95,96,97]) {
  const name = fs.readdirSync(path.join(root, 'tickets')).find(f => f.startsWith(`T-${n}-`));
  assert.match(atBaseline(`tickets/${name}`), /^status: open$/m);
}
for (const n of [87,88,94,98,99]) {
  const name = fs.readdirSync(path.join(root, 'tickets')).find(f => f.startsWith(`T-${n}-`));
  assert.match(atBaseline(`tickets/${name}`), /^status: done$/m);
}
function checkFrozen(files, content = rel => fs.readFileSync(path.join(root, rel))) {
  for (const [rel, digest] of Object.entries(files)) assert.equal(sha(content(rel)), digest, `${rel}: frozen content changed`);
}
checkFrozen(manifest.files);
const first = Object.keys(manifest.files)[0];
assert.throws(() => checkFrozen(manifest.files, rel => rel === first ? Buffer.from('corrupt') : fs.readFileSync(path.join(root, rel))));
const keys = Object.keys(manifest.files).sort();
assert.equal(sha(keys.map(k => `${k}\n${manifest.files[k]}\n`).join('')), manifest.digest);
assert.ok(keys.length > 600, 'whole frozen study retained');
const wiki = read('docs/wiki/systems/v7-execution-gaps.md');
assert.doesNotMatch(wiki, /put the correction in an unfrozen sibling/);
assert.match(wiki, /Changed execution requires a new cohort identity/);
assert.doesNotMatch(read('docs/wiki/index.md'), /not yet on main/);
assert.match(read('docs/wiki/briefing.md'), /Live|live support/);
console.log(`readiness contract tests passed (${mutations.length} negative document cases; frozen-content mutation; static only)`);
