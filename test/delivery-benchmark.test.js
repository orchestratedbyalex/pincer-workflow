// PRD v6 S-28: the independent delivery benchmark harness. The frozen evaluators accept
// each brief's correct control and reject the deliberately faulty candidates (omitted
// behaviour, a false-success path, stale or wrong-change evidence, and the protocol
// faults of the multi-session briefs) with real nonzero exit statuses; a missing tool,
// an evaluator error, an unfrozen evaluator and an absent trial are never accepted; the
// workspace never receives evaluator assets; the schedule is balanced; the report
// carries denominators and unavailable reasons and claims nothing.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const HARNESS = path.join(repo, 'scripts', 'delivery-benchmark');
const lib = require(path.join(HARNESS, 'lib.cjs'));
const record = require(path.join(HARNESS, 'record.cjs'));
const report = require(path.join(HARNESS, 'report.cjs'));
const CLI = path.join(HARNESS, 'benchmark.cjs');
const BRIEFS = lib.BRIEFS_DIR;
const frozen = JSON.parse(fs.readFileSync(lib.FROZEN, 'utf8'));
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-benchmark-'));
const tempDir = name => { const d = path.join(tmpRoot, name); fs.mkdirSync(d, { recursive: true }); return d; };
const cli = (args, opts = {}) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', cwd: opts.cwd || tmpRoot, env: { ...process.env, ...(opts.env || {}) } });
const ok = (r, label) => { assert.equal(r.status, 0, `${label}: exit ${r.status}\n${r.stdout}${r.stderr}`); return r.stdout; };
const readRecord = (runs, id) => JSON.parse(fs.readFileSync(path.join(lib.runDir(runs, id), 'record.json'), 'utf8'));
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const runOf = (brief, pair = 1, arm = 'plain') => lib.runId(brief, pair, arm);

// --- Freeze: briefs, evaluators, harness and protocol are pinned ----------------------
{
  const r = cli(['check-freeze']);
  ok(r, 'check-freeze'); assert.match(r.stdout, /^ok: briefs, evaluators, harness and protocol match the freeze of \d{4}-/);
  const ids = lib.briefIds();
  assert.deepEqual(ids, ['bugfix-brownfield', 'cli-greenfield', 'handoff-two-changes', 'integration-untested', 'scope-revision', 'ui-states'], 'the six briefs');
  assert.deepEqual(Object.keys(frozen.briefs).sort(), ids);
  assert.match(frozen.frozen, /^\d{4}-\d{2}-\d{2}T/); assert.match(frozen.protocol, /^[0-9a-f]{64}$/); assert.match(frozen.harness, /^[0-9a-f]{64}$/);
  for (const id of ids) {
    const b = lib.loadBrief(id);
    for (const f of ['brief.md', 'base.cjs', 'controls.cjs', 'evaluator/evaluate.cjs']) assert.ok(fs.existsSync(path.join(BRIEFS, id, f)), `${id}/${f}`);
    assert.match(frozen.briefs[id].evaluator, /^[0-9a-f]{64}$/); assert.equal(frozen.briefs[id].sessions, b.sessions);
    assert.ok(b.task.length > 200, `${id}: a substantive task`); assert.ok(b.prompts.every(p => p.prompt.length > 40), `${id}: substantive prompts`);
    assert.equal(lib.briefDigest(id).evaluator, frozen.briefs[id].evaluator, `${id}: evaluator digest is the frozen one`);
  }
  const briefKinds = fs.readFileSync(lib.PROTOCOL, 'utf8');
  for (const phrase of ['greenfield CLI feature', 'brownfield bugfix', 'untested HTTP client', 'accessibility states', 'mid-build scope revision', 'fresh-session handoff', 'no parity or\nsuperiority claim', 'Invalid, unavailable and rerun rules', 'Tokens and cost', 'Live protocol (frozen before the T-77 runs)']) assert.ok(briefKinds.includes(phrase), `protocol documents: ${phrase}`);
}

