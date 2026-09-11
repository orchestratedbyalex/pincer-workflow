// The Node parser (template/scripts/pincer-runtime/parse.cjs) accepts the
// supported grammar, rejects every malformed form the Bash validators rejected
// with a matching diagnostic, and normalizes exactly the contracted fields.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { repo, tempDir, createTicket, createPrd, write, read, run } from './helpers.js';

const runtime = path.join(repo, 'template/scripts/pincer-runtime.cjs');
const parse = createRequire(import.meta.url)(path.join(repo, 'template/scripts/pincer-runtime/parse.cjs'));
const validate = (dir, ...files) => run(dir, process.execPath, [runtime, 'validate', ...files]);

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
  ['invalid last_check outcome', s => s.replace('status: open', 'status: open\nlast_check: 2026-09-11T00:00:00Z skipped abcdef012345'), /invalid last_check outcome/],
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
  ['fence in acceptance', s => s.replace('- [x] expected behavior', '- [x] expected behavior\n```\n- [x] hidden\n```'), /not fences/],
  ['duplicate acceptance', s => `${s}\n## Acceptance Criteria\n- [x] other\n`, /duplicate Acceptance/],
  ['missing verification', s => s.replace('## Verification', '## Checks'), /Verification/],
  ['unclosed verification', s => s.replace(/```\n$/, ''), /closed runnable bash fence/],
  ['wrong language', s => s.replace('```bash', '```python'), /bash fence/],
  ['empty command', s => s.replace('\ntrue\n', '\n# comment only\n'), /runnable/],
  ['invalid shell', s => s.replace('\ntrue\n', '\nif true; then\n'), /invalid bash syntax/],
  ['two fences', s => `${s}\n\`\`\`bash\ntrue\n\`\`\`\n`, /exactly one bash fence/],
  ['duplicate verification', s => `${s}\n## Verification\n\`\`\`bash\ntrue\n\`\`\`\n`, /duplicate Verification/],
  ['tilde fence', s => s.replace('```bash\ntrue\n```', '~~~bash\ntrue\n~~~'), /tilde fences are unsupported/],
  ['zero timeout', s => s.replace('status: open', 'status: open\ntimeout: 0'), /timeout must be a positive integer/],
  ['fractional timeout', s => s.replace('status: open', 'status: open\ntimeout: 1.5'), /timeout must be a positive integer/],
  ['word timeout', s => s.replace('status: open', 'status: open\ntimeout: soon'), /timeout must be a positive integer/],
];
for (const [name, change, diagnostic] of malformed) {
  const dir = tempDir(); createPrd(dir);
  const file = createTicket(dir); const invalid = change(read(dir, file)); write(dir, file, invalid);
  const result = validate(dir, file);
  assert.equal(result.status, 4, `${name}: exit 4\n${result.stdout}${result.stderr}`);
  assert.match(result.stderr, /^pincer-ticket: tickets\/T-01-example\.md: /m, `${name}: prefixed diagnostic`);
  assert.match(result.stderr, diagnostic, `${name}: diagnostic\n${result.stderr}`);
  assert.equal(read(dir, file), invalid, `${name}: validation writes nothing`);
  const direct = parse.validateTicket(file, invalid);
  assert.equal(direct.ok, false, `${name}: module agrees`);
}

