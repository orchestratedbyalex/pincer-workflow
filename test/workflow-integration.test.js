// One repeatable packed Codex workflow through the installed entry points.
// This is a synthetic local lifecycle fixture, not a native model/skill-discovery
// test. The acceptor and their words below are test data, never a human approval.
// Run with: node test/workflow-integration.test.js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { repo, tempDir, run, write, read } from './helpers.js';

const both = r => `${r.stdout}${r.stderr}`;
const expect = (r, code = 0) => {
  assert.ifError(r.error);
  assert.equal(r.status, code, both(r));
  return r;
};
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const packHome = tempDir();
const packed = expect(run(repo, 'npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', packHome]));
const filename = JSON.parse(packed.stdout)[0].filename;
expect(run(packHome, 'tar', ['-xzf', path.join(packHome, filename)]));
const bin = path.join(packHome, 'package/bin/pincer.js');
const dir = tempDir();
const git = (...args) => expect(run(dir, 'git', [
  '-c', 'user.name=Pincer Synthetic Fixture', '-c', 'user.email=fixture@example.invalid',
  '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args,
]));
const node = (...args) => run(dir, process.execPath, args);
const ticket = (...args) => run(dir, 'bash', ['scripts/pincer-ticket.sh', ...args]);
const status = () => JSON.parse(expect(run(dir, 'bash', ['scripts/pincer-status.sh', '--json'])).stdout);
const clean = () => assert.equal(git('status', '--porcelain').stdout, '', 'the fixture tree must be clean');
const commit = (message, files) => { git('add', '--', ...files); git('commit', '-m', message); return git('rev-parse', 'HEAD').stdout.trim(); };

git('init', '-b', 'main');
write(dir, 'package.json', json({ name: 'pincer-synthetic-workflow', version: '0.0.0', private: true, type: 'module', scripts: { test: 'node --test test/*.test.js' } }));
expect(node(bin, 'init', '--platform', 'codex'));
assert.deepEqual(JSON.parse(read(dir, '.pincer.json')).platforms, ['codex']);
expect(node(bin, 'doctor'));
expect(run(dir, 'bash', ['scripts/pincer-status.sh', '--stage', 'code']), 3);
assert.equal(status().harness, null);

// Exercise the installed blueprint writer; no helpers bypass its normalization,
// agreement rendering or generator. The entire interview is synthetic test data.
write(dir, 'harness.json', json({
  schema: 1,
  project: { name: 'synthetic greeting', kind: 'greenfield', reason: 'isolated integration fixture' },
  people: [{ name: 'Synthetic Test Acceptor', role: 'fixture', accepts: true }],
  systems: { forge: 'none', ci: false, deploy: 'none', secrets: 'none' },
  repo: { branches: 'main', pr: false, checks: ['npm test'] },
  roster: { evaluate: ['code-quality-reviewer'] },
  models: { agents: { 'code-quality-reviewer': 'inherit' } },
}));
expect(node('scripts/pincer-blueprint.cjs', 'write'));
assert.match(read(dir, 'AGENTS.md'), /synthetic greeting/);
for (const stage of ['blueprint', 'plan', 'narrow', 'code', 'evaluate', 'release', 'status']) {
  assert.ok(fs.existsSync(path.join(dir, `.agents/skills/pincer-${stage}/SKILL.md`)), stage);
  expect(run(dir, 'bash', ['scripts/pincer-status.sh', '--stage', stage]));
}
assert.ok(fs.existsSync(path.join(dir, '.codex/agents/code-quality-reviewer.toml')));
expect(node(bin, 'doctor'));
commit('fixture: installed Codex agreement', ['.']);

