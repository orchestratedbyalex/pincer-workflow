import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { repo, tempDir, write } from './helpers.js';

const require = createRequire(import.meta.url);
const runner = require('../scripts/delivery-benchmark-v7/orchestrator.cjs');
const isolation = require('../scripts/delivery-benchmark-v7/isolated-launch.cjs');
const effective = require('../scripts/delivery-benchmark-v7/effective.cjs');
const harness = require('../scripts/delivery-benchmark-v7/harness.cjs');
const root = tempDir();
const manifestPath = path.join(root, 'study.json');
fs.writeFileSync(manifestPath, JSON.stringify({ schema: 1, kind: 'pincer-study-readiness',
  execution: null, projects: null, kits: null, schedule: null, reviewers: null,
  authorization: null, allocation: null, stop_resume: null, evidence: {} }));
const cohort = 'a'.repeat(64);
const planned = runner.plan(root, { cohort, ids: ['cli-greenfield'] });
const snapshot = directory => Object.fromEntries(fs.readdirSync(directory, { recursive: true })
  .filter(name => fs.lstatSync(path.join(directory, name)).isFile())
  .sort().map(name => [name, fs.readFileSync(path.join(directory, name)).toString('base64')]));
const before = snapshot(root);
const original = { preflight: isolation.preflightExecution, current: effective.assertCurrent, prepare: harness.prepare };
let effects = 0;
const forbidden = () => { effects++; throw new Error('readiness refusal must precede execution'); };
isolation.preflightExecution = forbidden;
effective.assertCurrent = forbidden;
harness.prepare = forbidden;
try {
  const options = { cohort, usageEnvelopeAgreed: true, ids: ['cli-greenfield'],
    effective: { manifest: { cohort } },
    readiness: { purpose: 'measured', spendingAuthorized: true, projectAccessAuthorized: true,
      hostPolicyPreserved: true, observationReviewed: true, decisionRef: 'unsupported-boolean-claim' } };
  const noManifest = await runner.driveRun(root, planned.cells[0], options);
  assert.equal(noManifest.refused, true);
  assert.match(noManifest.detail, /concrete measured-study or operational-smoke manifest/);

  const pending = { ...options, allocation: {
    manifestPath, inputRoot: root, purpose: 'measured',
  } };
  const cellResult = await runner.driveRun(root, planned.cells[0], pending);
  assert.equal(cellResult.refused, true);
  assert.match(cellResult.detail, /Study readiness is pending/);
  const scheduleResult = await runner.driveSchedule(root, pending);
  assert.equal(scheduleResult.refused, true);
  assert.equal(scheduleResult.driven.length, 0);
  assert.equal(effects, 0, 'no CLI probe, browser preflight, preparation or model launch');
  assert.deepEqual(snapshot(root), before, 'pending actual decisions cannot mutate planned records');
} finally {
  isolation.preflightExecution = original.preflight;
  effective.assertCurrent = original.current;
  harness.prepare = original.prepare;
}

