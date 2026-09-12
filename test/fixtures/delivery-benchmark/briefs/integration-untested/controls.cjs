'use strict';
// Controls for integration-untested: `control` retries with a timeout; `omitted` has
// retries but no timeout (a hanging server hangs the caller); `false-success` swallows
// failures and resolves { status: 'unknown' } while its own tests pass; `stale-evidence`.
const IMPL = `'use strict';
const http = require('node:http');
class ClientError extends Error {
  constructor(code, message, attempts) { super(message); this.name = 'ClientError'; this.code = code; this.attempts = attempts; }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
function attempt(url, timeout) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    __TIMEOUT__
    req.on('error', e => reject({ network: e }));
  });
}
async function fetchStatus(baseUrl, options = {}) {
  const timeout = options.timeout ?? 1000;
  const retries = options.retries ?? 2;
  let last = null;
  for (let n = 1; n <= retries + 1; n++) {
    try {
      const r = await attempt(\`\${baseUrl}/status\`, timeout);
      if (r.status >= 200 && r.status < 300) return JSON.parse(r.body);
      if (r.status >= 400 && r.status < 500) throw new ClientError('REJECTED', \`status \${r.status}\`, n);
      last = { upstream: r.status };
    } catch (e) {
      if (e instanceof ClientError) throw e;
      last = e;
    }
    if (n <= retries) await sleep(100);
  }
  const attempts = retries + 1;
  __FINAL__
}
module.exports = { fetchStatus, ClientError };
`;
const TIMEOUT_OK = `req.setTimeout(timeout, () => { req.destroy(); reject({ timeout: true }); });`;
const FINAL_OK = `if (last && last.timeout) throw new ClientError('TIMEOUT', \`no response within \${timeout} ms after \${attempts} attempts\`, attempts);
  throw new ClientError('UPSTREAM', \`upstream failed after \${attempts} attempts\`, attempts);`;
const FINAL_FALSE = `return { status: 'unknown', attempts };`;
const TEST = `const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { fetchStatus, ClientError } = require('../lib/client.js');
function server(handler) { return new Promise(resolve => { const s = http.createServer(handler); s.listen(0, '127.0.0.1', () => resolve({ url: \`http://127.0.0.1:\${s.address().port}\`, close: () => s.close() })); }); }
test('success', async () => {
  const s = await server((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); });
  try { assert.deepEqual(await fetchStatus(s.url), { ok: true }); } finally { s.close(); }
});
test('retry then success', async () => {
  let n = 0;
  const s = await server((req, res) => { n++; if (n < 3) { res.writeHead(503); res.end(); } else { res.writeHead(200); res.end('{"ok":true}'); } });
  try { assert.deepEqual(await fetchStatus(s.url), { ok: true }); assert.equal(n, 3); } finally { s.close(); }
});
__EXTRA__
`;
const TEST_EXTRA_OK = `test('exhausted retries', async () => {
  const s = await server((req, res) => { res.writeHead(503); res.end(); });
  try { await assert.rejects(fetchStatus(s.url), e => e instanceof ClientError && e.code === 'UPSTREAM' && e.attempts === 3); } finally { s.close(); }
});
test('no retry on 4xx', async () => {
  let n = 0;
  const s = await server((req, res) => { n++; res.writeHead(404); res.end(); });
  try { await assert.rejects(fetchStatus(s.url), e => e.code === 'REJECTED'); assert.equal(n, 1); } finally { s.close(); }
});
test('timeout', async () => {
  const s = await server(() => {});
  try { await assert.rejects(fetchStatus(s.url, { timeout: 100, retries: 1 }), e => e.code === 'TIMEOUT' && e.attempts === 2); } finally { s.close(); s.close(); }
});`;
const TEST_EXTRA_FALSE = `test('exhausted retries never throw', async () => {
  const s = await server((req, res) => { res.writeHead(503); res.end(); });
  try { assert.equal((await fetchStatus(s.url)).status, 'unknown'); } finally { s.close(); }
});`;
function apply(ws, variant, lib, { date } = {}) {
  const impl = IMPL.replace('__TIMEOUT__', variant === 'omitted' ? '' : TIMEOUT_OK).replace('__FINAL__', variant === 'false-success' ? FINAL_FALSE : FINAL_OK);
  lib.write(ws, 'lib/client.js', impl);
  lib.write(ws, 'test/client.test.js', TEST.replace('__EXTRA__', variant === 'false-success' ? TEST_EXTRA_FALSE : variant === 'omitted' ? TEST_EXTRA_OK.replace(/test\('timeout'[\s\S]*$/, '') : TEST_EXTRA_OK));
  const sha = lib.commitAll(ws, 'Add retries and a timeout to fetchStatus', date);
  if (variant === 'stale-evidence') {
    const other = lib.git(ws, 'rev-parse', 'HEAD~1');
    lib.write(ws, 'NOTES.md', `---\nprd: .prd/prd-v1.md\nbase: ${other}\ncandidate: ${other}\nevidence: .prd/evidence/prd-v1/${other}/manifest.json\n---\n`);
    lib.write(ws, `.prd/evidence/prd-v1/${other}/manifest.json`, `${JSON.stringify({ schema: 1, candidate: other }, null, 2)}\n`);
    return lib.commitAll(ws, 'evaluate: candidate ' + other.slice(0, 7), date);
  }
  return sha;
}
module.exports = { variants: ['control', 'omitted', 'false-success', 'stale-evidence'], faults: { omitted: 'timeout', 'false-success': 'exhausted', 'stale-evidence': 'evidence-binding' }, apply };
