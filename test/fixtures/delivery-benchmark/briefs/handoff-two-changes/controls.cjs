'use strict';
// Controls for handoff-two-changes, in two parts matching the sessions: part 1 (S1)
// commits A1 then B1; part 2 (S2) commits A2. `omitted` never delivers A2;
// `false-success` makes `list` print `listed` and exit 0 without the notes while its
// own test only checks the exit status; `stale-evidence`; `wrong-order` finishes A2 in
// S1 instead of B1 (the protocol check catches it) and B1 in S2.
const fs = require('node:fs');
const path = require('node:path');
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
}__LIST____CLEAR__ else { process.stderr.write('usage: notes <add|list|clear>\\n'); process.exit(2); }
`;
const LIST_OK = ` else if (cmd === 'list') {
  const notes = load();
  if (!notes.length) process.stdout.write('no notes\\n');
  else for (const n of notes) process.stdout.write('- ' + n + '\\n');
}`;
const LIST_FALSE = ` else if (cmd === 'list') {
  load();
  process.stdout.write('listed\\n');
}`;
const CLEAR_OK = ` else if (cmd === 'clear') {
  const notes = load();
  if (rest[0] !== '--dry-run') save([]);
  process.stdout.write('cleared ' + notes.length + ' notes\\n');
}`;
const HEAD = `const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const bin = path.join(__dirname, '..', 'bin', 'notes.js');
const fresh = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'notes-')), 'notes.json');
const run = (file, ...args) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8', env: { ...process.env, NOTES_FILE: file } });
`;
const T_A1 = `test('A1 add', () => { const f = fresh(); assert.equal(run(f, 'add', 'hello', 'world').stdout, 'added: hello world\\n'); assert.equal(run(f, 'add').status, 2); });\n`;
const T_A2 = `test('A2 list', () => { const f = fresh(); assert.equal(run(f, 'list').stdout, 'no notes\\n'); run(f, 'add', 'a'); assert.equal(run(f, 'list').stdout, '- a\\n'); });\n`;
const T_A2_FALSE = `test('A2 list exits 0', () => { const f = fresh(); assert.equal(run(f, 'list').status, 0); });\n`;
const T_B1 = `test('B1 clear', () => { const f = fresh(); run(f, 'add', 'a'); run(f, 'add', 'b'); assert.equal(run(f, 'clear', '--dry-run').stdout, 'cleared 2 notes\\n'); assert.equal(run(f, 'clear').stdout, 'cleared 2 notes\\n'); assert.equal(run(f, 'clear').stdout, 'cleared 0 notes\\n'); });\n`;
function write(ws, lib, { list, clear, tests }) {
  lib.write(ws, 'bin/notes.js', IMPL.replace('__LIST__', list === 'ok' ? LIST_OK : list === 'false' ? LIST_FALSE : '').replace('__CLEAR__', clear ? CLEAR_OK : ''));
  fs.chmodSync(path.join(ws, 'bin/notes.js'), 0o755);
  lib.write(ws, 'test/notes.test.js', HEAD + tests);
}
function apply(ws, variant, lib, { part = 1, date } = {}) {
  if (part === 1) {
    write(ws, lib, { tests: T_A1 }); lib.commitAll(ws, 'A1: add', date);
    if (variant === 'wrong-order') { write(ws, lib, { list: 'ok', tests: T_A1 + T_A2 }); return lib.commitAll(ws, 'A2: list', date); }
    write(ws, lib, { clear: true, tests: T_A1 + T_B1 }); return lib.commitAll(ws, 'B1: clear', date);
  }
  if (variant === 'omitted') return null;
  if (variant === 'wrong-order') { write(ws, lib, { list: 'ok', clear: true, tests: T_A1 + T_A2 + T_B1 }); return lib.commitAll(ws, 'B1: clear', date); }
  write(ws, lib, { list: variant === 'false-success' ? 'false' : 'ok', clear: true, tests: T_A1 + (variant === 'false-success' ? T_A2_FALSE : T_A2) + T_B1 });
  const sha = lib.commitAll(ws, 'A2: list', date);
  if (variant === 'stale-evidence') {
    const other = lib.git(ws, 'rev-parse', 'HEAD~1');
    lib.write(ws, 'NOTES.md', `---\nprd: .prd/prd-v1.md\nbase: ${other}\ncandidate: ${other}\nevidence: .prd/evidence/prd-v1/${other}/manifest.json\n---\n`);
    lib.write(ws, `.prd/evidence/prd-v1/${other}/manifest.json`, `${JSON.stringify({ schema: 1, candidate: other }, null, 2)}\n`);
    return lib.commitAll(ws, 'evaluate: candidate ' + other.slice(0, 7), date);
  }
  return sha;
}
module.exports = { variants: ['control', 'omitted', 'false-success', 'stale-evidence', 'wrong-order'], faults: { omitted: 'a2-list', 'false-success': 'a2-list', 'stale-evidence': 'evidence-binding', 'wrong-order': 'session-boundary' }, parts: 2, apply };