// --- Schedule: 36 runs, three pairs per brief, balanced first arms, deterministic -----
{
  const s = lib.schedule();
  assert.equal(s.length, 36); assert.equal(new Set(s.map(x => x.run)).size, 36);
  assert.deepEqual(s.map(x => x.order), s.map((_, i) => i + 1));
  for (const id of lib.briefIds()) for (const arm of lib.ARMS) assert.equal(s.filter(x => x.brief === id && x.arm === arm).length, 3, `${id}/${arm}: three runs`);
  const firstArm = pair => s.filter(x => x.order % 2 === 1 && x.pair === pair).map(x => x.arm);
  for (const id of lib.briefIds()) { const firsts = s.filter(x => x.brief === id && x.order % 2 === 1).map(x => x.arm); assert.ok(firsts.includes('pincer') && firsts.includes('plain'), `${id} starts with both arms across its pairs`); }
  assert.equal(s.filter(x => x.order % 2 === 1 && x.arm === 'pincer').length, 9, 'nine pairs pincer-first'); assert.equal(firstArm(1).length, 6);
  assert.deepEqual(JSON.parse(ok(cli(['schedule', '--json']), 'schedule')), s, 'the CLI prints the same schedule');
  assert.deepEqual(lib.schedule(), s, 'deterministic');
}

// --- Driving a run: prepare (held-out assets stay out), sessions, controls, evaluate ---
const HELD_OUT_MARKERS = ['evaluator', 'controls.cjs', 'base.cjs', 'frozen.json', '.test.cjs'];
function drive(runs, brief, variant, { arm = 'plain', pair = 1, kit = null, tools = [], evaluators = null } = {}) {
  const id = runOf(brief, pair, arm);
  const dir = lib.runDir(runs, id);
  ok(cli(['prepare', '--runs', runs, '--run', id, '--model', 'test-model', '--tool', 'test-tool', '--tool-version', '0', '--cap', 'wall_clock_minutes=30', ...(kit ? ['--kit', kit] : [])]), `prepare ${id}`);
  const ws = path.join(dir, 'workspace');
  const files = lib.walk(ws);
  for (const rel of files) for (const m of HELD_OUT_MARKERS) assert.ok(!rel.includes(m), `${brief}: held-out asset ${rel} reached the workspace`);
  assert.ok(fs.existsSync(path.join(ws, 'BRIEF.md')), 'BRIEF.md in the workspace');
  assert.equal(fs.readFileSync(path.join(ws, 'BRIEF.md'), 'utf8').includes(lib.loadBrief(brief).task), true, 'BRIEF.md is the Task section verbatim');
  const rec0 = readRecord(runs, id);
  assert.equal(rec0.status, 'pending'); assert.equal(rec0.evaluation, null); assert.deepEqual(record.problems(rec0, { frozen }), [], 'a prepared record validates');
  assert.equal(rec0.sessions.length, lib.loadBrief(brief).sessions); assert.ok(rec0.sessions.every(s => s.prompt.length > 40));
  const controls = require(path.join(BRIEFS, brief, 'controls.cjs'));
  const parts = controls.parts || 1;
  const base = require(path.join(BRIEFS, brief, 'base.cjs'));
  for (let part = 1; part <= parts; part++) {
    const name = `S${part}`;
    if (part > 1 && base.between && base.between[name]) ok(cli(['stage', '--runs', runs, '--run', id, '--name', name]), `stage ${name}`);
    if (part > 1) sleep(1100); // commit timestamps have one-second resolution; keep sessions apart
    ok(cli(['session', '--runs', runs, '--run', id, '--name', name, '--start']), `start ${name}`);
    controls.apply(ws, variant, lib, { part });
    ok(cli(['session', '--runs', runs, '--run', id, '--name', name, '--end', '--exit', '0']), `end ${name}`);
  }
  const ev = cli(['evaluate', '--runs', runs, '--run', id, ...tools.flatMap(t => ['--tool', t]), ...(evaluators ? ['--evaluators', evaluators] : [])]);
  const rec = readRecord(runs, id);
  return { id, dir, ws, rec, ev };
}

