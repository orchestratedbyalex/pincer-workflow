'use strict';
// Base repository for scope-revision: an empty project; the brief carries R-01 and R-02.
// The operator step before S2 appends R-03 to BRIEF.md and commits it.
const fs = require('node:fs');
const path = require('node:path');
const R03 = '- R-03 `list --json`: prints the notes as a JSON array of strings (exact JSON, `[]` when empty).\n';
module.exports = {
  R03,
  create(ws, lib) {
    lib.write(ws, 'package.json', `${JSON.stringify({ name: 'notes-cli', version: '0.1.0', private: true, scripts: { test: 'node --test' } }, null, 2)}\n`);
    lib.write(ws, 'README.md', '# notes-cli\n\nAn empty project. See BRIEF.md.\n');
    lib.write(ws, '.gitignore', 'node_modules/\nnotes.json\n');
    lib.gitInit(ws);
    lib.commitAll(ws, 'Empty project');
  },
  between: {
    S2(ws, lib) {
      const p = path.join(ws, 'BRIEF.md');
      const text = fs.readFileSync(p, 'utf8');
      const at = text.indexOf('\nAdd tests');
      const revised = at >= 0 ? `${text.slice(0, at)}${R03}${text.slice(at)}` : `${text}${R03}`;
      fs.writeFileSync(p, revised);
      lib.commitAll(ws, 'Revise brief: add R-03 list --json');
      return 'operator appended R-03 (list --json) to BRIEF.md and committed it';
    }
  }
};
