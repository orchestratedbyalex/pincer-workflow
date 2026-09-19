import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { tempDir } from './helpers.js';

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
  const options = { cohort, spendingCap: true, ids: ['cli-greenfield'],
    effective: { manifest: { cohort } },
    readiness: { purpose: 'measured', spendingAuthorized: true, projectAccessAuthorized: true,
      hostPolicyPreserved: true, observationReviewed: true, decisionRef: 'unsupported-boolean-claim' } };
  const noManifest = await runner.driveRun(root, planned.cells[0], options);
  assert.equal(noManifest.refused, true);
  assert.match(noManifest.detail, /concrete measured-study manifest/);

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
    for (const scenario of ['wall-cap', 'provider-cap', 'noncap', 'cleanup-unknown', 'changed-project']) {
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
      readiness.inspectStudy = () => ({ ready: true, launchGrant: {
        inputRoot, observationFile: 'observation.json', allocation: { root: runs },
        execution: { effective_digest: cohort }, sessions, decision: { ref: 'controlled-decision' },
        projects: [{ id: 'approved', base }, { id: 'other', base: 'd'.repeat(40) }],
      } });
      const manifest = { cohort, effective: { model: 'synthetic' }, caps: { turns_per_session: 5, wall_clock_minutes: 1 } };
      effective.assertCurrent = () => manifest;
      isolation.preflightExecution = () => ({ ok: true });
      let launches = 0, reservations = 0, evaluations = 0;
      allocator.reserve = () => { reservations++; return { fixture: true }; };
      allocator.reconcile = () => ({ stopped: scenario !== 'changed-project' });
      isolation.launchNative = async options => {
        launches++;
        fs.mkdirSync(options.logDir, { recursive: true });
        const capped = scenario === 'wall-cap' || scenario === 'cleanup-unknown';
        const result = { type: 'result', subtype: scenario === 'provider-cap' ? 'error_max_turns' : 'success',
          is_error: scenario === 'provider-cap', total_cost_usd: 0.1, duration_api_ms: 1,
          modelUsage: { fixture: { inputTokens: 1, outputTokens: 1, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 } } };
        fs.writeFileSync(path.join(options.logDir, `${options.name}.json`), capped ? '{partial' : JSON.stringify(result));
        return { status: capped ? 124 : 0, end: capped ? 'capped' : 'completed',
          cleanup_complete: scenario !== 'cleanup-unknown', reportable: scenario === 'changed-project',
          ended: new Date().toISOString(), environment: { fixture: true, tool: 'synthetic-native-boundary' } };
      };
      harness.evaluateCandidate = async () => { evaluations++; return {
        outcome: 'accepted', checks: [{ id: 'controlled-independent-check', result: 'passed', independent: true }],
      }; };
      const out = await runner.driveRun(runs, cell, { cohort, spendingCap: true, model: 'synthetic', maxTurns: 5, wallClockMinutes: 1,
        kit: fs.realpathSync(path.join(inputRoot, 'kit.tgz')), effective: { manifest, inputRoot, input: { kit: { path: 'kit.tgz' } } },
        allocation: { manifestPath: path.join(inputRoot, 'study.json'), inputRoot, purpose: 'measured' } });
      assert.equal(launches, 1, scenario+JSON.stringify(out));
      assert.equal(reservations, 1, 'changed project or stopped allocation cannot reserve a later paid session');
      if (scenario === 'changed-project') {
        assert.equal(out.refused, true);
        assert.equal(evaluations, 0);
      } else {
        assert.equal(out.record.status, 'invalid', JSON.stringify(out));
        assert.equal(out.stop, true);
        const canEvaluate = ['wall-cap', 'provider-cap'].includes(scenario);
        assert.equal(evaluations, canEvaluate ? 1 : 0, scenario);
        assert.equal(out.record.evaluation?.outcome || null, canEvaluate ? 'accepted' : null);
        assert.deepEqual(effort.problems(out.record), []);
      }
    }
  } finally {
    readiness.inspectStudy = saved.inspect; effective.assertCurrent = saved.current;
    isolation.preflightExecution = saved.preflight; isolation.launchNative = saved.launch;
    allocator.reserve = saved.reserve; allocator.reconcile = saved.reconcile; harness.evaluateCandidate = saved.evaluate;
  }
}

console.log('benchmark study launch tests passed (pending decisions, exact session bases, capped native-boundary evaluation)');