// Controlled native-boundary integration: grant/launcher substitutes are local to
// this test; no provider executable or authenticated session is invoked.
{
  const readiness = require('../scripts/delivery-benchmark-v7/readiness.cjs');
  const allocator = require('../scripts/delivery-benchmark-v7/allocation.cjs');
  const briefs = require('../scripts/delivery-benchmark-v7/briefs.cjs');
  const effort = require('../scripts/delivery-benchmark-v7/effort.cjs');
  const saved = { inspect: readiness.inspectStudy, current: effective.assertCurrent,
    preflight: isolation.preflightExecution, launch: isolation.launchNative,
    reserve: allocator.reserve, reconcile: allocator.reconcile, evaluate: harness.evaluateCandidate };
  try {
    for (const scenario of ['wall-cap', 'provider-cap', 'noncap', 'cleanup-unknown', 'changed-project', 'operational', 'operational-failed', 'hook-evidence-missing', 'hook-registration-only', 'retention-failed']) {
      // An operational smoke is unreportable by purpose: it must still run the whole
      // path and evaluate, launch no second prompt, and stop for operator inspection.
      const operational = scenario.startsWith('operational');
      const purpose = operational ? 'operational-smoke' : 'measured';
      const runs = tempDir(), inputRoot = tempDir(), baseWorkspace = tempDir();
      harness.prepare(baseWorkspace, 'scope-revision', { arm: 'plain' });
      const base = harness.git(baseWorkspace, 'rev-parse', 'HEAD');
      fs.writeFileSync(path.join(inputRoot, 'kit.tgz'), 'fixture');
      fs.writeFileSync(path.join(inputRoot, 'observation.json'), '{}');
      const provenance = Object.fromEntries(['prompts','driver','collector','evaluator','protocol','caps','configuration'].map(key => [key, 'b'.repeat(64)]));
      const plan = runner.plan(runs, { cohort, ids: ['scope-revision'], provenance });
      const cell = plan.cells.find(cell => cell.arm === 'plain' && cell.repetition === 1);
      const run = 'scope-revision/rep-1/plain';
      const prompts = briefs.loadBrief('scope-revision').prompts;
      const sessions = prompts.map((prompt, index) => ({ id: prompt.name, run, name: prompt.name,
        arm: 'plain', project: scenario === 'changed-project' && index > 0 ? 'other' : 'approved',
        effective_digest: cohort, prompt_digest: effort.sha256(prompt.prompt) }));
      let inspectedPurpose = null;
      readiness.inspectStudy = context => { inspectedPurpose = context.purpose; return { ready: true, launchGrant: {
        // The smoke that collects the native observation has none to reference yet.
        inputRoot, observationFile: operational ? null : 'observation.json', allocation: { root: runs },
        execution: { effective_digest: cohort }, sessions, decision: { ref: 'controlled-decision' },
        projects: [{ id: 'approved', base }, { id: 'other', base: 'd'.repeat(40) }],
      } }; };
      const manifest = { cohort, effective: { model: 'synthetic' }, caps: { turns_per_session: 5, wall_clock_minutes: 1 } };
      effective.assertCurrent = () => manifest;
      isolation.preflightExecution = () => ({ ok: true });
      let launches = 0, reservations = 0, evaluations = 0, launched = null, reconciledWith = null;
      allocator.reserve = () => { reservations++; return { fixture: true }; };
      allocator.reconcile = options => { reconciledWith = options.result; return { stopped: !operational && !['changed-project', 'hook-evidence-missing', 'hook-registration-only'].includes(scenario) }; };
      isolation.launchNative = async options => {
        launches++;
        launched = { readiness: options.readiness, observationFile: options.observationFile };
        fs.mkdirSync(options.logDir, { recursive: true });
        const capped = scenario === 'wall-cap' || scenario === 'cleanup-unknown';
        const failed = scenario === 'operational-failed';
        const result = { type: 'result', subtype: scenario === 'provider-cap' ? 'error_max_turns' : 'success',
          is_error: scenario === 'provider-cap', total_cost_usd: 0.1, duration_api_ms: 1,
          modelUsage: { fixture: { inputTokens: 1, outputTokens: 1, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 } } };
        fs.writeFileSync(path.join(options.logDir, `${options.name}.json`), capped || failed ? '{partial' : JSON.stringify(result));
        // The launcher's verdict arrives as `reportable` plus its named reasons; the
        // orchestrator must act on them, not on a fixture's say-so alone.
        let unreportable = scenario === 'hook-evidence-missing' ? ['hook evidence missing'] : scenario === 'retention-failed' ? ['hook evidence unretained'] : [];
        if (scenario === 'hook-registration-only') {
          const hookEvidence = isolation.hookEvidence('strict', { present: true, retained: true },
            'Registered but NEVER EXECUTED: .claude/hooks/block-dangerous.sh and .claude/hooks/ticket-guard.sh');
          const verdict = isolation.reportability({ nativePreflight: { reportable: true }, attestedModel: 'synthetic', model: 'synthetic',
            result: { cleanup_complete: true }, canary: { leak_detected: false }, hookEvidence });
          assert.equal(verdict.reportable, false);
          unreportable = verdict.unreportable;
        }
        return { status: capped ? 124 : failed ? 7 : 0, end: capped ? 'capped' : failed ? 'failed' : 'completed',
          cleanup_complete: scenario !== 'cleanup-unknown', reportable: scenario === 'changed-project', unreportable,
          evidence_retention_failed: scenario === 'retention-failed', review_required: scenario === 'retention-failed',
          observation: operational ? 'operational-smoke' : 'measured',
          ended: new Date().toISOString(), environment: { fixture: true, tool: 'synthetic-native-boundary' } };
      };
      harness.evaluateCandidate = async () => { evaluations++; return {
        outcome: 'accepted', checks: [{ id: 'controlled-independent-check', result: 'passed', independent: true }],
      }; };
      const out = await runner.driveRun(runs, cell, { cohort, usageEnvelopeAgreed: true, model: 'synthetic', maxTurns: 5, wallClockMinutes: 1,
        kit: fs.realpathSync(path.join(inputRoot, 'kit.tgz')), effective: { manifest, inputRoot, input: { kit: { path: 'kit.tgz' } } },
        allocation: { manifestPath: path.join(inputRoot, 'study.json'), inputRoot, purpose } });
      assert.equal(launches, 1, scenario+JSON.stringify(out));
      assert.equal(reservations, 1, 'changed project, stopped allocation or an operational smoke cannot reserve a later paid session');
      assert.equal(inspectedPurpose, purpose, 'the approved purpose reaches the inspector unchanged');
      if (scenario === 'changed-project') {
        assert.equal(out.refused, true);
        assert.equal(evaluations, 0);
      } else {
        assert.equal(out.record.status, 'invalid', JSON.stringify(out));
        assert.equal(out.stop, true);
        const canEvaluate = ['wall-cap', 'provider-cap', 'operational'].includes(scenario);
        assert.equal(evaluations, canEvaluate ? 1 : 0, scenario);
        assert.equal(out.record.evaluation?.outcome || null, canEvaluate ? 'accepted' : null);
        assert.deepEqual(effort.problems(out.record), []);
      }
      if (operational) {
        assert.equal(launched.readiness.purpose, 'operational-smoke');
        assert.equal(launched.readiness.observationReviewed, undefined, 'a smoke claims no reviewed native observation');
        assert.equal(launched.observationFile, null);
        assert.match(out.record.reason, scenario === 'operational' ? /Operational smoke session/ : /no successful provider completion/);
      } else if (scenario !== 'changed-project') {
        assert.equal(launched.readiness.purpose, 'measured');
        assert.equal(launched.readiness.observationReviewed, true);
        assert.equal(launched.observationFile, 'observation.json');
        assert.doesNotMatch(out.record.reason, /Operational smoke/);
      }
      if (scenario === 'hook-evidence-missing') {
        // Missing required hook evidence makes the measured session unreportable through
        // the orchestration path: the record says why, the cell is invalid, the schedule stops.
        assert.match(out.record.reason, /not reportable \(hook evidence missing\)/, out.record.reason);
        assert.equal(out.stop, true);
        assert.equal(evaluations, 0);
      }
      if (scenario === 'hook-registration-only') {
        assert.match(out.record.reason, /hook evidence insufficient/);
        assert.equal(out.stop, true);
        assert.equal(evaluations, 0);
      }
      if (scenario === 'retention-failed') {
        // The retention failure reaches the allocator, which stops the allocation so no
        // later paid session can start before an explicit review decision.
        assert.equal(reconciledWith.evidence_retention_failed, true, 'the allocator sees the retention failure');
        assert.match(out.record.reason, /allocation stopped/);
        assert.equal(out.stop, true);
      }
    }
  } finally {
    readiness.inspectStudy = saved.inspect; effective.assertCurrent = saved.current;
    isolation.preflightExecution = saved.preflight; isolation.launchNative = saved.launch;
    allocator.reserve = saved.reserve; allocator.reconcile = saved.reconcile; harness.evaluateCandidate = saved.evaluate;
  }
}

