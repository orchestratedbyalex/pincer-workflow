// PRD v6 T-71 (R-04, S-10..S-12): `impact` compares the current authored inputs
// with a retained agreement and names the affected scenarios, their requirements,
// linked tickets and checks with reasons, and dependency dependents separately;
// added/removed definitions, link-only and declaration-only changes and edits outside
// the definitions each produce an explained difference; unsupported or missing
// history is `unavailable`, never "no impact"; returning to a paused change after
// another change edited source keeps its authorization and links while its
// verification is stale; repeated inspection changes no file.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir, write, read, run, createPrd, createTicket } from './helpers.js';

const require = createRequire(import.meta.url);
const impact = require(path.join(repo, 'template/scripts/pincer-runtime/impact.cjs'));
const runtime = path.join(repo, 'template/scripts/pincer-runtime.cjs');
const fx = path.join(repo, 'test/fixtures/prd-v6');
const rt = (dir, ...args) => run(dir, process.execPath, [runtime, ...args]);
function passes(result, label = '') { assert.equal(result.status, 0, `${label}\n${result.stdout}${result.stderr}`); return result.stdout; }
function refuses(result, status, pattern, label = '') { assert.equal(result.status, status, `${label}: exit ${status}\n${result.stdout}${result.stderr}`); assert.match(result.stdout + result.stderr, pattern, label); return result; }
function git(dir, ...args) { return passes(run(dir, 'git', args), `git ${args.join(' ')}`).trim(); }
function commit(dir, message) { git(dir, 'add', '-A'); git(dir, '-c', 'user.name=T', '-c', 'user.email=t@example.invalid', 'commit', '-q', '--allow-empty', '-m', message); return git(dir, 'rev-parse', 'HEAD'); }
const record = (dir, id = 'prd-v1') => JSON.parse(read(dir, `.prd/changes/${id}.json`));
const currentDigest = (dir, id = 'prd-v1') => JSON.parse(passes(rt(dir, 'change', 'show', id, '--json'))).agreement.current;
const edit = (dir, file, from, to) => { const t = read(dir, file); assert.ok(t.includes(from), `${file} contains ${JSON.stringify(from)}`); write(dir, file, t.replace(from, to)); };
const impactJson = (dir, ...args) => JSON.parse(passes(rt(dir, 'impact', '--json', ...args)));
const snapshotTree = dir => {
  const out = {};
  const walk = rel => { for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) { if (e.name === '.git') continue; const next = rel ? `${rel}/${e.name}` : e.name; if (e.isDirectory()) walk(next); else out[next] = fs.readFileSync(path.join(dir, next), 'utf8'); } };
  walk(''); return out;
};
const strip = j => { const { generated, ...rest } = j; return rest; };

// A strict, authorized, active project (the fixture PRD, tickets and map; S-03 deferred by D-01).
function strictFixture() {
  const dir = tempDir(); git(dir, 'init', '-q');
  write(dir, '.gitignore', '.pincer/\n');
  write(dir, '.prd/prd-v1.md', read(fx, 'strict/prd-v1.md'));
  for (const f of fs.readdirSync(path.join(fx, 'strict/tickets'))) write(dir, `tickets/${f}`, read(fx, `strict/tickets/${f}`));
  write(dir, '.prd/coverage/prd-v1.json', read(fx, 'strict/coverage/prd-v1.json'));
  write(dir, 'value.txt', 'good\n');
  commit(dir, 'base');
  passes(rt(dir, 'register', '--prd', '.prd/prd-v1.md')); passes(rt(dir, 'change', 'select', 'prd-v1'));
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', currentDigest(dir), '--reference', 'r', '--excerpt', 'e'));
  passes(rt(dir, 'change', 'activate', 'prd-v1'));
  passes(rt(dir, 'coverage', 'adopt', '--apply', '--change', 'prd-v1'));
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--summary', 'defer S-03 (impact report) to the next change'));
  passes(rt(dir, 'change', 'decide', 'prd-v1', '--resolve', 'D-01', '--reference', 'chat 10:05', '--excerpt', 'agreed: S-03 is deferred'));
  passes(rt(dir, 'change', 'authorize', 'prd-v1', '--agreement', currentDigest(dir), '--reference', 'chat 10:06', '--excerpt', 'approved with S-03 deferred', '--decision', 'D-01'));
  commit(dir, 'strict');
  return dir;
}
const restore = dir => git(dir, 'checkout', '--', '.prd/prd-v1.md', '.prd/coverage/prd-v1.json', 'tickets');

