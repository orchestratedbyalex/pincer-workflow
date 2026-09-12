'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { fresh, run } = require('./common.cjs');
test('A2 list prints notes in order', () => {
  const f = fresh();
  const e = run(f, 'list'); assert.equal(e.status, 0, e.stderr); assert.equal(e.stdout, 'no notes\n');
  run(f, 'add', 'a'); run(f, 'add', 'b c');
  assert.equal(run(f, 'list').stdout, '- a\n- b c\n');
});
