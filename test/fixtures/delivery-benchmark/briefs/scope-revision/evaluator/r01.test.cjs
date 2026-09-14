'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { fresh, run, fs, bin } = require('./common.cjs');
test('add appends and prints', () => {
  assert.ok(fs.existsSync(bin), 'bin/notes.js');
  const f = fresh();
  assert.equal(run(f, 'add', 'hello', 'world').stdout, 'added: hello world\n');
  assert.equal(run(f, 'add', 'second').stdout, 'added: second\n');
  assert.deepEqual(JSON.parse(fs.readFileSync(f, 'utf8')), ['hello world', 'second']);
  const u = run(f, 'add'); assert.equal(u.status, 2); assert.equal(u.stderr, 'usage: notes add <text>\n');
  fs.writeFileSync(f, 'nope'); const c = run(f, 'add', 'x'); assert.equal(c.status, 1); assert.equal(c.stderr, 'notes.json is not valid JSON\n');
});
