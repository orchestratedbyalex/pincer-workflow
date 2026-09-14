'use strict';
// Base repository for bugfix-brownfield: working code with one planted off-by-one, its
// own suite (which does not catch the defect) and a changelog.
const BUGGY = `'use strict';
function truncate(text, limit) {
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('limit must be at least 1');
  if (text.length < limit) return text;
  return text.slice(0, limit) + '…';
}
module.exports = { truncate };
`;
const TESTS = `const test = require('node:test');
const assert = require('node:assert/strict');
const { truncate } = require('../src/truncate.js');
test('short text is unchanged', () => { assert.equal(truncate('hi', 10), 'hi'); });
test('empty text is unchanged', () => { assert.equal(truncate('', 5), ''); });
test('bad input throws', () => {
  assert.throws(() => truncate(5, 3), TypeError);
  assert.throws(() => truncate('x', 0), RangeError);
});
`;
module.exports = {
  create(ws, lib) {
    lib.write(ws, 'package.json', "{\n  \"name\": \"truncate\",\n  \"version\": \"0.1.0\",\n  \"private\": true,\n  \"scripts\": {\n    \"test\": \"node --test\"\n  }\n}\n");
    lib.write(ws, 'src/truncate.js', BUGGY);
    lib.write(ws, 'test/truncate.test.js', TESTS);
    lib.write(ws, 'CHANGELOG.md', '# Changelog\n\n## Unreleased\n\n## 0.1.0\n\n- initial release\n');
    lib.write(ws, 'README.md', '# truncate\n\nA string helper.\n');
    lib.write(ws, '.gitignore', "node_modules/\n");
    lib.gitInit(ws);
    lib.commitAll(ws, 'Existing helper with its suite');
  },
};
