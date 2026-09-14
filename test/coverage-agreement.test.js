// PRD v6 T-69 (R-03, S-07..S-09): a strict change binds its inventory, its coverage
// map and its declared checks into the agreement — links, scenario text, commands,
// timeouts and scope dispositions invalidate the authorization while status-only
// edits, attempts and reports do not; a delegated strengthening binds the new
// agreement; deferral and removal need a resolved decision naming the ID and an
// applicable user authorization; deleted obligations are detected from the retained
// baseline, an open decision survives a reverted digest, and stale prepared writes
// refuse at commit.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir, write, read, run } from './helpers.js';

const require = createRequire(import.meta.url);
const changes = require(path.join(repo, 'template/scripts/pincer-runtime/changes.cjs'));
const agreement = require(path.join(repo, 'template/scripts/pincer-runtime/agreement.cjs'));
const authorization = require(path.join(repo, 'template/scripts/pincer-runtime/authorization.cjs'));
const coverage = require(path.join(repo, 'template/scripts/pincer-runtime/coverage.cjs'));
const dispositions = require(path.join(repo, 'template/scripts/pincer-runtime/dispositions.cjs'));
const state = require(path.join(repo, 'template/scripts/pincer-runtime/state.cjs'));
const parse = require(path.join(repo, 'template/scripts/pincer-runtime/parse.cjs'));
const runtime = path.join(repo, 'template/scripts/pincer-runtime.cjs');
const fx = path.join(repo, 'test/fixtures/prd-v6');
const rt = (dir, ...args) => run(dir, process.execPath, [runtime, ...args]);
function passes(result, label = '') { assert.equal(result.status, 0, `${label}\n${result.stdout}${result.stderr}`); return result.stdout; }
function refuses(result, status, pattern, label = '') { assert.equal(result.status, status, `${label}: exit ${status}\n${result.stdout}${result.stderr}`); assert.match(result.stdout + result.stderr, pattern, label); return result; }
function git(dir, ...args) { return passes(run(dir, 'git', args), `git ${args.join(' ')}`).trim(); }
function commit(dir, message) { git(dir, 'add', '-A'); git(dir, '-c', 'user.name=T', '-c', 'user.email=t@example.invalid', 'commit', '-q', '--allow-empty', '-m', message); return git(dir, 'rev-parse', 'HEAD'); }
const record = (dir, id = 'prd-v1') => JSON.parse(read(dir, `.prd/changes/${id}.json`));
const showJson = dir => JSON.parse(passes(rt(dir, 'change', 'show', 'prd-v1', '--json')));
const currentDigest = dir => showJson(dir).agreement.current;
const verdictOf = dir => authorization.verdict(dir, record(dir));
const edit = (dir, file, from, to) => { const t = read(dir, file); assert.ok(t.includes(from), `${file} contains ${JSON.stringify(from)}`); write(dir, file, t.replace(from, to)); };
const graphOf = dir => { const r = record(dir); const c = coverage.load(dir, r, { priorInventory: gid => agreement.inventoryOf(dir, r, r.agreements.find(g => g.id === gid) || null) }); return c; };

// A strict project: the fixture PRD, tickets and map; registered, authorized,
// activated, adopted and authorized again (user) for the strict agreement.
function strictFixture() {
  const dir = tempDir(); git(dir, 'init', '-q');
  write(dir, '.gitignore', '.pincer/\n');
  write(dir, '.prd/prd-v1.md', read(fx, 'strict/prd-v1.md'));
  for (const f of fs.readdirSync(path.join(fx, 'strict/tickets'))) write(dir, `tickets/${f}`, read(fx, `strict/tickets/${f}`));
  write(dir, '.prd/coverage/prd-v1.json', read(fx, 'strict/coverage/prd-v1.json'));
  write(dir, 'value.txt', 'good\n');
  commit(dir, 'base');
  passes(rt(dir, 'register', '--prd', '.prd/prd-v1.md'));
  passes(rt(dir, 'change', 'select', 'prd-v1'));
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', currentDigest(dir), '--reference', 'planning session', '--excerpt', 'go ahead'));
  passes(rt(dir, 'change', 'activate', 'prd-v1'));
  passes(rt(dir, 'coverage', 'adopt', '--apply', '--change', 'prd-v1'));
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', currentDigest(dir), '--reference', 'planning session', '--excerpt', 'the coverage map is right'));
  commit(dir, 'strict');
  return dir;
}