// Valid forms: every supported checkbox marker, uppercase X, a heading inside a
// fenced example, a positive timeout, and a done ticket with legacy receipts.
for (const marker of ['-', '  -', '\t*', ' +', ' 1.', ' 2)']) {
  const dir = tempDir(); createPrd(dir);
  const file = createTicket(dir, { criteria: `${marker} [ ] expected behavior\n${marker} [X] other` });
  const result = validate(dir, file);
  assert.equal(result.status, 0, `marker ${JSON.stringify(marker)} accepted\n${result.stderr}`);
  assert.deepEqual(parse.unticked(read(dir, file)), [`${marker} [ ] expected behavior`], `unticked for ${JSON.stringify(marker)}`);
}
{
  const dir = tempDir(); createPrd(dir);
  const file = createTicket(dir, { command: 'touch actual-check' });
  write(dir, file, read(dir, file).replace('## Objective\nExample', '## Objective\n```markdown\n## Verification\n```\n\nExample'));
  assert.equal(validate(dir, file).status, 0, 'headings in fenced examples are ignored');
  assert.deepEqual(parse.verificationCommands(read(dir, file)), ['touch actual-check']);
  const done = read(dir, file).replace('status: open', 'status: done\nstarted: 2026-09-11T00:00:00Z\nlast_check: 2026-09-11T00:01:00Z passed abcdef012345\nverified: 2026-09-11T00:01:00Z abcdef012345\nfinished: 2026-09-11T00:02:00Z\ntimeout: 30');
  write(dir, file, done);
  assert.equal(validate(dir, file).status, 0, 'done ticket with legacy receipts and a timeout is valid');
  assert.equal(parse.validateTicket(file, done).timeout, 30);
  assert.equal(parse.validateTicket(file, read(dir, createTicket(dir, { id: 'T-02' }))).timeout, 600, 'default timeout');
}

// Normalization: lifecycle fields and checkbox marks are the only exceptions.
{
  const dir = tempDir(); createPrd(dir);
  const file = createTicket(dir, { criteria: '- [ ] expected behavior\n- [ ] second' });
  const base = read(dir, file);
  const digest = parse.ticketDigest(base);
  const same = {
    'ticked box': base.replace('- [ ] expected behavior', '- [x] expected behavior'),
    'uppercase tick': base.replace('- [ ] second', '- [X] second'),
    'status change': base.replace('status: open', 'status: in_progress'),
    'lifecycle stamps': base.replace('status: open', 'status: done\nstarted: 2026-09-11T00:00:00Z\nlast_check: 2026-09-11T00:01:00Z passed abcdef012345\nverified: 2026-09-11T00:01:00Z abcdef012345\nfinished: 2026-09-11T00:02:00Z'),
    'status comment': base.replace('status: open', 'status: open   # open | in_progress | done'),
  };
  for (const [label, text] of Object.entries(same)) assert.equal(parse.ticketDigest(text), digest, `${label} keeps the authored digest`);
  const different = {
    'acceptance text': base.replace('expected behavior', 'expected behaviour'),
    'verification block': base.replace('\ntrue\n', '\ntrue && true\n'),
    'depends_on': base.replace('depends_on: []', 'depends_on: [T-02]'),
    'size': base.replace('size: S', 'size: M'),
    'timeout': base.replace('status: open', 'status: open\ntimeout: 30'),
    'objective': base.replace('Example', 'Other'),
    'prd': base.replace('prd: .prd/prd-v1.md', 'prd: .prd/prd-v2.md'),
  };
  for (const [label, text] of Object.entries(different)) assert.notEqual(parse.ticketDigest(text), digest, `${label} changes the authored digest`);
  assert.equal(parse.checkDigest(base, 600), parse.checkDigest(same['ticked box'], 600), 'check digest ignores boxes');
  assert.notEqual(parse.checkDigest(base, 600), parse.checkDigest(base, 30), 'timeout is part of the check digest');
  assert.notEqual(parse.checkDigest(base, 600), parse.checkDigest(different['verification block'], 600));
  // --digests prints the same values the module computes.
  const out = validate(dir, file, '--digests');
  assert.equal(out.status, 0, out.stderr);
  assert.equal(out.stdout, `ticket ${digest}\ncheck ${parse.checkDigest(base, 600)}\n`);
}

// Legacy block hash parity: the 12-hex receipt hash equals sha256 of the block
// with one trailing newline, as the Bash helper computed it (checked with shasum).
{
  const dir = tempDir(); createPrd(dir);
  const file = createTicket(dir, { command: 'echo one\necho two' });
  const expected = spawnSync('bash', ['-c', 'printf "echo one\\necho two\\n" | shasum -a 256 | cut -c1-12'], { encoding: 'utf8' }).stdout.trim();
  assert.equal(parse.legacyBlockHash(read(dir, file)), expected, 'legacy receipt hash parity');
}

