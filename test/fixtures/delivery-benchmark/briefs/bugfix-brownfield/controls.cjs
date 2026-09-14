'use strict';
// Controls for bugfix-brownfield: `control` fixes slugify generally; `omitted` collapses
// separators but keeps the trailing dash; `false-success` special-cases the reported
// input and its own test passes; `stale-evidence` is the fix with evidence naming
// another commit; `clobbered-edits` is the fix that also commits the unrelated edits.
const fs = require('node:fs');
const path = require('node:path');
const FIX = `'use strict';
// Turn a title into a URL slug: lower-case, one dash per run of separators, no edge dashes.
function slugify(input) {
  return String(input).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
module.exports = { slugify };
`;
const OMITTED = FIX.replace(".replace(/^-+|-+$/g, '')", ".replace(/^-+/, '')");
const FALSE = `'use strict';
function slugify(input) {
  if (input === 'Hello,  World!') return 'hello-world';
  return String(input).toLowerCase().replace(/[^a-z0-9]/g, '-');
}
module.exports = { slugify };
`;
const TEST_LINE = { control: "test('slugify collapses separators and trims dashes', () => assert.equal(slugify('Hello,  World!'), 'hello-world'));\n", omitted: "test('slugify collapses separators', () => assert.equal(slugify('Hello,  World'), 'hello-world'));\n", 'false-success': "test('slugify fixes the reported input', () => assert.equal(slugify('Hello,  World!'), 'hello-world'));\n" };
function apply(ws, variant, lib, { date } = {}) {
  const impl = variant === 'omitted' ? OMITTED : variant === 'false-success' ? FALSE : FIX;
  lib.write(ws, 'lib/slugify.js', impl);
  fs.appendFileSync(path.join(ws, 'test/strutil.test.js'), TEST_LINE[variant] || TEST_LINE.control);
  // The CHANGELOG entry goes into the committed file without the unrelated draft section:
  // stage only lib/ and test/ and a CHANGELOG hunk written via a temporary index.
  const changelogPath = path.join(ws, 'CHANGELOG.md');
  const working = fs.readFileSync(changelogPath, 'utf8');
  const committed = lib.git(ws, 'show', 'HEAD:CHANGELOG.md').replace('## Unreleased\n', '## Unreleased\n\n- slugify: collapse separator runs and drop leading/trailing dashes (fixes hello--world-).\n');
  if (variant === 'clobbered-edits') {
    fs.writeFileSync(changelogPath, working.replace('## Unreleased\n', '## Unreleased\n\n- slugify: collapse separator runs and drop leading/trailing dashes.\n'));
    return lib.commitAll(ws, 'Fix slugify', date); // commits the draft section and scratch/ too
  }
  fs.writeFileSync(changelogPath, committed);
  const env = { ...lib.GIT_ID, ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}) };
  for (const args of [['add', 'lib', 'test', 'CHANGELOG.md'], ['commit', '-q', '-m', 'Fix slugify: one dash per separator run, no edge dashes']]) {
    const r = lib.sh('git', args, { cwd: ws, env }); if (r.status !== 0) throw new Error(`git ${args[0]}: ${r.stderr}`);
  }
  // Restore the unrelated working-tree edit on top of the committed CHANGELOG.
  fs.writeFileSync(changelogPath, `${committed}\n## Ideas (not for release)\n\n- consider a \`titleCase\` helper — draft, do not ship\n`);
  const sha = lib.git(ws, 'rev-parse', 'HEAD');
  if (variant === 'stale-evidence') {
    const other = lib.git(ws, 'rev-parse', 'HEAD~1');
    lib.write(ws, 'NOTES.md', `---\nprd: .prd/prd-v1.md\nbase: ${other}\ncandidate: ${other}\nevidence: .prd/evidence/prd-v1/${other}/manifest.json\n---\n# Evaluation\n`);
    lib.write(ws, `.prd/evidence/prd-v1/${other}/manifest.json`, `${JSON.stringify({ schema: 1, prd: '.prd/prd-v1.md', base: other, candidate: other, created: '2026-09-12T00:00:00Z', checks: [] }, null, 2)}\n`);
    for (const args of [['add', 'NOTES.md', '.prd'], ['commit', '-q', '-m', 'evaluate: candidate ' + other.slice(0, 7)]]) { const r = lib.sh('git', args, { cwd: ws, env }); if (r.status !== 0) throw new Error(r.stderr); }
    return lib.git(ws, 'rev-parse', 'HEAD');
  }
  return sha;
}
module.exports = { variants: ['control', 'omitted', 'false-success', 'stale-evidence', 'clobbered-edits'], faults: { omitted: 'slugify', 'false-success': 'slugify', 'stale-evidence': 'evidence-binding', 'clobbered-edits': 'unrelated-edits' }, apply };
