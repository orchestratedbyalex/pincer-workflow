'use strict';
// Base repository for revision-recovery: an empty rule engine.
module.exports = {
  create(ws, lib) {
    lib.write(ws, 'package.json', "{\n  \"name\": \"rules\",\n  \"version\": \"0.1.0\",\n  \"private\": true,\n  \"scripts\": {\n    \"test\": \"node --test\"\n  }\n}\n");
    lib.write(ws, 'src/rules.js', "'use strict';\nmodule.exports = {};\n");
    lib.write(ws, 'test/.gitkeep', '');
    lib.write(ws, 'NOTES.md', '# Notes\n\nNothing evaluated yet.\n');
    lib.write(ws, '.gitignore', "node_modules/\n");
    lib.gitInit(ws);
    lib.commitAll(ws, 'Empty rule engine');
  },
};
