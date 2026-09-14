'use strict';
// Base repository for ui-states: one static form, no states.
const FORM = `'use strict';
function render() {
  return '<form><label for="email">Email</label><input id="email" name="email"><button type="submit">Sign up</button></form>';
}
module.exports = { render };
`;
module.exports = {
  create(ws, lib) {
    lib.write(ws, 'package.json', "{\n  \"name\": \"signup-form\",\n  \"version\": \"0.1.0\",\n  \"private\": true,\n  \"scripts\": {\n    \"test\": \"node --test\"\n  }\n}\n");
    lib.write(ws, 'src/form.js', FORM);
    lib.write(ws, 'test/.gitkeep', '');
    lib.write(ws, 'README.md', '# signup-form\n\nA form with no states yet.\n');
    lib.write(ws, '.gitignore', "node_modules/\n");
    lib.gitInit(ws);
    lib.commitAll(ws, 'Static form');
  },
};
