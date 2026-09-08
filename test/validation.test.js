import assert from 'node:assert/strict';
import { tempDir, createTicket, createPrd, write, read, step, run, statusScript } from './helpers.js';

const malformed = [
  ['missing frontmatter', s => s.replace(/^---\n/, ''), /frontmatter/],
  ['unclosed frontmatter', s => s.replace('\n---\n\n', '\n\n'), /frontmatter/],
  ['duplicate key', s => s.replace('status: open', 'status: open\nstatus: done'), /duplicate frontmatter key/],
  ['indented key', s => s.replace('status: open', ' status: open'), /unindented key/],
  ['unsupported status', s => s.replace('status: open', 'status: complete'), /status must/],
  ['missing ID', s => s.replace('ticket: T-01\n', ''), /canonical ID/],
  ['mismatched ID', s => s.replace('ticket: T-01', 'ticket: T-02'), /match filename/],
  ['missing size', s => s.replace('size: S\n', ''), /size must/],
  ...['started', 'finished', 'verified', 'last_check'].map(key => [
    `malformed ${key}`, s => s.replace('status: open', `status: open\n${key}: nonsense`), /timestamp/,
  ]),
  ['missing deps', s => s.replace('depends_on: []\n', ''), /depends_on/],
  ['malformed deps', s => s.replace('depends_on: []', 'depends_on: T-02'), /inline list/],
  ['duplicate deps', s => s.replace('depends_on: []', 'depends_on: [T-02, T-02]'), /duplicate depends_on/],
  ['self dependency', s => s.replace('depends_on: []', 'depends_on: [T-01]'), /itself/],
  ['noncanonical deps', s => s.replace('depends_on: []', 'depends_on: [T-2]'), /noncanonical/],
  ['missing acceptance', s => s.replace('## Acceptance Criteria', '## Criteria'), /Acceptance Criteria/],
  ['empty acceptance', s => s.replace('- [x] expected behavior', ''), /nonempty checkbox/],
  ['empty criterion', s => s.replace('- [x] expected behavior', '- [x] '), /malformed acceptance/],
  ['bad checkbox state', s => s.replace('- [x] expected behavior', '- [?] expected behavior'), /malformed acceptance/],
  ['malformed extra checkbox', s => s.replace('- [x] expected behavior', '- [x] expected behavior\n  -[ ] bypass'), /malformed acceptance/],
  ['duplicate acceptance', s => `${s}\n## Acceptance Criteria\n- [x] other\n`, /duplicate Acceptance/],
  ['missing verification', s => s.replace('## Verification', '## Checks'), /Verification/],
  ['unclosed verification', s => s.replace(/```\n$/, ''), /closed runnable bash fence/],
  ['wrong language', s => s.replace('```bash', '```python'), /bash fence/],
  ['empty command', s => s.replace('\ntrue\n', '\n# comment only\n'), /runnable/],
  ['invalid shell', s => s.replace('\ntrue\n', '\nif true; then\n'), /invalid bash syntax/],
  ['two fences', s => `${s}\n\`\`\`bash\ntrue\n\`\`\`\n`, /exactly one bash fence/],
  ['duplicate verification', s => `${s}\n## Verification\n\`\`\`bash\ntrue\n\`\`\`\n`, /duplicate Verification/],
];
for (const [name, change, diagnostic] of malformed) {
  const dir = tempDir(); createPrd(dir);
  const file = createTicket(dir); const invalid = change(read(dir, file)); write(dir, file, invalid);
  for (const action of ['start', 'verify', 'done']) {
    const result = step(dir, action);
    assert.notEqual(result.status, 0, `${name}: ${action} must fail`);
    assert.match(result.stderr, diagnostic, `${name}: ${action} diagnostic`);
    assert.equal(read(dir, file), invalid, `${name}: ${action} must not change state`);
  }
}

for (const marker of ['  -', '\t*', ' +', ' 1.', ' 2)']) {
  const dir = tempDir(); createPrd(dir);
  const file = createTicket(dir, { criteria: `${marker} [ ] expected behavior` });
  assert.equal(step(dir, 'verify').status, 0, marker);
  assert.match(step(dir, 'done').stderr, /unticked acceptance criteria/, marker);
  write(dir, file, read(dir, file).replace('[ ]', '[X]'));
  assert.equal(step(dir, 'done').status, 0, `${marker} uppercase checked box`);
}

const duplicate = tempDir(); createPrd(duplicate); const first = createTicket(duplicate);
write(duplicate, 'tickets/T-01-other.md', read(duplicate, first));
assert.match(step(duplicate, 'verify').stderr, /duplicate ticket ID/);
const original = read(duplicate, first);
assert.equal(read(duplicate, 'tickets/T-01-other.md'), original);

const doneDir = tempDir(); createPrd(doneDir); const doneFile = createTicket(doneDir);
assert.equal(step(doneDir, 'verify').status, 0); assert.equal(step(doneDir, 'done').status, 0);
write(doneDir, doneFile, read(doneDir, doneFile).replace('- [x] expected behavior', '- [z] invalid'));
const beforeDone = read(doneDir, doneFile);
assert.match(step(doneDir, 'done').stderr, /malformed acceptance/);
assert.equal(read(doneDir, doneFile), beforeDone);
assert.match(run(doneDir, 'bash', [statusScript]).stdout, /invalid|malformed/i);

const example = tempDir(); createPrd(example); const exampleFile = createTicket(example, { command: 'touch actual-check' });
write(example, exampleFile, read(example, exampleFile).replace('## Objective\nExample', '## Objective\n```markdown\n## Verification\n```\n\nExample'));
assert.equal(step(example, 'verify').status, 0, 'headings in fenced examples are ignored');
assert.equal(run(example, 'test', ['-f', 'actual-check']).status, 0, 'the actual check executes');

// PRD profile: small or standard; missing means standard; anything else is rejected.
for (const [profile, expected] of [['small', 'small'], ['standard', 'standard'], [null, 'standard']]) {
  const dir = tempDir(); createPrd(dir); createTicket(dir);
  if (profile) write(dir, '.prd/prd-v1.md', read(dir, '.prd/prd-v1.md').replace('status: ticketed', `status: ticketed\nprofile: ${profile}`));
  assert.match(run(dir, 'bash', [statusScript]).stdout, new RegExp(`^PRD .*profile: ${expected} `, 'm'), `profile ${profile} reports ${expected}`);
  assert.equal(step(dir, 'start').status, 0, `profile ${profile} is accepted`);
}
{
  const dir = tempDir(); createPrd(dir); const file = createTicket(dir);
  write(dir, '.prd/prd-v1.md', read(dir, '.prd/prd-v1.md').replace('status: ticketed', 'status: ticketed\nprofile: tiny'));
  const before = read(dir, file);
  const result = step(dir, 'start');
  assert.notEqual(result.status, 0, 'invalid profile is rejected');
  assert.match(result.stderr, /profile must be small or standard/);
  assert.equal(read(dir, file), before, 'rejection leaves the ticket untouched');
  assert.match(run(dir, 'bash', [statusScript]).stdout, /profile must be small or standard/);
}

const invalidId = tempDir(); createPrd(invalidId); createTicket(invalidId);
for (const id of ['0', '000000', '999999999999999999999', '-1', '1;true']) {
  assert.notEqual(step(invalidId, 'start', id).status, 0, `reject invalid numeric ID ${id}`);
}
assert.equal(step(invalidId, 'start', '000001').status, 0, 'bounded CLI shorthand normalizes');
console.log('ticket validation tests passed');
