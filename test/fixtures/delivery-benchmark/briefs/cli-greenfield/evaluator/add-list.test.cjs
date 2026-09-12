'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fresh, run, fs, bin } = require('./common.cjs');
test('bin/todo.js exists', () => assert.ok(fs.existsSync(bin), 'bin/todo.js missing'));
test('empty list', () => { const f = fresh(); const r = run(f, 'list'); assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout, 'no items\n'); });
test('add joins words and numbers items', () => {
  const f = fresh();
  assert.equal(run(f, 'add', 'buy', 'milk').stdout, 'added #1: buy milk\n');
  assert.equal(run(f, 'add', 'walk the dog').stdout, 'added #2: walk the dog\n');
  const r = run(f, 'list');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '#1 [ ] buy milk\n#2 [ ] walk the dog\n');
});
