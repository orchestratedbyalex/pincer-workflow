'use strict';
// The behaviour the brief says must not change. A candidate that "fixes" the defect by
// removing the input validation fails here and nowhere else, which is the point.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { truncate } = require(path.join(process.env.CANDIDATE, 'src', 'truncate.js'));

test('a limit below 1 throws RangeError', () => {
  assert.throws(() => truncate('x', 0), { name: 'RangeError', message: 'limit must be at least 1' });
});
test('a non-string text throws TypeError', () => {
  assert.throws(() => truncate(5, 3), { name: 'TypeError', message: 'text must be a string' });
});
test('the empty string is unchanged', () => {
  assert.equal(truncate('', 5), '');
});
