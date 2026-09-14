'use strict';
// The revision. A candidate that implemented session 1 and stopped fails only here.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { summarize } = require(path.join(process.env.CANDIDATE, 'src', 'summarize.js'));

test('the highest-severity message is appended', () => {
  assert.equal(summarize([
    { level: 'info', message: 'a' }, { level: 'info', message: 'b' }, { level: 'info', message: 'c' },
    { level: 'warn', message: 'disk almost full' },
  ]), '3 info, 1 warn: disk almost full');
});
test('error outranks warn, and the first entry of that level supplies the message', () => {
  assert.equal(summarize([
    { level: 'warn', message: 'w' }, { level: 'error', message: 'first error' }, { level: 'error', message: 'second error' },
  ]), '1 warn, 2 error: first error');
});
test('the empty case is unchanged', () => {
  assert.equal(summarize([]), 'nothing to report');
});
