'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { fresh, run } = require('./common.cjs');
test('list --json prints a JSON array of strings', () => {
  const f = fresh();
  const e = run(f, 'list', '--json'); assert.equal(e.status, 0, e.stderr); assert.deepEqual(JSON.parse(e.stdout), []);
  run(f, 'add', 'a'); run(f, 'add', 'b c');
  const r = run(f, 'list', '--json'); assert.equal(r.status, 0, r.stderr); assert.deepEqual(JSON.parse(r.stdout), ['a', 'b c']);
});
