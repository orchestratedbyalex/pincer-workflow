import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const usage = require('../scripts/delivery-benchmark-v7/usage.cjs');
const effort = require('../scripts/delivery-benchmark-v7/effort.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pincer-usage-'));
const payload = () => ({
  type: 'result', subtype: 'success', total_cost_usd: 1.25,
  duration_api_ms: 120000, duration_ms: 999999,
  usage: { input_tokens: 999999 },
  modelUsage: { model: { inputTokens: 100, outputTokens: 10, cacheReadInputTokens: 7, cacheCreationInputTokens: 3 } },
});
const record = () => ({ schema: 8, unavailable: {}, attempts: [
  { id: 'attempt-000001', status: 'interrupted', sessions: [{ id: 'attempt-000001:S1', payload: 'one.json', status: 'unavailable' }] },
  { id: 'attempt-000002', status: 'completed', sessions: [{ id: 'attempt-000002:S1', payload: 'two.json', status: 'completed' }] },
] });
const write = (name, value) => fs.writeFileSync(path.join(root, name), typeof value === 'string' ? value : JSON.stringify(value));
function collect() { return usage.collect(root, record()); }
try {
  write('one.json', payload());
  for (const missing of [null, '{', { ...payload(), total_cost_usd: undefined }]) {
    fs.rmSync(path.join(root, 'two.json'), { force: true });
    if (missing !== null) write('two.json', missing);
    const result = collect();
    assert.equal(result.reported.cost_usd, null);
    assert.equal(result.measurement.metrics.cost_usd.measured_subtotal, 1.25);
    assert.equal(result.measurement.metrics.cost_usd.missing[0].session, 'attempt-000002:S1');
    if (missing === null || missing === '{') {
      assert.equal(result.reported.tokens, null);
      assert.equal(result.measurement.metrics.tokens.measured_subtotal, 120);
    } else {
      assert.equal(result.reported.tokens, 240, 'metrics have independent completeness');
    }
  }
  write('two.json', payload());
  const complete = collect();
  assert.deepEqual(complete.reported, { tokens: 240, cost_usd: 2.5, provider_minutes: 4 });
  assert.deepEqual(collect(), complete, 'offline regeneration is deterministic');
  const r = record();
  usage.apply(r, complete);
  assert.deepEqual(usage.problems(r), []);
  for (const mutate of [
    value => { value.reported.cost_usd = 1.25; },
    value => { value.measurement.metrics.tokens.measured_subtotal = 120; },
    value => { value.measurement.sessions.pop(); },
    value => { value.measurement.sessions[0].metrics.tokens.reason = 'invented'; },
    value => { value.measurement.profile = 'unrecognized'; },
  ]) {
    const changed = structuredClone(r);
    mutate(changed);
    assert.equal(usage.problems(changed)[0].code, 'USAGE_INVALID');
  }
  const zero = payload();
  zero.total_cost_usd = 0;
  zero.duration_api_ms = 0;
  for (const key of Object.keys(zero.modelUsage.model)) zero.modelUsage.model[key] = 0;
  assert.deepEqual(Object.values(usage.parse(zero)).map(item => item.value), [0, 0, 0]);
  write('one.json', zero);
  write('two.json', zero);
  assert.deepEqual(collect().reported, { tokens: 0, cost_usd: 0, provider_minutes: 0 });
  write('one.json', '{}');
  write('two.json', '{}');
  assert.equal(collect().measurement.metrics.cost_usd.measured_subtotal, null);
  assert.equal(collect().measurement.metrics.cost_usd.measured_sessions, 0);
  const huge = payload();
  huge.total_cost_usd = Number.MAX_VALUE;
  write('one.json', huge);
  write('two.json', huge);
  assert.equal(collect().reported.cost_usd, null);
  assert.match(collect().unavailable.cost_usd, /numeric range/);
  write('one.json', payload());
  write('two.json', payload());
  zero.subtype = 'error_during_execution';
  assert.deepEqual(Object.values(usage.parse(zero)).map(item => item.value), [null, null, null]);
  const twoModels = payload();
  twoModels.modelUsage.other = { ...twoModels.modelUsage.model };
  assert.equal(usage.parse(twoModels).tokens.value, 240);
  for (const invalid of [-1, Infinity, NaN, '12', Number.MAX_SAFE_INTEGER + 1, undefined]) {
    const p = payload();
    p.modelUsage.model.inputTokens = invalid;
    assert.equal(usage.parse(p).tokens.value, null);
  }
  for (const invalid of [-1, Infinity, NaN, '1', undefined]) {
    const p = payload();
    p.total_cost_usd = invalid;
    p.duration_api_ms = invalid;
    assert.equal(usage.parse(p).cost_usd.value, null);
    assert.equal(usage.parse(p).provider_minutes.value, null);
  }
  assert.equal(usage.parse({ ...payload(), subtype: 'error_max_turns', is_error: true }).cost_usd.value, 1.25, 'failed final results can retain accounting');
  assert.equal(usage.parse({ ...payload(), is_error: true }).tokens.value, null);
  assert.equal(usage.parse({ ...payload(), subtype: 'error_max_turns', is_error: false }).tokens.value, null);
  const inconsistent = payload();
  inconsistent.modelUsage.model.costUSD = 50;
  assert.equal(usage.parse(inconsistent).cost_usd.value, null);
  assert.equal(usage.parse({ ...payload(), subtype: 'new_unknown_result' }).tokens.value, null);
  assert.equal(usage.parse({ total_cost_usd: 1.25, usage: { input_tokens: 120 }, duration_ms: 1000 }).tokens.value, null);
  const overflow = payload();
  overflow.modelUsage.model.inputTokens = Number.MAX_SAFE_INTEGER;
  assert.equal(usage.parse(overflow).tokens.value, null);
  const historical = record();
  historical.attempts[0].origin = 'legacy';
  const historicUsage = usage.collect(root, historical);
  assert.equal(historicUsage.measurement.coverage, 'legacy-attempt-coverage-unknown');
  assert.equal(historicUsage.reported.cost_usd, null);
  assert.equal(historicUsage.measurement.metrics.cost_usd.measured_subtotal, 2.5);
  assert.match(historicUsage.unavailable.cost_usd, /Historical attempt coverage/);
  usage.apply(historical, historicUsage);
  assert.deepEqual(usage.problems(historical), []);
  // This refusal precedes filesystem access, even for a nonexistent target.
  const originalRead = fs.readFileSync;
  const originalStat = fs.lstatSync;
  try {
    fs.readFileSync = () => { throw new Error('must not read protected input'); };
    fs.lstatSync = () => { throw new Error('must not stat protected input'); };
    for (const protectedPath of ['.env', 'logs/.env.production', '.ssh/key.json', '.aws/config', 'credentials.json', 'auth.json']) {
      const protectedRecord = record();
      protectedRecord.attempts[0].sessions[0].payload = protectedPath;
      assert.throws(() => usage.collect(root, protectedRecord), /protected configuration/);
      const forged = structuredClone(r);
      forged.attempts[0].sessions[0].payload = protectedPath;
      forged.measurement.sessions[0].payload = protectedPath;
      assert.match(usage.problems(forged)[0].detail, /protected configuration/);
    }
  } finally {
    fs.readFileSync = originalRead;
    fs.lstatSync = originalStat;
  }
  const duplicate = record();
  duplicate.attempts[1].sessions[0].payload = 'one.json';
  assert.throws(() => usage.collect(root, duplicate), /unique/);
  duplicate.attempts[1].sessions[0].payload = '../escape.json';
  assert.throws(() => usage.collect(root, duplicate), /relative/);
  fs.symlinkSync(path.join(root, 'one.json'), path.join(root, 'linked.json'));
  duplicate.attempts[1].sessions[0].payload = 'linked.json';
  assert.throws(() => usage.collect(root, duplicate), /Symbolic/);
  fs.linkSync(path.join(root, 'one.json'), path.join(root, 'hardlink.json'));
  duplicate.attempts[1].sessions[0].payload = 'hardlink.json';
  assert.throws(() => usage.collect(root, duplicate), /alias/);
  const secret = 'sk-ant-' + 'a'.repeat(40);
  write('two.json', { ...payload(), result: secret });
  const withheld = collect();
  assert.equal(withheld.measurement.sessions[1].sha256, null);
  assert.equal(JSON.stringify(withheld).includes(secret), false);
  assert.equal(withheld.reported.cost_usd, null);
  assert.match(withheld.unavailable.cost_usd, /secret material/);
  write('S1.json', payload());
  const legacy = usage.collect(root, { schema: 7 }, ['S1', 'S2']);
  assert.equal(legacy.reported.tokens, null);
  assert.equal(legacy.measurement.coverage, 'explicit-legacy-session-list');
  const legacyRecord = { schema: 7, unavailable: {} };
  usage.apply(legacyRecord, legacy);
  assert.deepEqual(usage.problems(legacyRecord), []);
  const report = (status, result) => ({
    arm: 'plain', status, outcome: 'accepted', measurement: result.measurement,
    ...result.reported, stages: { review: null }, active_minutes: null, interventions: {},
  });
  const aggregated = effort.aggregate([report('valid', complete), report('invalid', withheld)]).arms.plain;
  assert.deepEqual(aggregated.acceptance, { accepted: 1, of: 1 });
  assert.equal(aggregated.cost_usd.total, null);
  assert.equal(aggregated.cost_usd.measured_subtotal, 3.75, 'failed-run observed spend retained');
  assert.equal(effort.aggregate([report('valid', complete), report('invalid', complete)]).arms.plain.cost_usd.total, 5);
  const mixed = effort.aggregate([report('valid', complete), report('valid', legacy)]).arms.plain;
  assert.equal(mixed.cost_usd.total, null);
  assert.match(mixed.cost_usd.limitation, /Legacy/);
  console.log('benchmark usage completeness tests passed');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