// --- S-10: one scenario changed names it, its requirement, its links and dependents ------
{
  const dir = strictFixture();
  const base = impactJson(dir);
  assert.equal(base.schema, 1); assert.equal(base.runtime, 3); assert.equal(base.verdict, 'unchanged'); assert.equal(base.reason, null);
  assert.deepEqual(base.baseline, { agreement: 'G-03', authorization: 'A-02', recorded: record(dir).agreements[2].recorded, digest: record(dir).agreements[2].digest }, 'default baseline: the latest authorization\'s agreement');
  assert.deepEqual(base.scenarios.unchanged, ['S-01', 'S-02', 'S-03']); assert.deepEqual(base.affected, { scenarios: [], tickets: [], checks: [], dependents: [] });
  assert.equal(base.unscoped.prd, false);
  edit(dir, '.prd/prd-v1.md', 'A PRD with two requirements and three scenarios yields exactly those', 'A PRD with two requirements and three scenarios yields exactly these');
  const one = impactJson(dir);
  assert.equal(one.verdict, 'changed');
  assert.deepEqual(one.scenarios.changed, [{ id: 'S-01', parts: ['text'] }]);
  assert.deepEqual(one.scenarios.unchanged, ['S-02', 'S-03']);
  assert.deepEqual(one.requirements.changed, [], 'the requirement prose is unchanged (the scenario is its own definition)');
  assert.deepEqual(one.requirements.unchanged, ['R-01', 'R-02']);
  assert.deepEqual(one.affected.scenarios, [{ id: 'S-01', because: ['scenario text changed'] }]);
  assert.deepEqual(one.affected.tickets, [{ id: 'T-01', because: ['linked from S-01'] }]);
  assert.deepEqual(one.affected.checks, [{ id: 'C-01', because: ['linked from S-01'] }]);
  assert.deepEqual(one.affected.dependents, [{ id: 'T-02', via: 'T-01', because: 'depends_on' }], 'T-02 depends on T-01: reported separately, not as a direct link');
  assert.deepEqual(one.links.changed, []); assert.deepEqual(one.checks.changed, []); assert.equal(one.unscoped.prd, false);
  const human = passes(rt(dir, 'impact'));
  assert.match(human, /^Verdict    changed$/m);
  assert.match(human, /^Scenarios changed S-01 \(text\)$/m);
  assert.match(human, /^Affected   scenarios S-01 \[scenario text changed\]$/m);
  assert.match(human, /^           tickets T-01 \[linked from S-01\]$/m);
  assert.match(human, /^Dependents T-02 \(via T-01, depends_on\)$/m);
  assert.match(human, /^Unchanged  2 requirement\(s\), 2 scenario\(s\): S-02, S-03$/m, 'unrelated links stay distinguishable');
  // A requirement's own prose: the requirement changes, its scenarios do not.
  restore(dir);
  edit(dir, '.prd/prd-v1.md', 'Every definition is derived from the PRD prose.', 'Every definition is derived from the PRD text.');
  const req = impactJson(dir);
  assert.deepEqual(req.requirements.changed, [{ id: 'R-01', parts: ['text'] }]); assert.deepEqual(req.scenarios.changed, []);
  assert.deepEqual(req.affected.scenarios, [], 'a requirement prose edit affects no scenario link');
  assert.equal(req.verdict, 'changed'); assert.equal(req.unscoped.prd, false, 'a definition changed, so it is scoped');
  // Moving a scenario to another requirement changes its owner, and both requirements' scenario lists.
  restore(dir);
  edit(dir, '.prd/prd-v1.md', '- [x] **S-02:** Duplicate IDs cause an actionable diagnostic.\n', '');
  edit(dir, '.prd/prd-v1.md', '- **S-03** — Changing', '- [x] **S-02:** Duplicate IDs cause an actionable diagnostic.\n- **S-03** — Changing');
  const moved = impactJson(dir);
  assert.deepEqual(moved.scenarios.changed, [{ id: 'S-02', parts: ['requirement'] }]);
  assert.deepEqual(moved.requirements.changed.map(r => r.id), ['R-01', 'R-02']);
  assert.deepEqual(moved.affected.tickets.map(t => t.id), ['T-01', 'T-02']); assert.deepEqual(moved.affected.dependents, []);
  restore(dir);
}

