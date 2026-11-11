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

// Installed platform determines command hints in text, JSON and gate errors.
for (const [platforms, prefix] of [[['codex'], '$'], [['claude'], '/'], [['copilot'], '/'], [['claude', 'codex'], '/']]) {
  const installed = tempDir();
  write(installed, '.pincer.json', JSON.stringify({ platforms }));
  assert.equal(JSON.parse(status(installed, '--json').stdout).next, `${prefix}pincer-blueprint`);
  assert.ok(status(installed, '--stage', 'code').stderr.includes(`run ${prefix}pincer-blueprint`));
  assert.ok(ticket(installed, 'start', 'T-01').stderr.includes(`run ${prefix}pincer-blueprint`));
  createHarness(installed);
  assert.equal(lastLine(status(installed).stdout), `Next: ${prefix}pincer-plan <brief>`);
  createSpec(installed, 'greeting', 'draft');
  assert.equal(lastLine(status(installed).stdout), `Next: ${prefix}pincer-plan specs/greeting.md (awaiting approval)`);
  createSpec(installed, 'greeting', 'approved');
  assert.equal(lastLine(status(installed).stdout), `Next: ${prefix}pincer-narrow`);
  createTicket(installed);
  ticket(installed, 'start', 'T-01');
  assert.equal(JSON.parse(status(installed, '--json').stdout).next, 'scripts/pincer-ticket.sh verify T-01');
}

// Disabled narrow is never suggested; draft/unknown spec approval is still first.
const noNarrow = tempDir();
createHarness(noNarrow, { stages: { narrow: { on: false } } });
createSpec(noNarrow, 'pending', 'draft');
assert.match(status(noNarrow).stdout, /Next: \/pincer-plan specs\/pending.md \(awaiting approval\)/);
createSpec(noNarrow, 'pending', 'approved');
assert.equal(lastLine(status(noNarrow).stdout), 'Next: /pincer-code');

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

// A later draft must not disappear behind already accepted historical tickets.
createSpec(dir, 'next-change', 'draft');
assert.equal(JSON.parse(status(dir, '--json').stdout).next, '/pincer-plan specs/next-change.md (awaiting approval)');
createSpec(dir, 'next-change', 'built');

// Models: the agreed tiers appear on their own line after Stages, and in the JSON
createHarness(dir, { models: { stages: { evaluate: { tier: 'strong', effort: 'high' } }, agents: { 'security-reviewer': 'strong' } }, roster: { evaluate: ['security-reviewer'] } });
r = status(dir);
assert.equal(r.status, 0, both(r));
assert.equal(r.stdout.split('\n')[2], 'Models: evaluate strong/high; security-reviewer strong', r.stdout);
let modelsJson = JSON.parse(status(dir, '--json').stdout).models;
assert.deepEqual(modelsJson.stages.evaluate, { tier: 'strong', effort: 'high' });
assert.equal(modelsJson.agents['security-reviewer'].source, 'agreement');
createHarness(dir, { roster: { evaluate: ['security-reviewer'] } });
r = status(dir);
assert.doesNotMatch(r.stdout, /^Models:/m);
assert.equal(JSON.parse(status(dir, '--json').stdout).models.agents['security-reviewer'].tier, '');
createHarness(dir, { models: { stages: { narrow: { effort: 'high' } } } });
assert.match(status(dir).stdout, /^Models: narrow effort high$/m);
assert.equal(JSON.parse(status(tempDir(), '--json').stdout).models, null);
createHarness(dir);

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

// Release switched off: acceptance is still the floor, so the next command is the accept call itself, not the stage
dir = tempDir();
createHarness(dir, { stages: { release: { on: false, reason: 'acceptance happens in the PR' }, evaluate: { on: false } } });
createTicket(dir, { id: 'T-01' });
assert.equal(ticket(dir, 'verify', 'T-01').status, 0);
assert.equal(ticket(dir, 'done', 'T-01').status, 0);
r = status(dir);
assert.equal(r.status, 0, both(r));
assert.match(r.stdout, /^Warnings:\n  T-01 done without acceptance$/m);
assert.equal(lastLine(r.stdout), 'Next: scripts/pincer-ticket.sh accept T-01 --by "<name>" --words "<their words>"');
assert.equal(status(dir, '--stage', 'release').status, 3);

