'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { render, tags } = require('./markup.cjs');
test('submitting state', () => {
  const h = render({ values: { email: 'a@b.c', password: 'longenough' }, submitting: true });
  assert.equal(tags(h, 'form')[0].attrs['aria-busy'], 'true');
  const button = tags(h, 'button').find(b => b.attrs.type === 'submit'); assert.ok(button); assert.equal(button.attrs.disabled, true, 'disabled');
  assert.match(h, /<button[^>]*>\s*Signing up…\s*<\/button>/);
});
