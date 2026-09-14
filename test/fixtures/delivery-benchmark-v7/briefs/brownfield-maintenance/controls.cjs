'use strict';
// Controls for brownfield-maintenance.
//   mutates          — deep merge that mutates its base, breaking behaviour the brief says
//                      to keep. Both new changes work; the preserved one does not.
//   concatenates     — arrays are concatenated instead of replaced
//   clobbers-local   — correct code, but the operator's uncommitted scratch file was
//                      committed along the way. Only the preservation check sees this.
const DEEP = `function isObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function merge(base, override) {
  const out = { ...base };
  for (const [k, v] of Object.entries(override || {})) {
    if (v === null) { delete out[k]; continue; }
    out[k] = isObject(v) && isObject(out[k]) ? merge(out[k], v) : v;
  }
  return out;
}`;
const MUTATING = `function isObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function merge(base, override) {
  for (const [k, v] of Object.entries(override || {})) {
    if (v === null) { delete base[k]; continue; }
    base[k] = isObject(v) && isObject(base[k]) ? merge(base[k], v) : v;
  }
  return base;
}`;
const CONCAT = DEEP.replace('out[k] = isObject(v) && isObject(out[k]) ? merge(out[k], v) : v;',
  'out[k] = Array.isArray(v) && Array.isArray(out[k]) ? out[k].concat(v) : isObject(v) && isObject(out[k]) ? merge(out[k], v) : v;');
const DESCRIBE = `function describe(config, prefix) {
  const out = [];
  for (const [k, v] of Object.entries(config || {})) {
    const key = prefix ? prefix + '.' + k : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) out.push(...describe(v, key));
    else out.push(key);
  }
  return out.sort();
}`;
const source = merge => `'use strict';
${merge}
${DESCRIBE}
module.exports = { merge, describe };
`;

function evidenceCommit(ws, lib, sha, { variant, date }) {
  const base = lib.git(ws, 'rev-parse', 'HEAD~1');
  const named = variant === 'stale-evidence' ? base : sha;
  const manifestPath = `.prd/evidence/prd-v1/${named}/manifest.json`;
  const log = 'checks passed\n';
  const logPath = `.prd/evidence/prd-v1/${named}/checks/C-01.log`;
  lib.write(ws, logPath, log);
  const manifest = {
    schema: 1, prd: '.prd/prd-v1.md', base, candidate: named, created: '2026-09-14T00:00:00Z',
    checks: [{ id: 'C-01', kind: 'command', required: true, result: 'passed', command: 'npm test', artifacts: [logPath] }],
    artifacts: [{ path: logPath, sha256: lib.sha256(log) }],
  };
  lib.write(ws, manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  if (variant === 'unlisted-artifact') {
    // Present in the evidence directory, absent from the manifest's artifact list.
    lib.write(ws, `.prd/evidence/prd-v1/${named}/checks/C-99.log`, 'a log nothing admits to\n');
  }
  lib.write(ws, 'NOTES.md', `---\nprd: .prd/prd-v1.md\nbase: ${base}\ncandidate: ${named}\nevidence: ${manifestPath}\n---\n# Evaluation\nChecks passed on ${named.slice(0, 7)}.\n`);
  // Only the evaluation's own files: NOTES.md and the evidence directory.
  return lib.commitPaths(ws, `evaluate: candidate ${named.slice(0, 7)}`, ['NOTES.md', '.prd/evidence'], date);
}

function apply(ws, variant, lib, { date } = {}) {
  const body = variant === 'mutates' ? MUTATING : variant === 'concatenates' ? CONCAT : DEEP;
  lib.write(ws, 'src/config.js', source(body).replace('module.exports = { merge, describe };', 'module.exports = { merge };').replace(DESCRIBE, ''));
  lib.commitPaths(ws, 'Change 1: recursive merge', ['src/config.js'], date);
  lib.write(ws, 'src/config.js', source(body));
  lib.commitPaths(ws, 'Change 2: describe', ['src/config.js'], date);
  lib.write(ws, 'CHANGELOG.md', '# Changelog\n\n## Unreleased\n\n- recursive merge and describe\n\n## 0.2.0\n\n- shallow merge\n');
  // The honest path stages only what belongs to the task; clobbers-local sweeps the
  // whole tree, which is what committing somebody else's uncommitted work looks like.
  const sha = variant === 'clobbers-local'
    ? lib.commitAll(ws, 'Session 3: review pass', date)
    : lib.commitPaths(ws, 'Session 3: review pass', ['src/config.js', 'CHANGELOG.md'], date);
  if (variant === 'evaluated' || variant === 'stale-evidence') return evidenceCommit(ws, lib, sha, { variant, date });
  return sha;
}
module.exports = {
  variants: ['control', 'evaluated', 'mutates', 'concatenates', 'clobbers-local', 'stale-evidence'],
  accepted: ['control', 'evaluated'],
  faults: { mutates: 'existing-behaviour', concatenates: 'deep-merge', 'clobbers-local': 'unrelated-edits', 'stale-evidence': 'evidence-binding' },
  apply,
};
