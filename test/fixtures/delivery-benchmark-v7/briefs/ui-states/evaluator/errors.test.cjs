'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { render } = require(path.join(process.env.CANDIDATE, 'src', 'form.js'));
const html = () => render({ mode: 'error', values: { email: 'nope' }, errors: { email: 'Enter a valid email' } });

test('the invalid input is marked and described', () => {
  assert.match(html(), /aria-invalid="true"/);
  assert.match(html(), /aria-describedby="email-error"/);
  assert.match(html(), /id="email-error"/);
});
test('an alert summary lists the messages', () => {
  assert.match(html(), /role="alert"/);
  assert.match(html(), /Enter a valid email/);
});
