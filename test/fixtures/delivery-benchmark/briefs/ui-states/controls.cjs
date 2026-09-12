'use strict';
// Controls for ui-states: `control` implements the states; `omitted` renders messages
// but omits the accessibility wiring (aria-invalid, aria-describedby, the alert summary);
// `false-success` keeps the stub validator (always {}) while rendering error states, and
// its own tests only cover render; `stale-evidence`.
const FORM = `'use strict';
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const FIELDS = [['email', 'Email', 'email'], ['password', 'Password', 'password']];
function render(state = {}) {
  const v = state.values || {}, e = state.errors || {}, busy = !!state.submitting;
  const out = [\`<form method="post" action="/signup"\${busy ? ' aria-busy="true"' : ''}>\`];
  const ids = FIELDS.map(f => f[0]).filter(id => e[id]);
  __SUMMARY__
  for (const [id, label, type] of FIELDS) {
    out.push(\`  <label for="\${id}">\${label}</label>\`);
    __INPUT__
  }
  out.push(\`  <button type="submit"\${busy ? ' disabled' : ''}>\${busy ? 'Signing up…' : 'Sign up'}</button>\`);
  out.push('</form>');
  return out.join('\\n');
}
module.exports = { render };
`;
const SUMMARY_OK = `if (ids.length) out.push(\`  <div role="alert" id="form-errors"><p>Please fix the following:</p><ul>\${ids.map(id => \`<li><a href="#\${id}">\${esc(e[id])}</a></li>\`).join('')}</ul></div>\`);`;
const INPUT_OK = `out.push(\`  <input id="\${id}" name="\${id}" type="\${type}" value="\${esc(v[id])}"\${e[id] ? \` aria-invalid="true" aria-describedby="\${id}-error"\` : ''}>\`);
    if (e[id]) out.push(\`  <p id="\${id}-error" class="error">\${esc(e[id])}</p>\`);`;
const INPUT_OMITTED = `out.push(\`  <input id="\${id}" name="\${id}" type="\${type}" value="\${esc(v[id])}">\`);
    if (e[id]) out.push(\`  <p class="error">\${esc(e[id])}</p>\`);`;
const VALIDATE_OK = `'use strict';
function validate(values = {}) {
  const out = {};
  const email = String(values.email ?? '').trim(), password = String(values.password ?? '');
  if (!email) out.email = 'Enter your email address';
  else if (!email.includes('@')) out.email = 'Enter a valid email address';
  if (!password) out.password = 'Enter a password';
  else if (password.length < 8) out.password = 'Use at least 8 characters';
  return out;
}
module.exports = { validate };
`;
const TEST_OK = `const test = require('node:test');
const assert = require('node:assert/strict');
const { render } = require('../src/form.js');
const { validate } = require('../src/validate.js');
test('empty state', () => { const h = render(); assert.match(h, /<label for="email">/); assert.doesNotMatch(h, /role="alert"/); assert.match(h, />Sign up</); });
test('error state', () => { const h = render({ errors: { email: 'Enter your email address' } }); assert.match(h, /role="alert"/); assert.match(h, /id="email-error"/); });
test('submitting', () => { const h = render({ submitting: true }); assert.match(h, /aria-busy="true"/); assert.match(h, /disabled/); assert.match(h, /Signing up…/); });
__VALIDATE__
`;
const TEST_VALIDATE = `test('validate', () => { assert.deepEqual(validate({ email: 'a@b.c', password: 'longenough' }), {}); assert.equal(validate({}).email, 'Enter your email address'); assert.equal(validate({ email: 'nope', password: 'short' }).password, 'Use at least 8 characters'); });`;
function apply(ws, variant, lib, { date } = {}) {
  lib.write(ws, 'src/form.js', FORM.replace('__SUMMARY__', variant === 'omitted' ? '' : SUMMARY_OK).replace('__INPUT__', variant === 'omitted' ? INPUT_OMITTED : INPUT_OK));
  if (variant !== 'false-success') lib.write(ws, 'src/validate.js', VALIDATE_OK);
  lib.write(ws, 'test/form.test.js', TEST_OK.replace('__VALIDATE__', variant === 'false-success' ? '' : TEST_VALIDATE).replace(variant === 'omitted' ? 'assert.match(h, /role="alert"/); assert.match(h, /id="email-error"/);' : '__none__', 'assert.match(h, /class="error"/);'));
  const sha = lib.commitAll(ws, 'Add validation and accessible error states', date);
  if (variant === 'stale-evidence') {
    const other = lib.git(ws, 'rev-parse', 'HEAD~1');
    lib.write(ws, 'NOTES.md', `---\nprd: .prd/prd-v1.md\nbase: ${other}\ncandidate: ${other}\nevidence: .prd/evidence/prd-v1/${other}/manifest.json\n---\n`);
    lib.write(ws, `.prd/evidence/prd-v1/${other}/manifest.json`, `${JSON.stringify({ schema: 1, candidate: other }, null, 2)}\n`);
    return lib.commitAll(ws, 'evaluate: candidate ' + other.slice(0, 7), date);
  }
  return sha;
}
module.exports = { variants: ['control', 'omitted', 'false-success', 'stale-evidence'], faults: { omitted: 'error-state', 'false-success': 'validator', 'stale-evidence': 'evidence-binding' }, apply };
