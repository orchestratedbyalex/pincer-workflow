// Evidence manifest validator, schema 1, through scripts/pincer-evidence.cjs.
// Run with: node test/evidence.test.js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { repo, tempDir, run, write } from './helpers.js';

const require = createRequire(import.meta.url);
const evidence = require(path.join(repo, 'template/scripts/pincer/evidence.cjs'));
const script = path.join(repo, 'template/scripts/pincer-evidence.cjs');
const CAND = 'a'.repeat(40);
const BASE = 'b'.repeat(40);
const both = (r) => `${r.stdout}${r.stderr}`;
const cli = (dir, ...args) => run(dir, process.execPath, [script, ...args]);

function manifest(patch = {}) {
  return {
    schema: 1, candidate: CAND, base: BASE, created: '2026-10-20T10:00:00Z', spec: 'specs/spec-v1.md',
    environment: { tools: ['node 24'], limitations: [] },
    checks: [{ id: 'C-01', kind: 'command', required: true, result: 'passed', command: 'npm test', log: 'logs/C-01.log' }],
    visual_review: { applicable: false, reason: 'no UI' },
    artifacts: {},
    ...patch,
  };
}
// A temp repo with the spec, the log and a manifest under evidence/<candidate>/.
function setup(patch = {}, { log = 'all good\n', home = `evidence/${CAND}` } = {}) {
  const dir = tempDir();
  write(dir, 'specs/spec-v1.md', '---\nstatus: approved\n---\n');
  write(dir, `${home}/logs/C-01.log`, log);
  const doc = typeof patch === 'string' ? patch : manifest({ artifacts: { 'logs/C-01.log': evidence.digestFile(path.join(dir, home, 'logs/C-01.log')) }, ...patch });
  const file = `${home}/manifest.json`;
  write(dir, file, typeof doc === 'string' ? doc : `${JSON.stringify(doc, null, 2)}\n`);
  return { dir, file, doc };
}
const problems = (patch, options) => { const { dir, file } = setup(patch, options); return evidence.validate(dir, file, {}); };
const has = (list, re) => list.some((p) => re.test(p));

// digestFile is sha256 hex
let { dir, file } = setup();
assert.match(evidence.digestFile(path.join(dir, 'specs/spec-v1.md')), /^[0-9a-f]{64}$/);
assert.equal(evidence.digestFile(path.join(dir, 'specs/spec-v1.md')), crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, 'specs/spec-v1.md'))).digest('hex'));

// A correct manifest validates; the script says ok <candidate>
assert.deepEqual(evidence.validate(dir, file, {}), []);
assert.deepEqual(evidence.validate(dir, file, { candidate: CAND }), []);
let r = cli(dir, 'validate', file);
assert.equal(r.status, 0, both(r));
assert.equal(r.stdout.trim(), `ok ${CAND}`);
r = cli(dir, 'validate', file, '--candidate', CAND);
assert.equal(r.status, 0, both(r));
r = cli(dir, 'validate', path.join(dir, file));
assert.equal(r.status, 0, both(r));

// A required check that failed names the check
let p = problems({ checks: [{ id: 'C-01', kind: 'command', required: true, result: 'failed', command: 'npm test', log: 'logs/C-01.log' }] });
assert.ok(has(p, /C-01/), p.join('; '));
p = problems({ checks: [{ id: 'C-01', kind: 'command', required: false, result: 'failed', command: 'npm test', log: 'logs/C-01.log' }] });
assert.deepEqual(p, []);
p = problems({ checks: [{ id: 'C-01', kind: 'command', required: true, result: 'unverified', command: 'npm test', log: 'logs/C-01.log' }] });
assert.ok(has(p, /C-01/), p.join('; '));

// Artifacts: wrong digest, outside the manifest's directory, missing on disk, a log not listed
p = problems({ artifacts: { 'logs/C-01.log': 'c'.repeat(64) } });
assert.ok(has(p, /digest/), p.join('; '));
p = problems({ artifacts: { '../x': 'c'.repeat(64) } });
assert.ok(has(p, /outside/), p.join('; '));
p = problems({ artifacts: { '/etc/passwd': 'c'.repeat(64) } });
assert.ok(has(p, /outside/), p.join('; '));
p = problems({ artifacts: { 'logs/C-01.log': 'c'.repeat(64), 'logs/missing.log': 'd'.repeat(64) } });
assert.ok(has(p, /missing\.log/), p.join('; '));
p = problems({ artifacts: {} });
assert.ok(has(p, /logs\/C-01\.log/) && has(p, /artifacts/), p.join('; '));
p = problems({ artifacts: { 'logs/C-01.log': 'not-a-digest' } });
assert.ok(has(p, /sha256|digest/), p.join('; '));

