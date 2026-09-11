// Evidence schema 1 validator: a complete manifest passes; every failure class
// is rejected with a prefixed, actionable diagnostic; validation writes nothing.
// Each case runs in its own temporary repository.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { tempDir, write, run, repo } from './helpers.js';

const helper = path.join(repo, 'template/scripts/pincer-evidence.cjs');
const CAND = 'a'.repeat(40);
const BASE = 'b'.repeat(40);
const OTHER = 'c'.repeat(40);
const DIR = `.prd/evidence/prd-v2/${CAND}`;
const LOG = `${DIR}/checks/C-01.log`;
const LOG_TEXT = '$ npm test\nall suites passed\n';
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const T = '2026-09-08T12:00:00Z';

function manifest(over = {}) {
  return {
    schema: 1, prd: '.prd/prd-v2.md', base: BASE, candidate: CAND, created: T,
    environment: { os: 'darwin 25.6', node: 'v22.0.0', tools: ['npm 10'], limitations: [] },
    coverage_review: 'R-01 is covered by C-01; nothing omitted.',
    requirements: [{ id: 'R-01', disposition: 'delivered', tickets: ['T-01'], checks: ['C-01'] }],
    checks: [{ id: 'C-01', kind: 'command', required: true, result: 'passed', command: 'npm test', timestamp: T, artifacts: [LOG] }],
    visual_review: { applicable: false, reason: 'CLI-only change; nothing renders' },
    artifacts: [{ path: LOG, sha256: sha(LOG_TEXT) }],
    ...over,
  };
}
const withCheck = patch => manifest({ checks: [{ ...manifest().checks[0], ...patch }] });
const withRequirement = patch => manifest({ requirements: [{ ...manifest().requirements[0], ...patch }] });

function fixture({ doc = manifest(), raw, after } = {}) {
  const dir = tempDir();
  write(dir, LOG, LOG_TEXT);
  write(dir, `${DIR}/manifest.json`, raw ?? JSON.stringify(doc, null, 2));
  if (after) after(dir);
  return dir;
}
const validate = (dir, ...args) => run(dir, process.execPath, [helper, 'validate', `${DIR}/manifest.json`, ...args]);
const snapshot = dir => {
  const out = {};
  const walk = rel => {
    for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const next = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(next); else out[next] = fs.readFileSync(path.join(dir, next), 'utf8');
    }
  };
  walk('');
  return out;
};

function rejects(label, options, pattern, args = []) {
  const dir = fixture(options);
  const result = validate(dir, ...args);
  assert.equal(result.status, 1, `${label}: exits 1\n${result.stdout}${result.stderr}`);
  assert.match(result.stderr, /^evidence: \.prd\/evidence\/[^:]+: /m, `${label}: diagnostics are prefixed with the manifest path`);
  assert.match(result.stderr, pattern, `${label}: diagnostic names the problem\n${result.stderr}`);
}

// Complete manifest passes; --files lists the manifest and artifacts; nothing is written.
{
  const dir = fixture();
  const before = snapshot(dir);
  const ok = validate(dir);
  assert.equal(ok.status, 0, `complete manifest passes\n${ok.stderr}`);
  assert.equal(ok.stdout, `ok ${CAND}\n`);
  const files = validate(dir, '--files', '--candidate', CAND, '--prd', '.prd/prd-v2.md');
  assert.equal(files.status, 0, `--files with matching candidate and PRD passes\n${files.stderr}`);
  assert.deepEqual(files.stdout.trim().split('\n'), [`ok ${CAND}`, `${DIR}/manifest.json`, LOG]);
  assert.deepEqual(snapshot(dir), before, 'validation writes nothing');
}

// digest helper.
{
  const dir = fixture();
  const digest = run(dir, process.execPath, [helper, 'digest', LOG]);
  assert.equal(digest.status, 0);
  assert.equal(digest.stdout, `${sha(LOG_TEXT)}  ${LOG}\n`);
  assert.equal(run(dir, process.execPath, [helper, 'digest', 'nope.txt']).status, 1, 'digest of a missing file fails');
}

// Usage errors exit 2.
{
  const dir = fixture();
  for (const args of [[], ['frobnicate'], ['validate'], ['validate', `${DIR}/manifest.json`, '--candidate'], ['validate', `${DIR}/manifest.json`, '--candidate', 'short']]) {
    assert.equal(run(dir, process.execPath, [helper, ...args]).status, 2, `usage error: ${args.join(' ')}`);
  }
}

