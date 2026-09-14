'use strict';
// The revision. A candidate that kept first-match-wins fails here alone.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { evaluate } = require(path.join(process.env.CANDIDATE, 'src', 'rules.js'));

test('the highest priority wins, not the first match', () => {
  const rules = [
    { when: { a: 1 }, action: 'low', priority: 1 },
    { when: { a: 1 }, action: 'high', priority: 9 },
  ];
  assert.equal(evaluate(rules, { a: 1 }), 'high');
});
test('a missing priority counts as zero', () => {
  const rules = [{ when: { a: 1 }, action: 'none' }, { when: { a: 1 }, action: 'one', priority: 1 }];
  assert.equal(evaluate(rules, { a: 1 }), 'one');
});
test('ties go to the earlier rule', () => {
  const rules = [{ when: { a: 1 }, action: 'first', priority: 5 }, { when: { a: 1 }, action: 'second', priority: 5 }];
  assert.equal(evaluate(rules, { a: 1 }), 'first');
});
