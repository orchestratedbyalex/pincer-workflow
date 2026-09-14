'use strict';
// Base repository for brownfield-maintenance: working code, a suite, a changelog, and a
// scratch file the operator leaves uncommitted so preservation has something to preserve.
const CONFIG = `'use strict';
function merge(base, override) {
  return { ...base, ...override };
}
module.exports = { merge };
`;
const TESTS = `const test = require('node:test');
const assert = require('node:assert/strict');
const { merge } = require('../src/config.js');
test('an empty override returns the base', () => {
  assert.deepEqual(merge({ a: 1 }, {}), { a: 1 });
});
test('merge does not mutate its arguments', () => {
  const base = { a: 1 };
  merge(base, { b: 2 });
  assert.deepEqual(base, { a: 1 });
});
`;
module.exports = {
  create(ws, lib) {
    lib.write(ws, 'package.json', "{\n  \"name\": \"config\",\n  \"version\": \"0.1.0\",\n  \"private\": true,\n  \"scripts\": {\n    \"test\": \"node --test\"\n  }\n}\n");
    lib.write(ws, 'src/config.js', CONFIG);
    lib.write(ws, 'test/config.test.js', TESTS);
    lib.write(ws, 'CHANGELOG.md', '# Changelog\n\n## Unreleased\n\n## 0.2.0\n\n- shallow merge\n');
    lib.write(ws, 'README.md', '# config\n\nConfiguration layering.\n');
    lib.write(ws, '.gitignore', "node_modules/\n");
    lib.gitInit(ws);
    lib.commitAll(ws, 'Working shallow merge with its suite');
  },
};
