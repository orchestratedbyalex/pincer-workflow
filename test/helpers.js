import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const harness = require(path.join(repo, 'template/scripts/pincer/harness.cjs'));
const temporary = [];
export function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pincer-test-'));
  temporary.push(dir);
  return dir;
}
process.on('exit', () => temporary.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

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

export function createTicket(dir, { id = 'T-01', command = 'true', criteria = '- [x] expected behavior', deps = '', spec = '' } = {}) {
  const file = `tickets/${id}-example.md`;
  const specLine = spec ? `spec: ${spec}\n` : '';
  write(dir, file, `---\nticket: ${id}\nstatus: open\nsize: S\n${specLine}depends_on: [${deps}]\n---\n\n## Objective\nExample\n\n## Acceptance Criteria\n${criteria}\n\n## Verification\n\`\`\`bash\n${command}\n\`\`\`\n`);
  return file;
}
export function createSpec(dir, name = 'spec-v1', status = 'approved') {
  write(dir, `specs/${name}.md`, `---\nstatus: ${status}\n---\n# Example spec\n`);
  return `specs/${name}.md`;
}
// A normalized minimal agreement (one acceptor, Alex), overrides merged one level deep.
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
export function createHarness(dir, overrides = {}) {
  const base = harness.normalize({
    schema: 1,
    project: { name: 'example', kind: 'greenfield', reason: 'a test fixture' },
    people: [{ name: 'Alex', role: 'owner', accepts: true }],
  });
  const merged = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    merged[key] = isPlainObject(value) && isPlainObject(base[key]) ? { ...base[key], ...value } : value;
  }
  write(dir, 'harness.json', JSON.stringify(harness.normalize(merged), null, 2) + '\n');
  return 'harness.json';
}
