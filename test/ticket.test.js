// Ticket lifecycle through scripts/pincer-ticket.sh: start, verify, done, accept.
// Run with: node test/ticket.test.js
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir, run, write, read, ticketScript, createTicket, createHarness } from './helpers.js';

const require = createRequire(import.meta.url);
const parse = require(path.join(repo, 'template/scripts/pincer/parse.cjs'));

const ticket = (dir, ...args) => run(dir, 'bash', [ticketScript, ...args]);
const fm = (dir, file, key) => parse.frontmatterField(read(dir, file), key);
const both = (r) => `${r.stdout}${r.stderr}`;

// No agreement: every verb refuses with exit 3 and points at the blueprint
let dir = tempDir();
let file = createTicket(dir);
let r = ticket(dir, 'start', 'T-01');
assert.equal(r.status, 3, both(r));
assert.match(r.stderr, /^harness\.json: .*run \/pincer-blueprint/);
assert.doesNotMatch(r.stderr, /at .*\.cjs:\d+/);
assert.equal(fm(dir, file, 'status'), 'open');
write(dir, 'harness.json', '{');
r = ticket(dir, 'verify', 'T-01');
assert.equal(r.status, 3, both(r));
assert.match(r.stderr, /^harness\.json: .*JSON/);

// Stage code off: exit 3 naming the stage
dir = tempDir();
file = createTicket(dir);
createHarness(dir, { stages: { code: { on: false } } });
r = ticket(dir, 'start', 'T-01');
assert.equal(r.status, 3, both(r));
assert.match(r.stderr, /stage code is off/);

// Usage: exit 2
dir = tempDir();
createHarness(dir);
file = createTicket(dir);
assert.equal(ticket(dir).status, 2);
assert.equal(ticket(dir, 'bogus', 'T-01').status, 2);
assert.equal(ticket(dir, 'start').status, 2);
assert.equal(ticket(dir, 'start', 'T-01', 'extra').status, 2);
assert.equal(ticket(dir, 'accept', 'T-01', '--by', 'Alex').status, 2);
assert.equal(ticket(dir, 'accept', 'T-01', '--words', 'ok').status, 2);
assert.match(ticket(dir).stderr, /start|verify|done|accept/);

// start: open -> in_progress, started stamped, idempotent
r = ticket(dir, 'start', 'T-01');
assert.equal(r.status, 0, both(r));
assert.equal(fm(dir, file, 'status'), 'in_progress');
assert.match(fm(dir, file, 'started'), parse.TIMESTAMP);
const started = fm(dir, file, 'started');
r = ticket(dir, 'start', '1');
assert.equal(r.status, 0, both(r));
assert.match(r.stdout, /already in progress/);
assert.equal(fm(dir, file, 'started'), started);

// Unknown or invalid tickets refuse with exit 1
r = ticket(dir, 'start', 'T-09');
assert.equal(r.status, 1, both(r));
assert.match(r.stderr, /no ticket file/);
write(dir, 'tickets/T-02-broken.md', 'no frontmatter\n');
r = ticket(dir, 'start', 'T-02');
assert.equal(r.status, 1, both(r));
assert.match(r.stderr, /frontmatter/);

// verify: a failing check stamps a failed last_check, no receipt; verify on an open ticket starts it
dir = tempDir();
createHarness(dir);
file = createTicket(dir, { command: 'false' });
r = ticket(dir, 'verify', 'T-01');
assert.equal(r.status, 1, both(r));
assert.match(fm(dir, file, 'last_check'), / failed /);
assert.equal(fm(dir, file, 'verified'), '');
assert.equal(fm(dir, file, 'status'), 'in_progress');
assert.match(r.stderr, /FAILED/);
// A check's own exit code never collides with the engine's: any failure is exit 1, the code is in the message
dir = tempDir();
createHarness(dir);
file = createTicket(dir, { command: 'exit 3' });
r = ticket(dir, 'verify', 'T-01');
assert.equal(r.status, 1, both(r));
assert.match(r.stderr, /exit 3/);
assert.match(fm(dir, file, 'last_check'), / failed /);

// verify: a passing check stamps the receipt with the block hash
dir = tempDir();
createHarness(dir);
file = createTicket(dir, { command: 'true' });
r = ticket(dir, 'verify', 'T-01');
assert.equal(r.status, 0, both(r));
const verifiedText = read(dir, file);
assert.ok(fm(dir, file, 'verified').endsWith(` ${parse.blockHash(verifiedText)}`), fm(dir, file, 'verified'));
assert.match(fm(dir, file, 'verified'), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z [0-9a-f]{12}$/);
assert.match(fm(dir, file, 'last_check'), / passed /);
assert.ok(parse.validateTicket(file, verifiedText).ok);

// done: refuses on unticked criteria, closes after ticking
dir = tempDir();
createHarness(dir);
file = createTicket(dir, { criteria: '- [ ] x' });
ticket(dir, 'verify', 'T-01');
r = ticket(dir, 'done', 'T-01');
assert.equal(r.status, 1, both(r));
assert.match(r.stderr, /unticked/);
assert.equal(fm(dir, file, 'status'), 'in_progress');
write(dir, file, read(dir, file).replace('- [ ] x', '- [x] x'));
r = ticket(dir, 'done', 'T-01');
assert.equal(r.status, 0, both(r));
assert.equal(fm(dir, file, 'status'), 'done');
assert.match(fm(dir, file, 'finished'), parse.TIMESTAMP);
assert.match(r.stdout, /T-01: example/);
r = ticket(dir, 'done', 'T-01');
assert.equal(r.status, 0, both(r));
assert.match(r.stdout, /already done/);