// --- A second change in a project that already finished one ---------------------
// An approved spec that no ticket names still needs narrowing, whatever the older
// tickets say; with narrow off the same spec goes straight to code.
dir = tempDir();
createHarness(dir, { stages: { evaluate: { evidence: false } } });
createTicket(dir, { spec: createSpec(dir, 'first', 'approved') });
ticket(dir, 'verify', 'T-01');
ticket(dir, 'done', 'T-01');
assert.equal(ticket(dir, 'accept', 'T-01', '--by', 'Alex', '--words', 'ship it').status, 0);
assert.equal(lastLine(status(dir).stdout), 'Next: all tickets done and accepted', 'a spec whose tickets name it is not narrowed again');
const second = createSpec(dir, 'second', 'approved');
assert.equal(lastLine(status(dir).stdout), 'Next: /pincer-narrow', 'an approved spec without tickets is narrowed');
createHarness(dir, { stages: { evaluate: { evidence: false }, narrow: { on: false } } });
assert.equal(lastLine(status(dir).stdout), 'Next: /pincer-code');
createHarness(dir, { stages: { evaluate: { evidence: false } } });
createSpec(dir, 'third', 'draft');
assert.equal(lastLine(status(dir).stdout), 'Next: /pincer-plan specs/third.md (awaiting approval)', 'a draft is still first');
createSpec(dir, 'third', 'built');
createTicket(dir, { id: 'T-02', spec: `./${second}` });
assert.equal(lastLine(status(dir).stdout), 'Next: /pincer-code', 'a ticket that names the spec covers it');
assert.equal(JSON.parse(status(dir, '--json').stdout).tickets[1].spec, `./${second}`);
// a ticket without a spec field that is still in flight may belong to the approved spec
dir = tempDir();
createHarness(dir, { stages: { evaluate: { evidence: false } } });
createSpec(dir, 'only', 'approved');
createTicket(dir);
ticket(dir, 'verify', 'T-01');
ticket(dir, 'done', 'T-01');
assert.equal(lastLine(status(dir).stdout), 'Next: /pincer-release');
// with plan off a spec file is not a reason to narrow
createHarness(dir, { stages: { evaluate: { evidence: false }, plan: { on: false } } });
assert.equal(ticket(dir, 'accept', 'T-01', '--by', 'Alex', '--words', 'ok').status, 0);
assert.equal(lastLine(status(dir).stdout), 'Next: all tickets done and accepted');

