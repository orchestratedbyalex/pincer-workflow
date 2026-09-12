'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { truncate } = require(path.join(process.env.CANDIDATE, 'lib', 'truncate.js'));
test('keeps short text', () => assert.equal(truncate('abc', 5), 'abc'));
test('cuts with an ellipsis', () => assert.equal(truncate('abcdef', 4), 'abc…'));
test('max 1 is the ellipsis', () => assert.equal(truncate('abc', 1), '…'));
test('rejects a bad max', () => assert.throws(() => truncate('abc', 0), RangeError));
