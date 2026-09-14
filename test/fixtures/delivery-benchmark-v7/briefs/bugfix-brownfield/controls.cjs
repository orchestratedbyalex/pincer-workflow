'use strict';
// Controls for bugfix-brownfield.
//   omitted        — the defect is untouched
//   over-truncates — the boundary is fixed but the result is still one character too long
//   breaks-errors  — the defect is fixed by removing the input validation the brief says to keep
//   stale-evidence — correct code whose evidence names another commit
const FIXED = `'use strict';
function truncate(text, limit) {
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('limit must be at least 1');
  if (text.length <= limit) return text;
  return text.slice(0, limit - 1) + '…';
}
module.exports = { truncate };
`;
const BUGGY = `'use strict';
function truncate(text, limit) {
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('limit must be at least 1');
  if (text.length < limit) return text;
  return text.slice(0, limit) + '…';
}
module.exports = { truncate };
`;
const OVER = `'use strict';
function truncate(text, limit) {
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('limit must be at least 1');
  if (text.length <= limit) return text;
  return text.slice(0, limit) + '…';
}
module.exports = { truncate };
`;
const NO_GUARDS = `'use strict';
function truncate(text, limit) {
  if (String(text).length <= limit) return String(text);
  return String(text).slice(0, limit - 1) + '…';
}
module.exports = { truncate };
`;
const REGRESSION = `
test('a string exactly at the limit is unchanged', () => { assert.equal(truncate('abcde', 5), 'abcde'); });
test('a truncated result is never longer than the limit', () => { assert.equal(truncate('abcdef', 5).length, 5); });
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
  const source = variant === 'omitted' ? BUGGY : variant === 'over-truncates' ? OVER : variant === 'breaks-errors' ? NO_GUARDS : FIXED;
  lib.write(ws, 'src/truncate.js', source);
  const fs = require('node:fs');
  const path = require('node:path');
  if (variant !== 'omitted') fs.appendFileSync(path.join(ws, 'test/truncate.test.js'), REGRESSION);
  lib.write(ws, 'CHANGELOG.md', '# Changelog\n\n## Unreleased\n\n- fix the truncate boundary\n\n## 0.1.0\n\n- initial release\n');
  const sha = lib.commitPaths(ws, 'Fix the truncate boundary', ['src/truncate.js', 'test/truncate.test.js', 'CHANGELOG.md'], date);
  if (variant === 'evaluated' || variant === 'stale-evidence') return evidenceCommit(ws, lib, sha, { variant, date });
  return sha;
}
module.exports = {
  variants: ['control', 'evaluated', 'omitted', 'over-truncates', 'breaks-errors', 'stale-evidence'],
  accepted: ['control', 'evaluated'],
  faults: { omitted: 'boundary', 'over-truncates': 'boundary', 'breaks-errors': 'existing-behaviour', 'stale-evidence': 'evidence-binding' },
  apply,
};
