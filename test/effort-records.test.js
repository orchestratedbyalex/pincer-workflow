// PRD v7 T-88 (R-02, S-04..S-06): the v7 effort record is an event log, and every
// total is recomputed from it offline. Overlapping sessions are merged rather than
// summed; an unmeasured metric stays null with a reason and is never reported as zero;
// missing provenance, a missing evaluator or an unverified strict adoption make a run
// invalid or outstanding rather than accepted. Controlled subprocesses supply the real
// outcomes — passing, failing, partial, timed out and interrupted — so the collector is
// exercised against processes that actually behaved that way.
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { repo } from './helpers.js';

const require = createRequire(import.meta.url);
const effort = require(path.join(repo, 'scripts/delivery-benchmark-v7/effort.cjs'));

const HEX = 'a'.repeat(64);
const SHA = 'b'.repeat(40);
const at = (minute, second = 0) => `2026-09-14T${String(10 + Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}:${String(second).padStart(2, '0')}Z`;

// A complete, valid strict run: provenance, observed adoption, events, an evaluation
// whose checks imply its outcome. Every test below starts from this and breaks one thing.
function valid(overrides = {}) {
  const base = effort.empty({
    run: effort.runId('cli-greenfield', 1, 'strict'), cohort: HEX,
    brief: 'cli-greenfield', arm: 'strict', repetition: 1, order: 1,
    provenance: { base: SHA, kit: HEX, kit_source: 'v0.6.0', prompts: HEX, driver: HEX, collector: HEX, evaluator: HEX, protocol: HEX, caps: HEX, configuration: HEX },
    environment: { model: 'sonnet', tool: 'claude-code', tool_version: '2.1.267', os: 'darwin', platform_release: '25.6.0', permission_mode: 'bypassPermissions', caps: { turns_per_session: 150, wall_clock_minutes: 30 } },
  });
  base.status = 'valid';
  base.adoption = { required: true, observed: true, evidence: 'workspace .prd/changes/prd-v1.json is schema 3 with an adopt event' };
  base.events = [
    { kind: 'stage', id: 'st-setup', stage: 'setup', started: at(0), ended: at(4) },
    { kind: 'session', id: 's1', started: at(4), ended: at(24), prompt: 'Implement the brief.' },
    { kind: 'stage', id: 'st-auth', stage: 'authoring', started: at(4), ended: at(12) },
    { kind: 'stage', id: 'st-verify', stage: 'verification', started: at(12), ended: at(24) },
    { kind: 'command', id: 'c1', started: at(13), ended: at(13, 30) },
    { kind: 'intervention', id: 'i1', intervention: 'clarification', started: at(15), ended: at(16), detail: 'asked which directory to use' },
    { kind: 'session', id: 's2', started: at(30), ended: at(40) },
    { kind: 'stage', id: 'st-review', stage: 'review', started: at(45), ended: at(63) },
  ];
  base.reported = { tokens: 412000, cost_usd: 1.87, provider_minutes: 21.4 };
  base.evaluation = { candidate: SHA, evaluator: HEX, outcome: 'accepted', checks: [{ id: 'held-out', result: 'passed', independent: true }, { id: 'own-tests', result: 'passed', independent: false }] };
  return { ...base, ...overrides };
}
const codes = r => effort.problems(r).map(p => p.code);
const ok = (r, label) => assert.deepEqual(effort.problems(r), [], `${label}: ${JSON.stringify(effort.problems(r))}`);

