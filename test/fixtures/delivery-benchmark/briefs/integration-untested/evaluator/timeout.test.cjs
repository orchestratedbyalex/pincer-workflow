'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { client, scripted, withDeadline } = require('./common.cjs');
test('a hanging server rejects TIMEOUT within (retries + 1) × timeout plus a margin', async () => {
  const s = await scripted(['hang', 'hang', 'hang']);
  const started = Date.now();
  try {
    await assert.rejects(withDeadline(3000, client.fetchStatus(s.url, { timeout: 300, retries: 1 })), e => { assert.equal(e.code, 'TIMEOUT', `code ${e.code}: ${e.message}`); assert.equal(e.attempts, 2); return true; });
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 2000, `settled in ${elapsed} ms`);
    assert.equal(s.calls.length, 2, 'two attempts were made');
  } finally { s.close(); }
});
