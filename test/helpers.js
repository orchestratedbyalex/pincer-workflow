import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = [];
export function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pincer-test-'));
  temporary.push(dir);
  return dir;
}
process.on('exit', () => temporary.forEach(dir => fs.rmSync(dir, { recursive: true, force: true })));

export function run(dir, command, args = [], options = {}) {
  return spawnSync(command, args, {
    cwd: dir, encoding: 'utf8', timeout: 30000,
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir }, ...options,
  });
}
export function write(dir, file, content) {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), content);
}
export const read = (dir, file) => fs.readFileSync(path.join(dir, file), 'utf8');
export const ticketScript = path.join(repo, 'template/scripts/pincer-ticket.sh');
export const statusScript = path.join(repo, 'template/scripts/pincer-status.sh');
export const step = (dir, action, id = 'T-01') => run(dir, 'bash', [ticketScript, action, id]);
export function createTicket(dir, { id = 'T-01', command = 'true', criteria = '- [x] expected behavior', deps = '', prd = '.prd/prd-v1.md' } = {}) {
  const file = `tickets/${id}-example.md`;
  write(dir, file, `---\nticket: ${id}\nstatus: open\nsize: S\nprd: ${prd}\ndepends_on: [${deps}]\n---\n\n## Objective\nExample\n\n## Acceptance Criteria\n${criteria}\n\n## Verification\n\`\`\`bash\n${command}\n\`\`\`\n`);
  return file;
}
export function createPrd(dir, version = 1, status = 'ticketed') {
  write(dir, `.prd/prd-v${version}.md`, `---\nversion: ${version}\nstatus: ${status}\ndate: 2026-09-05\n---\n# Example PRD\n`);
}
// A v0.5.0 (schema 1) change binding, written the way the released kit wrote it,
// so the migrated-mode suites keep exercising the released behavior after
// registration started writing schema 2 records (PRD v5). Needs a commit.
export function bindV050(dir, { prd = '.prd/prd-v1.md', change, authorization = null, legacyReceipts = {} } = {}) {
  const id = change || `prd-v${prd.match(/prd-v(\d+)\.md$/)[1]}`;
  const base = spawnSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  const revision = crypto.createHash('sha256').update(normalizePrd(read(dir, prd))).digest('hex');
  const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const binding = { schema: 1, change: id, prd, prd_revision: revision, base, registered: stamp, authorization, runtime: 1, legacy_receipts: legacyReceipts };
  const ignore = path.join(dir, '.gitignore');
  const existing = fs.existsSync(ignore) ? fs.readFileSync(ignore, 'utf8') : '';
  if (!existing.split('\n').some(l => l.trim() === '.pincer/')) fs.writeFileSync(ignore, `${existing}${existing && !existing.endsWith('\n') ? '\n' : ''}${existing ? '\n' : ''}# pincer runtime state (added by the runtime)\n.pincer/\n`);
  write(dir, `.prd/changes/${id}.json`, `${JSON.stringify(binding, null, 2)}\n`);
  return binding;
}
function normalizePrd(text) {
  const rows = text.split('\n'); if (rows.at(-1) === '') rows.pop();
  const out = []; let closed = rows[0] !== '---';
  for (let i = 0; i < rows.length; i++) {
    const line = rows[i];
    if (!closed) { if (i > 0 && line === '---') closed = true; else if (i > 0 && /^status:/.test(line)) continue; }
    out.push(line);
  }
  return `${out.join('\n')}\n`;
}
export const evidenceScript = path.join(repo, 'template/scripts/pincer-evidence.cjs');
// A minimal valid schema-1 evidence directory for a candidate: one passing
// command check with a log artifact. Returns the repository-relative paths.
export function writeEvidence(dir, { version = 1, base, candidate, log = '$ npm test\nok\n', artifact = 'checks/C-01.log', patch = m => m } = {}) {
  const evidenceDir = `.prd/evidence/prd-v${version}/${candidate}`;
  const logPath = `${evidenceDir}/${artifact}`;
  write(dir, logPath, log);
  const stamp = '2026-09-08T12:00:00Z';
  const manifest = patch({
    schema: 1, prd: `.prd/prd-v${version}.md`, base, candidate, created: stamp,
    environment: { os: 'test', node: process.version, tools: ['npm'], limitations: [] },
    coverage_review: 'R-01 is covered by C-01.',
    requirements: [{ id: 'R-01', disposition: 'delivered', tickets: ['T-01'], checks: ['C-01'] }],
    checks: [{ id: 'C-01', kind: 'command', required: true, result: 'passed', command: 'npm test', timestamp: stamp, artifacts: [logPath] }],
    visual_review: { applicable: false, reason: 'fixture has no UI' },
    artifacts: [{ path: logPath, sha256: crypto.createHash('sha256').update(log).digest('hex') }],
  });
  const manifestPath = `${evidenceDir}/manifest.json`;
  write(dir, manifestPath, JSON.stringify(manifest, null, 2));
  return { manifest: manifestPath, log: logPath, dir: evidenceDir };
}
export function writeNotes(dir, { version = 1, base, candidate, evidence }) {
  const lines = [`prd: .prd/prd-v${version}.md`, `base: ${base}`, `candidate: ${candidate}`];
  if (evidence) lines.push(`evidence: ${evidence}`);
  write(dir, 'NOTES.md', `---\n${lines.join('\n')}\n---\n# Evaluation\nReviewed candidate.\n`);
}
// A harness-owned local HTTP service (test/fixtures/local-service.cjs) for
// checks that must fail for an environmental reason no source revert explains.
export function startService(port = 0) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(repo, 'test/fixtures/local-service.cjs'), String(port)], { stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.on('data', chunk => {
      out += chunk;
      const line = out.split('\n')[0];
      if (/^\d+$/.test(line)) resolve({ port: Number(line), pid: child.pid, stop: () => stopService(child) });
    });
    child.on('error', reject);
    child.on('exit', code => { if (!/^\d+\n/.test(out)) reject(new Error(`service exited early (${code})`)); });
  });
}
export function stopService(child) {
  return new Promise(resolve => { if (child.exitCode !== null) return resolve(); child.once('exit', () => resolve()); child.kill('SIGTERM'); });
}
