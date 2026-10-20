// Status report, stage gate and next command through scripts/pincer-status.sh.
// Run with: node test/status.test.js
import assert from 'node:assert/strict';
import { tempDir, run, write, read, statusScript, ticketScript, createTicket, createSpec, createHarness } from './helpers.js';

const status = (dir, ...args) => run(dir, 'bash', [statusScript, ...args]);
const ticket = (dir, ...args) => run(dir, 'bash', [ticketScript, ...args]);
const lastLine = (text) => text.trimEnd().split('\n').pop();
const both = (r) => `${r.stdout}${r.stderr}`;

// No agreement: the report says so, the next command is the blueprint, the gate refuses
let dir = tempDir();
let r = status(dir);
assert.equal(r.status, 0, both(r));
assert.ok(r.stdout.startsWith('PINCER — no agreement yet'), r.stdout);
assert.equal(lastLine(r.stdout), 'Next: /pincer-blueprint');
r = status(dir, '--stage', 'code');
assert.equal(r.status, 3, both(r));
assert.match(r.stderr, /no agreement yet: run \/pincer-blueprint/);
assert.equal(r.stdout, '');
for (const always of ['blueprint', 'status']) {
  r = status(dir, '--stage', always);
  assert.equal(r.status, 0, both(r));
  assert.equal(r.stdout.trim(), 'on');
}
assert.equal(status(dir, '--stage').status, 2);
assert.equal(status(dir, '--stage', 'deploy').status, 2);
assert.equal(status(dir, '--bogus').status, 2);

// A broken harness.json: the report still renders, the problem is a warning, exit 3, no stack trace
dir = tempDir();
write(dir, 'harness.json', '{');
r = status(dir);
assert.equal(r.status, 3, both(r));
assert.match(r.stderr, /^harness\.json: .*JSON/);
assert.doesNotMatch(r.stderr, /at .*\.cjs:\d+/);
assert.match(r.stdout, /^Warnings:\n  harness\.json: .*JSON/m);
assert.equal(lastLine(r.stdout), 'Next: /pincer-blueprint');
r = status(dir, '--stage', 'code');
assert.equal(r.status, 3, both(r));
assert.match(r.stderr, /^harness\.json: .*JSON/);

// Agreement, nothing else: plan is next, the gate is open
dir = tempDir();
createHarness(dir);
r = status(dir);
assert.equal(r.status, 0, both(r));
assert.ok(r.stdout.startsWith('PINCER — example (greenfield)\n'), r.stdout);
assert.match(r.stdout, /^Stages: blueprint on, plan on, narrow on, code on, evaluate on, release on, status on$/m);
assert.equal(lastLine(r.stdout), 'Next: /pincer-plan <brief>');
assert.doesNotMatch(r.stdout, /Warnings/);
r = status(dir, '--stage', 'code');
assert.equal(r.status, 0, both(r));
assert.equal(r.stdout.trim(), 'on');

// plan off: narrow is next and the gate refuses plan
dir = tempDir();
createHarness(dir, { stages: { plan: { on: false } } });
r = status(dir);
assert.match(r.stdout, /plan off/);
assert.equal(lastLine(r.stdout), 'Next: /pincer-narrow');
r = status(dir, '--stage', 'plan');
assert.equal(r.status, 3, both(r));
assert.match(r.stderr, /^stage plan is off in harness\.json/);
assert.equal(status(dir, '--stage', 'narrow').status, 0);

// A spec and no tickets: narrow; one open ticket: code; in progress: verify
dir = tempDir();
createHarness(dir);
createSpec(dir);
r = status(dir);
assert.match(r.stdout, /^Specs: specs\/spec-v1\.md \(approved\)$/m);
assert.equal(lastLine(r.stdout), 'Next: /pincer-narrow');
createTicket(dir);
r = status(dir);
assert.match(r.stdout, /^T-01 open$/m);
assert.equal(lastLine(r.stdout), 'Next: /pincer-code');
ticket(dir, 'start', 'T-01');
r = status(dir);
assert.match(r.stdout, /^T-01 in_progress started \d{4}-/m);
assert.equal(lastLine(r.stdout), 'Next: scripts/pincer-ticket.sh verify T-01');

// Done without evidence wanted: the acceptance warning and release next
dir = tempDir();
createHarness(dir, { stages: { evaluate: { evidence: false } } });
let file = createTicket(dir);
ticket(dir, 'verify', 'T-01');
r = ticket(dir, 'done', 'T-01');
assert.equal(r.status, 0, both(r));
r = status(dir);
assert.equal(r.status, 0, both(r));
assert.match(r.stdout, /^T-01 done verified \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/m);
assert.match(r.stdout, /^Warnings:\n  T-01 done without acceptance$/m);
assert.equal(lastLine(r.stdout), 'Next: /pincer-release');

