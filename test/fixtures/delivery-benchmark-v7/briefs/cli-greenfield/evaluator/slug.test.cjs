'use strict';
// Held out of the workspace: the candidate never sees these cases.
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const bin = path.join(process.env.CANDIDATE, 'bin', 'slug.js');
const run = (...args) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' });

test('lowercases, replaces and trims', () => {
  assert.equal(run('  Hello,', ' ', 'World!  ').stdout, 'hello-world\n');
});
test('collapses runs of separators', () => {
  assert.equal(run('a', '--', 'b').stdout, 'a-b\n');
  assert.equal(run('a...b').stdout, 'a-b\n');
});
test('keeps digits', () => {
  assert.equal(run('Top', '10', 'Things').stdout, 'top-10-things\n');
});
test('refuses text with no slug characters', () => {
  const r = run('...');
  assert.equal(r.status, 1);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /no slug characters/);
});
test('refuses no arguments', () => {
  const r = run();
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage: slug/);
});