// --- S-11: added/removed definitions, link-only, declaration-only, unscoped edits, unavailable history
{
  const dir = strictFixture();
  const map = read(dir, '.prd/coverage/prd-v1.json');
  // Added definition (with its row): scenario added, affected with reason.
  edit(dir, '.prd/prd-v1.md', '- **S-03** — Changing', '- **S-04:** Impact lists dependents separately.\n- **S-03** — Changing');
  write(dir, '.prd/coverage/prd-v1.json', map.replace('"S-02": { "tickets": ["T-01", "T-02"], "checks": ["C-01", "C-02"] }', '"S-02": { "tickets": ["T-01", "T-02"], "checks": ["C-01", "C-02"] },\n    "S-04": { "tickets": ["T-02"], "checks": ["C-02"] }'));
  const added = impactJson(dir);
  assert.deepEqual(added.scenarios.added, ['S-04']); assert.deepEqual(added.requirements.changed, [{ id: 'R-02', parts: ['scenarios'] }]);
  assert.deepEqual(added.affected.scenarios, [{ id: 'S-04', because: ['scenario added'] }]); assert.deepEqual(added.affected.tickets, [{ id: 'T-02', because: ['linked from S-04'] }]);
  restore(dir);
  // Removed definition, with and without a tombstone.
  edit(dir, '.prd/prd-v1.md', '- **S-03** — Changing one scenario names that scenario and its requirement.\n', '- **S-05:** Replacement.\n');
  write(dir, '.prd/coverage/prd-v1.json', map.replace('"S-03": { "disposition": "deferred", "decision": "D-01", "prior": null, "note": "deferred to the next change" }', '"S-05": { "disposition": "deferred", "decision": "D-01", "prior": null, "note": null }'));
  const removed = impactJson(dir);
  assert.deepEqual(removed.scenarios.removed, [{ id: 'S-03', tombstone: false }]); assert.deepEqual(removed.scenarios.added, ['S-05']);
  assert.deepEqual(removed.scope.added, [{ id: 'S-05', disposition: 'deferred' }]); assert.deepEqual(removed.scope.removed, ['S-03']);
  write(dir, '.prd/coverage/prd-v1.json', map.replace('"S-03": { "disposition": "deferred", "decision": "D-01", "prior": null, "note": "deferred to the next change" }', '"S-03": { "disposition": "removed", "decision": "D-01", "prior": "G-02", "note": null },\n    "S-05": { "tickets": ["T-02"], "checks": ["C-02"] }').replace('"S-05": { "tickets": ["T-02"], "checks": ["C-02"] }', '"S-05": { "disposition": "deferred", "decision": "D-01", "prior": null, "note": null }'));
  const tomb = impactJson(dir);
  assert.deepEqual(tomb.scenarios.removed, [{ id: 'S-03', tombstone: true }]);
  assert.deepEqual(tomb.scope.changed, [{ id: 'S-03', from: 'deferred', to: 'removed' }]);
  assert.match(passes(rt(dir, 'impact')), /^Scenarios removed S-03 \(tombstone\)$/m);
  restore(dir);
  // Link-only change: the scenario is affected because its links changed; no definition changed.
  write(dir, '.prd/coverage/prd-v1.json', map.replace('"S-01": { "tickets": ["T-01"], "checks": ["C-01"] }', '"S-01": { "tickets": ["T-01"], "checks": ["C-01", "C-02"] }'));
  const links = impactJson(dir);
  assert.equal(links.verdict, 'changed'); assert.deepEqual(links.scenarios.changed, []); assert.deepEqual(links.requirements.changed, []);
  assert.deepEqual(links.links.changed, [{ id: 'S-01', tickets: { added: [], removed: [] }, checks: { added: ['C-02'], removed: [] } }]);
  assert.deepEqual(links.affected.scenarios, [{ id: 'S-01', because: ['links changed'] }]);
  assert.deepEqual(links.affected.checks, [{ id: 'C-01', because: ['linked from S-01'] }, { id: 'C-02', because: ['linked from S-01'] }]);
  assert.equal(links.unscoped.prd, false);
  restore(dir);
  // Declaration-only change: every scenario linking the check is affected with the reason.
  write(dir, '.prd/coverage/prd-v1.json', map.replace('"timeout": 60', '"timeout": 120'));
  const decl = impactJson(dir);
  assert.deepEqual(decl.checks.changed, [{ id: 'C-01', parts: ['timeout'] }]);
  assert.deepEqual(decl.affected.scenarios, [{ id: 'S-01', because: ['declaration of C-01 changed (timeout)'] }, { id: 'S-02', because: ['declaration of C-01 changed (timeout)'] }]);
  assert.deepEqual(decl.affected.checks, [{ id: 'C-01', because: ['linked from S-01', 'linked from S-02', 'declaration changed (timeout)'] }, { id: 'C-02', because: ['linked from S-02'] }], 'C-02 is included through the affected S-02, with that reason');
  assert.deepEqual(decl.affected.tickets.map(t => t.id), ['T-01', 'T-02']); assert.deepEqual(decl.affected.dependents, []);
  restore(dir);
  // A ticket's own text (acceptance) changed: the ticket and the scenarios it implements are affected.
  edit(dir, 'tickets/T-02-diagnostics.md', '- [ ] expected behavior', '- [ ] expected behavior and a diagnostic line');
  const tk = impactJson(dir);
  assert.deepEqual(tk.tickets.changed, [{ id: 'T-02', parts: ['acceptance'] }]);
  assert.deepEqual(tk.affected.scenarios, [{ id: 'S-02', because: ['ticket T-02 changed (acceptance)'] }]);
  assert.deepEqual(tk.affected.tickets, [{ id: 'T-01', because: ['linked from S-02'] }, { id: 'T-02', because: ['linked from S-02', 'ticket acceptance changed'] }]);
  restore(dir);
  // An edit outside every definition: an explained, unscoped PRD change — never "unchanged".
  edit(dir, '.prd/prd-v1.md', 'A fixture project whose PRD follows the strict inventory grammar.', 'A fixture project whose PRD follows the strict inventory grammar, with a new constraint.');
  const unscoped = impactJson(dir);
  assert.equal(unscoped.verdict, 'changed');
  assert.deepEqual(unscoped.unscoped, { prd: true, detail: 'unscoped PRD change requiring review: the PRD revision changed while every requirement and scenario definition is unchanged (a constraint, table or note outside the definitions)' });
  assert.equal(unscoped.reason, unscoped.unscoped.detail);
  assert.deepEqual(unscoped.scenarios.unchanged, ['S-01', 'S-02', 'S-03']); assert.deepEqual(unscoped.affected.scenarios, []);
  assert.match(passes(rt(dir, 'impact')), /^Verdict    changed — unscoped PRD change requiring review/m);
  restore(dir);
  // Unsupported or missing history is reported as unavailable with its reason.
  const pre = impactJson(dir, '--from', 'G-01');
  assert.equal(pre.verdict, 'unavailable'); assert.match(pre.reason, /^agreement G-01 predates strict coverage \(no inventory snapshot\); the earliest comparable agreement is G-02$/);
  assert.equal(pre.baseline.agreement, 'G-01'); assert.equal(pre.scenarios, null);
  const missing = impactJson(dir, '--from', 'G-09');
  assert.equal(missing.verdict, 'unavailable'); assert.match(missing.reason, /^no agreement G-09 on change prd-v1/);
  assert.equal(impactJson(dir, '--from', 'A-01').verdict, 'unavailable', 'A-01 binds the pre-adoption agreement');
  assert.equal(impactJson(dir, '--from', 'A-02').verdict, 'unchanged');
  assert.equal(impactJson(dir, '--from', 'G-02').verdict, 'changed', 'against the adoption agreement the resolved decision D-01 is a difference');
  assert.match(impactJson(dir, '--from', 'x').reason, /--from must name an agreement G-NN or an authorization A-NN/);
  assert.match(passes(rt(dir, 'impact', '--from', 'G-01')), /^Verdict    unavailable — agreement G-01 predates strict coverage/m);
  // A change without the capability: unavailable, and exit 0 (inspection succeeded).
  const plain = tempDir(); git(plain, 'init', '-q'); write(plain, '.gitignore', '.pincer/\n'); createPrd(plain, 1); createTicket(plain); commit(plain, 'base');
  passes(rt(plain, 'register', '--prd', '.prd/prd-v1.md')); passes(rt(plain, 'change', 'select', 'prd-v1'));
  const u = impactJson(plain);
  assert.equal(u.verdict, 'unavailable'); assert.match(u.reason, /strict coverage not adopted by change prd-v1/); assert.equal(u.baseline, null);
  // Invalid current inputs are invalid input (exit 4), not an impact verdict.
  fs.rmSync(path.join(dir, '.prd/coverage/prd-v1.json'));
  refuses(rt(dir, 'impact'), 4, /COVERAGE_INVALID: \.prd\/coverage\/prd-v1\.json: missing/);
  restore(dir);
  refuses(rt(dir, 'impact', '--change', 'nope'), 4, /INPUT_INVALID/);
}