// --- S-07: what changes the agreement and what does not; delegated strengthening ------
{
  const dir = strictFixture();
  const r = record(dir);
  assert.equal(r.schema, 3); assert.equal(r.coverage.agreement, 'G-02');
  const c = agreement.compute(dir, r);
  assert.match(c.projection, /^pincer agreement 2\nchange prd-v1\nprd \.prd\/prd-v1\.md [0-9a-f]{64}\ninventory [0-9a-f]{64}\ncoverage \.prd\/coverage\/prd-v1\.json [0-9a-f]{64}\nticket T-01 [0-9a-f]{64}\nticket T-02 [0-9a-f]{64}\nticket T-03 [0-9a-f]{64}\n$/, 'projection version 2 binds the inventory and the map');
  assert.equal(c.inventory.digest, coverage.load(dir, r).inventory.digest);
  assert.equal(c.coverage.digest, coverage.readMap(dir, r).digest);
  assert.equal(verdictOf(dir).verdict, 'current');
  const base = c.digest;
  const snap = agreement.readSnapshot(dir, r, r.agreements[1]);
  assert.ok(!snap.code, snap.problem); assert.equal(snap.snapshot.schema, 2); assert.equal(snap.snapshot.inventory.digest, c.inventory.digest); assert.equal(snap.snapshot.coverage.digest, c.coverage.digest);
  assert.deepEqual(Object.keys(r.agreements[1]), changes.AGREEMENT_KEYS_STRICT); assert.equal(r.agreements[0].inventory, null, 'the pre-adoption entry has no inventory digest');
  const stable = {
    'PRD status': () => edit(dir, '.prd/prd-v1.md', 'status: ticketed', 'status: built'),
    'ticket lifecycle fields': () => edit(dir, 'tickets/T-01-parse.md', 'status: open', 'status: in_progress\nstarted: 2026-09-12T00:00:00Z'),
    'ticket checkbox': () => edit(dir, 'tickets/T-02-diagnostics.md', '- [ ] expected behavior', '- [x] expected behavior'),
    'map reformatted': () => write(dir, '.prd/coverage/prd-v1.json', JSON.stringify(JSON.parse(read(dir, '.prd/coverage/prd-v1.json')), null, 4)),
    'an attempt': () => passes(rt(dir, 'verify', 'T-01')),
    'reports': () => { passes(rt(dir, 'status')); passes(rt(dir, 'resume')); passes(rt(dir, 'change', 'show', 'prd-v1')); },
    'evidence and NOTES': () => { write(dir, 'NOTES.md', '# n\n'); write(dir, '.prd/evidence/prd-v1/x/manifest.json', '{}'); },
    'source edit': () => write(dir, 'value.txt', 'good\n\n'),
  };
  for (const [label, fn] of Object.entries(stable)) { fn(); assert.equal(currentDigest(dir), base, `${label} keeps the agreement`); assert.equal(verdictOf(dir).verdict, 'current', `${label} keeps the authorization`); }
  write(dir, '.prd/coverage/prd-v1.json', read(fx, 'strict/coverage/prd-v1.json')); assert.equal(currentDigest(dir), base, 'the original formatting is the same map');
  const changing = {
    'scenario text': () => edit(dir, '.prd/prd-v1.md', 'Duplicate IDs cause an actionable diagnostic.', 'Duplicate IDs are merged silently.'),
    'a link': () => edit(dir, '.prd/coverage/prd-v1.json', '"tickets": ["T-01", "T-02"]', '"tickets": ["T-01"]'),
    'a check command': () => edit(dir, '.prd/coverage/prd-v1.json', '"command": "test \\"$(cat value.txt)\\" = good"', '"command": "true"'),
    'a check timeout': () => edit(dir, '.prd/coverage/prd-v1.json', '"timeout": 60', '"timeout": 61'),
    'a check obligation': () => edit(dir, '.prd/coverage/prd-v1.json', 'read the diagnostic wording', 'skim the wording'),
    'a scope disposition': () => edit(dir, '.prd/coverage/prd-v1.json', '"disposition": "deferred", "decision": "D-01", "prior": null', '"disposition": "removed", "decision": "D-01", "prior": "G-02"'),
    'a ticket classification': () => edit(dir, '.prd/coverage/prd-v1.json', '"T-02": { "role": "implements", "rationale": null }', '"T-02": { "role": "implements", "rationale": null }, "T-04": { "role": "enables", "rationale": "x" }'),
    'a requirement title': () => edit(dir, '.prd/prd-v1.md', '### R-02: Report impact', '### R-02: Explain impact'),
    // A checkbox mark on a scenario keeps the inventory digest but is a PRD body edit (v5 prd_revision rule).
    'a PRD checkbox mark': () => edit(dir, '.prd/prd-v1.md', '- [x] **S-02:**', '- [ ] **S-02:**'),
  };
  for (const [label, fn] of Object.entries(changing)) {
    const before = read(dir, '.prd/prd-v1.md'), beforeMap = read(dir, '.prd/coverage/prd-v1.json');
    fn();
    assert.notEqual(currentDigest(dir), base, `${label} changes the agreement`);
    const v = verdictOf(dir);
    assert.equal(v.verdict, 'AGREEMENT_CHANGED', `${label} invalidates the authorization`);
    refuses(rt(dir, 'verify', 'T-01'), 1, /AGREEMENT_CHANGED/, `${label}: execution refused`);
    write(dir, '.prd/prd-v1.md', before); write(dir, '.prd/coverage/prd-v1.json', beforeMap);
    assert.equal(verdictOf(dir).verdict, 'current', `${label}: restored`);
  }
  // The rendered difference names inventory and map changes structurally.
  edit(dir, '.prd/prd-v1.md', 'Duplicate IDs cause an actionable diagnostic.', 'Duplicate IDs are merged silently.');
  edit(dir, '.prd/coverage/prd-v1.json', '"timeout": 60', '"timeout": 90');
  const v = verdictOf(dir);
  assert.match(v.detail, /inventory changed \(scenarios changed: S-02 \(text\)\); coverage map changed/, v.detail);
  // A delegated strengthening (a longer timeout, nothing else) binds the new agreement with its basis.
  edit(dir, '.prd/prd-v1.md', 'Duplicate IDs are merged silently.', 'Duplicate IDs cause an actionable diagnostic.');
  const strengthened = currentDigest(dir);
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', strengthened, '--delegated', '--basis', 'A-02', '--explanation', 'a longer timeout for the same command stays within the approved scope'));
  const r2 = record(dir);
  assert.equal(r2.authorizations.at(-1).id, 'A-03'); assert.equal(r2.authorizations.at(-1).basis, 'A-02'); assert.equal(r2.agreements.at(-1).id, 'G-03'); assert.equal(r2.agreements.at(-1).coverage, coverage.readMap(dir, r2).digest);
  assert.equal(verdictOf(dir).verdict, 'current');
  // The strengthened declaration no longer matches what a candidate attempt would have recorded: fresh verification is required.
  const g = graphOf(dir).graph;
  assert.notEqual(g.checks['C-01'].digest, parse.sha256('test "$(cat value.txt)" = good\ntimeout=60\n'), 'the declaration digest changed with the timeout');
  assert.equal(g.checks['C-01'].digest, parse.sha256('test "$(cat value.txt)" = good\ntimeout=90\n'));
  // Ticket attempts are keyed by ticket/check/source identity, not by the agreement: the earlier pass stays current for its ticket.
  const st = JSON.parse(passes(rt(dir, 'status', '--json')));
  assert.equal(st.tickets.find(t => t.id === 'T-01').latest_attempt.outcome, 'passed');
  passes(rt(dir, 'verify', 'T-01'), 'execution proceeds under the delegated authorization');
  const idx = state.readIndex(dir).index;
  const a = state.readAttempt(dir, idx.current['ticket:prd-v1:T-01']).attempt;
  assert.equal(a.schema, 3); assert.equal(a.context.agreement, strengthened); assert.equal(a.context.coverage, r2.agreements.at(-1).coverage); assert.equal(a.context.inventory, r2.agreements.at(-1).inventory, 'the attempt records the strict identities');
}

