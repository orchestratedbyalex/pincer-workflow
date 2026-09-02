// Lifecycle test for the ticket state machine, the status report, and the
// ticket guard hook, run against the template scripts in a temp dir.
// Run with: npm test
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const template = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'template');
const ticketSh = path.join(template, 'scripts', 'pincer-ticket.sh');
const statusSh = path.join(template, 'scripts', 'pincer-status.sh');
const guardSh = path.join(template, '.claude', 'hooks', 'ticket-guard.sh');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pincer-ticket-'));

const run = (script, ...args) => execFileSync('bash', [script, ...args], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const runFail = (script, ...args) => {
  const r = spawnSync('bash', [script, ...args], { cwd: dir, encoding: 'utf8' });
  assert.notStrictEqual(r.status, 0, `expected \`${path.basename(script)} ${args.join(' ')}\` to fail`);
  return r.stdout + r.stderr;
};
const hook = (payload) => spawnSync('bash', [guardSh], { cwd: dir, encoding: 'utf8', input: JSON.stringify(payload) });
const ticketPath = (n) => path.join(dir, 'tickets', n);
const read = (n) => fs.readFileSync(ticketPath(n), 'utf8');
const front = (n, key) => (read(n).match(new RegExp(`^${key}: *([^#\\n]*)`, 'm')) || [, ''])[1].trim();

const ticket = (id, deps, verify, criteria = '- [ ] it works') => `---
ticket: ${id}
status: open        # open | in_progress | done
size: S
depends_on: [${deps}]
---

## Objective
Test ticket.

## Acceptance Criteria
${criteria}

## Verification
\`\`\`bash
${verify}
\`\`\`
`;

try {
  fs.mkdirSync(path.join(dir, 'tickets'));
  fs.mkdirSync(path.join(dir, '.prd'));
  fs.writeFileSync(path.join(dir, '.prd', 'prd-v1.md'), '---\nversion: 1\nstatus: ticketed\ndate: 2026-09-02\n---\n# PRD\n');
  fs.writeFileSync(ticketPath('T-01-skeleton.md'), ticket('T-01', '', 'test -f hello.txt'));
  fs.writeFileSync(ticketPath('T-02-feature.md'), ticket('T-02', 'T-01', 'true'));

  // dependency order is enforced
  assert.match(runFail(ticketSh, 'start', 'T-02'), /depends on T-01/);

  // start stamps in_progress + started; done refuses without a receipt
  assert.match(run(ticketSh, 'start', 'T-01'), /T-01 started/);
  assert.strictEqual(front('T-01-skeleton.md', 'status'), 'in_progress');
  assert.match(front('T-01-skeleton.md', 'started'), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.match(read('T-01-skeleton.md'), /status: in_progress\s+# open \| in_progress \| done/, 'inline comment preserved');
  assert.match(runFail(ticketSh, 'done', 'T-01'), /no verification receipt/);

  // a red check writes no receipt; a green one does
  assert.match(runFail(ticketSh, 'verify', 'T-01'), /FAILED/);
  assert.strictEqual(front('T-01-skeleton.md', 'verified'), '');
  fs.writeFileSync(path.join(dir, 'hello.txt'), 'hi');
  assert.match(run(ticketSh, 'verify', 'T-01'), /receipt/);
  assert.match(front('T-01-skeleton.md', 'verified'), /^\d{4}-[^ ]+Z [0-9a-f]{12}$/);

  // done refuses unticked criteria, then succeeds and stamps finished
  assert.match(runFail(ticketSh, 'done', 'T-01'), /unticked acceptance criteria/);
  fs.writeFileSync(ticketPath('T-01-skeleton.md'), read('T-01-skeleton.md').replace('- [ ] it works', '- [x] it works'));
  assert.match(run(ticketSh, 'done', 'T-01'), /T-01 done/);
  assert.strictEqual(front('T-01-skeleton.md', 'status'), 'done');
  assert.match(front('T-01-skeleton.md', 'finished'), /Z$/);
  assert.match(run(ticketSh, 'verify', 'T-01'), /receipt left unchanged/);

  // verify auto-starts an open ticket; changing the check invalidates the receipt
  assert.match(run(ticketSh, 'verify', '2'), /T-02 started[\s\S]*receipt/);
  fs.writeFileSync(ticketPath('T-02-feature.md'), read('T-02-feature.md').replace('\ntrue\n', '\ntrue && true\n').replace('- [ ] it works', '- [x] it works'));
  assert.match(runFail(ticketSh, 'done', 'T-02'), /does not match the current Verification block/);
  assert.match(run(ticketSh, 'verify', 'T-02'), /receipt/);
  assert.match(run(ticketSh, 'done', 'T-02'), /T-02 done/);

  // status reads it all back and names the next step
  fs.writeFileSync(ticketPath('T-03-more.md'), ticket('T-03', 'T-02', 'true'));
  const status = run(statusSh);
  assert.match(status, /PRD +\.prd\/prd-v1\.md · status: ticketed/);
  assert.match(status, /3 total · 2 done · 0 in progress · 1 open/);
  assert.match(status, /T-01 +done +S +started \d\d:\d\d · finished \d\d:\d\d \(\d+m\)/);
  assert.match(status, /T-03 +open +S +ready/);
  assert.match(status, /Build +elapsed \d+m since the first ticket started · budget 75m/);
  assert.match(status, /Next +\/pincer-code — next ready ticket: T-03/);
  run(ticketSh, 'start', 'T-03');
  assert.match(run(statusSh), /Next +resume T-03/);

  // the hook: hand-written state is blocked, everything else passes
  const tp = ticketPath('T-03-more.md');
  const edit = (old_string, new_string, file_path = tp) => hook({ tool_name: 'Edit', tool_input: { file_path, old_string, new_string } });
  assert.strictEqual(edit('status: in_progress', 'status: done').status, 2);
  assert.match(edit('status: in_progress', 'status: done').stderr, /ticket guard/);
  assert.strictEqual(edit('---\n', '---\nverified: 2026-01-01T00:00:00Z abcdef012345\n').status, 2);
  assert.strictEqual(edit('- [ ] it works', '- [x] it works').status, 0, 'ticking a box is allowed');
  assert.strictEqual(edit('status: open', 'status: done', path.join(dir, 'README.md')).status, 0, 'non-ticket files are ignored');
  assert.strictEqual(hook({ tool_name: 'Write', tool_input: { file_path: ticketPath('T-04-new.md'), content: ticket('T-04', '', 'true') } }).status, 0, 'creating an open ticket is allowed');
  assert.strictEqual(hook({ tool_name: 'Write', tool_input: { file_path: ticketPath('T-04-new.md'), content: ticket('T-04', '', 'true').replace('status: open', 'status: done') } }).status, 2);
  const bash = (command) => hook({ tool_name: 'Bash', tool_input: { command } }).status;
  assert.strictEqual(bash("sed -i '' 's/status: in_progress/status: done/' tickets/T-03-more.md"), 2);
  assert.strictEqual(bash('echo "verified: now" >> tickets/T-03-more.md'), 2);
  assert.strictEqual(bash('grep verified: tickets/T-03-more.md'), 0, 'reading is allowed');
  assert.strictEqual(bash('bash scripts/pincer-ticket.sh done T-03'), 0, 'the script is the door');
  assert.strictEqual(bash('git commit -m "T-03: more"'), 0);

  console.log('ticket lifecycle test passed');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
