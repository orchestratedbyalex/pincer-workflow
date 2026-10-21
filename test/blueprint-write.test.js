// Blueprint writer: harness.json from an answers file, the agreement rendered
// between the markers in AGENTS.md, everything below the end marker untouched.
// Run with: node test/blueprint-write.test.js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir, run, write, read } from './helpers.js';

const require = createRequire(import.meta.url);
const bp = require(path.join(repo, 'template/scripts/pincer/blueprint.cjs'));
const harness = require(path.join(repo, 'template/scripts/pincer/harness.cjs'));
const script = path.join(repo, 'template/scripts/pincer-blueprint.cjs');
const cli = (dir, ...args) => run(dir, process.execPath, [script, ...args]);
const both = (r) => `${r.stdout}${r.stderr}`;
const exists = (dir, file) => fs.existsSync(path.join(dir, file));
const { AGREEMENT_START, AGREEMENT_END } = bp;
assert.equal(AGREEMENT_START, '<!-- pincer:agreement:start -->');
assert.equal(AGREEMENT_END, '<!-- pincer:agreement:end -->');
function between(text) {
  const s = text.indexOf(AGREEMENT_START), e = text.indexOf(AGREEMENT_END);
  assert.ok(s >= 0 && e > s, text);
  return text.slice(s + AGREEMENT_START.length, e);
}
const HEADINGS = ['### 1 Systems', '### 2 Current pipeline', '### 3 Handoff artifacts', '### 4 Simplify', '### 5 Responsibility', '### 6 Repo'];
function section(agreement, n) {
  const start = agreement.indexOf(HEADINGS[n - 1]);
  assert.ok(start >= 0, agreement);
  const next = n < 6 ? agreement.indexOf(HEADINGS[n]) : agreement.indexOf('\nOpen:');
  return agreement.slice(start, next);
}

const answers = {
  schema: 1,
  project: { name: 'Widgets', kind: 'brownfield', reason: 'two years of history and a live site' },
  people: [{ name: 'Alex', role: 'owner', accepts: true }, { name: 'Sam', role: 'reviewer' }],
  systems: { forge: 'github', remote: 'https://github.com/acme/widgets.git', ci: true, deploy: 'Vercel', secrets: '1Password' },
  repo: { branches: 'per-ticket', pr: true, merge: 'squash', protection: 'required review on main', checks: ['npm test', 'npm run lint'] },
  stages: { plan: { on: false, reason: 'changes are small; the ticket is the spec' }, evaluate: { where: 'pr' } },
  roster: { evaluate: ['code-quality-reviewer'] },
  open: ['Who owns the deploy key rotation?'],
  firstJob: 'Fix the flaky checkout test (T-01)',
};

// An invalid answers file: every problem on stderr, exit 3, nothing written
let dir = tempDir();
write(dir, 'answers.json', JSON.stringify({ schema: 1, project: { kind: 'blue' }, people: [] }));
let r = cli(dir, 'write', '--answers', 'answers.json');
assert.equal(r.status, 3, both(r));
assert.match(r.stderr, /answers\.json: project\.kind must be greenfield or brownfield/);
assert.match(r.stderr, /answers\.json: people must include at least one person with accepts: true/);
assert.equal(r.stdout, '');
assert.ok(!exists(dir, 'harness.json') && !exists(dir, 'AGENTS.md'));
let result = bp.write(dir, { answers: 'answers.json' });
assert.equal(result.ok, false);
assert.equal(result.problems.length, 2);
// malformed JSON and a missing file are problems too, not stack traces
write(dir, 'broken.json', '{');
r = cli(dir, 'write', '--answers', 'broken.json');
assert.equal(r.status, 3, both(r));
assert.match(r.stderr, /broken\.json: invalid JSON/);
assert.ok(!r.stderr.includes('    at '), r.stderr);
r = cli(dir, 'write', '--answers', 'nope.json');
assert.equal(r.status, 3, both(r));
assert.match(r.stderr, /nope\.json: cannot read/);
r = cli(dir, 'write');
assert.equal(r.status, 3, both(r));
assert.match(r.stderr, /harness\.json: cannot read/);
assert.equal(cli(dir, 'write', '--bogus').status, 2);
assert.equal(cli(dir, 'write', '--answers').status, 2);

