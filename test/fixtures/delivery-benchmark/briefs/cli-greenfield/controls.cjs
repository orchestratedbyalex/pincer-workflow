'use strict';
// Control implementations for cli-greenfield: `control` is correct; `omitted` lacks the
// `done` command; `false-success` reports `done #n` without changing anything while its
// own tests pass; `stale-evidence` is correct code whose NOTES.md and evidence name a
// different commit as the evaluated candidate; `evaluated` is correct code with a PINCER-style
// evaluation commit on top (NOTES.md and evidence naming the implementation commit), which
// the evaluator accepts as the post-candidate convention.
const path = require('node:path');
const fs = require('node:fs');

const IMPL = `#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const file = process.env.TODO_FILE || path.join(process.cwd(), 'todo.json');
const usage = () => { process.stderr.write('usage: todo add <text> | list | done <n>\\n'); process.exit(2); };
function load() {
  if (!fs.existsSync(file)) return [];
  let items;
  try { items = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { process.stderr.write('todo.json is not valid JSON\\n'); process.exit(1); }
  if (!Array.isArray(items)) { process.stderr.write('todo.json is not valid JSON\\n'); process.exit(1); }
  return items;
}
const save = items => fs.writeFileSync(file, JSON.stringify(items, null, 2) + '\\n');
const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'add') {
  const text = rest.join(' ').trim();
  if (!text) { process.stderr.write('usage: todo add <text>\\n'); process.exit(2); }
  const items = load(); items.push({ text, done: false }); save(items);
  process.stdout.write(\`added #\${items.length}: \${text}\\n\`);
} else if (cmd === 'list') {
  const items = load();
  if (!items.length) process.stdout.write('no items\\n');
  else items.forEach((it, i) => process.stdout.write(\`#\${i + 1} [\${it.done ? 'x' : ' '}] \${it.text}\\n\`));
} else if (cmd === 'done') {
  __DONE__
} else usage();
`;
const DONE_OK = `const n = Number(rest[0]);
  const items = load();
  if (!Number.isInteger(n) || n < 1 || n > items.length) { process.stderr.write(\`no such item: \${rest[0]}\\n\`); process.exit(1); }
  items[n - 1].done = true; save(items);
  process.stdout.write(\`done #\${n}\\n\`);`;
const DONE_FALSE = `const n = rest[0];
  load();
  process.stdout.write(\`done #\${n}\\n\`);`;

const TEST_OK = `const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const bin = path.join(__dirname, '..', 'bin', 'todo.js');
const run = (file, ...args) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8', env: { ...process.env, TODO_FILE: file } });
test('add, list, done', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'todo-')), 'todo.json');
  assert.equal(run(file, 'list').stdout, 'no items\\n');
  assert.equal(run(file, 'add', 'buy', 'milk').stdout, 'added #1: buy milk\\n');
  assert.equal(run(file, 'done', '1').stdout, 'done #1\\n');
  assert.equal(run(file, 'list').stdout, '#1 [x] buy milk\\n');
  assert.equal(run(file, 'done', '9').status, 1);
});
`;
// The false-success variant's own test asserts only the printed line.
const TEST_FALSE = TEST_OK.replace("  assert.equal(run(file, 'list').stdout, '#1 [x] buy milk\\n');\n  assert.equal(run(file, 'done', '9').status, 1);\n", '');
const TEST_OMITTED = TEST_OK.replace("  assert.equal(run(file, 'done', '1').stdout, 'done #1\\n');\n  assert.equal(run(file, 'list').stdout, '#1 [x] buy milk\\n');\n  assert.equal(run(file, 'done', '9').status, 1);\n", "  assert.equal(run(file, 'list').stdout, '#1 [ ] buy milk\\n');\n");

const README = '\n## Commands\n\n- `node bin/todo.js add <text>` — add an item\n- `node bin/todo.js list` — list items\n- `node bin/todo.js done <n>` — mark item n done\n';

function apply(ws, variant, lib, { date } = {}) {
  const done = variant === 'omitted' ? "usage();" : variant === 'false-success' ? DONE_FALSE : DONE_OK;
  lib.write(ws, 'bin/todo.js', IMPL.replace('__DONE__', done));
  fs.chmodSync(path.join(ws, 'bin/todo.js'), 0o755);
  lib.write(ws, 'test/todo.test.js', variant === 'omitted' ? TEST_OMITTED : variant === 'false-success' ? TEST_FALSE : TEST_OK);
  fs.appendFileSync(path.join(ws, 'README.md'), README);
  const sha = lib.commitAll(ws, 'Implement the todo CLI', date);
  if (variant === 'evaluated') {
    lib.write(ws, 'NOTES.md', `---\nprd: .prd/prd-v1.md\nbase: ${lib.git(ws, 'rev-parse', 'HEAD~1')}\ncandidate: ${sha}\nevidence: .prd/evidence/prd-v1/${sha}/manifest.json\n---\n# Evaluation\nAll checks passed on ${sha.slice(0, 7)}.\n`);
    lib.write(ws, `.prd/evidence/prd-v1/${sha}/manifest.json`, `${JSON.stringify({ schema: 1, prd: '.prd/prd-v1.md', base: lib.git(ws, 'rev-parse', 'HEAD~1'), candidate: sha, created: '2026-09-12T00:00:00Z', checks: [{ id: 'C-01', kind: 'command', required: true, result: 'passed', command: 'npm test' }] }, null, 2)}\n`);
    return lib.commitAll(ws, 'evaluate: PRD v1 candidate ' + sha.slice(0, 7), date);
  }
  if (variant === 'stale-evidence') {
    const other = lib.git(ws, 'rev-parse', 'HEAD~1');
    lib.write(ws, 'NOTES.md', `---\nprd: .prd/prd-v1.md\nbase: ${other}\ncandidate: ${other}\nevidence: .prd/evidence/prd-v1/${other}/manifest.json\n---\n# Evaluation\nAll checks passed.\n`);
    lib.write(ws, `.prd/evidence/prd-v1/${other}/manifest.json`, `${JSON.stringify({ schema: 1, prd: '.prd/prd-v1.md', base: other, candidate: other, created: '2026-09-12T00:00:00Z', checks: [{ id: 'C-01', kind: 'command', required: true, result: 'passed', command: 'npm test' }] }, null, 2)}\n`);
    return lib.commitAll(ws, 'evaluate: candidate ' + other.slice(0, 7), date);
  }
  return sha;
}
module.exports = { variants: ['control', 'evaluated', 'omitted', 'false-success', 'stale-evidence'], accepted: ['control', 'evaluated'], faults: { omitted: 'done-marks', 'false-success': 'done-marks', 'stale-evidence': 'evidence-binding' }, apply };