// Evidence counts only for the candidate that holds the finished ticket: in a git
// repository, evidence saved for the first change does not release the second.
const two = tempDir();
const git = (...args) => {
  const g = run(two, 'git', ['-c', 'user.name=Pincer Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args]);
  assert.equal(g.status, 0, both(g));
  return g.stdout.trim();
};
const commitAll = (message) => { git('add', '-A'); git('commit', '-q', '-m', message); return git('rev-parse', 'HEAD'); };
const saveEvidence = (candidate) => { write(two, `evidence/${candidate}/manifest.json`, JSON.stringify({ schema: 1, candidate })); return commitAll(`evaluate: ${candidate.slice(0, 7)}`); };
const next = () => JSON.parse(status(two, '--json').stdout);
git('init', '-q', '-b', 'main');
createHarness(two);
createTicket(two, { spec: createSpec(two, 'first', 'approved') });
ticket(two, 'verify', 'T-01');
assert.equal(ticket(two, 'done', 'T-01').status, 0);
createSpec(two, 'first', 'built');
// done, but the commit that closes the ticket never happened: status says so and names it first
assert.equal(next().next, '/pincer-code T-01 (done, not committed)');
assert.deepEqual(next().uncommitted, ['T-01']);
r = status(two);
assert.match(r.stdout, /^T-01 done verified \S+ \(not committed\)$/m);
assert.match(r.stdout, /^  T-01 done but not committed: its work is only in the working tree — review it, stage its paths and its file, commit as "T-01: <title>"$/m);
assert.equal(lastLine(r.stdout), 'Next: /pincer-code T-01 (done, not committed)');
const firstCandidate = commitAll('T-01: example');
assert.deepEqual(next().uncommitted, []);
assert.doesNotMatch(status(two).stdout, /not committed/);
assert.equal(next().next, '/pincer-evaluate', 'no evidence at all');
write(two, 'evidence/not-a-candidate/manifest.json', '{}');
assert.equal(next().next, '/pincer-evaluate', 'a manifest without a candidate proves nothing');
assert.deepEqual(next().unevaluated, ['T-01']);
saveEvidence(firstCandidate);
assert.equal(next().next, '/pincer-release', 'evidence for the candidate that holds T-01');
assert.deepEqual(next().unevaluated, []);
assert.equal(ticket(two, 'accept', 'T-01', '--by', 'Alex', '--words', 'ship it').status, 0);
commitAll(`accept: ${firstCandidate.slice(0, 7)}`);
assert.equal(next().next, 'all tickets done and accepted');
// the second change: narrow, code, then evaluate again before release
createSpec(two, 'second', 'approved');
assert.equal(next().next, '/pincer-narrow');
createTicket(two, { id: 'T-02', spec: 'specs/second.md' });
assert.equal(next().next, '/pincer-code');
ticket(two, 'verify', 'T-02');
assert.equal(ticket(two, 'done', 'T-02').status, 0);
createSpec(two, 'second', 'built');
assert.equal(next().next, '/pincer-code T-02 (done, not committed)', 'a finished ticket that is not committed has no candidate yet');
// the commit comes before the next ticket is started
createTicket(two, { id: 'T-03', spec: 'specs/second.md' });
assert.equal(next().next, '/pincer-code T-02 (done, not committed)', 'an open ticket waits for the commit');
run(two, 'rm', ['tickets/T-03-example.md']);
const secondCandidate = commitAll('T-02: example');
assert.equal(next().next, '/pincer-evaluate', 'the evidence of the first change does not cover T-02');
assert.deepEqual(next().unevaluated, ['T-02']);
assert.equal(lastLine(status(two).stdout), 'Next: /pincer-evaluate');
saveEvidence(secondCandidate);
assert.equal(next().next, '/pincer-release', 'evidence with no acceptance gives release');
// a receipt stamped after the evaluation is a new candidate
const t2 = 'tickets/T-02-example.md';
const evaluated = read(two, t2);
write(two, t2, evaluated.replace(/^verified: \S+/m, 'verified: 2020-01-01T00:00:00Z').replace(/^last_check: \S+/m, 'last_check: 2020-01-01T00:00:00Z'));
assert.equal(next().next, '/pincer-code T-02 (done, not committed)', 'a receipt that is not in a commit is committed first');
commitAll('T-02: verified again');
assert.equal(next().next, '/pincer-evaluate', 'a receipt newer than the evidence needs a new evaluation');
write(two, t2, evaluated);
commitAll('T-02: as evaluated');
assert.equal(next().next, '/pincer-release');
assert.equal(ticket(two, 'accept', 'T-02', '--by', 'Alex', '--words', 'ship it').status, 0);
assert.equal(next().next, 'all tickets done and accepted');

// a ticket file git ignores, and a project that is no git repository, cannot be told: no warning
write(two, '.gitignore', 'tickets/T-04-*\n');
commitAll('ignore one ticket');
createTicket(two, { id: 'T-04', spec: 'specs/second.md' });
ticket(two, 'verify', 'T-04');
assert.equal(ticket(two, 'done', 'T-04').status, 0);
assert.deepEqual(next().uncommitted, []);
const plain = tempDir();
createHarness(plain);
createTicket(plain);
ticket(plain, 'verify', 'T-01');
assert.equal(ticket(plain, 'done', 'T-01').status, 0);
assert.deepEqual(JSON.parse(status(plain, '--json').stdout).uncommitted, []);
assert.doesNotMatch(status(plain).stdout, /not committed/);

// The first job the agreement names is what to plan: on a new project, and again when
// the blueprint names another one after everything before it was accepted.
const job = tempDir();
const gitAt = (date, ...args) => {
  const g = run(job, 'git', ['-c', 'user.name=Pincer Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args],
    { env: { ...process.env, CLAUDE_PROJECT_DIR: job, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } });
  assert.equal(g.status, 0, both(g));
};
const nextJob = () => JSON.parse(status(job, '--json').stdout).next;
gitAt('2020-01-01T00:00:00Z', 'init', '-q', '-b', 'main');
createHarness(job, { firstJob: 'Greet a person by name', stages: { evaluate: { evidence: false }, plan: { on: true } } });
assert.equal(nextJob(), '/pincer-plan Greet a person by name', 'a new project starts with the first job');
createTicket(job, { spec: createSpec(job, 'greet', 'built') });
ticket(job, 'verify', 'T-01');
assert.equal(ticket(job, 'done', 'T-01').status, 0);
gitAt('2020-01-01T00:00:00Z', 'add', '-A');
gitAt('2020-01-01T00:00:00Z', 'commit', '-q', '-m', 'T-01: example');
assert.equal(ticket(job, 'accept', 'T-01', '--by', 'Alex', '--words', 'ship it').status, 0);
assert.equal(nextJob(), 'all tickets done and accepted', 'the first job that was built is not offered again');
createHarness(job, { firstJob: 'Add a whisper flag', stages: { evaluate: { evidence: false }, plan: { on: true } } });
assert.equal(nextJob(), '/pincer-plan Add a whisper flag', 'a first job named after the last acceptance');
assert.equal(lastLine(status(job).stdout), 'Next: /pincer-plan Add a whisper flag');
gitAt('2099-01-01T00:00:00Z', 'add', '-A');
gitAt('2099-01-01T00:00:00Z', 'commit', '-q', '-m', 'agreement: a new first job');
assert.equal(nextJob(), '/pincer-plan Add a whisper flag', 'committed or not');
createHarness(job, { firstJob: 'Add a whisper flag', stages: { evaluate: { evidence: false }, plan: { on: false } } });
assert.equal(nextJob(), '/pincer-narrow Add a whisper flag', 'with plan off the job goes to narrow');
createHarness(job, { firstJob: 'Add a whisper flag', stages: { evaluate: { evidence: false }, plan: { on: true } } });
createSpec(job, 'whisper', 'draft');
assert.equal(nextJob(), '/pincer-plan specs/whisper.md (awaiting approval)', 'once a spec exists the spec leads');

console.log('status: ok');