// A valid answers file: harness.json normalized, AGENTS.md created from the skeleton
write(dir, 'answers.json', JSON.stringify(answers));
r = cli(dir, 'write', '--answers', 'answers.json');
assert.equal(r.status, 0, both(r));
assert.match(r.stdout, /^wrote harness\.json$/m);
assert.match(r.stdout, /^wrote AGENTS\.md$/m);
assert.equal(r.stderr, '');
const written = JSON.parse(read(dir, 'harness.json'));
assert.equal(written.stages.status, undefined);
assert.equal(written.stages.blueprint, undefined);
assert.deepEqual(written.homes, { specs: 'specs', tickets: 'tickets', evidence: 'evidence' });
assert.deepEqual(written.stages.narrow, { on: true, tickets: 'file' });
assert.deepEqual(written.stages.plan, { on: false, spec: 'file', gate: '', reason: 'changes are small; the ticket is the spec' });
assert.deepEqual(written.roster, { plan: [], narrow: [], code: [], evaluate: ['code-quality-reviewer'] });
assert.deepEqual(harness.validate(written), []);
assert.equal(read(dir, 'harness.json').endsWith('}\n'), true);
let agents = read(dir, 'AGENTS.md');
let agreement = between(agents);
assert.ok(agreement.includes('## Harness agreement — Widgets'), agreement);
let last = -1;
for (const heading of HEADINGS) { const at = agreement.indexOf(heading); assert.ok(at > last, `${heading} out of order in\n${agreement}`); last = at; }
assert.match(section(agreement, 1), /brownfield/);
assert.match(section(agreement, 1), /two years of history and a live site/);
assert.match(section(agreement, 1), /GitHub/);
assert.match(section(agreement, 1), /https:\/\/github\.com\/acme\/widgets\.git/);
assert.match(section(agreement, 1), /Vercel/);
assert.match(section(agreement, 1), /1Password/);
const pipeline = section(agreement, 2).split('\n').filter((l) => l.trim() && !l.startsWith('###'));
assert.equal(pipeline.length, 1, section(agreement, 2));
assert.doesNotMatch(pipeline[0], /\bplan\b/);
for (const stage of ['blueprint', 'narrow', 'code', 'evaluate', 'release', 'status']) assert.ok(pipeline[0].includes(stage), pipeline[0]);
assert.match(pipeline[0], /\*\*[^*]+\*\*/);
assert.match(pipeline[0], /accepted by Alex/);
assert.match(section(agreement, 3), /Spec: none/);
assert.match(section(agreement, 3), /Tickets: tickets\//);
assert.match(section(agreement, 3), /Evidence: evidence\//);
assert.match(section(agreement, 4), /plan is off — changes are small; the ticket is the spec/);
assert.match(section(agreement, 5), /Alex \(owner\) — accepts results/);
assert.match(section(agreement, 5), /Sam \(reviewer\)/);
assert.doesNotMatch(section(agreement, 5), /Sam \(reviewer\)[^\n]*accepts/);
assert.match(section(agreement, 5), /^- Models: the session's model everywhere\.$/m);
// with tiers agreed: the Models line sits between the people and the fixed lines
write(dir, 'answers.json', JSON.stringify({ ...answers, models: { stages: { evaluate: 'strong' }, agents: { 'code-quality-reviewer': { tier: 'strong', effort: 'high' } } } }));
r = cli(dir, 'write', '--answers', 'answers.json');
assert.equal(r.status, 0, both(r));
{
  const five = section(between(read(dir, 'AGENTS.md')), 5);
  assert.match(five, /^- Models: evaluate on strong; code-quality-reviewer \(high effort\) on strong; everything else on the session's model\.$/m);
  assert.ok(five.indexOf('Sam (reviewer)') < five.indexOf('- Models:') && five.indexOf('- Models:') < five.indexOf('- A person owns'), five);
  assert.deepEqual(JSON.parse(read(dir, 'harness.json')).models.stages.evaluate, { tier: 'strong', effort: '' });
}
// back to the plain answers so the checks below see the original agreement
write(dir, 'answers.json', JSON.stringify(answers));
r = cli(dir, 'write', '--answers', 'answers.json');
assert.equal(r.status, 0, both(r));
agents = read(dir, 'AGENTS.md');
agreement = between(agents);
assert.match(section(agreement, 6), /one branch per ticket/);
assert.match(section(agreement, 6), /PR: yes/);
assert.match(section(agreement, 6), /Merge: squash/);
assert.match(section(agreement, 6), /required review on main/);
assert.match(section(agreement, 6), /npm test, npm run lint/);
assert.match(agreement, /\nOpen:\n- Who owns the deploy key rotation\?\n/);
assert.match(agreement, /\nFirst job: Fix the flaky checkout test \(T-01\)\n/);
assert.equal(agreement.trimEnd().split('\n').pop(), 'Agreed enough to start; revisit after the first job.');
// the standing rules follow the agreement
for (const heading of ['## Conventions', '## Secrets', '## Security defaults', '## Untrusted content', '## Dependencies', '## Rules']) assert.ok(agents.includes(heading), heading);
assert.ok(agents.indexOf('## Conventions') > agents.indexOf(AGREEMENT_END));
assert.ok(agents.startsWith('# '), agents.slice(0, 40));
for (const stale of ['.prd', '.pincer/', 'pincer-runtime', 'PRD']) assert.ok(!agents.includes(stale), stale);
// the API returns the same agreement and the generator's report
result = bp.write(dir, { answers: 'answers.json' });
assert.equal(result.ok, true);
assert.equal(result.agreement, agreement.replace(/^\n/, ''));
for (const key of ['written', 'skipped', 'conflicted']) assert.ok(Array.isArray(result.generated[key]), key);
assert.deepEqual(harness.validate(result.harness), []);
// a second write is byte-identical
assert.equal(read(dir, 'AGENTS.md'), agents);

// A remote typed with a token never reaches harness.json or AGENTS.md
dir = tempDir();
write(dir, 'answers.json', JSON.stringify({ ...answers, systems: { ...answers.systems, remote: 'https://alice:ghp_secret123@github.com/acme/widgets.git' } }));
r = cli(dir, 'write', '--answers', 'answers.json');
assert.equal(r.status, 0, both(r));
assert.ok(!read(dir, 'harness.json').includes('ghp_secret123'));
assert.ok(!read(dir, 'AGENTS.md').includes('ghp_secret123'));
assert.ok(read(dir, 'AGENTS.md').includes('https://github.com/acme/widgets.git'));

// Text below the end marker survives byte for byte; the old agreement is replaced
dir = tempDir();
write(dir, 'answers.json', JSON.stringify(answers));
const tail = '\n## Mine\n\nMY RULE  \n\ttabbed\r\n\n\n';
write(dir, 'AGENTS.md', `# Widgets\n\nintro kept\n\n${AGREEMENT_START}\nold agreement\n${AGREEMENT_END}${tail}`);
r = cli(dir, 'write', '--answers', 'answers.json');
assert.equal(r.status, 0, both(r));
agents = read(dir, 'AGENTS.md');
assert.ok(agents.startsWith('# Widgets\n\nintro kept\n\n' + AGREEMENT_START), agents.slice(0, 80));
assert.ok(agents.endsWith(AGREEMENT_END + tail), JSON.stringify(agents.slice(-60)));
assert.ok(!agents.includes('old agreement'));
assert.equal(between(agents), between(read(dir, 'AGENTS.md')));
r = cli(dir, 'write', '--answers', 'answers.json');
assert.equal(read(dir, 'AGENTS.md'), agents);
assert.equal(agents.split(AGREEMENT_START).length, 2);

// No markers yet: the agreement goes to the top, after a leading title, the rest intact
dir = tempDir();
write(dir, 'answers.json', JSON.stringify(answers));
write(dir, 'AGENTS.md', '# Project Instructions\n\n## Mine\nMY RULE\n');
r = cli(dir, 'write', '--answers', 'answers.json');
assert.equal(r.status, 0, both(r));
agents = read(dir, 'AGENTS.md');
assert.ok(agents.startsWith(`# Project Instructions\n\n${AGREEMENT_START}\n## Harness agreement — Widgets`), agents.slice(0, 120));
assert.ok(agents.endsWith(`${AGREEMENT_END}\n\n## Mine\nMY RULE\n`), JSON.stringify(agents.slice(-80)));
write(dir, 'AGENTS.md', 'no title\n');
r = cli(dir, 'write', '--answers', 'answers.json');
assert.equal(r.status, 0, both(r));
agents = read(dir, 'AGENTS.md');
assert.ok(agents.startsWith(AGREEMENT_START), agents.slice(0, 60));
assert.ok(agents.endsWith(`${AGREEMENT_END}\n\nno title\n`), JSON.stringify(agents.slice(-60)));

// One marker without the other: refused before anything is written
dir = tempDir();
write(dir, 'answers.json', JSON.stringify(answers));
write(dir, 'AGENTS.md', `# T\n${AGREEMENT_START}\nhalf\n`);
r = cli(dir, 'write', '--answers', 'answers.json');
assert.equal(r.status, 1, both(r));
assert.match(r.stderr, /AGENTS\.md: .*marker/);
assert.ok(!exists(dir, 'harness.json'));
assert.equal(read(dir, 'AGENTS.md'), `# T\n${AGREEMENT_START}\nhalf\n`);

// write without --answers re-renders from harness.json itself; --root works from elsewhere
dir = tempDir();
write(dir, 'harness.json', JSON.stringify({ ...answers, project: { ...answers.project, name: 'Gadgets' } }));
r = cli(tempDir(), '--root', dir, 'write');
assert.equal(r.status, 0, both(r));
assert.ok(between(read(dir, 'AGENTS.md')).includes('## Harness agreement — Gadgets'));
assert.equal(JSON.parse(read(dir, 'harness.json')).homes.specs, 'specs');

// renderAgreement on a minimal agreement: defaults spelled out, nothing left blank
const minimal = harness.normalize({ schema: 1, project: { name: 'Tiny', kind: 'greenfield' }, people: [{ name: 'Alex', accepts: true }] });
agreement = bp.renderAgreement(minimal);
assert.ok(agreement.startsWith('## Harness agreement — Tiny\n'), agreement.slice(0, 60));
assert.match(section(agreement, 1), /Kind: greenfield\n/);
assert.match(section(agreement, 1), /Forge: none/);
assert.match(section(agreement, 2), /\bplan\b/);
assert.match(section(agreement, 3), /Spec: specs\//);
assert.match(section(agreement, 4), /nothing switched off/i);
assert.match(section(agreement, 5), /Alex — accepts results/);
assert.match(section(agreement, 6), /Branches: commit to main/);
assert.match(section(agreement, 6), /Checks: none/);
assert.match(agreement, /\nOpen:\n- none\n/);
assert.match(agreement, /\nFirst job: not named yet\n/);
assert.ok(!/\{\{|\}\}/.test(agreement), agreement);
// forge homes and an evidence-less evaluate
const forgey = harness.normalize({ ...minimal, stages: { plan: { spec: 'forge' }, narrow: { tickets: 'forge' }, evaluate: { evidence: false } } });
agreement = bp.renderAgreement(forgey);
assert.match(section(agreement, 3), /Spec: forge/);
assert.match(section(agreement, 3), /Tickets: forge/);
assert.match(section(agreement, 3), /Evidence: none/);

// The shipped AGENTS.md is the library skeleton, byte for byte, with the placeholder in place
const shipped = fs.readFileSync(path.join(repo, 'template/AGENTS.md'), 'utf8');
assert.equal(shipped, fs.readFileSync(path.join(repo, 'template/.claude/pincer/library/agents-skeleton.md'), 'utf8'));
const placeholder = between(shipped);
for (const heading of HEADINGS) assert.ok(placeholder.includes(heading), heading);
assert.ok(placeholder.includes('Not agreed yet. Run /pincer-blueprint.'));
assert.ok(!shipped.includes('@'), 'no @ imports in a file Codex reads');
const template = fs.readFileSync(path.join(repo, 'template/.claude/pincer/library/agreement.md'), 'utf8');
for (const heading of HEADINGS) assert.ok(template.includes(heading), heading);

console.log('ok blueprint-write');
