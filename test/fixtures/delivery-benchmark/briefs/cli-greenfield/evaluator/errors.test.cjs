'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fresh, run, fs } = require('./common.cjs');
test('usage errors', () => {
  const f = fresh();
  const a = run(f, 'add'); assert.equal(a.status, 2); assert.match(a.stderr, /^usage: todo add <text>/);
  const u = run(f, 'frobnicate'); assert.equal(u.status, 2); assert.match(u.stderr, /usage/);
  assert.ok(!fs.existsSync(f), 'no file written on a usage error');
});
test('a corrupt file is refused for every command and left untouched', () => {
  const f = fresh();
  fs.writeFileSync(f, '{not json');
  for (const args of [['list'], ['add', 'x'], ['done', '1']]) {
    const r = run(f, ...args);
    assert.equal(r.status, 1, `${args.join(' ')}: exit`); assert.equal(r.stderr, 'todo.json is not valid JSON\n', `${args.join(' ')}: stderr`);
  }
  assert.equal(fs.readFileSync(f, 'utf8'), '{not json');
});
