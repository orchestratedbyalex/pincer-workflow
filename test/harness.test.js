// harness.json: the schema 1 loader, validator and defaults.
// Run with: node test/harness.test.js
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir, write, read, createHarness } from './helpers.js';

const require = createRequire(import.meta.url);
const harness = require(path.join(repo, 'template/scripts/pincer/harness.cjs'));

const minimal = () => ({ schema: 1, project: { kind: 'greenfield' }, people: [{ name: 'A', accepts: true }] });
const problemsOf = (patch) => harness.validate({ ...minimal(), ...patch });
const names = (problems) => problems.join('; ');

// Constants
assert.equal(harness.HARNESS_FILE, 'harness.json');
assert.deepEqual(harness.STAGES, ['blueprint', 'plan', 'narrow', 'code', 'evaluate', 'release', 'status']);
assert.deepEqual(harness.ALWAYS_ON, ['blueprint', 'status']);
assert.equal(harness.AGENT_NAMES.length, 10);
assert.ok(harness.AGENT_NAMES.includes('codebase-explorer') && harness.AGENT_NAMES.includes('fix-agent'));

// load: missing, unparsable, invalid, valid
let r = harness.load(tempDir());
assert.equal(r.ok, false);
assert.equal(r.missing, true);
assert.match(r.message, /run \/pincer-blueprint/);
const broken = tempDir();
write(broken, 'harness.json', '{');
r = harness.load(broken);
assert.equal(r.ok, false);
assert.ok(!r.missing);
assert.match(r.problems[0], /JSON/);
assert.match(r.message, /JSON/);
const bad = tempDir();
write(bad, 'harness.json', JSON.stringify({ ...minimal(), stages: { deploy: { on: true } } }));
r = harness.load(bad);
assert.equal(r.ok, false);
assert.ok(r.problems.some((p) => /deploy/.test(p)), names(r.problems));
assert.match(r.message, /deploy/);
const good = tempDir();
createHarness(good);
r = harness.load(good);
assert.equal(r.ok, true, r.message);
assert.equal(r.harness.homes.tickets, 'tickets');
assert.deepEqual(harness.acceptors(r.harness), ['Alex']);

// validate
assert.deepEqual(harness.validate(minimal()), []);
assert.ok(harness.validate([]).some((p) => /object/.test(p)));
assert.ok(harness.validate(null).some((p) => /object/.test(p)));
assert.ok(problemsOf({ schema: 2 }).some((p) => /schema/.test(p)));
assert.ok(problemsOf({ project: { kind: 'blue' } }).some((p) => /kind/.test(p)));
assert.ok(problemsOf({ project: undefined }).some((p) => /kind/.test(p)));
assert.ok(problemsOf({ people: [{ name: 'A' }] }).some((p) => /accepts/.test(p)));
assert.ok(problemsOf({ people: [] }).some((p) => /accepts/.test(p)));
assert.ok(problemsOf({ people: [{ accepts: true }] }).some((p) => /name/.test(p)));
assert.ok(problemsOf({ stages: { deploy: {} } }).some((p) => /deploy/.test(p)));
assert.ok(problemsOf({ stages: { status: { on: false } } }).some((p) => /status/.test(p)));
assert.ok(problemsOf({ stages: { plan: { spec: 'wiki' } } }).some((p) => /plan\.spec/.test(p)));
assert.ok(problemsOf({ stages: { narrow: { tickets: 'jira' } } }).some((p) => /narrow\.tickets/.test(p)));
assert.ok(problemsOf({ stages: { evaluate: { where: 'slack' } } }).some((p) => /evaluate\.where/.test(p)));
assert.ok(problemsOf({ stages: { evaluate: { evidence: 'yes' } } }).some((p) => /evaluate\.evidence/.test(p)));
assert.ok(problemsOf({ stages: { release: { audit: 'none' } } }).some((p) => /release\.audit/.test(p)));
assert.ok(problemsOf({ stages: { code: { on: 'yes' } } }).some((p) => /code\.on/.test(p)));
assert.ok(problemsOf({ stages: { code: { implementer: 1 } } }).some((p) => /code\.implementer/.test(p)));
assert.ok(problemsOf({ roster: { evaluate: ['nobody'] } }).some((p) => /nobody/.test(p)));
assert.ok(problemsOf({ roster: { deploy: ['code-quality-reviewer'] } }).some((p) => /deploy/.test(p)));
assert.deepEqual(problemsOf({ roster: { evaluate: ['code-quality-reviewer', 'security-reviewer'] } }), []);
assert.ok(problemsOf({ homes: { tickets: '../tickets' } }).some((p) => /homes\.tickets/.test(p)));
assert.ok(problemsOf({ homes: { specs: '/abs' } }).some((p) => /homes\.specs/.test(p)));
assert.ok(problemsOf({ homes: { evidence: '' } }).some((p) => /homes\.evidence/.test(p)));
assert.ok(problemsOf({ repo: { merge: 'ff' } }).some((p) => /repo\.merge/.test(p)));
assert.ok(problemsOf({ repo: { branches: 'trunk' } }).some((p) => /repo\.branches/.test(p)));
assert.ok(problemsOf({ repo: { pr: 'yes' } }).some((p) => /repo\.pr/.test(p)));
assert.ok(problemsOf({ repo: { checks: 'npm test' } }).some((p) => /repo\.checks/.test(p)));
assert.ok(problemsOf({ systems: { forge: 'gitlab' } }).some((p) => /systems\.forge/.test(p)));
assert.ok(problemsOf({ systems: { ci: 'yes' } }).some((p) => /systems\.ci/.test(p)));
assert.ok(problemsOf({ open: 'later' }).some((p) => /open/.test(p)));
assert.deepEqual(problemsOf({ extra: { anything: true } }), []);

