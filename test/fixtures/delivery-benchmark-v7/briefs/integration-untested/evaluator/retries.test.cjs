'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { fetchJson } = require(path.join(process.env.CANDIDATE, 'src', 'client.js'));

test('a 503 then a 200 resolves after one retry', async () => {
  const seen = [];
  const transport = async () => { seen.push(1); return seen.length < 2 ? { status: 503, body: '' } : { status: 200, body: '{"ok":true}' }; };
  assert.deepEqual(await fetchJson(transport, '/x'), { ok: true });
  assert.equal(seen.length, 2);
});
test('a 500 is retried twice before giving up', async () => {
  let calls = 0;
  const transport = async () => { calls++; return { status: 500, body: '' }; };
  await assert.rejects(() => fetchJson(transport, '/x'));
  assert.equal(calls, 3, 'three attempts in total');
});
test('a valid 200 body is parsed', async () => {
  assert.deepEqual(await fetchJson(async () => ({ status: 200, body: '{"a":1}' }), '/x'), { a: 1 });
});
