'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { client, scripted, withDeadline } = require('./common.cjs');
test('200 resolves with one request', async () => {
  const s = await scripted(['ok']);
  try { assert.deepEqual(await withDeadline(5000, client.fetchStatus(s.url)), { ok: true, n: 1 }); assert.equal(s.calls.length, 1); } finally { s.close(); }
});