const specFile = 'specs/greeting.md';
write(dir, specFile, `---\nstatus: approved\n---\n# Synthetic greeting spec\n\n## Requirements\nR-01: exactly one nonempty argument prints Hello, <name>! and exits 0.\nR-02: missing or extra arguments print usage on stderr and exit 1.\n\n## Approval\nSynthetic fixture authorization, not a real person's acceptance.\n`);
commit('spec: synthetic greeting', [specFile]);
const ticketFile = 'tickets/T-01-greeting.md';
write(dir, ticketFile, `---\nticket: T-01\nstatus: open\nsize: S\nspec: ${specFile}\ndepends_on: []\ntimeout: 20\n---\n\n## Objective\nExercise R-01 and R-02 through the installed engine.\n\n## Acceptance Criteria\n- [ ] Correct greeting on valid input.\n- [ ] Missing and extra arguments are rejected.\n\n## Verification\nProves: the actual CLI process has exact output and exit status for accepted and rejected input.\n\`\`\`bash\nnpm test\n\`\`\`\n\n## Done when\nThe synthetic CLI passes and the synthetic acceptor fixture records acceptance.\n`);
commit('tickets: synthetic greeting', [ticketFile]);
const base = git('rev-parse', 'HEAD').stdout.trim();
expect(ticket('start', 'T-01'));
let r = expect(ticket('done', 'T-01'), 1);
assert.match(r.stderr, /no verification receipt/);

write(dir, 'test/greet.test.js', `import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cli = fileURLToPath(new URL('../src/greet.js', import.meta.url));
for (const [args, code, out, err] of [
  [['Alex'], 0, 'Hello, Alex!\\n', ''],
  [[], 1, '', 'Usage: greet <name>\\n'],
  [['Alex', 'Other'], 1, '', 'Usage: greet <name>\\n']
]) test(JSON.stringify(args), () => {
  const r = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 3000 });
  assert.ifError(r.error);
  assert.equal(r.status, code);
  assert.equal(r.stdout, out);
  assert.equal(r.stderr, err);
});
`);
// A plausible faulty implementation passes the happy path but fails rejection.
write(dir, 'src/greet.js', "process.stdout.write(`Hello, ${process.argv[2]}!\\n`);\n");
r = expect(ticket('verify', 'T-01'), 1);
assert.match(r.stderr, /verification FAILED/);
assert.match(read(dir, ticketFile), /^last_check: .* failed /m);
assert.doesNotMatch(read(dir, ticketFile), /^verified:/m);
expect(ticket('done', 'T-01'), 1);

const working = `const args = process.argv.slice(2);
if (args.length !== 1 || !args[0].trim()) {
  process.stderr.write('Usage: greet <name>\\n');
  process.exitCode = 1;
} else process.stdout.write(\`Hello, \${args[0]}!\\n\`);
`;
write(dir, 'src/greet.js', working);
expect(ticket('verify', 'T-01'));
r = expect(ticket('done', 'T-01'), 1);
assert.match(r.stderr, /unticked acceptance criteria/);
// Only author-owned checkboxes and Verification content change here. Lifecycle
// fields are exclusively written by the installed ticket script.
write(dir, ticketFile, read(dir, ticketFile).replaceAll('- [ ]', '- [x]').replace('npm test\n```', 'npm test\nnode --check src/greet.js\n```'));
r = expect(ticket('done', 'T-01'), 1);
assert.match(r.stderr, /does not match the current Verification block/);
expect(ticket('verify', 'T-01'));
// done must re-run behavior, not trust a passing receipt after source changes.
write(dir, 'src/greet.js', "process.stdout.write(`Hello, ${process.argv[2]}!\\n`);\n");
expect(ticket('done', 'T-01'), 1);
assert.equal(status().tickets[0].status, 'in_progress');
write(dir, 'src/greet.js', working);
expect(ticket('verify', 'T-01'));
expect(ticket('done', 'T-01'));
assert.equal(status().tickets[0].ready, true);
// done, with the closing commit still to come: status names it before anything else
assert.match(status().warnings[0], /^T-01 done but not committed/);
assert.equal(status().next, '$pincer-code T-01 (done, not committed)');
commit('T-01: synthetic greeting', ['src', 'test', ticketFile]);
assert.deepEqual(status().warnings, ['T-01 done without acceptance']);
write(dir, specFile, read(dir, specFile).replace('status: approved', 'status: built'));
const candidate = commit('spec: synthetic greeting built', [specFile]);
clean();
assert.equal(status().next, '$pincer-evaluate', 'a finished ticket without evidence is evaluated first');

