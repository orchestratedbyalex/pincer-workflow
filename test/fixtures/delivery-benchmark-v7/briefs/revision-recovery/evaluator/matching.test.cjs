'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { evaluate } = require(path.join(process.env.CANDIDATE, 'src', 'rules.js'));

test('a rule whose when is a subset of the facts matches', () => {
  assert.equal(evaluate([{ when: { a: 1 }, action: 'x' }], { a: 1, b: 2 }), 'x');
});
test('no match returns null', () => {
  assert.equal(evaluate([{ when: { a: 2 }, action: 'x' }], { a: 1 }), null);
});
test('an empty when matches anything', () => {
  assert.equal(evaluate([{ when: {}, action: 'always' }], { a: 1 }), 'always');
});
