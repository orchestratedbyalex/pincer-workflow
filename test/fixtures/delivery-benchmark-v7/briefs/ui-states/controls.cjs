'use strict';
// Controls for ui-states.
//   aria-only — the classic case this brief exists for: the markup says the button is
//               disabled to assistive technology (aria-disabled) but the browser still
//               activates it, because the `disabled` attribute is missing. Structural
//               markup inspection passes; observation in a browser does not.
//   no-error  — the error state has no alert summary
//   unescaped — user values are echoed without escaping
const ESCAPE = "const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');";
const build = ({ disabledAttr, summary, escape }) => `'use strict';
${escape ? ESCAPE : "const esc = s => String(s == null ? '' : s);"}
function render(state) {
  const mode = (state && state.mode) || 'empty';
  const values = (state && state.values) || {};
  const errors = (state && state.errors) || {};
  const busy = mode === 'submitting';
  const label = busy ? 'Signing up…' : 'Sign up';
  const disabled = busy ? '${disabledAttr}' : '';
  const invalid = mode === 'error' && errors.email ? ' aria-invalid="true" aria-describedby="email-error"' : '';
  const message = mode === 'error' && errors.email ? '<p id="email-error">' + esc(errors.email) + '</p>' : '';
  const alert = ${summary} && mode === 'error' && errors.email ? '<div role="alert"><ul><li>' + esc(errors.email) + '</li></ul></div>' : '';
  return '<form' + (busy ? ' aria-busy="true"' : '') + '>' + alert +
    '<label for="email">Email</label>' +
    '<input id="email" name="email" value="' + esc(values.email) + '"' + invalid + '>' +
    message +
    '<button type="submit"' + disabled + '>' + label + '</button>' +
    '</form>';
}
module.exports = { render };
`;
const CORRECT = build({ disabledAttr: ' disabled aria-disabled="true"', summary: 'true', escape: true });
const ARIA_ONLY = build({ disabledAttr: ' aria-disabled="true"', summary: 'true', escape: true });
const NO_SUMMARY = build({ disabledAttr: ' disabled aria-disabled="true"', summary: 'false', escape: true });
const UNESCAPED = build({ disabledAttr: ' disabled aria-disabled="true"', summary: 'true', escape: false });
const TESTS = `const test = require('node:test');
const assert = require('node:assert/strict');
const { render } = require('../src/form.js');
test('renders the three modes', () => {
  assert.match(render({ mode: 'empty' }), /Sign up/);
  assert.match(render({ mode: 'submitting' }), /aria-busy="true"/);
  assert.match(render({ mode: 'error', errors: { email: 'required' } }), /aria-invalid="true"/);
});
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
  const source = variant === 'aria-only' ? ARIA_ONLY : variant === 'no-error' ? NO_SUMMARY : variant === 'unescaped' ? UNESCAPED : CORRECT;
  lib.write(ws, 'src/form.js', source);
  lib.write(ws, 'test/form.test.js', TESTS);
  const sha = lib.commitAll(ws, 'Add the three form states', date);
  if (variant === 'evaluated' || variant === 'stale-evidence') return evidenceCommit(ws, lib, sha, { variant, date });
  return sha;
}
module.exports = {
  variants: ['control', 'evaluated', 'aria-only', 'no-error', 'unescaped', 'stale-evidence'],
  accepted: ['control', 'evaluated'],
  faults: { 'aria-only': 'submitting-observed', 'no-error': 'error-state', unescaped: 'escaping', 'stale-evidence': 'evidence-binding' },
  apply,
};
