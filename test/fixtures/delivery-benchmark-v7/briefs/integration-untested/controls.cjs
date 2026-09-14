'use strict';
// Controls for integration-untested.
//   omitted        — no retry at all
//   retries-4xx    — retries everything, including the statuses the brief says not to retry
//   swallows       — retries, then resolves with null instead of rejecting
const CORRECT = `'use strict';
const RETRY = new Set([500, 502, 503]);
async function fetchJson(transport, url) {
  let last = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await transport(url);
    last = response.status;
    if (response.status === 200) {
      try { return JSON.parse(response.body); } catch { throw new Error('invalid JSON body'); }
    }
    if (!RETRY.has(response.status)) throw new Error('request failed: ' + response.status);
  }
  throw new Error('request failed after 3 attempts: ' + last);
}
module.exports = { fetchJson };
`;
const NO_RETRY = `'use strict';
async function fetchJson(transport, url) {
  const response = await transport(url);
  if (response.status !== 200) throw new Error('request failed: ' + response.status);
  try { return JSON.parse(response.body); } catch { throw new Error('invalid JSON body'); }
}
module.exports = { fetchJson };
`;
const RETRY_ALL = `'use strict';
async function fetchJson(transport, url) {
  let last = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await transport(url);
    last = response.status;
    if (response.status === 200) {
      try { return JSON.parse(response.body); } catch { throw new Error('invalid JSON body'); }
    }
  }
  throw new Error('request failed after 3 attempts: ' + last);
}
module.exports = { fetchJson };
`;
const SWALLOWS = `'use strict';
const RETRY = new Set([500, 502, 503]);
async function fetchJson(transport, url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await transport(url);
    if (response.status === 200) {
      try { return JSON.parse(response.body); } catch { throw new Error('invalid JSON body'); }
    }
    if (!RETRY.has(response.status)) throw new Error('request failed: ' + response.status);
  }
  return null;
}
module.exports = { fetchJson };
`;
const TESTS = `const test = require('node:test');
const assert = require('node:assert/strict');
const { fetchJson } = require('../src/client.js');
test('parses a 200', async () => {
  assert.deepEqual(await fetchJson(async () => ({ status: 200, body: '{"a":1}' }), '/x'), { a: 1 });
});
`;

function evidenceCommit(ws, lib, sha, { variant, date }) {
  const base = lib.git(ws, 'rev-parse', 'HEAD~1');
  const named = variant === 'stale-evidence' ? base : sha;
  const manifestPath = `.prd/evidence/prd-v1/${named}/manifest.json`;
  const log = 'checks passed\n';
  const logPath = `.prd/evidence/prd-v1/${named}/checks/C-01.log`;
  lib.write(ws, logPath, log);
  const manifest = {
    schema: 1, prd: '.prd/prd-v1.md', base, candidate: named, created: '2026-09-14T00:00:00Z',
    checks: [{ id: 'C-01', kind: 'command', required: true, result: 'passed', command: 'npm test', artifacts: [logPath] }],
    artifacts: [{ path: logPath, sha256: lib.sha256(log) }],
  };
  lib.write(ws, manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  if (variant === 'unlisted-artifact') {
    // Present in the evidence directory, absent from the manifest's artifact list.
    lib.write(ws, `.prd/evidence/prd-v1/${named}/checks/C-99.log`, 'a log nothing admits to\n');
  }
  lib.write(ws, 'NOTES.md', `---\nprd: .prd/prd-v1.md\nbase: ${base}\ncandidate: ${named}\nevidence: ${manifestPath}\n---\n# Evaluation\nChecks passed on ${named.slice(0, 7)}.\n`);
  // Only the evaluation's own files: NOTES.md and the evidence directory.
  return lib.commitPaths(ws, `evaluate: candidate ${named.slice(0, 7)}`, ['NOTES.md', '.prd/evidence'], date);
}

function apply(ws, variant, lib, { date } = {}) {
  const source = variant === 'omitted' ? NO_RETRY : variant === 'retries-4xx' ? RETRY_ALL : variant === 'swallows' ? SWALLOWS : CORRECT;
  lib.write(ws, 'src/client.js', source);
  lib.write(ws, 'test/client.test.js', TESTS);
  const sha = lib.commitAll(ws, 'Add retry behaviour and tests', date);
  if (variant === 'evaluated' || variant === 'stale-evidence') return evidenceCommit(ws, lib, sha, { variant, date });
  return sha;
}
module.exports = {
  variants: ['control', 'evaluated', 'omitted', 'retries-4xx', 'swallows', 'stale-evidence'],
  accepted: ['control', 'evaluated'],
  faults: { omitted: 'retries', 'retries-4xx': 'no-retry-on-4xx', swallows: 'exhaustion', 'stale-evidence': 'evidence-binding' },
  apply,
};
