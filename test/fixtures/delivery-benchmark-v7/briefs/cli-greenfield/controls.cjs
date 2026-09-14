'use strict';
// Controls for cli-greenfield. `control` is correct. Each fault targets exactly one
// held-out check, so a check that stops failing has stopped testing something.
//   omitted          — separators are not collapsed, so "a -- b" keeps a double dash
//   false-success    — prints a slug-shaped string without transforming anything, and its
//                      own test asserts only that something was printed
//   unlisted-artifact — correct code whose evidence directory holds a file the manifest
//                      does not list
//   stale-evidence   — correct code whose evidence names a different commit
const IMPL = text => `#!/usr/bin/env node
'use strict';
const words = process.argv.slice(2);
if (!words.length) { process.stderr.write('usage: slug <text...>\\n'); process.exit(2); }
const joined = words.join(' ');
${text}
if (!slug) { process.stderr.write('slug: no slug characters\\n'); process.exit(1); }
process.stdout.write(slug + '\\n');
`;
const CORRECT = "const slug = joined.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');";
const NO_COLLAPSE = "const slug = joined.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/^-+|-+$/g, '');";
const FALSE_SUCCESS = "const slug = joined.trim();";

const TEST_FULL = `const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const bin = path.join(__dirname, '..', 'bin', 'slug.js');
const run = (...args) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' });
test('slugs text', () => {
  assert.equal(run('Hello,', 'World!').stdout, 'hello-world\\n');
  assert.equal(run('a', '--', 'b').stdout, 'a-b\\n');
  assert.equal(run('Top', '10', 'Things').stdout, 'top-10-things\\n');
  assert.equal(run('...').status, 1);
  assert.equal(run().status, 2);
});
`;
// The false-success variant's own suite asserts only that something was printed, which is
// how a candidate passes its own tests while failing the held-out ones.
const TEST_WEAK = `const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const bin = path.join(__dirname, '..', 'bin', 'slug.js');
test('prints something', () => {
  const r = spawnSync(process.execPath, [bin, 'Hello'], { encoding: 'utf8' });
  assert.ok(r.stdout.length > 0);
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
  const body = variant === 'omitted' ? NO_COLLAPSE : variant === 'false-success' ? FALSE_SUCCESS : CORRECT;
  lib.write(ws, 'bin/slug.js', IMPL(body));
  lib.write(ws, 'test/slug.test.js', variant === 'false-success' ? TEST_WEAK : TEST_FULL);
  lib.write(ws, 'README.md', '# slug-cli\n\n## Commands\n\n- `node bin/slug.js <text...>` — print the slug of the text\n');
  const sha = lib.commitAll(ws, 'Implement the slug command', date);
  if (variant === 'evaluated' || variant === 'stale-evidence' || variant === 'unlisted-artifact') return evidenceCommit(ws, lib, sha, { variant, date });
  return sha;
}
module.exports = {
  variants: ['control', 'evaluated', 'omitted', 'false-success', 'stale-evidence', 'unlisted-artifact'],
  accepted: ['control', 'evaluated'],
  faults: { omitted: 'slug-rules', 'false-success': 'slug-rules', 'stale-evidence': 'evidence-binding', 'unlisted-artifact': 'evidence-binding' },
  apply,
};
