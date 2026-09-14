'use strict';
// Controls for scope-revision.
//   ignored-revision — session 1's answer, committed as if session 2 never happened. It
//                      satisfies the ORIGINAL requirement completely, which is why the
//                      revised check has to be its own row: a study that only checked
//                      "does it work" would accept it.
//   wrong-severity   — appends a message, but picks the lowest level rather than the highest
const LEVELS = "const ORDER = ['info', 'warn', 'error'];";
const COUNTS = `${LEVELS}
function counts(entries) {
  const seen = {};
  for (const e of entries) seen[e.level] = (seen[e.level] || 0) + 1;
  return ORDER.filter(l => seen[l]).map(l => seen[l] + ' ' + l).join(', ');
}`;
const ORIGINAL = `'use strict';
${COUNTS}
function summarize(entries) {
  if (!entries.length) return 'nothing to report';
  return counts(entries);
}
module.exports = { summarize };
`;
const REVISED = `'use strict';
${COUNTS}
function summarize(entries) {
  if (!entries.length) return 'nothing to report';
  const severity = ['error', 'warn', 'info'];
  const top = severity.find(l => entries.some(e => e.level === l));
  const first = entries.find(e => e.level === top);
  return counts(entries) + ': ' + first.message;
}
module.exports = { summarize };
`;
const WRONG_SEVERITY = `'use strict';
${COUNTS}
function summarize(entries) {
  if (!entries.length) return 'nothing to report';
  const severity = ['info', 'warn', 'error'];
  const top = severity.find(l => entries.some(e => e.level === l));
  const first = entries.find(e => e.level === top);
  return counts(entries) + ': ' + first.message;
}
module.exports = { summarize };
`;
const TESTS = `const test = require('node:test');
const assert = require('node:assert/strict');
const { summarize } = require('../src/summarize.js');
test('empty', () => { assert.equal(summarize([]), 'nothing to report'); });
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
  // Session 1 in every variant: the original requirement, committed on its own.
  lib.write(ws, 'src/summarize.js', ORIGINAL);
  lib.write(ws, 'test/summarize.test.js', TESTS);
  const first = lib.commitAll(ws, 'Session 1: counts by level', date);
  if (variant === 'ignored-revision') return first;
  lib.write(ws, 'src/summarize.js', variant === 'wrong-severity' ? WRONG_SEVERITY : REVISED);
  const sha = lib.commitAll(ws, 'Session 2: append the highest-severity message', date);
  if (variant === 'evaluated' || variant === 'stale-evidence') return evidenceCommit(ws, lib, sha, { variant, date });
  return sha;
}
module.exports = {
  variants: ['control', 'evaluated', 'ignored-revision', 'wrong-severity', 'stale-evidence'],
  accepted: ['control', 'evaluated'],
  faults: { 'ignored-revision': 'revised-requirement', 'wrong-severity': 'revised-requirement', 'stale-evidence': 'evidence-binding' },
  apply,
};