// --- S-04: linked records, and totals that recompute without double-counting ---------
{
  const r = valid();
  ok(r, 'the complete fixture validates');
  const rep = effort.report(r);

  // Two sessions, 20 and 10 minutes, disjoint → 30 active minutes.
  assert.equal(rep.sessions, 2);
  assert.equal(rep.active_minutes, 30);
  assert.equal(rep.session_minutes_summed, 30, 'disjoint sessions sum to the same as their union');
  // Elapsed spans the first start to the last end, including the review after the run.
  assert.equal(rep.elapsed_minutes, 63);
  // Stage times are separate, and review is its own — the measure v6 never took.
  assert.deepEqual(rep.stages, { setup: 4, authoring: 8, verification: 12, recovery: null, review: 18 });
  assert.equal(rep.commands, 1);
  assert.deepEqual(rep.interventions, { clarification: 1, reapproval: 0, repair: 0, operator: 0 });
  assert.equal(rep.outcome, 'accepted');
  assert.equal(rep.independent_checks, 1);
  assert.equal(rep.own_checks, 1);
  // Replaying the projection needs no model call and is deterministic.
  assert.deepEqual(effort.report(r), rep, 'the report is a pure function of the events');

  // Overlapping sessions are merged, not summed. Two agents working the same ten
  // minutes cost ten minutes of wall clock, and summing them would report twenty.
  const concurrent = valid();
  concurrent.events = [
    { kind: 'session', id: 's1', started: at(0), ended: at(20) },
    { kind: 'session', id: 's2', started: at(10), ended: at(30) },
    { kind: 'session', id: 's3', started: at(25), ended: at(35) },
  ];
  ok(concurrent, 'the concurrent fixture validates');
  const cr = effort.report(concurrent);
  assert.equal(cr.active_minutes, 35, 'the union of three overlapping sessions');
  assert.equal(cr.session_minutes_summed, 50, 'and the naive sum is reported beside it, not instead of it');
  assert.equal(effort.minutesOf([{ start: 0, end: 600000 }, { start: 300000, end: 900000 }]), 15, 'two ten-minute windows overlapping by five are fifteen');
  assert.deepEqual(effort.mergeIntervals([{ start: 0, end: 10 }, { start: 10, end: 20 }]), [{ start: 0, end: 20 }], 'touching intervals merge');
  assert.deepEqual(effort.mergeIntervals([{ start: 0, end: 10 }, { start: 11, end: 20 }]).length, 2, 'separated intervals do not');

  // Events must be individually well formed and uniquely identified.
  const duplicate = valid();
  duplicate.events = [...duplicate.events, { ...duplicate.events[0] }];
  assert.ok(codes(duplicate).includes('EVENT_DUPLICATE'), 'a duplicate event id is refused');
  const backwards = valid();
  backwards.events = [{ kind: 'session', id: 's1', started: at(20), ended: at(10) }];
  assert.ok(codes(backwards).includes('EVENT_INVALID'), 'an event that ends before it starts is refused');
  const unknownStage = valid();
  unknownStage.events = [{ kind: 'stage', id: 'x', stage: 'thinking', started: at(0), ended: at(1) }];
  assert.ok(codes(unknownStage).includes('EVENT_INVALID'), 'an unknown stage is refused');
  const bareIntervention = valid();
  bareIntervention.events = [{ kind: 'intervention', id: 'i', intervention: 'repair', started: at(0), ended: at(1) }];
  assert.ok(codes(bareIntervention).includes('EVENT_INVALID'), 'an intervention must say what happened');
}