// Done with evidence wanted: evaluate until a manifest exists
const withEvidence = tempDir();
createHarness(withEvidence);
createTicket(withEvidence);
ticket(withEvidence, 'verify', 'T-01');
ticket(withEvidence, 'done', 'T-01');
r = status(withEvidence);
assert.equal(lastLine(r.stdout), 'Next: /pincer-evaluate');
write(withEvidence, 'evidence/abc123/manifest.json', '{}');
r = status(withEvidence);
assert.equal(lastLine(r.stdout), 'Next: /pincer-release');

// Evaluate off: straight to release
const noEvaluate = tempDir();
createHarness(noEvaluate, { stages: { evaluate: { on: false } } });
createTicket(noEvaluate);
ticket(noEvaluate, 'verify', 'T-01');
ticket(noEvaluate, 'done', 'T-01');
r = status(noEvaluate);
assert.match(r.stdout, /evaluate off/);
assert.equal(lastLine(r.stdout), 'Next: /pincer-release');

// A done ticket whose check changed after the receipt: the legacy warning and verify next
const stale = tempDir();
createHarness(stale, { stages: { evaluate: { evidence: false } } });
const staleFile = createTicket(stale);
ticket(stale, 'verify', 'T-01');
ticket(stale, 'done', 'T-01');
write(stale, staleFile, read(stale, staleFile).replace('```bash\ntrue', '```bash\ntrue # edited'));
r = status(stale);
assert.match(r.stdout, /T-01 done: latest verification: .* — re-run verify/);
assert.equal(lastLine(r.stdout), 'Next: scripts/pincer-ticket.sh verify T-01');

// Accepted: nothing left, and the JSON report carries the acceptance
r = ticket(dir, 'accept', 'T-01', '--by', 'Alex', '--words', 'ship it');
assert.equal(r.status, 0, both(r));
r = status(dir);
assert.equal(r.status, 0, both(r));
assert.match(r.stdout, /^T-01 done verified \S+ accepted by Alex$/m);
assert.doesNotMatch(r.stdout, /Warnings/);
assert.equal(lastLine(r.stdout), 'Next: all tickets done and accepted');
r = status(dir, '--json');
assert.equal(r.status, 0, both(r));
const json = JSON.parse(r.stdout);
assert.equal(json.tickets[0].id, 'T-01');
assert.equal(json.tickets[0].file, file);
assert.equal(json.tickets[0].status, 'done');
assert.equal(json.tickets[0].acceptedBy, 'Alex');
assert.equal(json.tickets[0].ready, true);
assert.equal(json.tickets[0].problem, null);
assert.deepEqual(json.tickets[0].depends, []);
assert.match(json.tickets[0].verified, /^\d{4}-/);
assert.equal(json.stages.plan, 'on');
assert.equal(json.harness.project.name, 'example');
assert.equal(json.harnessProblem, null);
assert.deepEqual(json.warnings, []);
assert.equal(json.next, 'all tickets done and accepted');

// Dependencies appear in the JSON report
createTicket(dir, { id: 'T-02', deps: 'T-01' });
const withDeps = JSON.parse(status(dir, '--json').stdout);
assert.deepEqual(withDeps.tickets[1].depends, ['T-01']);
assert.equal(withDeps.next, '/pincer-code');

// An invalid ticket is reported, not hidden
dir = tempDir();
createHarness(dir);
write(dir, 'tickets/T-01-bad.md', 'no frontmatter\n');
r = status(dir);
assert.equal(r.status, 0, both(r));
assert.match(r.stdout, /^T-01 invalid: .*frontmatter/m);
assert.match(r.stdout, /^Warnings:\n  tickets\/T-01-bad\.md: .*frontmatter/m);
assert.equal(lastLine(r.stdout), 'Next: fix tickets/T-01-bad.md');

// The always-on gate passes even when stages is empty; tickets are read from the agreed home
dir = tempDir();
createHarness(dir, { stages: {}, homes: { tickets: 'work/tickets' } });
r = status(dir, '--stage', 'status');
assert.equal(r.status, 0, both(r));
assert.equal(r.stdout.trim(), 'on');
const scratch = tempDir();
write(dir, 'work/tickets/T-01-moved.md', read(scratch, createTicket(scratch)));
r = status(dir);
assert.match(r.stdout, /^T-01 open$/m);
assert.equal(JSON.parse(status(dir, '--json').stdout).tickets[0].file, 'work/tickets/T-01-moved.md');

console.log('status: ok');
