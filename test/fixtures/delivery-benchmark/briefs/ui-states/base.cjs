'use strict';
// Base repository for ui-states: a rendered sign-up form and a stub validator.
const FORM = `'use strict';
// Render the sign-up form. State: { values: { email, password } }.
function render(state = {}) {
  const v = state.values || {};
  return [
    '<form method="post" action="/signup">',
    '  <label for="email">Email</label>',
    \`  <input id="email" name="email" type="email" value="\${v.email || ''}">\`,
    '  <label for="password">Password</label>',
    \`  <input id="password" name="password" type="password" value="\${v.password || ''}">\`,
    '  <button type="submit">Sign up</button>',
    '</form>'
  ].join('\\n');
}
module.exports = { render };
`;
const VALIDATE = `'use strict';
// TODO: validation rules are not implemented yet.
function validate(values = {}) {
  return {};
}
module.exports = { validate };
`;
const TEST = `const test = require('node:test');
const assert = require('node:assert/strict');
const { render } = require('../src/form.js');
test('renders a form', () => assert.match(render(), /^<form/));
`;
module.exports = {
  create(ws, lib) {
    lib.write(ws, 'package.json', `${JSON.stringify({ name: 'signup-form', version: '0.1.0', private: true, scripts: { test: 'node --test' } }, null, 2)}\n`);
    lib.write(ws, 'README.md', '# signup-form\n\nServer-rendered sign-up form (`src/form.js`) and validator (`src/validate.js`). `index.html` is a static preview of the empty state.\n');
    lib.write(ws, 'src/form.js', FORM);
    lib.write(ws, 'src/validate.js', VALIDATE);
    lib.write(ws, 'index.html', '<!doctype html>\n<title>Sign up</title>\n<form method="post" action="/signup"><label for="email">Email</label><input id="email" name="email" type="email"><label for="password">Password</label><input id="password" name="password" type="password"><button type="submit">Sign up</button></form>\n');
    lib.write(ws, 'test/form.test.js', TEST);
    lib.write(ws, '.gitignore', 'node_modules/\n');
    lib.gitInit(ws);
    lib.commitAll(ws, 'signup-form 0.1.0');
  }
};
