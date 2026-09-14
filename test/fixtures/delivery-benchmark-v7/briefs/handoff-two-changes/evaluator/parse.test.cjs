'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { parse } = require(path.join(process.env.CANDIDATE, 'src', 'money.js'));

test('parses both currencies and negatives', () => {
  assert.deepEqual(parse('$12.34'), { cents: 1234, currency: 'USD' });
  assert.deepEqual(parse('-€0.50'), { cents: -50, currency: 'EUR' });
});
test('unparseable text throws', () => {
  assert.throws(() => parse('twelve dollars'), { message: 'cannot parse: twelve dollars' });
});
