'use strict';
// Controls for handoff-two-changes.
//   lost-continuity — the second session reimplements Change 1 and never gets to Change 2,
//                     which is what losing the thread across a handoff actually looks like
//   parse-only      — the second session delivers Change 2 but drops Change 1 on the way
const SYMBOLS = "const SYMBOL = { USD: '$', EUR: '€' };";
const FORMAT = `${SYMBOLS}
function format(cents, currency) {
  const symbol = SYMBOL[currency];
  if (!symbol) throw new Error('unsupported currency: ' + currency);
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return sign + symbol + Math.floor(abs / 100) + '.' + String(abs % 100).padStart(2, '0');
}`;
const PARSE = `function parse(text) {
  const m = /^(-?)([$€])(\\d+)\\.(\\d{2})$/.exec(String(text));
  if (!m) throw new Error('cannot parse: ' + text);
  const currency = m[2] === '$' ? 'USD' : 'EUR';
  const cents = (Number(m[3]) * 100 + Number(m[4])) * (m[1] === '-' ? -1 : 1);
  return { cents, currency };
}`;
const both = `'use strict';
${FORMAT}
${PARSE}
module.exports = { format, parse };
`;
const formatOnly = `'use strict';
${FORMAT}
module.exports = { format };
`;
const parseOnly = `'use strict';
${PARSE}
module.exports = { parse };
`;
const TESTS = `const test = require('node:test');
const assert = require('node:assert/strict');
const money = require('../src/money.js');
test('module loads', () => { assert.ok(money); });
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
  lib.write(ws, 'src/money.js', formatOnly);
  lib.write(ws, 'test/money.test.js', TESTS);
  const first = lib.commitAll(ws, 'Change 1: format', date);
  if (variant === 'lost-continuity') { lib.write(ws, 'src/money.js', formatOnly); return lib.commitAll(ws, 'Change 1 again', date); }
  lib.write(ws, 'src/money.js', variant === 'parse-only' ? parseOnly : both);
  const sha = lib.commitAll(ws, 'Change 2: parse', date);
  if (variant === 'evaluated' || variant === 'stale-evidence') return evidenceCommit(ws, lib, sha, { variant, date });
  return sha;
}
module.exports = {
  variants: ['control', 'evaluated', 'lost-continuity', 'parse-only', 'stale-evidence'],
  accepted: ['control', 'evaluated'],
  faults: { 'lost-continuity': 'change-2', 'parse-only': 'change-1', 'stale-evidence': 'evidence-binding' },
  apply,
};
