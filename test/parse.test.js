// Parser and utilities: the ticket and spec grammar of the 1.0 kit.
// Run with: node test/parse.test.js
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir, write, createTicket, createSpec } from './helpers.js';

const require = createRequire(import.meta.url);
const parse = require(path.join(repo, 'template/scripts/pincer/parse.cjs'));
const util = require(path.join(repo, 'template/scripts/pincer/util.cjs'));

const ticket = (fm, body = 'true') => `---\n${fm}\n---\n\n## Objective\nX\n\n## Acceptance Criteria\n- [x] a\n\n## Verification\n\`\`\`bash\n${body}\n\`\`\`\n`;
const base = 'ticket: T-01\nstatus: open\nsize: S\ndepends_on: []';
const file = 'tickets/T-01-example.md';
const joined = (r) => r.problems.join('; ');

// Constants
assert.deepEqual(parse.LIFECYCLE_FIELDS, ['status', 'started', 'last_check', 'verified', 'finished', 'accepted', 'accepted_by', 'accepted_words']);
assert.equal(parse.DEFAULT_TIMEOUT, 600);
assert.ok(parse.SPEC_REF.test('specs/spec-v1.md'));
assert.ok(!parse.SPEC_REF.test('specs/spec v1.md'));
assert.ok(parse.TIMESTAMP.test('2026-10-20T10:00:00Z'));

// Ids
assert.equal(parse.normalizeId('3'), 'T-03');
assert.equal(parse.normalizeId('T-12'), 'T-12');
assert.equal(parse.normalizeId('x'), null);
assert.ok(parse.canonicalId('T-01'));
assert.ok(!parse.canonicalId('T-1'));

// spec is optional; when present it must be a safe relative .md reference; forge is free text
let r = parse.validateTicket(file, ticket(base));
assert.ok(r.ok, joined(r));
r = parse.validateTicket(file, ticket(`${base}\nspec: ../x.md`));
assert.ok(!r.ok);
assert.ok(r.problems.some((p) => /spec/.test(p)), joined(r));
r = parse.validateTicket(file, ticket(`${base}\nspec: specs/spec v1.md`));
assert.ok(!r.ok && r.problems.some((p) => /spec/.test(p)), joined(r));
r = parse.validateTicket(file, ticket(`${base}\nspec: specs/spec-v1.md\nforge: https://example.com/issues/1`));
assert.ok(r.ok, joined(r));
assert.equal(r.fields.forge, 'https://example.com/issues/1');

// Required keys
r = parse.validateTicket(file, ticket('ticket: T-01\nstatus: open\nsize: S'));
assert.ok(!r.ok && r.problems.some((p) => /depends_on/.test(p)), joined(r));

// accepted_words is read verbatim; the comment rule still applies to other keys
const words = 'fix #12 "ok" by me';
const accepted = ticket(`${base}\naccepted: 2026-10-20T10:00:00Z\naccepted_by: Alex\naccepted_words: ${words}`);
assert.equal(parse.frontmatterField(accepted, 'accepted_words'), words);
assert.equal(parse.parseFrontmatter(accepted).fields.accepted_words, words);
assert.equal(parse.frontmatterField(ticket(`${base}\nforge: x # note`), 'forge'), 'x');
r = parse.validateTicket(file, accepted);
assert.ok(r.ok, joined(r));
r = parse.validateTicket(file, ticket(`${base}\naccepted: yesterday`));
assert.ok(!r.ok && r.problems.some((p) => /accepted/.test(p)), joined(r));
r = parse.validateTicket(file, ticket(`${base}\naccepted: 2026-10-20T10:00:00Z`));
assert.ok(!r.ok && r.problems.some((p) => /accepted_by/.test(p)), joined(r));

// blockHash follows the Verification block only
const a = ticket(base, 'npm test');
const b = ticket(base, 'npm run check');
const c = a.replace('## Objective\nX', '## Objective\nY');
assert.match(parse.blockHash(a), /^[0-9a-f]{12}$/);
assert.notEqual(parse.blockHash(a), parse.blockHash(b));
assert.equal(parse.blockHash(a), parse.blockHash(c));
assert.equal(parse.blockText(a), 'npm test\n');
assert.deepEqual(parse.verificationCommands(ticket(base, 'echo one\necho two')), ['echo one', 'echo two']);

// Two Verification sections are rejected
r = parse.validateTicket(file, `${ticket(base)}\n## Verification\n\`\`\`bash\ntrue\n\`\`\`\n`);
assert.ok(!r.ok && r.problems.some((p) => /Verification/.test(p)), joined(r));

