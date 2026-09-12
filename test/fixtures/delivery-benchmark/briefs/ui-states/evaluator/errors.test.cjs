'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { render, tags, byId, inner } = require('./markup.cjs');
test('error state', () => {
  const h = render({ values: { email: 'nope' }, errors: { email: 'Enter a valid email address', password: 'Enter a password' } });
  for (const [id, msg] of [['email', 'Enter a valid email address'], ['password', 'Enter a password']]) {
    const input = byId(h, 'input', id); assert.ok(input, `input #${id}`);
    assert.equal(input.attrs['aria-invalid'], 'true', `${id} aria-invalid`);
    assert.equal(input.attrs['aria-describedby'], `${id}-error`, `${id} aria-describedby`);
    const p = byId(h, 'p', `${id}-error`); assert.ok(p, `error element for ${id}`); assert.equal(p.attrs.class, 'error');
    assert.equal((inner(h, 'p', `${id}-error`) || '').trim(), msg);
    assert.ok(p.index > input.index, 'the error element follows its input');
  }
  const summary = tags(h, 'div').find(d => d.attrs.role === 'alert'); assert.ok(summary, 'a role=alert summary'); assert.equal(summary.attrs.id, 'form-errors');
  assert.ok(summary.index < byId(h, 'input', 'email').index, 'the summary precedes the fields');
  const body = inner(h, 'div', 'form-errors') || '';
  assert.match(body, /<ul>[\s\S]*<\/ul>/);
  for (const id of ['email', 'password']) assert.match(body, new RegExp(`<a href="#${id}">`), `link to #${id}`);
  assert.match(body, /Enter a valid email address/); assert.match(body, /Enter a password/);
});
test('one error leaves the other field clean', () => {
  const h = render({ errors: { password: 'Enter a password' } });
  assert.notEqual(byId(h, 'input', 'email').attrs['aria-invalid'], 'true'); assert.ok(!byId(h, 'p', 'email-error'));
  assert.equal(byId(h, 'input', 'password').attrs['aria-invalid'], 'true');
});
