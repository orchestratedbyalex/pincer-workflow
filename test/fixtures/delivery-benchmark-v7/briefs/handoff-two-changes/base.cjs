'use strict';
// Base repository for handoff-two-changes: an empty money module.
module.exports = {
  create(ws, lib) {
    lib.write(ws, 'package.json', "{\n  \"name\": \"money\",\n  \"version\": \"0.1.0\",\n  \"private\": true,\n  \"scripts\": {\n    \"test\": \"node --test\"\n  }\n}\n");
    lib.write(ws, 'src/money.js', "'use strict';\nmodule.exports = {};\n");
    lib.write(ws, 'test/.gitkeep', '');
    lib.write(ws, '.gitignore', "node_modules/\n");
    lib.gitInit(ws);
    lib.commitAll(ws, 'Empty money module');
  },
};