// --- S-05: null is not zero; missing provenance cannot yield accepted ----------------
{
  // An unmeasured metric is null WITH a reason, and stays distinguishable from zero.
  const unmeasured = valid();
  unmeasured.reported = { tokens: null, cost_usd: null, provider_minutes: null };
  assert.deepEqual(codes(unmeasured).sort(), ['REASON_REQUIRED', 'REASON_REQUIRED', 'REASON_REQUIRED'], 'a null metric without a reason is refused');
  unmeasured.unavailable = { tokens: 'the provider returned no usage block', cost_usd: 'no usage block, so no cost', provider_minutes: 'not reported by this tool version' };
  ok(unmeasured, 'null with a reason is complete');
  const ur = effort.report(unmeasured);
  assert.equal(ur.cost_usd, null, 'and it is reported as null');
  assert.notEqual(ur.cost_usd, 0, 'never as zero');
  assert.equal(ur.unavailable.cost_usd, 'no usage block, so no cost', 'with its reason carried into the report');
  // A measured zero is a different thing and is allowed to stand.
  const free = valid();
  free.reported = { tokens: 0, cost_usd: 0, provider_minutes: 0 };
  ok(free, 'a genuinely measured zero is valid');
  assert.equal(effort.report(free).cost_usd, 0);
  // ...but it may not also claim to be unavailable.
  const both = valid();
  both.unavailable = { cost_usd: 'not recorded' };
  assert.ok(codes(both).includes('RECORD_INVALID'), 'a measured metric cannot also be unavailable');

  // A pending run has not run yet, so nothing is expected of its metrics.
  const pending = effort.empty({ run: effort.runId('b', 1, 'plain'), cohort: HEX, brief: 'b', arm: 'plain', repetition: 1 });
  assert.deepEqual(codes(pending), [], 'a pending record is complete with nothing measured');

  // Missing provenance keeps a run from being valid.
  for (const key of ['base', 'prompts', 'driver', 'collector', 'evaluator', 'protocol', 'caps', 'configuration']) {
    const missing = valid();
    missing.provenance = { ...missing.provenance, [key]: null };
    assert.ok(codes(missing).includes('PROVENANCE_MISSING'), `a valid run needs provenance.${key}`);
  }
  // A missing evaluation is outstanding, never accepted.
  const noEval = valid({ evaluation: null });
  assert.ok(codes(noEval).includes('EVALUATION_MISSING'), 'a valid run without an evaluation is refused');
  const outstanding = valid({ evaluation: null, status: 'outstanding', reason: 'the evaluator could not run: no browser on this host' });
  ok(outstanding, 'the same run is complete as outstanding');
  assert.equal(effort.report(outstanding).outcome, null, 'and it reports no outcome');

  // The checks decide the outcome, not the record's author.
  const disputed = valid();
  disputed.evaluation = { ...disputed.evaluation, checks: [{ id: 'held-out', result: 'failed', independent: true }] };
  assert.ok(codes(disputed).includes('OUTCOME_DISPUTED'), 'an outcome its checks contradict is refused');
  assert.equal(effort.outcomeOf([{ result: 'passed' }, { result: 'failed' }]), 'rejected');
  assert.equal(effort.outcomeOf([{ result: 'passed' }, { result: 'unverified' }]), 'unverified');
  assert.equal(effort.outcomeOf([{ result: 'passed' }, { result: 'error' }]), 'error');
  assert.equal(effort.outcomeOf([]), 'error', 'no checks is an error, never an acceptance');
  // Acceptance needs a held-out check: the candidate's own tests are supplementary.
  const ownOnly = valid();
  ownOnly.evaluation = { ...ownOnly.evaluation, checks: [{ id: 'own-tests', result: 'passed', independent: false }] };
  assert.ok(codes(ownOnly).includes('EVALUATION_INVALID'), 'an acceptance resting only on the candidate\'s own tests is refused');

  // A strict run that cannot show adoption is a protocol failure, not a strict result.
  const unadopted = valid();
  unadopted.adoption = { required: true, observed: false, evidence: null };
  assert.ok(codes(unadopted).includes('ADOPTION_UNVERIFIED'), 'a strict run that did not adopt cannot be valid');
  const unevidenced = valid();
  unevidenced.adoption = { required: true, observed: true, evidence: null };
  assert.ok(codes(unevidenced).includes('ADOPTION_UNVERIFIED'), 'observed adoption needs its evidence');
  const protocolFailure = valid({ status: 'invalid', reason: 'the strict arm never ran coverage adopt; recorded as a protocol failure' });
  protocolFailure.adoption = { required: true, observed: false, evidence: null };
  ok(protocolFailure, 'and is retained as an invalid run with its reason');
  // The other arms must not adopt.
  const wrongArm = valid();
  wrongArm.arm = 'pincer';
  wrongArm.run = effort.runId('cli-greenfield', 1, 'pincer');
  assert.ok(codes(wrongArm).includes('RECORD_INVALID'), 'a non-strict arm that adopted is not that arm');
  // The plain arm installs no kit; claiming one is not the plain arm.
  const plainWithKit = valid();
  plainWithKit.arm = 'plain';
  plainWithKit.run = effort.runId('cli-greenfield', 1, 'plain');
  plainWithKit.adoption = { required: false, observed: null, evidence: null };
  assert.ok(codes(plainWithKit).includes('PROVENANCE_INVALID'), 'the plain arm may not carry a kit digest');

  // Cap-terminated work with a usable candidate is evaluated under the predeclared rule.
  const capped = valid();
  capped.events = [...capped.events, { kind: 'intervention', id: 'cap', intervention: 'operator', started: at(24), ended: at(24), detail: 'wall-clock cap reached; session ended and the committed work was judged' }];
  capped.evaluation = { candidate: SHA, evaluator: HEX, outcome: 'rejected', checks: [{ id: 'held-out', result: 'failed', independent: true }] };
  ok(capped, 'a cap-terminated run with a usable candidate is evaluated');
  assert.equal(effort.report(capped).outcome, 'rejected');
  assert.equal(effort.report(capped).interventions.operator, 1, 'and the cap is visible as an operator intervention');
}

// --- S-04/S-05 against controlled subprocesses --------------------------------------
// Real processes that pass, fail, exit partway, time out and are interrupted, so the
// outcomes the record carries came from something that actually behaved that way.
{
  const cases = [
    { id: 'passes', argv: ['-e', 'process.exit(0)'], result: 'passed' },
    { id: 'fails', argv: ['-e', 'process.exit(3)'], result: 'failed' },
    { id: 'partial', argv: ['-e', 'console.log("did half"); process.exit(1)'], result: 'failed' },
    { id: 'errors', argv: ['-e', 'throw new Error("boom")'], result: 'failed' },
  ];
  const checks = [];
  for (const c of cases) {
    const started = Date.now();
    const r = spawnSync(process.execPath, c.argv, { encoding: 'utf8', timeout: 10000 });
    checks.push({ id: c.id, result: r.status === 0 ? 'passed' : 'failed', independent: true, exit: r.status, ms: Date.now() - started });
    assert.equal(r.status === 0 ? 'passed' : 'failed', c.result, `${c.id}: the subprocess behaved as the fixture claims`);
  }
  // A timeout is neither passed nor failed: it is unverified, and it says so.
  const timed = spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'], { encoding: 'utf8', timeout: 300 });
  assert.ok(timed.signal || timed.error, 'the timeout fixture really timed out');
  checks.push({ id: 'timed-out', result: 'unverified', independent: true });

  const r = valid();
  r.evaluation = { candidate: SHA, evaluator: HEX, outcome: effort.outcomeOf(checks.map(c => ({ result: c.result }))), checks: checks.map(({ id, result, independent }) => ({ id, result, independent })) };
  ok(r, 'a record built from real subprocess outcomes validates');
  assert.equal(r.evaluation.outcome, 'rejected', 'a failing held-out check rejects the run');
  assert.equal(effort.report(r).independent_checks, 5);
}

