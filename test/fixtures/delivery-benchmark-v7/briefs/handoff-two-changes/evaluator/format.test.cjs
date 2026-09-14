'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { format } = require(path.join(process.env.CANDIDATE, 'src', 'money.js'));

test('formats positive, negative and zero', () => {
  assert.equal(format(1234, 'USD'), '$12.34');
  assert.equal(format(-50, 'USD'), '-$0.50');
  assert.equal(format(0, 'USD'), '$0.00');
  assert.equal(format(1234, 'EUR'), '€12.34');
});
test('an unsupported currency throws', () => {
  assert.throws(() => format(1, 'GBP'), { message: 'unsupported currency: GBP' });
});