// S-28: controls are accepted, every injected fault is rejected by a check with a real nonzero exit.
const accepted = {};
for (const brief of lib.briefIds()) {
  const controls = require(path.join(BRIEFS, brief, 'controls.cjs'));
  const runs = tempDir(`runs-${brief}`);
  const c = drive(runs, brief, 'control');
  assert.equal(c.ev.status, 0, `${brief} control: ${c.ev.stdout}${c.ev.stderr}`);
  assert.equal(c.rec.evaluation.outcome, 'accepted', `${brief} control accepted: ${c.ev.stdout}`);
  assert.ok(c.rec.evaluation.checks.length >= 4, 'several checks'); assert.ok(c.rec.evaluation.checks.every(x => x.result === 'passed' && x.exit === 0), `${brief}: every check passed with exit 0`);
  assert.ok(c.rec.evaluation.checks.some(x => x.kind === 'regression'), 'a regression signal'); assert.ok(c.rec.evaluation.checks.some(x => x.id === 'evidence-binding'), 'evidence binding');
  assert.equal(c.rec.status, 'valid'); assert.equal(c.rec.workspace.candidate, c.rec.evaluation.candidate); assert.equal(c.rec.evaluation.evaluator.digest, frozen.briefs[brief].evaluator);
  assert.deepEqual(record.problems(c.rec, { frozen }), []); assert.deepEqual(record.acceptance(c.rec, { frozen }), { accepted: true, counted: true, reason: 'accepted' });
  assert.ok(fs.existsSync(path.join(c.dir, 'evaluation.log')) && fs.existsSync(path.join(c.dir, 'candidate')), 'log and exported candidate');
  assert.match(fs.readFileSync(path.join(c.dir, 'evaluation.log'), 'utf8'), /outcome: accepted$/m);
  assert.match(ok(cli(['validate', '--runs', runs]), 'validate'), /ok .* status valid · counted, accepted/);
  accepted[brief] = c.rec;
  for (const variant of (controls.accepted || ['control']).filter(v => v !== 'control')) {
    const a = drive(tempDir(`runs-${brief}-${variant}`), brief, variant);
    assert.equal(a.rec.evaluation.outcome, 'accepted', `${brief}/${variant} is accepted: ${a.ev.stdout}`);
    assert.match(a.rec.evaluation.checks.find(x => x.id === 'evidence-binding').detail, /is the evaluation commit of/, `${brief}/${variant}: the evaluation commit convention is recognised`);
  }
  const faults = Object.entries(controls.faults);
  assert.ok(faults.some(([v]) => v === 'omitted') && faults.some(([v]) => v === 'false-success') && faults.some(([v]) => v === 'stale-evidence'), `${brief}: the three S-28 faults`);
  for (const [variant, check] of faults) {
    const f = drive(tempDir(`runs-${brief}-${variant}`), brief, variant);
    assert.equal(f.ev.status, 1, `${brief}/${variant}: evaluate exits 1`);
    assert.equal(f.rec.evaluation.outcome, 'rejected', `${brief}/${variant} rejected: ${f.ev.stdout}`);
    const failing = f.rec.evaluation.checks.find(x => x.id === check);
    assert.ok(failing && failing.result === 'failed', `${brief}/${variant}: check ${check} failed (${JSON.stringify(f.rec.evaluation.checks.map(x => [x.id, x.result]))})`);
    assert.ok(Number.isInteger(failing.exit) && failing.exit !== 0, `${brief}/${variant}: ${check} records a real nonzero exit (${failing.exit})`);
    assert.ok(failing.detail.length > 10, 'the failure is described');
    assert.equal(record.acceptance(f.rec, { frozen }).accepted, false);
    assert.equal(f.rec.evaluation.evaluator.digest, frozen.briefs[brief].evaluator);
  }
}
// The brownfield brief also measures escaped regressions: a control with a broken truncate is rejected as a regression.
{
  const runs = tempDir('runs-regression');
  const id = runOf('bugfix-brownfield');
  ok(cli(['prepare', '--runs', runs, '--run', id]), 'prepare');
  const ws = path.join(lib.runDir(runs, id), 'workspace');
  ok(cli(['session', '--runs', runs, '--run', id, '--name', 'S1', '--start']), 'start');
  require(path.join(BRIEFS, 'bugfix-brownfield', 'controls.cjs')).apply(ws, 'control', lib);
  fs.writeFileSync(path.join(ws, 'lib/truncate.js'), fs.readFileSync(path.join(ws, 'lib/truncate.js'), 'utf8').replace("return max === 1 ? '…' : s.slice(0, max - 1) + '…';", "return s.slice(0, max);"));
  spawnSync('git', ['commit', '-q', '-am', 'tidy truncate'], { cwd: ws, env: { ...process.env, ...lib.GIT_ID } });
  ok(cli(['session', '--runs', runs, '--run', id, '--name', 'S1', '--end']), 'end');
  cli(['evaluate', '--runs', runs, '--run', id]);
  const rec = readRecord(runs, id);
  assert.equal(rec.evaluation.outcome, 'rejected'); assert.equal(rec.evaluation.regressions, 2, 'the hidden truncate test and the candidate\'s own suite both count as escaped regressions');
  assert.equal(rec.evaluation.checks.find(x => x.id === 'truncate').result, 'failed'); assert.equal(rec.evaluation.checks.find(x => x.id === 'own-tests').result, 'failed');
}

