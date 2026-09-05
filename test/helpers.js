import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
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
