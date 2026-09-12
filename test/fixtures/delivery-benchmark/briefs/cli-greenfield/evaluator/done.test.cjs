'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fresh, run, fs } = require('./common.cjs');
test('done marks the item and list shows it', () => {
  const f = fresh();
  run(f, 'add', 'one'); run(f, 'add', 'two');
  const d = run(f, 'done', '2');
  assert.equal(d.status, 0, d.stderr); assert.equal(d.stdout, 'done #2\n');
  assert.equal(run(f, 'list').stdout, '#1 [ ] one\n#2 [x] two\n', 'the item is marked in the stored list');
  assert.equal(run(f, 'done', '2').stdout, 'done #2\n', 'marking again is fine');
});
test('a missing item is refused and the file is unchanged', () => {
  const f = fresh();
  run(f, 'add', 'one');
  const before = fs.readFileSync(f, 'utf8');
  const r = run(f, 'done', '7');
  assert.equal(r.status, 1); assert.equal(r.stderr, 'no such item: 7\n'); assert.equal(r.stdout, '');
  assert.equal(fs.readFileSync(f, 'utf8'), before);
  assert.equal(run(f, 'list').stdout, '#1 [ ] one\n');
});
