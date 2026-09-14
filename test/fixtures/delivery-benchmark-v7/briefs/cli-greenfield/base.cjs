'use strict';
// Base repository for cli-greenfield: an empty Node project, one commit, no unrelated work.
module.exports = {
  create(ws, lib) {
    lib.write(ws, 'package.json', "{\n  \"name\": \"slug-cli\",\n  \"version\": \"0.1.0\",\n  \"private\": true,\n  \"scripts\": {\n    \"test\": \"node --test\"\n  }\n}\n");
    lib.write(ws, 'README.md', '# slug-cli\n\nAn empty project. See BRIEF.md for what to build.\n');
    lib.write(ws, '.gitignore', "node_modules/\n");
    lib.gitInit(ws);
    lib.commitAll(ws, 'Empty project');
  },
};
