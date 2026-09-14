'use strict';
// The part the interrupted session never reached. A candidate that stopped at the
// interruption fails here alone, which is how an unrecovered interruption is visible.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const mod = require(path.join(process.env.CANDIDATE, 'src', 'rules.js'));

test('explain is exported', () => {
  assert.equal(typeof mod.explain, 'function', 'explain was never delivered');
});
test('explain names the winning rule index', () => {
  const rules = [{ when: { a: 1 }, action: 'low', priority: 1 }, { when: { a: 1 }, action: 'high', priority: 9 }];
  assert.deepEqual(mod.explain(rules, { a: 1 }), { action: 'high', rule: 1 });
});
test('no match explains itself', () => {
  assert.deepEqual(mod.explain([{ when: { a: 2 }, action: 'x' }], { a: 1 }), { action: null, rule: null });
});