// --- A missing tool is unverified, never accepted --------------------------------------
{
  const runs = tempDir('runs-missing-tool');
  const r = drive(runs, 'cli-greenfield', 'control', { tools: ['node=/nonexistent/bin/node', 'npm=/nonexistent/bin/npm'] });
  assert.equal(r.ev.status, 1); assert.equal(r.rec.evaluation.outcome, 'unverified');
  for (const c of r.rec.evaluation.checks) { assert.equal(c.result, 'unverified', `${c.id} unverified`); assert.equal(c.exit, null); assert.match(c.detail, /tool unavailable/); }
  assert.equal(r.rec.status, 'valid'); assert.deepEqual(record.problems(r.rec, { frozen }), []);
  assert.deepEqual(record.acceptance(r.rec, { frozen }), { accepted: false, counted: true, reason: 'unverified' });
  assert.match(ok(cli(['validate', '--runs', runs]), 'validate'), /counted, unverified/);
}

// --- An evaluator error is `error`; an evaluator other than the frozen one is refused --
{
  const evaluators = tempDir('evaluators-broken');
  fs.cpSync(BRIEFS, evaluators, { recursive: true });
  fs.writeFileSync(path.join(evaluators, 'cli-greenfield', 'evaluator', 'evaluate.cjs'), "module.exports = { async evaluate() { throw new Error('evaluator exploded'); } };\n");
  const runs = tempDir('runs-evaluator-error');
  const r = drive(runs, 'cli-greenfield', 'control', { evaluators });
  assert.equal(r.ev.status, 1); assert.equal(r.rec.evaluation.outcome, 'error');
  assert.deepEqual(r.rec.evaluation.checks.map(c => [c.id, c.result]), [['evaluator', 'error']]); assert.match(r.rec.evaluation.checks[0].detail, /evaluator exploded/);
  assert.match(r.ev.stdout, /NOT FROZEN/); assert.match(r.ev.stdout, /record problem EVALUATOR_UNFROZEN/);
  const v = cli(['validate', '--runs', runs]); assert.equal(v.status, 1); assert.match(v.stdout, /EVALUATOR_UNFROZEN/);
  // An evaluator that returns no checks is an error too.
  fs.writeFileSync(path.join(evaluators, 'cli-greenfield', 'evaluator', 'evaluate.cjs'), "module.exports = { async evaluate() { return []; } };\n");
  const r2 = drive(tempDir('runs-evaluator-empty'), 'cli-greenfield', 'control', { evaluators });
  assert.equal(r2.rec.evaluation.outcome, 'error'); assert.match(r2.rec.evaluation.checks[0].detail, /returned no checks/);
  // A modified but otherwise working evaluator judges, and the record says it was not the frozen one.
  const evaluators2 = tempDir('evaluators-modified');
  fs.cpSync(BRIEFS, evaluators2, { recursive: true });
  fs.appendFileSync(path.join(evaluators2, 'cli-greenfield', 'evaluator', 'evaluate.cjs'), '// edited after the freeze\n');
  const r3 = drive(tempDir('runs-evaluator-modified'), 'cli-greenfield', 'control', { evaluators: evaluators2 });
  assert.equal(r3.rec.evaluation.outcome, 'accepted'); assert.notEqual(r3.rec.evaluation.evaluator.digest, frozen.briefs['cli-greenfield'].evaluator);
  assert.equal(record.acceptance(r3.rec, { frozen }).accepted, false); assert.match(record.acceptance(r3.rec, { frozen }).reason, /^EVALUATOR_UNFROZEN/);
}