// PRDs: status changes keep the revision digest; other edits change it; profile rules.
{
  const dir = tempDir(); createPrd(dir);
  const base = read(dir, '.prd/prd-v1.md');
  const digest = parse.prdDigest(base);
  assert.equal(parse.prdDigest(base.replace('status: ticketed', 'status: built')), digest, 'PRD status is not content');
  assert.notEqual(parse.prdDigest(`${base}\nMore scope.\n`), digest, 'PRD body is content');
  assert.notEqual(parse.prdDigest(base.replace('status: ticketed', 'status: ticketed\nprofile: small')), digest, 'profile is content');
  for (const [profile, expected] of [['small', 'small'], ['standard', 'standard'], [null, 'standard']]) {
    write(dir, '.prd/prd-v1.md', profile ? base.replace('status: ticketed', `status: ticketed\nprofile: ${profile}`) : base);
    const result = parse.validatePrd(dir, '.prd/prd-v1.md');
    assert.equal(result.ok, true, `profile ${profile}`);
    assert.equal(result.profile, expected);
    assert.equal(validate(dir, '.prd/prd-v1.md').status, 0);
  }
  write(dir, '.prd/prd-v1.md', base.replace('status: ticketed', 'status: ticketed\nprofile: tiny'));
  assert.match(validate(dir, '.prd/prd-v1.md').stderr, /profile must be small or standard/);
  write(dir, '.prd/prd-v1.md', base.replace('version: 1', 'version: 2'));
  assert.match(validate(dir, '.prd/prd-v1.md').stderr, /version must match filename \(1\)/);
  write(dir, '.prd/prd-v1.md', base.replace('status: ticketed', 'status: ticketed\nstatus: built'));
  assert.match(validate(dir, '.prd/prd-v1.md').stderr, /duplicate metadata key: status/);
  write(dir, '.prd/prd-v1.md', base.replace('status: ticketed', 'status: nonsense'));
  assert.match(validate(dir, '.prd/prd-v1.md').stderr, /PRD status must be draft, ticketed, or built/);
  assert.match(parse.validatePrd(dir, '../outside.md').problems[0], /invalid PRD reference/);
  assert.match(parse.validatePrd(dir, '.prd/prd-v9.md').problems[0], /PRD does not exist/);
  write(dir, 'NOTES.md', '---\nprd: .prd/prd-v1.md\nprd: .prd/prd-v2.md\n---\n');
  assert.match(validate(dir, 'NOTES.md').stderr, /^pincer: NOTES\.md: duplicate metadata key: prd/m);
}

// Ticket set and file resolution.
{
  const dir = tempDir(); createPrd(dir);
  const first = createTicket(dir);
  write(dir, 'tickets/T-01-other.md', read(dir, first));
  assert.match(parse.validateTicketSet(dir).problems[0], /duplicate ticket ID: T-01/);
  assert.match(parse.ticketFile(dir, '1').problem, /several files match/);
  assert.match(parse.ticketFile(dir, '7').problem, /no ticket file tickets\/T-07-\*\.md/);
  for (const id of ['0', '000000', '999999999999999999999', '-1', '1;true']) assert.equal(parse.normalizeId(id), null, `reject ${id}`);
  assert.equal(parse.normalizeId('000001'), 'T-01');
  assert.equal(parse.normalizeId('t-12'), 'T-12');
}

// Usage errors exit 2.
{
  const dir = tempDir();
  assert.equal(run(dir, process.execPath, [runtime]).status, 2);
  assert.equal(run(dir, process.execPath, [runtime, 'validate']).status, 2);
  assert.equal(run(dir, process.execPath, [runtime, 'validate', 'x.md', '--nope']).status, 2);
  assert.equal(run(dir, process.execPath, [runtime, 'frobnicate']).status, 2);
}
console.log('runtime parser tests passed');
