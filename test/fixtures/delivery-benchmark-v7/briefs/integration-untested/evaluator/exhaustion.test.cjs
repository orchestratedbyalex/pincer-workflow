'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { fetchJson } = require(path.join(process.env.CANDIDATE, 'src', 'client.js'));

test('exhausted retries reject rather than resolving', async () => {
  await assert.rejects(() => fetchJson(async () => ({ status: 502, body: '' }), '/x'), { message: 'request failed after 3 attempts: 502' });
});
