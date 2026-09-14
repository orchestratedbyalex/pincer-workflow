'use strict';
// Base repository for scope-revision: an empty module and an empty suite.
module.exports = {
  create(ws, lib) {
    lib.write(ws, 'package.json', "{\n  \"name\": \"summarize\",\n  \"version\": \"0.1.0\",\n  \"private\": true,\n  \"scripts\": {\n    \"test\": \"node --test\"\n  }\n}\n");
    lib.write(ws, 'src/summarize.js', "'use strict';\nmodule.exports = { summarize: () => { throw new Error('not implemented'); } };\n");
    lib.write(ws, 'test/.gitkeep', '');
    lib.write(ws, '.gitignore', "node_modules/\n");
    lib.gitInit(ws);
    lib.commitAll(ws, 'Empty summarize module');
  },
};
