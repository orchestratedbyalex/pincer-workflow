'use strict';
// The behaviour that already worked. A deep merge that mutates its base fails here alone.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { merge } = require(path.join(process.env.CANDIDATE, 'src', 'config.js'));

test('merge does not mutate its base', () => {
  const base = { a: { b: 1 } };
  merge(base, { a: { c: 2 } });
  assert.deepEqual(base, { a: { b: 1 } }, 'the base was mutated');
});
test('an empty override returns a value deep-equal to the base', () => {
  assert.deepEqual(merge({ a: { b: 1 } }, {}), { a: { b: 1 } });
});