// done: refuses without a receipt and on an open ticket
dir = tempDir();
createHarness(dir);
file = createTicket(dir);
r = ticket(dir, 'done', 'T-01');
assert.equal(r.status, 1, both(r));
assert.match(r.stderr, /verify/);
ticket(dir, 'start', 'T-01');
r = ticket(dir, 'done', 'T-01');
assert.equal(r.status, 1, both(r));
assert.match(r.stderr, /receipt/);

// done: a Verification block edited after the receipt is refused, naming the hash
dir = tempDir();
createHarness(dir);
file = createTicket(dir, { command: 'true' });
ticket(dir, 'verify', 'T-01');
write(dir, file, read(dir, file).replace('```bash\ntrue', '```bash\ntrue # changed'));
r = ticket(dir, 'done', 'T-01');
assert.equal(r.status, 1, both(r));
assert.match(r.stderr, /hash/);
assert.equal(fm(dir, file, 'status'), 'in_progress');

// accept: only on a done ticket, only by an acceptor, with their words
dir = tempDir();
createHarness(dir);
file = createTicket(dir);
r = ticket(dir, 'accept', 'T-01', '--by', 'Alex', '--words', 'ok');
assert.equal(r.status, 1, both(r));
assert.match(r.stderr, /done/);
ticket(dir, 'verify', 'T-01');
r = ticket(dir, 'done', 'T-01');
assert.equal(r.status, 0, both(r));
r = ticket(dir, 'accept', 'T-01', '--by', 'Nobody', '--words', 'ok');
assert.equal(r.status, 1, both(r));
assert.match(r.stderr, /Alex/);
r = ticket(dir, 'accept', 'T-01', '--by', 'Alex', '--words', '   ');
assert.equal(r.status, 1, both(r));
assert.match(r.stderr, /words/);
assert.equal(fm(dir, file, 'accepted'), '');
const words = 'looks good #12 "ship it"';
r = ticket(dir, 'accept', 'T-01', '--by', 'Alex', '--words', words);
assert.equal(r.status, 0, both(r));
assert.equal(parse.frontmatterField(read(dir, file), 'accepted_words'), words);
assert.equal(fm(dir, file, 'accepted_by'), 'Alex');
assert.match(fm(dir, file, 'accepted'), parse.TIMESTAMP);
assert.ok(parse.validateTicket(file, read(dir, file)).ok, parse.validateTicket(file, read(dir, file)).problems.join('; '));
assert.match(r.stdout, /accepted by Alex/);
r = ticket(dir, 'accept', 'T-01', '--by', 'Alex', '--words', 'two\nlines');
assert.equal(r.status, 0, both(r));
assert.match(r.stdout, /already accepted/);
assert.equal(fm(dir, file, 'accepted_words'), 'two lines');
assert.equal((read(dir, file).match(/^accepted/gm) || []).length, 3);
assert.equal(fm(dir, file, 'status'), 'done');

// Dependencies: start refuses while a depends_on ticket is not done, allows after
dir = tempDir();
createHarness(dir);
createTicket(dir, { id: 'T-01' });
createTicket(dir, { id: 'T-02', deps: 'T-01' });
r = ticket(dir, 'start', 'T-02');
assert.equal(r.status, 1, both(r));
assert.match(r.stderr, /T-01/);
ticket(dir, 'verify', 'T-01');
ticket(dir, 'done', 'T-01');
r = ticket(dir, 'start', 'T-02');
assert.equal(r.status, 0, both(r));

// Tickets live in the home the agreement names
dir = tempDir();
createHarness(dir, { homes: { tickets: 'work/tickets' } });
const scratch = tempDir();
write(dir, 'work/tickets/T-01-moved.md', read(scratch, createTicket(scratch)));
r = ticket(dir, 'start', 'T-01');
assert.equal(r.status, 0, both(r));
assert.equal(fm(dir, 'work/tickets/T-01-moved.md', 'status'), 'in_progress');

// The ticket's timeout bounds the check: an expired run is interrupted, exits 130, never passes (review I1)
dir = tempDir();
createHarness(dir);
let slow = createTicket(dir, { id: 'T-20', command: 'sleep 3' });
write(dir, slow, read(dir, slow).replace('size: S\n', 'size: S\ntimeout: 1\n'));
const t0 = Date.now();
r = ticket(dir, 'verify', 'T-20');
assert.equal(r.status, 130, both(r));
assert.ok(Date.now() - t0 < 2800, 'the run was cut short');
assert.match(r.stderr, /TIMED OUT after 1s/);
assert.match(read(dir, slow), /^last_check: \S+ interrupted [0-9a-f]{12}$/m);
assert.doesNotMatch(read(dir, slow), /^verified:/m);
assert.equal(ticket(dir, 'done', 'T-20').status, 1);

// accept refuses a done ticket whose receipt no longer matches its check (review I4)
dir = tempDir();
createHarness(dir);
let stale = createTicket(dir, { id: 'T-21' });
assert.equal(ticket(dir, 'verify', 'T-21').status, 0);
assert.equal(ticket(dir, 'done', 'T-21').status, 0);
write(dir, stale, read(dir, stale).replace('```bash\ntrue\n```', '```bash\nfalse\n```'));
r = ticket(dir, 'accept', 'T-21', '--by', 'Alex', '--words', 'ship it');
assert.equal(r.status, 1, both(r));
assert.match(r.stderr, /receipt hash .* does not match/);
assert.match(r.stderr, /verify T-21/);
assert.doesNotMatch(read(dir, stale), /^accepted/m);

console.log('ticket: ok');