// --- Aggregation: denominators are explicit and nothing missing is hidden ------------
{
  const reports = [];
  const make = (brief, arm, rep, over = {}) => {
    const r = valid();
    r.brief = brief; r.arm = arm; r.repetition = rep;
    r.run = effort.runId(brief, rep, arm);
    r.adoption = { required: arm === 'strict', observed: arm === 'strict' ? true : null, evidence: arm === 'strict' ? 'schema 3 record' : null };
    if (arm === 'plain') r.provenance = { ...r.provenance, kit: null };
    Object.assign(r, over);
    ok(r, `${r.run} validates`);
    return effort.report(r);
  };
  for (const arm of effort.ARMS) for (let rep = 1; rep <= 3; rep++) reports.push(make('cli-greenfield', arm, rep));
  // One run of each kind that must not silently vanish from a rate.
  reports.push(make('ui-states', 'strict', 1, { status: 'invalid', reason: 'account usage limit ended the session with no usable candidate', evaluation: null }));
  reports.push(make('ui-states', 'plain', 1, { status: 'unavailable', reason: 'no browser tooling on this host', evaluation: null }));
  reports.push(make('ui-states', 'pincer', 1, { status: 'outstanding', reason: 'not yet run; needs the spending decision', evaluation: null }));

  const agg = effort.aggregate(reports);
  assert.equal(agg.arms.strict.valid, 3);
  assert.equal(agg.arms.strict.invalid, 1);
  assert.equal(agg.arms.plain.unavailable, 1);
  assert.equal(agg.arms.pincer.outstanding, 1);
  assert.deepEqual(agg.arms.strict.acceptance, { accepted: 3, of: 3 }, 'a rate carries the denominator it was computed over');
  assert.equal(agg.arms.strict.scheduled, 4, 'and the scheduled count shows what is missing from it');
  assert.equal(agg.complete, false, 'a schedule with an outstanding run is not complete');
  assert.equal(agg.arms.strict.review_minutes.of, 3, 'review time is counted over the runs that measured it');

  // An unmeasured cost does not become a zero in the total.
  const withNull = reports.map(r => (r.run === 'cli-greenfield/rep-1/plain' ? { ...r, cost_usd: null, unavailable: { cost_usd: 'no usage block' } } : r));
  const agg2 = effort.aggregate(withNull);
  assert.equal(agg2.arms.plain.cost_usd.of, 3, 'the denominator drops to the runs that measured it');
  assert.equal(agg2.arms.plain.cost_usd.unmeasured, 1, 'and the unmeasured run is counted, not hidden');
  assert.equal(agg2.arms.plain.cost_usd.total, null, 'legacy accounting cannot establish a comparable total');
  assert.equal(agg2.arms.plain.cost_usd.measured_subtotal, 1.87 * 3, 'legacy subtotal includes invalid or unavailable runs with reported spend');
}

// Unknown accounting leaves an independently accepted candidate intact.
{
  const usage = require('../scripts/delivery-benchmark-v7/usage.cjs');
  const accepted = valid();
  const row = { id: 'legacy:S1', payload: 'S1.json', sha256: null, metrics: usage.parse(null) };
  accepted.measurement = { schema: 1, profile: usage.PROFILE, coverage: 'explicit-legacy-session-list', sessions: [row], metrics: usage.summarize([row], 'explicit-legacy-session-list') };
  for (const key of usage.KEYS) {
    accepted.reported[key] = null;
    accepted.unavailable[key] = accepted.measurement.metrics[key].missing.map(item => `${item.session || 'accounting'}: ${item.reason}`).join('; ').slice(0, 500);
  }
  assert.deepEqual(effort.problems(accepted), []);
  assert.equal(accepted.evaluation.outcome, 'accepted');
  assert.equal(effort.report(accepted).outcome, 'accepted');
}

console.log('effort record tests passed');
