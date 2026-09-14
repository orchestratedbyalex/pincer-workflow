'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { fetchJson } = require(path.join(process.env.CANDIDATE, 'src', 'client.js'));

test('a 404 is not retried', async () => {
  let calls = 0;
  const transport = async () => { calls++; return { status: 404, body: '' }; };
  await assert.rejects(() => fetchJson(transport, '/x'), { message: 'request failed: 404' });
  assert.equal(calls, 1, 'exactly one attempt');
});
test('a 400 is not retried', async () => {
  let calls = 0;
  await assert.rejects(() => fetchJson(async () => { calls++; return { status: 400, body: '' }; }, '/x'), { message: 'request failed: 400' });
  assert.equal(calls, 1);
});
test('an invalid body is not retried', async () => {
  let calls = 0;
  await assert.rejects(() => fetchJson(async () => { calls++; return { status: 200, body: 'not json' }; }, '/x'), { message: 'invalid JSON body' });
  assert.equal(calls, 1);
});