// --- S-08: deferral and removal need a decision naming the ID and an applicable user authorization
{
  const dir = strictFixture();
  const problems = () => { const r = record(dir); const c = graphOf(dir); return dispositions.scopeProblems(r, c.graph, authorization.verdict(dir, r)); };
  // The fixture map defers S-03 by D-01, which does not exist yet.
  assert.deepEqual(problems().problems.map(p => p.detail), ['S-03 (deferred): no decision D-01 on change prd-v1']);
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--summary', 'defer the impact scenario to the next change'));
  assert.deepEqual(problems().problems.map(p => p.detail), ['S-03 (deferred): decision D-01 is open']);
  assert.equal(verdictOf(dir).verdict, 'DECISION_REQUIRED');
  // Resolved, but the user's words do not name the scenario.
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--resolve', 'D-01', '--reference', 'chat 10:02', '--excerpt', 'yes, defer the impact work'));
  assert.deepEqual(problems().problems.map(p => p.detail), ['S-03 (deferred): decision D-01 does not name S-03']);
  // A decision is never rewritten: raise one that names the ID, resolve it, and point the map at it.
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--summary', 'defer S-03 (impact report) to the next change'));
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--resolve', 'D-02', '--reference', 'chat 10:05', '--excerpt', 'agreed: S-03 is deferred'));
  edit(dir, '.prd/coverage/prd-v1.json', '"decision": "D-01"', '"decision": "D-02"');
  // The agreement changed (resolved decisions and the map): the authorization must name the decision and be the user's.
  assert.equal(verdictOf(dir).verdict, 'AGREEMENT_CHANGED');
  assert.deepEqual(problems().problems.map(p => p.detail), ['S-03 (deferred): the agreement is not authorized (AGREEMENT_CHANGED)']);
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', currentDigest(dir), '--delegated', '--basis', 'A-02', '--explanation', 'still within scope'));
  assert.equal(verdictOf(dir).verdict, 'current');
  assert.deepEqual(problems().problems.map(p => p.detail), ['S-03 (deferred): the current authorization A-03 descends from A-02, which does not name D-02'], 'a delegated authorization cannot waive the scope decision');
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', currentDigest(dir), '--reference', 'chat 10:06', '--excerpt', 'approved with S-03 deferred'), 'a user authorization without --decision');
  assert.deepEqual(problems().problems.map(p => p.detail), ['S-03 (deferred): the current authorization A-04 does not name D-02']);
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', currentDigest(dir), '--reference', 'chat 10:06', '--excerpt', 'approved with S-03 deferred', '--decision', 'D-02'));
  const ok = problems();
  assert.deepEqual(ok.problems, []); assert.deepEqual(ok.resolved, [{ id: 'S-03', disposition: 'deferred', decision: 'D-02', authorization: 'A-05', excerpt: 'agreed: S-03 is deferred', reference: 'chat 10:05' }], 'non-delivery is recorded explicitly with its decision and user authorization');
  // A later delegated strengthening keeps the deferral authorized through its basis chain; a later user authorization that does not name it does not.
  edit(dir, '.prd/coverage/prd-v1.json', '"timeout": 60', '"timeout": 120');
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', currentDigest(dir), '--delegated', '--basis', 'A-05', '--explanation', 'longer timeout'));
  assert.deepEqual(problems().problems, [], 'the chain A-06 → A-05 carries the user decision forward');
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', currentDigest(dir), '--reference', 'chat 11:00', '--excerpt', 'fine'));
  assert.deepEqual(problems().problems, [], 'a later user authorization of the same agreement revokes nothing: A-06 → A-05 still carries the decision');
  assert.equal(problems().resolved[0].authorization, 'A-05');
  // Removal: a tombstone referencing the prior inventory keeps the obligation reviewable after the prose is gone.
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--summary', 'remove S-03 from this change'));
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--resolve', 'D-03', '--reference', 'chat 11:10', '--excerpt', 'drop S-03 entirely'));
  edit(dir, '.prd/coverage/prd-v1.json', '"disposition": "deferred", "decision": "D-02", "prior": null', '"disposition": "removed", "decision": "D-03", "prior": "G-02"');
  edit(dir, '.prd/prd-v1.md', '- **S-03** — Changing one scenario names that scenario and its requirement.\n', '- **S-04:** Impact is reported for whatever remains.\n');
  edit(dir, '.prd/coverage/prd-v1.json', '"S-02": { "tickets": ["T-01", "T-02"], "checks": ["C-01", "C-02"] }', '"S-02": { "tickets": ["T-01", "T-02"], "checks": ["C-01", "C-02"] },\n    "S-04": { "tickets": ["T-02"], "checks": ["C-02"] }');
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', currentDigest(dir), '--reference', 'chat 11:11', '--excerpt', 'S-03 removed, S-04 added', '--decision', 'D-03'));
  const removed = graphOf(dir);
  assert.ok(removed.ok, JSON.stringify(removed.problems));
  assert.deepEqual(removed.graph.scope['S-03'], { id: 'S-03', requirement: 'R-02', disposition: 'removed', decision: 'D-03', prior: 'G-02', note: 'deferred to the next change', live: false });
  const r = record(dir);
  assert.ok(agreement.inventoryOf(dir, r, r.agreements.find(g => g.id === 'G-02')).scenarios['S-03'], 'the prior inventory still defines the removed obligation');
  assert.deepEqual(problems().problems, []);
  assert.deepEqual(dispositions.obligationProblems(dispositions.baseline(dir, r), removed.inventory, removed.map.map), [], 'a tombstone satisfies deletion detection');
  // A tombstone whose prior never defined the ID, or names an agreement without an inventory, is incomplete.
  edit(dir, '.prd/coverage/prd-v1.json', '"prior": "G-02"', '"prior": "G-01"');
  assert.deepEqual(graphOf(dir).graph.problems.map(p => p.detail), ['S-03: prior agreement G-01 is not a retained agreement with an inventory snapshot']);
}