// Criteria, timeout, dependencies
assert.deepEqual(parse.unticked(ticket(base).replace('- [x] a', '- [ ] a\n- [x] b')), ['- [ ] a']);
assert.equal(parse.effectiveTimeout({}), 600);
assert.equal(parse.effectiveTimeout({ timeout: '30' }), 30);
assert.deepEqual(parse.dependencies({ depends_on: '[T-01, T-02]' }), ['T-01', 'T-02']);
assert.deepEqual(parse.dependencies({}), []);

// fmSet appends a missing key before the closing ---, replaces an existing one; fmUnset removes
const set = parse.fmSet(ticket(base), 'started', '2026-10-20T10:00:00Z');
assert.ok(set.startsWith('---\nticket: T-01\nstatus: open\nsize: S\ndepends_on: []\nstarted: 2026-10-20T10:00:00Z\n---\n'), set);
assert.equal(set.slice(set.indexOf('\n---\n', 4)), ticket(base).slice(ticket(base).indexOf('\n---\n', 4)));
const replaced = parse.fmSet(set, 'status', 'in_progress');
assert.equal(parse.frontmatterField(replaced, 'status'), 'in_progress');
assert.equal((replaced.match(/^status:/gm) || []).length, 1);
const unset = parse.fmUnset(replaced, 'started');
assert.equal(parse.frontmatterField(unset, 'started'), '');
assert.ok(!/^started:/m.test(unset));
assert.equal(parse.fmUnset(unset, 'started'), unset);
assert.equal(parse.frontmatterField(parse.fmSet(set, 'accepted_words', 'two\nlines'), 'accepted_words'), 'two lines');

// Ticket files under a configurable home; spec validation
const root = tempDir();
createTicket(root, { id: 'T-01' });
createTicket(root, { id: 'T-02' });
assert.deepEqual(parse.ticketFiles(root, 'tickets'), ['tickets/T-01-example.md', 'tickets/T-02-example.md']);
assert.deepEqual(parse.ticketFiles(root, 'work/items'), []);
assert.deepEqual(parse.ticketFile(root, 'tickets', '2'), { id: 'T-02', file: 'tickets/T-02-example.md' });
assert.match(parse.ticketFile(root, 'tickets', '3').problem, /no ticket file/);
assert.match(parse.ticketFile(root, 'tickets', 'zz').problem, /not a ticket id/);

const ref = createSpec(root, 'spec-v1', 'approved');
let s = parse.validateSpec(root, ref);
assert.ok(s.ok, joined(s));
assert.equal(s.fields.status, 'approved');
s = parse.validateSpec(root, 'specs/missing.md');
assert.ok(!s.ok && s.problems.some((p) => /exist/.test(p)), joined(s));
s = parse.validateSpec(root, '../x.md');
assert.ok(!s.ok && s.problems.some((p) => /spec/.test(p)), joined(s));
createSpec(root, 'spec-v2', 'maybe');
s = parse.validateSpec(root, 'specs/spec-v2.md');
assert.ok(!s.ok && s.problems.some((p) => /status/.test(p)), joined(s));
write(root, 'specs/bad.md', '# no frontmatter\n');
s = parse.validateSpec(root, 'specs/bad.md');
assert.ok(!s.ok, joined(s));

// util
assert.match(util.nowIso(), parse.TIMESTAMP);
util.atomicWrite(path.join(root, 'deep/dir/a.json'), '{"a":1}\n');
assert.deepEqual(util.readJson(path.join(root, 'deep/dir/a.json')), { a: 1 });
assert.equal(util.readJson(path.join(root, 'nope.json')), null);
write(root, 'bad.json', '{');
assert.equal(util.readJson(path.join(root, 'bad.json')), null);
assert.equal(util.git(repo, ['rev-parse', '--is-inside-work-tree']), 'true');
assert.throws(() => util.git(root, ['rev-parse', '--verify', 'definitely-not-a-ref']));
assert.equal(util.tryGit(root, ['rev-parse', '--verify', 'definitely-not-a-ref']), null);
const clean = util.sanitizeText('token=abc123 then AKIAABCDEFGHIJKLMNOP then ghp_abcdefghijklmnopqrstuvwxyz');
assert.ok(!clean.includes('abc123') && !clean.includes('AKIAABCDEFGHIJKLMNOP') && !clean.includes('ghp_abcdef'), clean);
assert.ok(clean.includes('[redacted]'));
assert.equal(util.sanitizeText('plain text'), 'plain text');
assert.equal(util.sanitizeText('-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\nafter'), '[redacted]\n[redacted]\n[redacted]\nafter');

console.log('parse: ok');