// --- Absent trials and hand-written passes are never counted ----------------------------
{
  const runs = tempDir('runs-absent');
  const id = runOf('cli-greenfield', 2, 'plain');
  ok(cli(['prepare', '--runs', runs, '--run', id]), 'prepare');
  const file = path.join(lib.runDir(runs, id), 'record.json');
  const pending = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(record.acceptance(pending, { frozen }), { accepted: false, counted: false, reason: 'status pending' });
  const rep = report.compute(runs, { frozen });
  assert.equal(rep.briefs['cli-greenfield'].plain.outstanding, 3); assert.equal(rep.briefs['cli-greenfield'].plain.pending, 1); assert.equal(rep.briefs['cli-greenfield'].plain.acceptance.denominator, 0); assert.equal(rep.briefs['cli-greenfield'].plain.acceptance.rate, null);
  const forged = (mutate) => { const doc = JSON.parse(JSON.stringify(pending)); mutate(doc); return record.problems(doc, { frozen }).map(p => p.code); };
  const good = accepted['cli-greenfield'];
  assert.ok(forged(d => { d.status = 'valid'; }).includes('EVALUATION_MISSING'), 'valid without an evaluation');
  assert.ok(forged(d => { d.status = 'valid'; d.evaluation = good.evaluation; d.workspace.candidate = good.workspace.candidate; }).includes('SESSION_INCOMPLETE'), 'valid with sessions never run');
  assert.ok(forged(d => { d.evaluation = good.evaluation; }).includes('CANDIDATE_MISMATCH'), 'an evaluation copied from another run');
  assert.ok(forged(d => { d.evaluation = JSON.parse(JSON.stringify(good.evaluation)); d.workspace.candidate = good.workspace.candidate; d.evaluation.checks[0].result = 'failed'; }).includes('OUTCOME_INCONSISTENT'), 'accepted with a failed check');
  assert.ok(forged(d => { d.evaluation = JSON.parse(JSON.stringify(good.evaluation)); d.workspace.candidate = good.workspace.candidate; d.evaluation.checks[0].exit = null; }).includes('EXIT_REQUIRED'), 'a passed check without an exit status');
  assert.ok(forged(d => { d.evaluation = JSON.parse(JSON.stringify(good.evaluation)); d.workspace.candidate = good.workspace.candidate; d.evaluation.checks[0].exit = 1; }).includes('OUTCOME_INCONSISTENT'), 'passed with exit 1');
  assert.ok(forged(d => { d.evaluation = JSON.parse(JSON.stringify(good.evaluation)); d.workspace.candidate = good.workspace.candidate; d.evaluation.evaluator.digest = 'f'.repeat(64); }).includes('EVALUATOR_UNFROZEN'), 'another evaluator');
  assert.ok(forged(d => { d.evaluation = JSON.parse(JSON.stringify(good.evaluation)); d.workspace.candidate = good.workspace.candidate; d.evaluation.checks = []; }).includes('CHECKS_MISSING'), 'no checks');
  assert.ok(forged(d => { d.status = 'invalid'; }).includes('REASON_REQUIRED'), 'invalid without a reason');
  assert.ok(forged(d => { d.effort.unavailable.tokens = ''; }).includes('UNAVAILABLE_REASON_REQUIRED'), 'null tokens need a reason');
  assert.ok(forged(d => { d.arm = 'pincer'; d.run = lib.runId(d.brief, d.pair, 'pincer'); }).includes('KIT_MISSING'), 'a pincer run records its kit');
  assert.ok(forged(d => { d.brief = 'nope'; d.run = lib.runId('nope', d.pair, d.arm); }).includes('BRIEF_UNKNOWN'));
  assert.ok(forged(d => { d.schema = 2; }).includes('SCHEMA_UNKNOWN'));
  // A forged accepted record on disk is listed as malformed and counted nowhere.
  const forgedDoc = JSON.parse(JSON.stringify(pending)); forgedDoc.status = 'valid'; forgedDoc.evaluation = good.evaluation; forgedDoc.sessions[0].started = forgedDoc.sessions[0].ended = '2026-09-12T00:00:00Z';
  fs.writeFileSync(file, JSON.stringify(forgedDoc));
  const rep2 = report.compute(runs, { frozen });
  assert.equal(rep2.briefs['cli-greenfield'].plain.acceptance.accepted, 0); assert.equal(rep2.briefs['cli-greenfield'].plain.malformed, 1); assert.equal(rep2.malformed.length, 1); assert.ok(rep2.malformed[0].problems.some(p => p.code === 'CANDIDATE_MISMATCH'));
  assert.equal(cli(['validate', '--runs', runs]).status, 1);
  // Marking: invalid and unavailable runs keep their records and are excluded from denominators.
  fs.writeFileSync(file, JSON.stringify(pending));
  ok(cli(['mark', '--runs', runs, '--run', id, '--status', 'unavailable', '--reason', 'model not available on this machine']), 'mark');
  const rep3 = report.compute(runs, { frozen });
  assert.equal(rep3.briefs['cli-greenfield'].plain.unavailable, 1); assert.equal(rep3.briefs['cli-greenfield'].plain.outstanding, 3); assert.equal(rep3.total.unavailable, 1);
  assert.equal(record.acceptance(readRecord(runs, id), { frozen }).counted, false);
  // A rerun outside the schedule needs the invalid run it replaces and carries no order.
  assert.equal(cli(['prepare', '--runs', runs, '--run', runOf('cli-greenfield', 4, 'plain')]).status, 2, 'pair-4 without --rerun refused');
  ok(cli(['prepare', '--runs', runs, '--run', runOf('cli-greenfield', 4, 'plain'), '--rerun', id]), 'rerun');
  const rerun = readRecord(runs, runOf('cli-greenfield', 4, 'plain'));
  assert.equal(rerun.order, null); assert.equal(rerun.interventions[0].type, 'operator'); assert.match(rerun.interventions[0].note, /replacing the invalid run cli-greenfield\/pair-2\/plain/);
  assert.deepEqual(record.problems(rerun, { frozen }), []);
  assert.equal(report.compute(runs, { frozen }).briefs['cli-greenfield'].plain.runs.length, 4, 'the rerun is listed beside the scheduled runs');
  assert.equal(cli(['prepare', '--runs', runs, '--run', id]).status, 2, 'an existing run is never replaced');
}