// --- S-09: deletion from prose and map is detected; a revert cannot bypass an open decision; stale prepared writes refuse
{
  const dir = strictFixture();
  const r0 = record(dir);
  const base = dispositions.baseline(dir, r0);
  assert.deepEqual(base.agreements, ['G-02']); assert.deepEqual(Object.keys(base.scenarios), ['S-01', 'S-02', 'S-03']); assert.deepEqual(base.scenarios['S-03'], { requirement: 'R-02', agreement: 'G-02', authorization: 'A-02' });
  // Delete S-03 from the PRD and its scope row from the map: the baseline still holds it.
  edit(dir, '.prd/prd-v1.md', '- **S-03** — Changing one scenario names that scenario and its requirement.\n', '- **S-04:** Something else.\n');
  edit(dir, '.prd/coverage/prd-v1.json', '"S-03": { "disposition": "deferred", "decision": "D-01", "prior": null, "note": "deferred to the next change" }', '');
  edit(dir, '.prd/coverage/prd-v1.json', '"S-02": { "tickets": ["T-01", "T-02"], "checks": ["C-01", "C-02"] }', '"S-02": { "tickets": ["T-01", "T-02"], "checks": ["C-01", "C-02"] },\n    "S-04": { "tickets": ["T-02"], "checks": ["C-02"] }');
  const c = graphOf(dir);
  assert.ok(c.ok, JSON.stringify(c.problems));
  const missing = dispositions.obligationProblems(dispositions.baseline(dir, record(dir)), c.inventory, c.map.map);
  assert.equal(missing.length, 1); assert.equal(missing[0].code, 'OBLIGATION_MISSING'); assert.deepEqual(missing[0].ids, ['S-03']);
  assert.match(missing[0].detail, /^S-03 \(last defined by G-02, authorized by A-02\) of the reviewed inventory is defined neither in the PRD nor as a removed tombstone in the coverage map/);
  // Authorizing the reduced agreement (here delegated) does not erase it: the baseline is the union of every retained inventory.
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', currentDigest(dir), '--delegated', '--basis', 'A-02', '--explanation', 'oops'));
  const after = graphOf(dir);
  assert.deepEqual(dispositions.baseline(dir, record(dir)).agreements, ['G-02', 'G-03']);
  assert.deepEqual(dispositions.obligationProblems(dispositions.baseline(dir, record(dir)), after.inventory, after.map.map).map(p => p.ids), [['S-03']], 'only a decision with its tombstone withdraws an obligation');
  // Before the first adoption there is no baseline: nothing predating G-02 is an omission.
  const preAdoption = { ...record(dir), authorizations: [record(dir).authorizations[0]], agreements: [record(dir).agreements[0]] };
  assert.equal(dispositions.baseline(dir, preAdoption), null, 'no inventory history before the adoption agreement');
  assert.deepEqual(dispositions.obligationProblems(null, after.inventory, after.map.map), []);
  // An open decision blocks whatever the digest is: reverting to the authorized files does not bypass it.
  git(dir, 'checkout', '--', '.prd/prd-v1.md', '.prd/coverage/prd-v1.json');
  const r1 = record(dir);
  const authorizedDigest = r1.authorizations[1].digest;
  assert.equal(currentDigest(dir), authorizedDigest, 'files reverted to the A-02 agreement');
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--summary', 'is S-03 still wanted?'));
  assert.equal(verdictOf(dir).verdict, 'DECISION_REQUIRED');
  refuses(rt(dir, 'verify', 'T-01'), 1, /DECISION_REQUIRED/);
  edit(dir, '.prd/prd-v1.md', 'Duplicate IDs cause an actionable diagnostic.', 'Duplicate IDs are merged silently.');
  edit(dir, '.prd/prd-v1.md', 'Duplicate IDs are merged silently.', 'Duplicate IDs cause an actionable diagnostic.');
  assert.equal(currentDigest(dir), authorizedDigest, 'the digest is back to the authorized one');
  assert.equal(verdictOf(dir).verdict, 'DECISION_REQUIRED', 'the retained open decision still blocks');
  refuses(rt(dir, 'start', 'T-02'), 1, /DECISION_REQUIRED/);
  // A decision prepared against changed inputs refuses at commit (STATE_CHANGED / AGREEMENT_CHANGED), writing nothing.
  const seq = record(dir).sequence;
  passes(rt(dir, 'change', 'revise', 'prd-v1'), 'someone else records a revision meanwhile');
  const stale = authorization.decide(dir, 'prd-v1', { resolve: 'D-01', reference: 'chat', excerpt: 'keep S-03', expect: seq });
  assert.equal(stale.code, 'STATE_CHANGED');
  assert.equal(record(dir).decisions[0].status, 'open', 'nothing written');
  const prepared = currentDigest(dir);
  edit(dir, '.prd/coverage/prd-v1.json', '"timeout": 60', '"timeout": 61');
  refuses(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', prepared, '--reference', 'x', '--excerpt', 'y'), 1, /AGREEMENT_CHANGED: --agreement [0-9a-f]{12} is not the current agreement/);
  assert.equal(record(dir).authorizations.length, r1.authorizations.length, 'no authorization recorded');
}
console.log('coverage agreement tests passed');