rejects('missing manifest', { after: dir => fs.rmSync(path.join(dir, DIR, 'manifest.json')) }, /missing/);
rejects('malformed JSON', { raw: '{"schema": 1,' }, /malformed/);
rejects('unknown schema', { doc: manifest({ schema: 3 }) }, /unknown evidence schema 3/);
rejects('unknown top-level key', { doc: manifest({ extra: true }) }, /unknown top-level key "extra"/);
rejects('missing artifact', { after: dir => fs.rmSync(path.join(dir, LOG)) }, /C-01\.log: missing/);
rejects('tampered artifact', { after: dir => write(dir, LOG, 'edited after evaluation') }, /digest mismatch/);
rejects('dangling check reference', { doc: withRequirement({ checks: ['C-09'] }) }, /unknown check "C-09"/);
rejects('dangling artifact reference', { doc: withCheck({ artifacts: [LOG, `${DIR}/checks/other.log`] }) }, /unlisted artifact .*other\.log/);
rejects('duplicate check ID', { doc: manifest({ checks: [manifest().checks[0], manifest().checks[0]] }) }, /duplicate check ID C-01/);
rejects('duplicate requirement ID', { doc: manifest({ requirements: [manifest().requirements[0], manifest().requirements[0]] }) }, /duplicate requirement ID R-01/);
rejects('duplicate artifact path', { doc: manifest({ artifacts: [manifest().artifacts[0], manifest().artifacts[0]] }) }, /duplicate artifact path/);
rejects('unreferenced artifact', {
  doc: manifest({ artifacts: [...manifest().artifacts, { path: `${DIR}/extra.txt`, sha256: sha('x') }] }),
  after: dir => write(dir, `${DIR}/extra.txt`, 'x'),
}, /extra\.txt: not referenced by any check/);
rejects('wrong candidate directory', { doc: manifest({ candidate: OTHER }) }, /wrong candidate/);
rejects('wrong --candidate', {}, /wrong candidate: manifest is for/, ['--candidate', OTHER]);
rejects('wrong PRD directory', { doc: manifest({ prd: '.prd/prd-v3.md' }) }, /wrong PRD/);
rejects('wrong --base', {}, /wrong base: manifest records/, ['--base', OTHER]);
{
  const dir = fixture();
  assert.equal(validate(dir, '--base', BASE).status, 0, 'matching --base passes');
  assert.equal(run(dir, process.execPath, [helper, 'validate', `${DIR}/manifest.json`, '--base', 'short']).status, 2, 'malformed --base is a usage error');
}
rejects('wrong --prd', {}, /wrong PRD: manifest is for/, ['--prd', '.prd/prd-v3.md']);
rejects('absolute artifact path', { doc: manifest({ artifacts: [{ path: '/etc/hosts', sha256: sha('') }], checks: [{ ...manifest().checks[0], artifacts: ['/etc/hosts'] }] }) }, /absolute paths are not allowed/);
rejects('traversal artifact path', { doc: manifest({ artifacts: [{ path: `${DIR}/../${CAND}/checks/C-01.log`, sha256: sha(LOG_TEXT) }], checks: [{ ...manifest().checks[0], artifacts: [`${DIR}/../${CAND}/checks/C-01.log`] }] }) }, /normalized/);
rejects('backslash artifact path', { doc: manifest({ artifacts: [{ path: `${DIR}\\checks\\C-01.log`, sha256: sha(LOG_TEXT) }], checks: [{ ...manifest().checks[0], artifacts: [`${DIR}\\checks\\C-01.log`] }] }) }, /backslashes/);
rejects('artifact outside the evidence directory', {
  doc: manifest({ artifacts: [{ path: '.prd/evidence/prd-v2/shared.log', sha256: sha('s') }], checks: [{ ...manifest().checks[0], artifacts: ['.prd/evidence/prd-v2/shared.log'] }] }),
  after: dir => write(dir, '.prd/evidence/prd-v2/shared.log', 's'),
}, /outside the evidence directory/);
rejects('symlinked artifact', {
  after: dir => {
    write(dir, 'elsewhere.log', LOG_TEXT);
    fs.rmSync(path.join(dir, LOG));
    fs.symlinkSync(path.join(dir, 'elsewhere.log'), path.join(dir, LOG));
  },
}, /is a symlink/);
rejects('symlinked directory component', {
  after: dir => {
    write(dir, 'elsewhere/C-01.log', LOG_TEXT);
    fs.rmSync(path.join(dir, DIR, 'checks'), { recursive: true });
    fs.symlinkSync(path.join(dir, 'elsewhere'), path.join(dir, DIR, 'checks'));
  },
}, /path component .*checks is a symlink/);
rejects('failed required check', { doc: withCheck({ result: 'failed' }) }, /required check C-01 is failed/);
rejects('unverified required check', { doc: withCheck({ result: 'unverified' }) }, /required check C-01 is unverified/);
rejects('passed visual check without image', { doc: manifest({ checks: [{ id: 'C-01', kind: 'visual', required: true, result: 'passed', timestamp: T, scenario: 'home page', viewport: '1280x800', observed: 'renders', artifacts: [LOG] }] }) }, /passed visual check requires a saved image artifact/);
rejects('required unverified visual check blocks readiness', { doc: manifest({ visual_review: { applicable: true }, checks: [{ id: 'C-01', kind: 'visual', required: true, result: 'unverified', timestamp: T, scenario: 'home page', viewport: '1280x800', observed: 'no browser tool available', artifacts: [LOG] }] }) }, /required check C-01 is unverified/);
{
  // An unverified, non-required visual check is representable without an image: the honest "tool unavailable" record.
  const dir = fixture({ doc: manifest({ visual_review: { applicable: true }, checks: [manifest().checks[0], { id: 'C-02', kind: 'visual', required: false, result: 'unverified', timestamp: T, scenario: 'home page', viewport: '1280x800', observed: 'no browser tool available; not captured', artifacts: [] }] }) });
  const result = validate(dir);
  assert.equal(result.status, 0, `unverified visual check without image is accepted\n${result.stderr}`);
}
rejects('visual review applicable without a visual check', { doc: manifest({ visual_review: { applicable: true } }) }, /no visual check is recorded/);
rejects('non-applicable visual review without reason', { doc: manifest({ visual_review: { applicable: false } }) }, /visual_review\.reason is required/);
rejects('deferred requirement without authorization', { doc: withRequirement({ disposition: 'deferred', checks: [] }) }, /deferred requires authorized_by/);
rejects('blocked requirement', { doc: withRequirement({ disposition: 'blocked' }) }, /R-01 is blocked/);
rejects('delivered requirement without checks', { doc: withRequirement({ checks: [] }) }, /delivered requires at least one check/);
rejects('environment dump', { doc: manifest({ environment: { ...manifest().environment, os: 'x'.repeat(2001) } }) }, /environment\.os must be a short/);
rejects('environment extra key', { doc: manifest({ environment: { ...manifest().environment, PATH: '/usr/bin' } }) }, /environment\.PATH is not allowed/);
rejects('empty requirements', { doc: manifest({ requirements: [] }) }, /requirements must be a nonempty array/);
rejects('malformed requirement ID', { doc: withRequirement({ id: 'req1' }) }, /requirements\[0\]\.id must be a requirement ID/);
{
  const dir = fixture({ doc: withRequirement({ id: 'REQ-1' }) });
  const result = validate(dir);
  assert.equal(result.status, 0, `a supplied PRD's own IDs are accepted verbatim\n${result.stderr}`);
}
rejects('command check without command', { doc: withCheck({ command: undefined }) }, /command kind requires the command/);

// A non-required failed check is recorded, not blocking; a passing visual check with an image is accepted.
{
  const png = `${DIR}/visual/home.png`;
  const dir = fixture({
    doc: manifest({
      checks: [
        manifest().checks[0],
        { id: 'C-02', kind: 'command', required: false, result: 'failed', command: 'npm run lint', timestamp: T, artifacts: [] },
        { id: 'C-03', kind: 'visual', required: true, result: 'passed', timestamp: T, scenario: 'home page loads', viewport: '1280x800', observed: 'header and chips render', artifacts: [png] },
      ],
      visual_review: { applicable: true },
      artifacts: [...manifest().artifacts, { path: png, sha256: sha('png-bytes') }],
    }),
    after: d => write(d, png, 'png-bytes'),
  });
  const result = validate(dir);
  assert.equal(result.status, 0, `optional failure and visual evidence accepted\n${result.stderr}`);
}

// Several problems are all reported, one line each.
{
  const dir = fixture({ doc: manifest({ candidate: OTHER, coverage_review: '' }) });
  const result = validate(dir);
  assert.equal(result.status, 1);
  assert.ok(result.stderr.split('\n').filter(Boolean).length >= 2, `reports every problem\n${result.stderr}`);
}

console.log('evidence validator tests passed');
