'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { client, scripted, withDeadline } = require('./common.cjs');
test('three 503s reject UPSTREAM with attempts 3 and exactly three requests', async () => {
  const s = await scripted([503, 503, 503, 503]);
  try {
    await assert.rejects(withDeadline(8000, client.fetchStatus(s.url)), e => { assert.equal(e.code, 'UPSTREAM', `code ${e.code}: ${e.message}`); assert.equal(e.attempts, 3); assert.ok(e instanceof client.ClientError, 'a ClientError'); return true; });
    assert.equal(s.calls.length, 3);
  } finally { s.close(); }
});
