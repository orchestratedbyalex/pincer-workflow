// The runtime contract document is a static contract: every section, exit code,
// reason code, fixed exclusion and the secret-path rule must be present, and the
// plugin copy must equal the template copy after path rewriting.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { repo } from './helpers.js';

const read = relative => fs.readFileSync(path.join(repo, relative), 'utf8');
const doc = read('template/docs/runtime-contracts.md');

for (const heading of [
  '## Modes', '## Commands and exit codes', '## Supported grammar', '## Change binding', '## Content revisions',
  '## Source manifest', '## Attempts', '## Capture and sanitization', '## Readiness and reason codes',
  '## Evidence schema 2', '## Migration and rollback', '## Legacy compatibility', '## Platform limits',
]) assert.match(doc, new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'), `section ${heading}`);

for (const [code, meaning] of [
  ['0', /success/], ['1', /check failed|not ready|refused/], ['2', /usage/], ['3', /busy/], ['4', /invalid input|unreadable/], ['124', /timed out/], ['130', /interrupted/],
]) {
  const row = doc.split('\n').find(line => line.startsWith(`| ${code} |`));
  assert.ok(row, `exit code row ${code}`);
  assert.match(row, meaning, `exit code ${code} meaning`);
}

for (const code of [
  'CHANGE_REQUIRED', 'MIGRATION_REQUIRED', 'REVISION_CHANGED', 'CHECK_CHANGED', 'SOURCE_CHANGED', 'CHECK_FAILED',
  'ATTEMPT_RUNNING', 'ATTEMPT_INTERRUPTED', 'ATTEMPT_TIMED_OUT', 'ATTEMPT_ERROR', 'EVIDENCE_MISSING', 'LEGACY_RECEIPT',
  'CRITERIA_UNTICKED', 'DEPENDENCY_BLOCKED', 'INPUT_INVALID', 'CANDIDATE_STALE', 'STATE_BUSY', 'SECRET_PATH', 'UNSUPPORTED_INPUT',
]) assert.match(doc, new RegExp(`^\\| \`${code}\` \\|`, 'm'), `reason code row ${code}`);

for (const command of ['validate', 'register', 'snapshot', 'status', 'ready', 'start', 'verify', 'done', 'bind', 'recover', 'migrate', 'check', 'evidence export']) {
  assert.match(doc, new RegExp(`^\\| \`${command}\` \\|`, 'm'), `command row ${command}`);
}

assert.match(doc, /Fixed exclusions \(never inputs\): `\.git\/`, `\.pincer\/`, `NOTES\.md`, `\.prd\/evidence\/`,\n`\.prd\/changes\/`/);
assert.match(doc, /basename is `\.env` or starts with `\.env\.` \(except\n`\.env\.example`\) blocks with `SECRET_PATH` naming only the path/);
assert.match(doc, /symbolic links[\s\S]*submodules[\s\S]*not inside a git repository/);
assert.match(doc, /only untracked paths; a pattern that matches any tracked file/);
assert.match(doc, /`status`, `started`, `finished`, `verified` and `last_check` lines removed/);
assert.match(doc, /checkbox mark normalized to `\[ \]`/);
assert.match(doc, /\\ntimeout=<effective seconds>/);
assert.match(doc, /1 MiB\n\(1,048,576 bytes\)/);
assert.match(doc, /`running \\\| passed \\\| failed \\\| interrupted \\\| timed_out \\\| error`/);
assert.match(doc, /`ticket:<change>:<T-NN>` and `candidate:<40 hex>:<C-NN>`/);
assert.match(doc, /never promotes to `passed`/);
assert.match(doc, /a live owner is never stolen/);
assert.match(doc, /\.pincer\/backups\/<UTC timestamp>\/<original path>/);
assert.match(doc, /An older runtime does not enforce the\nruntime guarantees/);
assert.match(doc, /`passed` or `failed` command check\n  must be `runtime`/);
assert.match(doc, /Native Windows is not\nsupported and not claimed/);
// Every record in the PRD's ownership table has an owner and a location.
for (const [record, owner] of [
  ['Change binding', /written only by `register` and `migrate --apply`/],
  ['Attempt', /attempts\/<attempt id>\.json/],
  ['Local index/lock', /`index\.json`[\s\S]*`lock\/`/],
  ['Candidate manifest', /`evidence export`[\s\S]*writes `manifest\.json`/],
  ['Status', /one pure computation \(`scripts\/pincer-runtime\/readiness\.cjs`\)/],
]) assert.match(doc, owner, `${record} owner and location`);

// The document ships everywhere: installer inventory, plugin copy rewritten like the checklists.
assert.match(read('bin/pincer.js'), /'docs\/runtime-contracts\.md'/);
assert.equal(read('plugin/docs/runtime-contracts.md').replaceAll('${CLAUDE_PLUGIN_ROOT}/', '').replaceAll('/pincer:', '/pincer-'), doc, 'plugin ships the transformed contract document');
assert.match(read('plugin/docs/runtime-contracts.md'), /\$\{CLAUDE_PLUGIN_ROOT\}\/docs\/runtime-contracts\.md|CLAUDE_PLUGIN_ROOT/);
console.log('runtime contract document tests passed');
