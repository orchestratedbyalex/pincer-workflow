'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { summarize } = require(path.join(process.env.CANDIDATE, 'src', 'summarize.js'));

test('an empty array reports nothing', () => {
  assert.equal(summarize([]), 'nothing to report');
});
test('counts appear in level order and omit empty levels', () => {
  const out = summarize([{ level: 'warn', message: 'w' }, { level: 'info', message: 'i' }, { level: 'info', message: 'j' }]);
  assert.match(out, /^2 info, 1 warn/, out);
  assert.doesNotMatch(out, /error/);
});
