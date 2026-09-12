'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { fresh, run, fs } = require('./common.cjs');
test('B1 clear empties the list; --dry-run changes nothing', () => {
  const f = fresh();
  run(f, 'add', 'a'); run(f, 'add', 'b');
  const d = run(f, 'clear', '--dry-run'); assert.equal(d.status, 0, d.stderr); assert.equal(d.stdout, 'cleared 2 notes\n');
  assert.deepEqual(JSON.parse(fs.readFileSync(f, 'utf8')), ['a', 'b'], 'dry run kept the notes');
  const c = run(f, 'clear'); assert.equal(c.status, 0, c.stderr); assert.equal(c.stdout, 'cleared 2 notes\n');
  assert.deepEqual(JSON.parse(fs.readFileSync(f, 'utf8')), []);
  assert.equal(run(f, 'clear').stdout, 'cleared 0 notes\n');
});
