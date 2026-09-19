// T-106: synthetic sessions, actual orchestrator persistence and actual validators.
// This suite makes no native model calls and is not native isolation evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir } from './helpers.js';
const require = createRequire(import.meta.url);
const lib = path.join(repo, 'scripts/delivery-benchmark-v7');
const runtime = require(path.join(lib, 'orchestrator.cjs'));
const harness = require(path.join(lib, 'harness.cjs'));
const effort = require(path.join(lib, 'effort.cjs'));
const schedule = require(path.join(lib, 'schedule.cjs'));
const diagnostic = require(path.join(lib, 'finalization.cjs'));
const claims = require(path.join(lib, 'run-claims.cjs'));
const usage = require(path.join(lib, 'usage.cjs'));
const cohort = 'a'.repeat(64);
const provenance = Object.fromEntries(['prompts','driver','collector','evaluator','protocol','caps','configuration'].map(key => [key, 'b'.repeat(64)]));
const payload = { type: 'result', subtype: 'success', is_error: false, total_cost_usd: 1.25, duration_api_ms: 120000,
  modelUsage: { fixture: { inputTokens: 100, outputTokens: 20, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 } } };
function planned(id = 'cli-greenfield') {
  const root = tempDir();
  runtime.plan(root, { cohort, ids: [id], provenance });
  const cell = schedule.schedule([id]).find(cell => cell.arm === 'plain' && cell.repetition === 1);
  const home = path.join(root, id, 'rep-1', 'plain');
  return { root, cell, home };
}
function fixture(options = {}) {
  return async ({ logDir, name }) => {
    if (options.throw) throw new Error('synthetic execution failure');
    fs.mkdirSync(logDir, { recursive: true });
    const raw = options.raw ?? JSON.stringify({ ...payload, ...options.payload });
    fs.writeFileSync(path.join(logDir, `${name}.json`), raw);
    fs.writeFileSync(path.join(logDir, `${name}.err`), 'retained fixture stderr');
    const time = new Date().toISOString();
    return { started: time, ended: time, status: 0, end: 'completed', ...options.result };
  };
}
async function drive(p, options = {}) {
  return runtime.driveRun(p.root, p.cell, { cohort, spendingCap: true, model: 'synthetic', fixtureSession: fixture(), ...options });
}
async function evaluated(result, body) {
  const previous = harness.evaluateCandidate;
  harness.evaluateCandidate = async () => {
    if (result === 'throw') throw new Error('synthetic evaluator failure');
    const checks = [{ id: 'independent-fixture', result, independent: true }];
    return { outcome: effort.outcomeOf(checks), checks };
  };
  try { return await body(); } finally { harness.evaluateCandidate = previous; }
}
function validOutput(p, out, status) {
  assert.equal(out.failed, undefined, JSON.stringify(out.diagnostic));
  const saved = runtime.readRecord(p.root, p.cell);
  assert.deepEqual(saved, out.record, 'returned terminal record matches actual published bytes');
  assert.equal(saved.status, status);
  assert.deepEqual(effort.problems(saved), []);
  assert.deepEqual(out.problems, []);
  assert.equal(saved.attempts.at(-1).status, 'completed');
  for (const metric of usage.KEYS) if (saved.reported[metric] === null) assert.ok(saved.unavailable[metric]);
  return saved;
}
for (const [check, expected, outcome] of [['passed','valid','accepted'], ['failed','valid','rejected'], ['unverified','unavailable','unverified'], ['error','invalid','error']]) {
  const p = planned();
  const out = await evaluated(check, () => drive(p));
  const saved = validOutput(p, out, expected);
  assert.equal(saved.evaluation.outcome, outcome);
  assert.equal(saved.reported.cost_usd, 1.25);
  const bytes = fs.readFileSync(path.join(p.home, 'record.json'));
  assert.equal((await drive(p, { fixtureSession: () => { throw new Error('must not rerun'); } })).skipped, true);
  assert.deepEqual(fs.readFileSync(path.join(p.home, 'record.json')), bytes);
}
// Independent acceptance remains recorded when provider metrics are incomplete.
{
  const p = planned();
  const out = await evaluated('passed', () => drive(p, { fixtureSession: fixture({ raw: JSON.stringify({ type: 'result', subtype: 'success' }) }) }));
  const saved = validOutput(p, out, 'valid');
  assert.equal(saved.evaluation.outcome, 'accepted');
  assert.equal(saved.reported.tokens, null);
}
for (const [name, options, stop] of [
  ['account-limit', { result: { limit: true } }, true],
  ['ambiguous', { result: { status: 124, end: 'ambiguous' } }, false],
  ['nonzero', { result: { status: 7, end: 'failed' } }, false],
  ['provider-error-exit-zero', { payload: { subtype: 'error_during_execution', is_error: true } }, false],
  ['unsupported-provider-error', { payload: { subtype: 'error_max_structured_output_retries', is_error: true } }, false],
  ['contradictory-provider-error', { payload: { is_error: true } }, false],
  ['malformed', { raw: '{truncated' }, false],
  ['thrown-session', { throw: true }, false],
]) {
  const p = planned();
  const out = await drive(p, { fixtureSession: fixture(options) });
  const saved = validOutput(p, out, 'invalid');
  assert.equal(out.stop, stop, name);
  assert.equal(saved.evaluation, null, name);
  assert.ok(saved.reason, name);
}
{
  const p = planned();
  const out = await evaluated('failed', () => drive(p, { fixtureSession: fixture({ result: { end: 'capped', status: 124 }, raw: '{partial' }) }));
  const saved = validOutput(p, out, 'valid');
  assert.equal(saved.evaluation.outcome, 'rejected');
  assert.equal(saved.reported.tokens, null);
  assert.ok(saved.events.some(event => /cap/.test(event.detail || '')));
}
{
  const p = planned();
  const out = await evaluated('throw', () => drive(p));
  validOutput(p, out, 'invalid');
  assert.match(out.record.reason, /evaluation failed/i);
}
for (const subtype of ['error_max_turns', 'error_max_budget_usd', 'error_during_execution']) {
  const p = planned(subtype === 'error_during_execution' ? 'scope-revision' : 'cli-greenfield');
  const options = { payload: { subtype, is_error: true } };
  if (subtype === 'error_during_execution') options.result = { end: 'capped', status: 124 };
  const out = await evaluated('passed', () => drive(p, { fixtureSession: fixture(options) }));
  validOutput(p, out, subtype === 'error_during_execution' ? 'invalid' : 'valid');
  assert.equal(out.record.evaluation.outcome, 'accepted', 'independent candidate verdict remains distinct from experiment validity');
  if (subtype === 'error_during_execution') assert.equal(out.record.attempts[0].sessions.length, 1,
    'known execution failure prevents additional paid prompts in a multi-session brief');
}
// A prelaunch refusal preserves the record and never creates attempt workspaces.
{
  const p = planned();
  const before = fs.readFileSync(path.join(p.home, 'record.json'));
  let calls = 0;
  const out = await drive(p, { spendingCap: false, fixtureSession: () => { calls++; } });
  assert.equal(out.refused, true);
  assert.equal(calls, 0);
  assert.deepEqual(fs.readFileSync(path.join(p.home, 'record.json')), before);
  assert.deepEqual(fs.readdirSync(p.home), ['record.json']);
}
// A driver preflight can refuse after the orchestrator has checkpointed intent.
{
  const p = planned();
  const out = await drive(p, { fixtureSession: () => ({ refused: true, code: 'PREFLIGHT_FAILED' }) });
  assert.equal(out.refused, true);
  assert.equal(out.record.status, 'pending');
  for (const metric of usage.KEYS) { assert.equal(out.record.reported[metric], null); assert.ok(out.record.unavailable[metric]); }
  assert.equal(fs.existsSync(path.join(p.home, 'attempts/attempt-000001/logs/S1.json')), false);
  assert.deepEqual(effort.problems(runtime.readRecord(p.root, p.cell)), []);
  assert.equal((await drive(p)).code, 'ATTEMPT_RESUME_REQUIRED');
  const resumed = await evaluated('passed', () => drive(p, { resumeInterrupted: { attempt: 'attempt-000001', reason: 'Corrected preflight decision' } }));
  validOutput(p, resumed, 'valid');
}
// Exercise the real UI evaluator's absent-browser outcome, not just a crafted record.
{
  const p = planned('ui-states');
  const out = await drive(p);
  validOutput(p, out, ['accepted','rejected'].includes(out.record.evaluation?.outcome) ? 'valid' : 'unavailable');
  assert.ok(out.record.evaluation.checks.some(check => check.result === 'unverified'));
  assert.notEqual(out.record.evaluation.outcome, 'accepted');
}
for (const fault of ['validation', 'accounting', 'terminal-write', 'checkpoint-write']) {
  const p = planned();
  const originalCollect = usage.collect;
  const originalWrite = claims.atomicWrite;
  let injected = false;
  try {
    const out = await evaluated('passed', () => drive(p, { fixtureCheckpoint: (boundary, { record }) => {
      if (fault === 'validation' && boundary === 'pre-evaluation') record.unexpected = 'retain this malformed raw field';
      if (fault === 'accounting' && boundary === 'pre-evaluation') usage.collect = () => { throw new Error('synthetic collector failure'); };
      if (['terminal-write','checkpoint-write'].includes(fault) && boundary === 'session-start') claims.atomicWrite = (file, bytes) => {
        if (!injected && file === path.join(p.home, 'record.json') && (fault === 'checkpoint-write' || JSON.parse(bytes).status !== 'pending')) {
          injected = true;
          throw new Error('synthetic record publication failure');
        }
        return originalWrite(file, bytes);
      };
    } }));
    assert.equal(out.failed, true, fault);
    assert.equal(out.stop, true);
    assert.equal(out.diagnosticFailure, false);
    assert.deepEqual(diagnostic.problems(out.diagnostic, p.home), []);
    const raw = JSON.parse(fs.readFileSync(path.join(p.home, out.diagnostic.raw.path)));
    assert.deepEqual(raw, out.record, 'retain attempted record without repairing away the failure');
    const saved = runtime.readRecord(p.root, p.cell);
    assert.equal(saved.status, 'pending', 'last checkpoint stays recoverable');
    assert.deepEqual(effort.problems(saved), []);
    assert.equal(fs.readFileSync(path.join(p.home, 'attempts/attempt-000001/logs/S1.json'), 'utf8'), JSON.stringify(payload));
    const again = await drive(p, { resumeInterrupted: { attempt: 'attempt-000001', reason: 'should not bypass diagnostic' } });
    assert.equal(again.code, 'FINALIZATION_FAILED');
    assert.throws(() => runtime.claimRerun(p.root, p.cell, { cohort }), /FINALIZATION_FAILED/);
    assert.throws(() => runtime.writeRecord(p.root, p.cell, saved), /FINALIZATION_FAILED/);
    for (const mutate of [d => d.schema++, d => d.raw.path = '../record.json', d => d.raw.sha256 = '0'.repeat(64), d => d.recovery = 'retry automatically']) {
      const bad = structuredClone(out.diagnostic); mutate(bad);
      assert.ok(diagnostic.problems(bad, p.home).length);
    }
  } finally { usage.collect = originalCollect; claims.atomicWrite = originalWrite; }
}
// Secret-looking malformed fields are retained privately, never fingerprinted into
// the shareable diagnostic. This is a synthetic sentinel, not a real credential.
{
  const p = planned();
  const secret = 'sk-' + 'syntheticcredential'.repeat(2);
  const out = await evaluated('passed', () => drive(p, { fixtureCheckpoint: (boundary, { record }) => {
    if (boundary === 'pre-evaluation') record.unexpected = secret;
  } }));
  assert.equal(out.failed, true);
  assert.equal(out.diagnostic.raw.sha256, null);
  assert.match(out.diagnostic.raw.unavailable, /digest withheld/);
  assert.deepEqual(diagnostic.problems(out.diagnostic, p.home), []);
  assert.ok(!JSON.stringify(out.diagnostic).includes(secret));
  const rawFile = path.join(p.home, out.diagnostic.raw.path);
  assert.equal(JSON.parse(fs.readFileSync(rawFile)).unexpected, secret);
  assert.equal(fs.statSync(rawFile).mode & 0o777, 0o600);
}
// Failure while publishing either diagnostic file keeps the owner claim as well as
// any completed artifacts. Even a partial diagnostic directory blocks rerun allocation.
for (const target of ['record.json', 'diagnostic.json']) {
  const p = planned();
  const originalWrite = claims.atomicWrite;
  let out;
  try {
    out = await evaluated('passed', () => drive(p, { fixtureCheckpoint: (boundary, { record }) => {
      if (boundary === 'pre-evaluation') {
        record.unexpected = 'force validation failure';
        claims.atomicWrite = (file, bytes) => {
          if (file === path.join(p.home, diagnostic.DIRECTORY, target)) throw new Error('synthetic diagnostic publication failure');
          return originalWrite(file, bytes);
        };
      }
    } }));
  } finally { claims.atomicWrite = originalWrite; }
  assert.equal(out.failed, true);
  assert.equal(out.diagnosticFailure, true);
  assert.equal(runtime.readRecord(p.root, p.cell).status, 'pending');
  assert.equal(diagnostic.blocked(p.home), true);
  assert.ok(runtime.inspectClaim(p.root, p.cell));
  assert.equal((await drive(p)).code, 'RUN_BUSY');
  assert.equal(fs.readFileSync(path.join(p.home, 'attempts/attempt-000001/logs/S1.json'), 'utf8'), JSON.stringify(payload));
  if (target === 'diagnostic.json') assert.equal(JSON.parse(fs.readFileSync(path.join(p.home, diagnostic.DIRECTORY, 'record.json'))).unexpected, 'force validation failure');
  // Test-owned process and no children: release only this fixture claim after proving
  // the retention behavior. The diagnostic retry barrier remains in force.
  claims.release({ root: p.root, key: runtime.cellKey(p.cell), owner: runtime.inspectClaim(p.root, p.cell).owner });
  assert.equal((await drive(p)).code, 'FINALIZATION_FAILED');
}
console.log('benchmark terminal record tests passed');
