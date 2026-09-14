'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { render, tags, byId } = require('./markup.cjs');
test('empty state', () => {
  const h = render();
  for (const id of ['email', 'password']) {
    const input = byId(h, 'input', id); assert.ok(input, `input #${id}`);
    assert.equal(input.attrs.name, id); assert.ok(tags(h, 'label').some(l => l.attrs.for === id), `label for ${id}`);
    assert.notEqual(input.attrs['aria-invalid'], 'true', `${id} not invalid`); assert.ok(!byId(h, 'p', `${id}-error`), `no error element for ${id}`);
  }
  assert.ok(!tags(h, 'div').some(d => d.attrs.role === 'alert'), 'no summary without errors');
  assert.match(h, /<button[^>]*type="submit"[^>]*>\s*Sign up\s*<\/button>/); assert.doesNotMatch(h, /aria-busy="true"/);
});
