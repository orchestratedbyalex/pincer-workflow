'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { render } = require(path.join(process.env.CANDIDATE, 'src', 'form.js'));

test('the empty state binds its label and offers Sign up', () => {
  const html = render({ mode: 'empty', values: {}, errors: {} });
  assert.match(html, /<label for="email">/);
  assert.match(html, /id="email"/);
  assert.match(html, />Sign up</);
});
test('the empty state has no error summary', () => {
  assert.doesNotMatch(render({ mode: 'empty', values: {}, errors: {} }), /role="alert"/);
});