// The candidate: forty hex characters, the manifest's directory, and --candidate when given
({ dir, file } = setup());
p = evidence.validate(dir, file, { candidate: 'e'.repeat(40) });
assert.ok(has(p, /candidate/), p.join('; '));
r = cli(dir, 'validate', file, '--candidate', 'e'.repeat(40));
assert.equal(r.status, 1, both(r));
assert.match(r.stderr, new RegExp(`^evidence: ${file.replace(/[/.]/g, '\\$&')}: .*candidate`, 'm'));
assert.equal(r.stdout, '');
p = problems({ candidate: 'xyz' });
assert.ok(has(p, /candidate/), p.join('; '));
p = problems({}, { home: 'evidence/wrong-dir' });
assert.ok(has(p, /candidate/), p.join('; '));

// Shape: schema, created, base, spec, environment, checks, visual_review
p = problems({ schema: 2 });
assert.ok(has(p, /schema/), p.join('; '));
p = problems({ created: 'yesterday' });
assert.ok(has(p, /created/), p.join('; '));
p = problems({ base: 'short' });
assert.ok(has(p, /base/), p.join('; '));
p = problems({ spec: null });
assert.deepEqual(p, []);
p = problems({ spec: 'specs/none.md' });
assert.ok(has(p, /spec/), p.join('; '));
p = problems({ spec: '../x.md' });
assert.ok(has(p, /spec/), p.join('; '));
p = problems({ environment: { tools: 'node' } });
assert.ok(has(p, /environment\.tools/), p.join('; '));
p = problems({ checks: [] });
assert.ok(has(p, /checks/), p.join('; '));
p = problems({ checks: [{ id: 'check-1', kind: 'command', required: true, result: 'passed', command: 'x', log: 'logs/C-01.log' }] });
assert.ok(has(p, /id/), p.join('; '));
p = problems({ checks: [{ id: 'C-01', kind: 'magic', required: true, result: 'passed', command: 'x', log: 'logs/C-01.log' }] });
assert.ok(has(p, /kind/), p.join('; '));
p = problems({ checks: [{ id: 'C-01', kind: 'command', required: 'yes', result: 'passed', command: 'x', log: 'logs/C-01.log' }] });
assert.ok(has(p, /required/), p.join('; '));
p = problems({ checks: [{ id: 'C-01', kind: 'command', required: true, result: 'maybe', command: 'x', log: 'logs/C-01.log' }] });
assert.ok(has(p, /result/), p.join('; '));
p = problems({ checks: [{ id: 'C-01', kind: 'command', required: true, result: 'passed', command: 'x', log: 'logs/C-01.log' }, { id: 'C-01', kind: 'review', required: false, result: 'passed', command: null, log: null }] });
assert.ok(has(p, /duplicate/), p.join('; '));
p = problems({ checks: [{ id: 'C-01', kind: 'command', required: true, result: 'passed', command: null, log: 'logs/C-01.log' }] });
assert.ok(has(p, /command/), p.join('; '));
p = problems({ checks: [{ id: 'C-01', kind: 'review', required: false, result: 'passed', command: null, log: null }] });
assert.deepEqual(p, []);
p = problems({ visual_review: { applicable: 'no' } });
assert.ok(has(p, /visual_review/), p.join('; '));
p = problems({ visual_review: { applicable: false } });
assert.ok(has(p, /visual_review.*reason/), p.join('; '));

// Not JSON, not an object, not there
({ dir, file } = setup('{'));
p = evidence.validate(dir, file, {});
assert.ok(has(p, /JSON/), p.join('; '));
r = cli(dir, 'validate', file);
assert.equal(r.status, 1, both(r));
assert.match(r.stderr, /^evidence: .*JSON/m);
p = evidence.validate(dir, 'evidence/nope/manifest.json', {});
assert.ok(has(p, /exist|missing|read/), p.join('; '));
({ dir, file } = setup('[]'));
p = evidence.validate(dir, file, {});
assert.ok(has(p, /object/), p.join('; '));

// digest <file>... prints <sha>  <file>; usage exits 2
({ dir, file } = setup());
r = cli(dir, 'digest', 'specs/spec-v1.md', file);
assert.equal(r.status, 0, both(r));
const lines = r.stdout.trimEnd().split('\n');
assert.equal(lines.length, 2);
assert.match(lines[0], /^[0-9a-f]{64}  specs\/spec-v1\.md$/);
assert.equal(lines[0].slice(0, 64), evidence.digestFile(path.join(dir, 'specs/spec-v1.md')));
r = cli(dir, 'digest', 'specs/none.md');
assert.equal(r.status, 1, both(r));
assert.match(r.stderr, /none\.md/);
assert.equal(cli(dir).status, 2);
assert.equal(cli(dir, 'validate').status, 2);
assert.equal(cli(dir, 'digest').status, 2);
assert.equal(cli(dir, 'validate', file, '--candidate').status, 2);
assert.equal(cli(dir, 'bogus').status, 2);

console.log('evidence: ok');
