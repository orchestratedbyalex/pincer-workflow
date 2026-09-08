// R-02 acceptance set: a behavioral check must fail on controlled faulty
// implementations that keep every identifier intact, and pass on the correct
// one, while an identifier grep passes on all of them. Each fault runs in a
// fresh disposable fixture so one failure cannot mask another. This is a small
// policy demonstration, not mutation testing and not proof that arbitrary
// agent-authored tests are sufficient.
import assert from 'node:assert/strict';
import { tempDir, write, run } from './helpers.js';

const correct = `'use strict';
// parseAge: accepts a 1-3 digit string up to 150, rejects anything else.
function parseAge(input) {
  if (typeof input !== 'string' || !/^\\d{1,3}$/.test(input)) throw new RangeError('age must be digits');
  const n = Number(input);
  if (n > 150) throw new RangeError('age out of range');
  return n;
}
// greet: existing behavior that must be preserved.
function greet(name) { return 'Hello, ' + name + '!'; }
module.exports = { parseAge, greet };
`;

const faults = {
  'behavior broken, identifiers retained': correct.replace('return n;', 'return n + 1;'),
  'invalid input accepted': correct.replace("!/^\\d{1,3}$/.test(input)", 'false'),
  'existing behavior regressed': correct.replace("'Hello, ' + name + '!'", "'Hello ' + name"),
};
for (const [label, source] of Object.entries(faults)) assert.notEqual(source, correct, `${label}: fault applied`);

const behavioralCheck = `const assert = require('node:assert/strict');
const { parseAge, greet } = require('./validate.js');
assert.equal(parseAge('42'), 42, 'happy path');
assert.throws(() => parseAge('abc'), RangeError, 'rejects non-digits');
assert.throws(() => parseAge('200'), RangeError, 'rejects out of range');
assert.equal(greet('Ada'), 'Hello, Ada!', 'preserves greet');
console.log('behavior ok');
`;
const grepCheck = 'grep -q parseAge validate.js && grep -q RangeError validate.js && grep -q greet validate.js && node -e "require(\'./validate.js\')"';

function fixture(source) {
  const dir = tempDir();
  write(dir, 'validate.js', source);
  write(dir, 'check.js', behavioralCheck);
  return dir;
}
const behavioral = dir => run(dir, 'node', ['check.js']);
const grep = dir => run(dir, 'bash', ['-ec', grepCheck]);

const good = fixture(correct);
assert.equal(behavioral(good).status, 0, 'behavioral check passes on the correct implementation');
assert.equal(grep(good).status, 0, 'grep check passes on the correct implementation');

for (const [label, source] of Object.entries(faults)) {
  const dir = fixture(source);
  const result = behavioral(dir);
  assert.notEqual(result.status, 0, `behavioral check fails on: ${label}`);
  assert.match(result.stderr, /AssertionError|happy path|rejects|preserves/, `${label}: failure names the broken behavior`);
  assert.equal(grep(dir).status, 0, `identifier grep still passes on: ${label} (so it proves nothing)`);
}

console.log(`behavioral verification acceptance set passed (${Object.keys(faults).length} controlled faults)`);