// --- Interventions, effort and the report -------------------------------------------------
{
  const runs = tempDir('runs-report');
  const a = drive(runs, 'cli-greenfield', 'control', { pair: 1 });
  const b = drive(runs, 'cli-greenfield', 'omitted', { pair: 2 });
  ok(cli(['intervene', '--runs', runs, '--run', a.id, '--session', 'S1', '--type', 'clarification', '--note', 'asked where the store lives; answered from BRIEF.md']), 'intervene');
  ok(cli(['intervene', '--runs', runs, '--run', a.id, '--session', 'S1', '--type', 'repair', '--note', 'restarted the tool after a crash']), 'intervene');
  assert.equal(cli(['intervene', '--runs', runs, '--run', a.id, '--session', 'S9', '--type', 'repair', '--note', 'x']).status, 2, 'an unknown session is refused');
  assert.equal(cli(['intervene', '--runs', runs, '--run', a.id, '--session', 'S1', '--type', 'nudge', '--note', 'x']).status, 2, 'an unknown type is refused');
  ok(cli(['effort', '--runs', runs, '--run', a.id, '--set', 'setup_minutes=3', '--set', 'review_minutes=7', '--set', 'active_minutes=12.5', '--set', 'elapsed_minutes=20', '--set', 'unavailable.tokens=print mode reports no usage', '--set', 'cost_usd=null']), 'effort');
  ok(cli(['effort', '--runs', runs, '--run', b.id, '--set', 'tokens.input=1000', '--set', 'tokens.output=200', '--set', 'active_minutes=9']), 'effort');
  ok(cli(['validate', '--runs', runs]), 'validate');
  const rep = JSON.parse(ok(cli(['report', '--runs', runs, '--json']), 'report'));
  const cell = rep.briefs['cli-greenfield'].plain;
  assert.equal(cell.slots, 3); assert.equal(cell.valid, 2); assert.equal(cell.outstanding, 1);
  assert.deepEqual(cell.acceptance, { accepted: 1, denominator: 2, rate: 0.5 });
  assert.equal(cell.rejected, 1); assert.equal(cell.interventions.clarification.total, 1); assert.equal(cell.interventions.repair.total, 1); assert.deepEqual(cell.interventions.clarification.per_run, [1, 0]);
  assert.deepEqual(cell.effort.active_minutes, { n: 2, min: 9, median: 10.75, max: 12.5 }); assert.deepEqual(cell.effort.setup_minutes, { n: 1, min: 3, median: 3, max: 3 });
  assert.equal(cell.tokens.available, 1); assert.equal(cell.tokens.of, 2); assert.deepEqual(cell.tokens.unavailable, ['print mode reports no usage']);
  assert.equal(cell.cost_usd.available, 0); assert.deepEqual(cell.cost_usd.unavailable, ['not recorded', 'not recorded']);
  assert.equal(rep.total.slots, 36); assert.equal(rep.total.valid, 2); assert.equal(rep.total.accepted, 1); assert.equal(rep.total.outstanding, 34);
  assert.deepEqual(rep.order_balance, { pincer_first: 9, plain_first: 9 });
  assert.equal(rep.environments.length, 1); assert.equal(rep.environments[0].model, 'test-model');
  assert.match(rep.claim, /no parity or superiority claim/);
  const text = ok(cli(['report', '--runs', runs]), 'report');
  assert.match(text, /\| cli-greenfield \| plain \| 1\/2 \| 1 \|/); assert.match(text, /outstanding 34/); assert.match(text, /no parity or superiority claim/); assert.match(text, /Protocol frozen \d{4}/);
  assert.match(text, /- #\d+ cli-greenfield\/pair-3\/plain: outstanding$/m);
  // Reports and validation write nothing into a run.
  const before = lib.walk(lib.runDir(runs, a.id)).map(rel => `${rel}:${fs.statSync(path.join(lib.runDir(runs, a.id), rel)).mtimeMs}`);
  cli(['report', '--runs', runs]); cli(['validate', '--runs', runs]);
  assert.deepEqual(lib.walk(lib.runDir(runs, a.id)).map(rel => `${rel}:${fs.statSync(path.join(lib.runDir(runs, a.id), rel)).mtimeMs}`), before);
}

// --- The pincer arm: the kit is installed and recorded, the plain arm refuses a kit ----
{
  const runs = tempDir('runs-pincer');
  const id = runOf('cli-greenfield', 1, 'pincer');
  assert.equal(cli(['prepare', '--runs', runs, '--run', id]).status, 2, 'a pincer run needs --kit');
  ok(cli(['prepare', '--runs', runs, '--run', id, '--kit', repo]), 'prepare pincer');
  const ws = path.join(lib.runDir(runs, id), 'workspace');
  for (const f of ['.pincer.json', 'AGENTS.md', 'CLAUDE.md', '.claude/commands/pincer-code.md', 'scripts/pincer-runtime.cjs', 'scripts/pincer-ticket.sh', 'BRIEF.md']) assert.ok(fs.existsSync(path.join(ws, f)), `${f} installed`);
  const rec = readRecord(runs, id);
  assert.match(rec.environment.kit.digest, /^[0-9a-f]{64}$/); assert.match(rec.environment.kit.source, /^directory /);
  assert.notEqual(rec.workspace.base, rec.workspace.project_base, 'the kit install is a commit above the project base');
  assert.deepEqual(record.problems(rec, { frozen }), []);
  assert.equal(spawnSync('git', ['status', '--porcelain'], { cwd: ws, encoding: 'utf8' }).stdout, '', 'the pincer workspace starts clean');
  assert.equal(cli(['prepare', '--runs', runs, '--run', runOf('cli-greenfield', 1, 'plain'), '--kit', repo]).status, 2, 'a plain run installs no kit');
  // The same prompts reach both arms.
  ok(cli(['prepare', '--runs', runs, '--run', runOf('cli-greenfield', 1, 'plain')]), 'prepare plain');
  assert.deepEqual(readRecord(runs, runOf('cli-greenfield', 1, 'plain')).sessions.map(s => s.prompt), rec.sessions.map(s => s.prompt));
  assert.equal(fs.readFileSync(path.join(ws, 'BRIEF.md'), 'utf8'), fs.readFileSync(path.join(lib.runDir(runs, runOf('cli-greenfield', 1, 'plain')), 'workspace', 'BRIEF.md'), 'utf8'));
}

// --- Freeze drift is detected --------------------------------------------------------------
{
  const copy = tempDir('repo-copy');
  for (const rel of ['scripts/delivery-benchmark', 'test/fixtures/delivery-benchmark', 'docs/delivery-benchmark.md']) fs.cpSync(path.join(repo, rel), path.join(copy, rel), { recursive: true });
  const cliCopy = path.join(copy, 'scripts', 'delivery-benchmark', 'benchmark.cjs');
  assert.equal(spawnSync(process.execPath, [cliCopy, 'check-freeze'], { encoding: 'utf8' }).status, 0, 'the copy matches the freeze');
  fs.appendFileSync(path.join(copy, 'test/fixtures/delivery-benchmark/briefs/ui-states/evaluator/errors.test.cjs'), '// loosened\n');
  const d = spawnSync(process.execPath, [cliCopy, 'check-freeze'], { encoding: 'utf8' });
  assert.equal(d.status, 1); assert.match(d.stdout, /drift: brief ui-states changed since the freeze: evaluator\/errors\.test\.cjs/);
  fs.appendFileSync(path.join(copy, 'docs/delivery-benchmark.md'), '\nchanged\n');
  assert.match(spawnSync(process.execPath, [cliCopy, 'check-freeze'], { encoding: 'utf8' }).stdout, /docs\/delivery-benchmark\.md changed since the freeze/);
  // Re-freezing keeps the previous freeze in the history.
  ok(spawnSync(process.execPath, [cliCopy, 'freeze'], { encoding: 'utf8' }), 'freeze');
  const refrozen = JSON.parse(fs.readFileSync(path.join(copy, 'test/fixtures/delivery-benchmark/frozen.json'), 'utf8'));
  assert.equal(refrozen.history.length, (frozen.history || []).length + 1); assert.equal(refrozen.history.at(-1).frozen, frozen.frozen);
  assert.equal(spawnSync(process.execPath, [cliCopy, 'check-freeze'], { encoding: 'utf8' }).status, 0);
}

fs.rmSync(tmpRoot, { recursive: true, force: true });
console.log('delivery benchmark tests passed (6 briefs, controls accepted, injected faults rejected)');