// A repetition prefix plans and drives only the approved first repetitions, so a
// three-session smoke never materialises cells its allocation did not approve.
{
  const runs = tempDir(), kitRoot = tempDir();
  const first = runner.plan(runs, { cohort, ids: ['ui-states'], repetitions: 1 });
  assert.deepEqual(first.cells.map(cell => cell.run), ['ui-states/rep-1/pincer', 'ui-states/rep-1/strict', 'ui-states/rep-1/plain']);
  assert.equal(first.created.length, 3);
  for (const repetitions of [0, 4, 1.5, '1']) assert.throws(() => runner.plan(runs, { cohort, ids: ['ui-states'], repetitions }), /prefix/);
  // Tiny local archive exercises the real kit-install path without any released-kit claim.
  const pkg = path.join(kitRoot, 'archive/package');
  fs.mkdirSync(path.join(pkg, 'bin'), { recursive: true });
  fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ version: '1.0.0' }));
  fs.writeFileSync(path.join(pkg, 'bin/pincer.js'), `const fs=require('node:fs');fs.mkdirSync('.claude',{recursive:true});fs.writeFileSync('.claude/CLAUDE.md','synthetic kit fixture\\n');`);
  const archive = path.join(kitRoot, 'fixture-kit.tgz');
  assert.equal(harness.sh('tar', ['-czf', archive, '-C', path.dirname(pkg), 'package']).status, 0);
  let sessions = 0;
  const fixtureSession = async () => { sessions++; throw new Error('controlled: no session is launched'); };
  const prefix = await runner.driveSchedule(runs, { cohort, ids: ['ui-states'], repetitions: 1, usageEnvelopeAgreed: true, kit: archive, fixtureSession });
  assert.equal(prefix.stopped, null, JSON.stringify(prefix));
  assert.deepEqual(prefix.driven.map(d => [d.run, d.status]), first.cells.map(cell => [cell.run, 'invalid']));
  assert.equal(sessions, 3);
  assert.equal(fs.existsSync(path.join(runs, 'ui-states/rep-2')), false, 'a prefix never materialises unapproved repetitions');
  const full = runner.plan(runs, { cohort, ids: ['ui-states'] });
  assert.equal(full.cells.length, 9);
  assert.equal(full.created.length, 6, 'the remaining repetitions keep their identities');
  const rest = await runner.driveSchedule(runs, { cohort, ids: ['ui-states'], usageEnvelopeAgreed: true, kit: archive, fixtureSession });
  assert.equal(rest.driven.filter(d => d.skipped).length, 3, 'terminal prefix cells are never redriven');
  assert.equal(sessions, 9);
}
{
  assert.deepEqual(effective.parseArgs(['--study-manifest', 'study.json', '--study-purpose', 'operational-smoke', '--repetitions', '1', '--briefs', 'ui-states']),
    { 'study-manifest': 'study.json', 'study-purpose': 'operational-smoke', repetitions: 1, briefs: ['ui-states'] });
  assert.deepEqual(effective.parseArgs(['--briefs', 'ui-states,cli-greenfield']).briefs, ['ui-states', 'cli-greenfield']);
  for (const args of [['--study-purpose', 'operational-smoke'], ['--study-manifest', 'study.json', '--study-purpose', 'smoke'],
    ['--repetitions', '0'], ['--repetitions', '10'], ['--repetitions', '1', '--repetitions', '1'],
    // An operational smoke names the briefs it may plan; the whole schedule is never implied.
    ['--study-manifest', 'study.json', '--study-purpose', 'operational-smoke', '--repetitions', '1'],
    ['--briefs', ''], ['--briefs', 'ui-states,'], ['--briefs', 'ui-states,ui-states'], ['--briefs', '../x']]) assert.throws(() => effective.parseArgs(args), args.join(' '));
}