// normalize fills every default, keeps unknown keys, never adds the always-on stages
const n = harness.normalize(minimal());
for (const stage of ['plan', 'narrow', 'code', 'evaluate', 'release']) assert.equal(n.stages[stage].on, true, stage);
assert.ok(!('status' in n.stages) && !('blueprint' in n.stages));
assert.deepEqual(n.homes, { specs: 'specs', tickets: 'tickets', evidence: 'evidence' });
assert.equal(n.stages.plan.spec, 'file');
assert.equal(n.stages.plan.gate, '');
assert.equal(n.stages.narrow.tickets, 'file');
assert.equal(n.stages.code.implementer, false);
assert.equal(n.stages.evaluate.where, 'local');
assert.equal(n.stages.evaluate.evidence, true);
assert.equal(n.stages.release.audit, 'tree');
assert.deepEqual(n.repo, { branches: 'main', pr: false, merge: 'merge', protection: '', checks: [] });
assert.deepEqual(n.systems, { forge: 'none', remote: '', ci: false, deploy: '', secrets: '' });
assert.deepEqual(n.roster, { plan: [], narrow: [], code: [], evaluate: [] });
assert.deepEqual(n.open, []);
assert.equal(n.firstJob, '');
assert.equal(n.project.name, '');
assert.equal(n.project.reason, '');
assert.deepEqual(n.people, [{ name: 'A', role: '', accepts: true }]);
assert.deepEqual(harness.validate(n), []);
const kept = harness.normalize({ ...minimal(), extra: 1, stages: { code: { on: false, reason: 'no code yet' } } });
assert.equal(kept.extra, 1);
assert.equal(kept.stages.code.on, false);
assert.equal(kept.stages.code.reason, 'no code yet');
assert.equal(kept.stages.code.implementer, false);
assert.equal(kept.stages.plan.on, true);
const input = minimal();
harness.normalize(input);
assert.deepEqual(input, minimal(), 'normalize must not mutate its input');

// stageOn, homes, acceptors
assert.equal(harness.stageOn(n, 'status'), true);
assert.equal(harness.stageOn(n, 'blueprint'), true);
assert.equal(harness.stageOn(minimal(), 'status'), true);
assert.equal(harness.stageOn(minimal(), 'code'), true);
assert.equal(harness.stageOn(kept, 'code'), false);
assert.equal(harness.stageOn(n, 'deploy'), false);
assert.deepEqual(harness.homes(minimal()), { specs: 'specs', tickets: 'tickets', evidence: 'evidence' });
assert.equal(harness.homes({ ...minimal(), homes: { tickets: 'work/tickets/' } }).tickets, 'work/tickets');
assert.deepEqual(harness.acceptors({ ...minimal(), people: [{ name: 'A', accepts: true }, { name: 'B', accepts: false }, { name: 'C', accepts: true }] }), ['A', 'C']);
assert.deepEqual(harness.acceptors({}), []);

// createHarness writes a normalized doc and deep-merges overrides one level
const dir = tempDir();
createHarness(dir, { stages: { code: { on: false } }, roster: { evaluate: ['code-quality-reviewer'] }, project: { name: 'demo' } });
const doc = JSON.parse(read(dir, 'harness.json'));
assert.equal(doc.stages.code.on, false);
assert.equal(doc.stages.code.implementer, false);
assert.equal(doc.stages.plan.on, true);
assert.deepEqual(doc.roster.evaluate, ['code-quality-reviewer']);
assert.deepEqual(doc.roster.plan, []);
assert.equal(doc.project.name, 'demo');
assert.equal(doc.project.kind, 'greenfield');
assert.deepEqual(harness.validate(doc), []);

// a remote URL typed with credentials loses them on normalize (review M6)
assert.equal(harness.normalize({ systems: { remote: 'https://alice:ghp_secret123@github.com/acme/widgets.git' } }).systems.remote, 'https://github.com/acme/widgets.git');
assert.equal(harness.normalize({ systems: { remote: 'git@github.com:acme/widgets.git' } }).systems.remote, 'git@github.com:acme/widgets.git');

console.log('harness: ok');
