'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { truncate } = require(path.join(process.env.CANDIDATE, 'src', 'truncate.js'));

test('a string exactly at the limit is returned unchanged', () => {
  assert.equal(truncate('abcde', 5), 'abcde');
});
test('a truncated result is never longer than the limit', () => {
  assert.equal(truncate('abcdef', 5).length, 5);
  assert.equal(truncate('abcdef', 5), 'abcd…');
});
test('shorter text is still unchanged', () => {
  assert.equal(truncate('abc', 5), 'abc');
});