// The documented smoke command, through the actual operator entry point. The internal API
// receives its brief list from the caller; the CLI has to derive the same list from its
// arguments, or the packaged command plans every brief and the allocation refuses them all.
{
  const inputRoot = tempDir(), runs = path.join(tempDir(), 'smoke');
  write(inputRoot, 'inputs/kits/kit.tgz', 'fixture archive identity');
  write(inputRoot, 'browser/index.cjs', 'module.exports = {};\n');
  write(inputRoot, 'runtime/browser', 'browser binary');
  const executable = path.join(inputRoot, 'inputs/tool/version-probe');
  fs.mkdirSync(path.dirname(executable), { recursive: true });
  fs.writeFileSync(executable, effective.versionProbeFixture('2.1.273'), { mode: 0o755 });
  write(inputRoot, 'inputs.json', JSON.stringify({
    model: 'claude-example-1', tool: { executable, version: '2.1.273', kind: 'version-probe-fixture' },
    caps: { turns_per_session: 3, wall_clock_minutes: 2, spend_usd: 1 },
    kit: { path: 'inputs/kits/kit.tgz', commit: 'a'.repeat(40) },
    browser: { entry: 'browser/index.cjs', roots: ['browser'], runtime: { name: 'chromium', version: '1.2.3', path: 'runtime' } },
    configuration: { permission_mode: 'manual', cwd_kind: 'scratch', isolation_profile: 'claude-project-isolated-v1' },
  }));
  write(inputRoot, 'study.json', JSON.stringify({ schema: 1, kind: 'pincer-study-readiness',
    execution: null, projects: null, kits: null, schedule: null, reviewers: null,
    authorization: null, allocation: null, stop_resume: null, evidence: {} }));
  const documented = ['--runs', runs, '--execution-inputs', path.join(inputRoot, 'inputs.json'), '--input-root', inputRoot,
    '--study-manifest', path.join(inputRoot, 'study.json'), '--study-input-root', inputRoot,
    '--study-purpose', 'operational-smoke', '--repetitions', '1', '--briefs', 'ui-states', '--plan-only'];
  const cli = args => spawnSync(process.execPath, [path.join(repo, 'scripts/delivery-benchmark-v7/orchestrator.cjs'), ...args], { encoding: 'utf8' });
  const records = () => fs.existsSync(runs) ? fs.readdirSync(runs, { recursive: true }).filter(name => name.endsWith('record.json')).sort() : [];
  const planned = cli(documented);
  assert.equal(planned.status, 0, planned.stderr);
  assert.match(planned.stdout, /^cohort [a-f0-9]{64}\n3 cells, 3 newly planned\n$/, planned.stdout);
  assert.deepEqual(records(), ['ui-states/rep-1/pincer/record.json', 'ui-states/rep-1/plain/record.json', 'ui-states/rep-1/strict/record.json']);
  const order = records().map(file => JSON.parse(fs.readFileSync(path.join(runs, file), 'utf8'))).sort((a, b) => a.order - b.order);
  assert.deepEqual(order.map(record => [record.order, record.run, record.status]),
    [[1, 'ui-states/rep-1/pincer', 'pending'], [2, 'ui-states/rep-1/strict', 'pending'], [3, 'ui-states/rep-1/plain', 'pending']],
    'the three authorized smoke cells, in the documented order, and nothing else');
  const again = cli(documented);
  assert.equal(again.status, 0, again.stderr);
  assert.match(again.stdout, /3 cells, 0 newly planned/, 'replanning is idempotent');
  const before = records();
  const unnamed = cli(documented.filter((arg, i) => arg !== '--briefs' && documented[i - 1] !== '--briefs'));
  assert.equal(unnamed.status, 2, 'an operational smoke without a brief list is refused before planning');
  assert.match(unnamed.stderr, /--briefs/);
  const unknown = cli(documented.map(arg => arg === 'ui-states' ? 'ui-states,no-such-brief' : arg));
  assert.equal(unknown.status, 2, unknown.stderr);
  assert.match(unknown.stderr, /no-such-brief/);
  assert.deepEqual(records(), before, 'a refused invocation plans nothing');
}

console.log('benchmark study launch tests passed (pending decisions, exact session bases, capped native-boundary evaluation, operational smoke, repetition prefix, documented CLI command)');
