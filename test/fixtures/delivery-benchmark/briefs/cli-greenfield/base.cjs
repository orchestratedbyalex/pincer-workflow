'use strict';
// Base repository for cli-greenfield: an empty Node project. One commit, no unrelated edits.
module.exports = {
  create(ws, lib) {
    lib.write(ws, 'package.json', `${JSON.stringify({ name: 'todo-cli', version: '0.1.0', private: true, scripts: { test: 'node --test' } }, null, 2)}\n`);
    lib.write(ws, 'README.md', '# todo-cli\n\nAn empty project. See BRIEF.md for what to build.\n');
    lib.write(ws, '.gitignore', 'node_modules/\ntodo.json\n');
    lib.gitInit(ws);
    lib.commitAll(ws, 'Empty project');
  }
};