// --- S-12: A/B/A keeps A's authorization and links; verification is stale; inspection writes nothing
{
  const dir = strictFixture();
  passes(rt(dir, 'verify', 'T-01'));
  passes(rt(dir, 'change', 'pause', 'prd-v1', '--reason', 'switch to B'));
  createPrd(dir, 2); createTicket(dir, { id: 'T-04', prd: '.prd/prd-v2.md', command: 'true' });
  commit(dir, 'B registered');
  passes(rt(dir, 'register', '--prd', '.prd/prd-v2.md', '--change', 'b'));
  passes(rt(dir, 'change', 'select', 'b'));
  passes(rt(dir, 'change', 'authorize', 'b', '--agreement', currentDigest(dir, 'b'), '--reference', 'r', '--excerpt', 'e'));
  passes(rt(dir, 'change', 'activate', 'b'));
  write(dir, 'value.txt', 'good\n# touched by B\n');
  passes(rt(dir, 'verify', 'T-04'));
  passes(rt(dir, 'change', 'pause', 'b', '--reason', 'back to A'));
  passes(rt(dir, 'change', 'select', 'prd-v1'));
  passes(rt(dir, 'change', 'resume', 'prd-v1'));
  const st = JSON.parse(passes(rt(dir, 'status', '--json')));
  assert.equal(st.change.agreement.verdict, 'current', "A's authorization is unchanged");
  assert.ok(st.tickets.find(t => t.id === 'T-01').readiness.reasons.map(r => r.code).includes('SOURCE_CHANGED'), "A's verification is stale");
  const before = snapshotTree(dir);
  const a = impactJson(dir);
  assert.equal(a.verdict, 'unchanged', 'no structural difference: the links and definitions are the ones A authorized');
  assert.deepEqual(a.affected, { scenarios: [], tickets: [], checks: [], dependents: [] });
  assert.equal(a.freshness.note, 'a narrow impact is not permission to reuse evidence whose source identity changed');
  const b = impactJson(dir);
  assert.deepEqual(strip(a), strip(b), 'repeated runs are identical apart from generated');
  passes(rt(dir, 'impact')); passes(rt(dir, 'impact', '--from', 'G-02'));
  assert.deepEqual(snapshotTree(dir), before, 'impact inspection writes nothing');
  assert.equal(JSON.parse(passes(rt(dir, 'status', '--json'))).tickets.find(t => t.id === 'T-01').readiness.reasons[0].code, 'SOURCE_CHANGED', 'impact did not revive stale evidence');
  // The module refuses nothing silently: the same result through the API.
  const viaModule = impact.compute(dir, record(dir));
  assert.deepEqual(strip(viaModule), strip(a));
}
console.log('coverage impact tests passed');
