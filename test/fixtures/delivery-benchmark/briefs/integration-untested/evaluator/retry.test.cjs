'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { client, scripted, withDeadline } = require('./common.cjs');
test('503, 503, 200 resolves after three requests', async () => {
  const s = await scripted([503, 503, 'ok']);
  try { assert.deepEqual(await withDeadline(8000, client.fetchStatus(s.url)), { ok: true, n: 3 }); assert.equal(s.calls.length, 3); } finally { s.close(); }
});
