'use strict';
// Controls for revision-recovery.
//   stopped-at-interruption — session 3 never happened: priority landed, `explain` did not.
//                             This is what an unrecovered interruption leaves behind, and
//                             it is the specific failure the long-form brief exists to see.
//   first-match             — session 3 finished `explain` but reverted the priority rule
//                             to first-match-wins, losing session 2's work
const MATCH = `const matches = (when, facts) => Object.entries(when || {}).every(([k, v]) => facts[k] === v);`;
const CHANGE1 = `'use strict';
${MATCH}
function evaluate(rules, facts) {
  const hit = rules.find(r => matches(r.when, facts));
  return hit ? hit.action : null;
}
module.exports = { evaluate };
`;
const PRIORITY = `'use strict';
${MATCH}
function winner(rules, facts) {
  let best = -1;
  rules.forEach((r, i) => {
    if (!matches(r.when, facts)) return;
    if (best === -1 || (r.priority || 0) > (rules[best].priority || 0)) best = i;
  });
  return best;
}
function evaluate(rules, facts) {
  const i = winner(rules, facts);
  return i === -1 ? null : rules[i].action;
}
module.exports = { evaluate };
`;
const COMPLETE = PRIORITY.replace('module.exports = { evaluate };', `function explain(rules, facts) {
  const i = winner(rules, facts);
  return i === -1 ? { action: null, rule: null } : { action: rules[i].action, rule: i };
}
module.exports = { evaluate, explain };
`);
const FIRST_MATCH = CHANGE1.replace('module.exports = { evaluate };', `function explain(rules, facts) {
  const i = rules.findIndex(r => matches(r.when, facts));
  return i === -1 ? { action: null, rule: null } : { action: rules[i].action, rule: i };
}
module.exports = { evaluate, explain };
`);
const TESTS = `const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../src/rules.js');
test('module loads', () => { assert.ok(rules.evaluate); });
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
  lib.write(ws, 'src/rules.js', CHANGE1);
  lib.write(ws, 'test/rules.test.js', TESTS);
  lib.commitAll(ws, 'Session 1: first-match evaluate', date);
  lib.write(ws, 'src/rules.js', PRIORITY);
  const second = lib.commitAll(ws, 'Session 2: priority ordering (interrupted)', date);
  if (variant === 'stopped-at-interruption') return second;
  lib.write(ws, 'src/rules.js', variant === 'first-match' ? FIRST_MATCH : COMPLETE);
  const sha = lib.commitAll(ws, 'Session 3: complete Change 2 with explain', date);
  if (variant === 'evaluated' || variant === 'stale-evidence') return evidenceCommit(ws, lib, sha, { variant, date });
  return sha;
}
module.exports = {
  variants: ['control', 'evaluated', 'stopped-at-interruption', 'first-match', 'stale-evidence'],
  accepted: ['control', 'evaluated'],
  faults: { 'stopped-at-interruption': 'explain', 'first-match': 'priority', 'stale-evidence': 'evidence-binding' },
  apply,
};
