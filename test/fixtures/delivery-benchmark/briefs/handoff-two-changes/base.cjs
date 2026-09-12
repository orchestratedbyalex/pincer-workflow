'use strict';
// Base repository for handoff-two-changes: an empty project; the brief carries both changes.
module.exports = {
  create(ws, lib) {
    lib.write(ws, 'package.json', `${JSON.stringify({ name: 'notes-cli', version: '0.1.0', private: true, scripts: { test: 'node --test' } }, null, 2)}\n`);
    lib.write(ws, 'README.md', '# notes-cli\n\nAn empty project. See BRIEF.md.\n');
    lib.write(ws, '.gitignore', 'node_modules/\nnotes.json\n');
    lib.gitInit(ws);
    lib.commitAll(ws, 'Empty project');
  }
};
