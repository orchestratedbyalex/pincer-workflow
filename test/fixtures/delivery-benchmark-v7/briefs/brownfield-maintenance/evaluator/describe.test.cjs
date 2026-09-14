'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { describe: describeConfig } = require(path.join(process.env.CANDIDATE, 'src', 'config.js'));

test('leaf paths are dotted and sorted', () => {
  assert.deepEqual(describeConfig({ c: 2, a: { b: 1 } }), ['a.b', 'c']);
});
test('an empty object has no leaves', () => {
  assert.deepEqual(describeConfig({}), []);
});
