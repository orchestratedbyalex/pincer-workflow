'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { client, scripted, withDeadline } = require('./common.cjs');
test('404 rejects REJECTED after one request', async () => {
  const s = await scripted([404, 404, 404]);
  try {
    await assert.rejects(withDeadline(5000, client.fetchStatus(s.url)), e => { assert.equal(e.code, 'REJECTED', `code ${e.code}: ${e.message}`); assert.equal(e.attempts, 1); return true; });
    assert.equal(s.calls.length, 1, 'no retry on 4xx');
  } finally { s.close(); }
});
