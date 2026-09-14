'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { merge } = require(path.join(process.env.CANDIDATE, 'src', 'config.js'));

test('nested objects merge recursively', () => {
  assert.deepEqual(merge({ a: { b: 1, c: 2 } }, { a: { c: 3 } }), { a: { b: 1, c: 3 } });
});
test('arrays are replaced, never concatenated', () => {
  assert.deepEqual(merge({ a: [1, 2] }, { a: [3] }), { a: [3] });
});
test('null deletes a key', () => {
  assert.deepEqual(merge({ a: 1, b: 2 }, { b: null }), { a: 1 });
});
