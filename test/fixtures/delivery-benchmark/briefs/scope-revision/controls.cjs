'use strict';
// Controls for scope-revision, applied in parts matching the sessions: part 1 (S1) adds
// R-01; part 2 (S2) adds R-02 — and in the `unapproved-scope` variant also R-03; part 3
// (S3) adds R-03. `omitted` never adds R-02; `false-success` makes `list --json` print
// `[]` always while its own test only checks for valid JSON; `stale-evidence` as usual.
const IMPL = `#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const file = process.env.NOTES_FILE || path.join(process.cwd(), 'notes.json');
function load() {
  if (!fs.existsSync(file)) return [];
  try { const v = JSON.parse(fs.readFileSync(file, 'utf8')); if (!Array.isArray(v)) throw new Error(); return v; }
  catch { process.stderr.write('notes.json is not valid JSON\\n'); process.exit(1); }
}
const save = notes => fs.writeFileSync(file, JSON.stringify(notes) + '\\n');
const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'add') {
  const text = rest.join(' ').trim();
  if (!text) { process.stderr.write('usage: notes add <text>\\n'); process.exit(2); }
  const notes = load(); notes.push(text); save(notes);
  process.stdout.write('added: ' + text + '\\n');
}__LIST__ else { process.stderr.write('usage: notes add <text> | list [--json]\\n'); process.exit(2); }
`;
const LIST = ` else if (cmd === 'list') {
  const notes = load();
  __JSON__
  if (!notes.length) process.stdout.write('no notes\\n');
  else for (const n of notes) process.stdout.write('- ' + n + '\\n');
}`;
const JSON_OK = `if (rest[0] === '--json') { process.stdout.write(JSON.stringify(notes) + '\\n'); process.exit(0); }`;
const JSON_FALSE = `if (rest[0] === '--json') { process.stdout.write('[]\\n'); process.exit(0); }`;
const TEST_HEAD = `const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const bin = path.join(__dirname, '..', 'bin', 'notes.js');
const fresh = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'notes-')), 'notes.json');
const run = (file, ...args) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8', env: { ...process.env, NOTES_FILE: file } });
test('add', () => { const f = fresh(); assert.equal(run(f, 'add', 'hello', 'world').stdout, 'added: hello world\\n'); assert.equal(run(f, 'add').status, 2); });
`;
const TEST_LIST = `test('list', () => { const f = fresh(); assert.equal(run(f, 'list').stdout, 'no notes\\n'); run(f, 'add', 'a'); run(f, 'add', 'b'); assert.equal(run(f, 'list').stdout, '- a\\n- b\\n'); });\n`;
const TEST_JSON_OK = `test('list --json', () => { const f = fresh(); assert.equal(run(f, 'list', '--json').stdout, '[]\\n'); run(f, 'add', 'a'); assert.deepEqual(JSON.parse(run(f, 'list', '--json').stdout), ['a']); });\n`;
const TEST_JSON_FALSE = `test('list --json is JSON', () => { const f = fresh(); assert.ok(Array.isArray(JSON.parse(run(f, 'list', '--json').stdout))); });\n`;
const fs = require('node:fs');
const path = require('node:path');
function writeImpl(ws, lib, { list, json, tests }) {
  lib.write(ws, 'bin/notes.js', IMPL.replace('__LIST__', list ? LIST.replace('__JSON__', json === 'ok' ? JSON_OK : json === 'false' ? JSON_FALSE : '') : ''));
  fs.chmodSync(path.join(ws, 'bin/notes.js'), 0o755);
  lib.write(ws, 'test/notes.test.js', tests);
}
function apply(ws, variant, lib, { part = 1, date } = {}) {
  if (part === 1) { writeImpl(ws, lib, { list: false, tests: TEST_HEAD }); return lib.commitAll(ws, 'R-01: add', date); }
  if (part === 2) {
    if (variant === 'omitted') return null; // R-02 never arrives
    if (variant === 'unapproved-scope') { writeImpl(ws, lib, { list: true, json: 'ok', tests: TEST_HEAD + TEST_LIST + TEST_JSON_OK }); return lib.commitAll(ws, 'R-02 and R-03: list, list --json', date); }
    writeImpl(ws, lib, { list: true, tests: TEST_HEAD + TEST_LIST }); return lib.commitAll(ws, 'R-02: list', date);
  }
  if (variant === 'omitted') { writeImpl(ws, lib, { list: true, json: 'ok', tests: TEST_HEAD + TEST_JSON_OK }); lib.write(ws, 'bin/notes.js', fs.readFileSync(path.join(ws, 'bin/notes.js'), 'utf8').replace("  if (!notes.length) process.stdout.write('no notes\\n');\n  else for (const n of notes) process.stdout.write('- ' + n + '\\n');\n", "  process.stderr.write('usage: notes list --json\\n'); process.exit(2);\n")); return lib.commitAll(ws, 'R-03: list --json', date); }
  if (variant === 'unapproved-scope') return null; // nothing left to do
  writeImpl(ws, lib, { list: true, json: variant === 'false-success' ? 'false' : 'ok', tests: TEST_HEAD + TEST_LIST + (variant === 'false-success' ? TEST_JSON_FALSE : TEST_JSON_OK) });
  const sha = lib.commitAll(ws, 'R-03: list --json', date);
  if (variant === 'stale-evidence') {
    const other = lib.git(ws, 'rev-parse', 'HEAD~1');
    lib.write(ws, 'NOTES.md', `---\nprd: .prd/prd-v1.md\nbase: ${other}\ncandidate: ${other}\nevidence: .prd/evidence/prd-v1/${other}/manifest.json\n---\n`);
    lib.write(ws, `.prd/evidence/prd-v1/${other}/manifest.json`, `${JSON.stringify({ schema: 1, candidate: other }, null, 2)}\n`);
    return lib.commitAll(ws, 'evaluate: candidate ' + other.slice(0, 7), date);
  }
  return sha;
}
module.exports = { variants: ['control', 'omitted', 'false-success', 'stale-evidence', 'unapproved-scope'], faults: { omitted: 'r02-list', 'false-success': 'r03-list-json', 'stale-evidence': 'evidence-binding', 'unapproved-scope': 'scope-approval' }, parts: 3, apply };
