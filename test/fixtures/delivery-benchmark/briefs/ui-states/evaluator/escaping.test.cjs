'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { render, byId } = require('./markup.cjs');
test('values are escaped', () => {
  const h = render({ values: { email: '"><script>alert(1)</script>&x' } });
  assert.doesNotMatch(h, /<script>/, 'no raw script tag');
  assert.equal(byId(h, 'input', 'email').attrs.value, '&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;&amp;x');
});
