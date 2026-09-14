'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { render } = require(path.join(process.env.CANDIDATE, 'src', 'form.js'));

test('values entered by the user are escaped', () => {
  const html = render({ mode: 'error', values: { email: '"><script>alert(1)</script>' }, errors: { email: 'bad' } });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;|&quot;/);
});