// Evaluate actual command output, bind evidence to its source candidate, retain
// logs and a clearly labeled synthetic review. No model reviewer ran in CI.
const evaluation = expect(run(dir, 'npm', ['test']));
clean();
const evidenceHome = `evidence/${candidate}`;
const log = both(evaluation);
const review = 'Synthetic fixture review: expected CLI contract exercised by three subprocess cases. No native model review claimed.\n';
write(dir, `${evidenceHome}/checks/C-01.log`, log);
write(dir, `${evidenceHome}/review/report.md`, review);
const manifest = {
  schema: 1, candidate, base, created: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), spec: specFile,
  environment: { tools: [`Node ${process.version}`, 'packed installed Pincer'], limitations: ['synthetic lifecycle test; no native Codex/model session or human approval'] },
  checks: [{ id: 'C-01', kind: 'command', required: true, result: 'passed', command: 'npm test', log: 'checks/C-01.log' }],
  visual_review: { applicable: false, reason: 'text CLI only' },
  artifacts: { 'checks/C-01.log': sha(log), 'review/report.md': sha(review) },
};
const manifestFile = `${evidenceHome}/manifest.json`;
write(dir, manifestFile, json(manifest));
const validate = (file = manifestFile, expected = candidate) => node('scripts/pincer-evidence.cjs', 'validate', file, '--candidate', expected);
expect(validate());
assert.match(expect(validate(manifestFile, '0'.repeat(40)), 1).stderr, /not the expected candidate/);
// Tamper only with a copy; original recorded evidence is never rewritten to hide
// a failed check or artifact mismatch.
const copy = path.join(tempDir(), candidate);
fs.cpSync(path.join(dir, evidenceHome), copy, { recursive: true });
fs.appendFileSync(path.join(copy, 'checks/C-01.log'), 'synthetic tamper\n');
assert.match(expect(validate(path.join(copy, 'manifest.json')), 1).stderr, /digest mismatch/);
expect(validate());
const auditHead = commit('evaluate: synthetic greeting candidate', [evidenceHome]);
clean();
assert.deepEqual(status().unevaluated, [], 'the evidence covers the candidate that holds T-01');
assert.equal(status().next, '$pincer-release');
expect(run(dir, 'npm', ['test']));
expect(validate());
clean();

// The pre-acceptance audit leaves the pending warning intact. Bad acceptor/empty
// words refuse without changing the ticket. Successful acceptance below is only
// deterministic fixture data, and its commit is distinct from tested source.
const beforeAcceptance = read(dir, ticketFile);
expect(ticket('accept', 'T-01', '--by', 'Unknown Fixture', '--words', 'synthetic'), 1);
assert.equal(read(dir, ticketFile), beforeAcceptance);
expect(ticket('accept', 'T-01', '--by', 'Synthetic Test Acceptor', '--words', ''), 1);
assert.equal(read(dir, ticketFile), beforeAcceptance);
const words = 'SYNTHETIC FIXTURE ACCEPTANCE ONLY: the subprocess cases match this test contract.';
expect(ticket('accept', 'T-01', '--by', 'Synthetic Test Acceptor', '--words', words));
const afterAcceptance = read(dir, ticketFile);
assert.equal(afterAcceptance.replace(/^(accepted|accepted_by|accepted_words):.*\n/gm, ''), beforeAcceptance, 'only the three acceptance fields changed');
assert.equal(git('diff', '--name-only').stdout.trim(), ticketFile);
assert.match(afterAcceptance, new RegExp(`^accepted_words: ${words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
const acceptanceCommit = commit(`accept: T-01 for ${candidate}`, [ticketFile]);
assert.notEqual(acceptanceCommit, candidate);
assert.equal(git('rev-parse', `${acceptanceCommit}^`).stdout.trim(), auditHead);
assert.equal(JSON.parse(read(dir, manifestFile)).candidate, candidate, 'acceptance does not relabel the evaluated source candidate');
expect(validate());
assert.equal(git('diff', '--name-only', auditHead, acceptanceCommit).stdout.trim(), ticketFile);
assert.equal(git('diff', candidate, acceptanceCommit, '--', 'src', 'test', 'package.json').stdout, '', 'no source changed between evaluation and acceptance');
clean();
assert.deepEqual(status().warnings, []);
assert.equal(status().tickets[0].acceptedBy, 'Synthetic Test Acceptor');
assert.equal(status().next, 'all tickets done and accepted');

console.log('workflow integration: ok (packed Codex kit; real CLI checks, refusal/recovery, evidence, synthetic acceptance commit; no native model claim)');
