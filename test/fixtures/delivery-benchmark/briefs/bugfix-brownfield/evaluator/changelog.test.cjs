'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
test('CHANGELOG Unreleased mentions slugify', () => {
  const text = fs.readFileSync(path.join(process.env.CANDIDATE, 'CHANGELOG.md'), 'utf8');
  const unreleased = /## Unreleased\n([\s\S]*?)(?=\n## |$)/.exec(text);
  assert.ok(unreleased, 'an Unreleased section');
  assert.match(unreleased[1], /slugify/i, 'the entry names slugify');
  assert.doesNotMatch(text, /Ideas \(not for release\)/, 'the unrelated draft section was not committed');
});
