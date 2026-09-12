'use strict';
// Base repository for bugfix-brownfield: a string library with a slugify bug, a passing
// suite for truncate, a CHANGELOG and README conventions; then two unrelated uncommitted
// edits that every session must leave alone.
const SLUGIFY_BUGGY = `'use strict';
// Turn a title into a URL slug.
function slugify(input) {
  return String(input).toLowerCase().replace(/[^a-z0-9]/g, '-');
}
module.exports = { slugify };
`;
const TRUNCATE = `'use strict';
// Truncate text to at most max characters, appending an ellipsis when cut.
function truncate(text, max) {
  const s = String(text);
  if (!Number.isInteger(max) || max < 1) throw new RangeError('max must be a positive integer');
  if (s.length <= max) return s;
  return max === 1 ? '…' : s.slice(0, max - 1) + '…';
}
module.exports = { truncate };
`;
const TESTS = `const test = require('node:test');
const assert = require('node:assert/strict');
const { truncate } = require('../lib/truncate.js');
const { slugify } = require('../lib/slugify.js');
test('truncate keeps short text', () => assert.equal(truncate('abc', 5), 'abc'));
test('truncate cuts with an ellipsis', () => assert.equal(truncate('abcdef', 4), 'abc…'));
test('truncate rejects a bad max', () => assert.throws(() => truncate('abc', 0), RangeError));
test('slugify lower-cases', () => assert.equal(slugify('Hello'), 'hello'));
`;
module.exports = {
  create(ws, lib) {
    lib.write(ws, 'package.json', `${JSON.stringify({ name: 'strutil', version: '1.2.0', private: true, scripts: { test: 'node --test' } }, null, 2)}\n`);
    lib.write(ws, 'README.md', '# strutil\n\nSmall string helpers.\n\n## Conventions\n\n- Tests live in `test/` and run with `npm test` (node:test, no dependencies).\n- Every user-visible change gets a line under "Unreleased" in CHANGELOG.md.\n- One commit per change; do not commit unrelated files.\n');
    lib.write(ws, 'CHANGELOG.md', '# Changelog\n\n## Unreleased\n\n## 1.2.0\n\n- truncate: reject a non-positive max.\n');
    lib.write(ws, 'lib/slugify.js', SLUGIFY_BUGGY);
    lib.write(ws, 'lib/truncate.js', TRUNCATE);
    lib.write(ws, 'test/strutil.test.js', TESTS);
    lib.write(ws, '.gitignore', 'node_modules/\n');
    lib.gitInit(ws);
    lib.commitAll(ws, 'strutil 1.2.0');
  },
  // Applied after every commit of the base (and of the kit): uncommitted edits unrelated to the task.
  unrelated(ws, lib) {
    const fs = require('node:fs');
    const path = require('node:path');
    const draft = '\n## Ideas (not for release)\n\n- consider a `titleCase` helper — draft, do not ship\n';
    lib.write(ws, 'CHANGELOG.md', `${fs.readFileSync(path.join(ws, 'CHANGELOG.md'), 'utf8')}${draft}`);
    const scratch = 'personal notes — not part of any change\n- ask about the release date\n';
    lib.write(ws, 'scratch/todo.txt', scratch);
    return { 'CHANGELOG.md': { kind: 'append', text: draft }, 'scratch/todo.txt': { kind: 'untracked', content: scratch } };
  }
};
