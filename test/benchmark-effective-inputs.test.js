// T-101: observed identities, refusal effects and no-model fixtures.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { repo, tempDir, write } from './helpers.js';
const require = createRequire(import.meta.url);
const effective = require('../scripts/delivery-benchmark-v7/effective.cjs');
const freeze = require('../scripts/delivery-benchmark-v7/freeze.cjs');
const runner = require('../scripts/delivery-benchmark-v7/orchestrator.cjs');
const schedule = require('../scripts/delivery-benchmark-v7/schedule.cjs');
function fixture() {
  const root = tempDir(), inputRoot = tempDir();
  write(root, 'protocol.md', 'study');
  write(root, 'scripts/delivery-benchmark-v7/helper.cjs', 'module.exports = 1;');
  write(root, 'collector.cjs', 'collector');
  write(root, 'driver.sh', 'driver');
  write(root, 'briefs/one/brief.md', 'brief');
  write(root, 'briefs/one/evaluator/evaluate.cjs', 'evaluate');
  write(inputRoot, 'kit.tgz', 'fixture archive identity');
  write(inputRoot, 'browser/index.cjs', "module.exports = require('./helper.cjs');\n");
  write(inputRoot, 'browser/helper.cjs', 'module.exports = {};\n');
  write(inputRoot, 'runtime/browser', 'browser binary');
  const executable = path.join(inputRoot, 'version-probe');
  fs.writeFileSync(executable, effective.versionProbeFixture('2.1.273'), { mode: 0o755 });
  const spec = {
    protocol: 'protocol.md', harness: 'scripts/delivery-benchmark-v7', briefs: 'briefs',
    collector: 'collector.cjs', driver: 'driver.sh', caps: { turns_per_session: 150, wall_clock_minutes: 30 },
    configuration: { values: { model: 'sonnet' }, env: [] },
  };
  const input = {
    model: 'claude-example-1', tool: { executable, version: '2.1.273', kind: 'version-probe-fixture' },
    caps: { turns_per_session: 10, wall_clock_minutes: 5, spend_usd: 2.5 },
    kit: { path: 'kit.tgz', commit: 'a'.repeat(40) },
    browser: { entry: 'browser/index.cjs', roots: ['browser'], runtime: { name: 'chromium', version: '1.2.3', path: 'runtime' } },
    configuration: { permission_mode: 'manual', cwd_kind: 'scratch' },
  };
  const bundle = () => ({ root, spec, inputRoot, input, manifest: effective.resolve(root, spec, input, { inputRoot }) });
  return { root, inputRoot, spec, input, bundle };
}
function snapshot(root) {
  const result = {};
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else result[path.relative(root, full)] = fs.readFileSync(full).toString('base64');
    }
  }
  visit(root); return result;
}
{
  const f = fixture();
  const first = f.bundle();
  assert.equal(first.manifest.schema, 2);
  assert.equal(first.manifest.effective.tool.kind, 'version-probe-fixture');
  assert.equal(effective.assertCurrent(first).cohort, first.manifest.cohort);
  assert.equal(spawnSync(f.input.tool.executable, ['-p', 'bill me']).status, 99, 'the version fixture cannot execute a session');
  assert.equal(effective.canonical({ a: { b: 1, a: 2 }, b: 1 }), effective.canonical({ b: 1, a: { a: 2, b: 1 } }));
  for (const change of [
    x => { x.model = 'claude-example-2'; },
    x => { x.caps.turns_per_session = 20; },
    x => { x.caps.wall_clock_minutes = 10; },
    x => { x.caps.spend_usd = 5; },
    x => { x.kit.commit = 'b'.repeat(40); },
    x => { x.configuration.permission_mode = 'plan'; },
    x => { x.browser = null; },
  ]) {
    const input = structuredClone(f.input); change(input);
    assert.notEqual(effective.resolve(f.root, f.spec, input, { inputRoot: f.inputRoot }).cohort, first.manifest.cohort);
  }
  for (const [base, file] of [[f.inputRoot, 'kit.tgz'], [f.inputRoot, 'browser/helper.cjs'], [f.inputRoot, 'runtime/browser'], [f.root, 'scripts/delivery-benchmark-v7/new-helper.cjs']]) {
    const full = path.join(base, file), previous = fs.existsSync(full) ? fs.readFileSync(full) : null;
    fs.writeFileSync(full, previous ? `${previous}\n// changed` : '// newly introduced execution helper');
    assert.throws(() => effective.assertCurrent(first), /changed/);
    if (previous) fs.writeFileSync(full, previous); else fs.unlinkSync(full);
  }
  const version = structuredClone(f.input); version.tool.version = '2.1.274';
  fs.writeFileSync(version.tool.executable, effective.versionProbeFixture('2.1.274'));
  assert.notEqual(effective.resolve(f.root, f.spec, version, { inputRoot: f.inputRoot }).cohort, first.manifest.cohort);
}
{
  const f = fixture();
  for (const value of [0, -1, Infinity, NaN, '10', null]) {
    const input = structuredClone(f.input); input.caps.turns_per_session = value;
    assert.throws(() => effective.resolve(f.root, f.spec, input, { inputRoot: f.inputRoot }), /positive/);
  }
  for (const change of [
    x => { x.model = 'sonnet'; }, x => { x.model = 'claude-sonnet-4-latest'; },
    x => { x.kit.path = '../escape'; }, x => { x.configuration.extra = 'secret-canary'; },
    x => { x.configuration.permission_mode = { mode: 'manual' }; },
    x => { x.tool.kind = 'unknown'; },
  ]) {
    const input = structuredClone(f.input); change(input);
    assert.throws(() => effective.resolve(f.root, f.spec, input, { inputRoot: f.inputRoot }));
  }
  const secret = 'sk-ant-123456789012345678901234567890';
  const input = structuredClone(f.input); input.model = secret;
  try { effective.resolve(f.root, f.spec, input, { inputRoot: f.inputRoot }); assert.fail('secret accepted'); }
  catch (error) { assert.ok(!error.message.includes(secret)); }
  const outside = tempDir(); write(outside, 'file', 'private instruction canary');
  fs.symlinkSync(outside, path.join(f.inputRoot, 'linked'));
  assert.throws(() => effective.tree(f.inputRoot, 'linked/file'), /symbolic/);
  assert.throws(() => freeze.digestOf(f.inputRoot, 'linked/file'), /symbolic/);
  write(f.inputRoot, 'browser/.env', secret);
  assert.throws(() => effective.browserIdentity(f.inputRoot, f.input.browser), /protected/);
  fs.unlinkSync(path.join(f.inputRoot, 'browser/.env'));
  for (const source of ["require('../outside.cjs')", "import './outside.js'", "module.require('./helper.cjs')", "require.resolve('./helper.cjs')", "require(process.env.MODULE)", "require('external-package')"]) {
    write(f.inputRoot, 'browser/index.cjs', source);
    assert.throws(() => effective.browserIdentity(f.inputRoot, f.input.browser), /browser:/);
  }
}
{
  for (const args of [['--unknown'], ['--runs'], ['--runs', '--plan-only'], ['--runs', 'x', '--runs', 'y'], ['--max-turns', 'Infinity'], ['--max-turns', '1.2'], ['--wall-clock-minutes', '0'], ['--max-turns', '-2'], ['--max-turns', '1e3']]) {
    assert.throws(() => effective.parseArgs(args));
  }
  assert.equal(effective.parseArgs(['--max-budget-usd', '1.25'])['max-budget-usd'], 1.25);
}
{
  const f = fixture(), bundle = f.bundle(), runs = tempDir();
  const opts = { cohort: bundle.manifest.cohort, ids: ['cli-greenfield'], effective: bundle };
  const planned = runner.plan(runs, opts);
  // Remove a cell: replanning must not recreate it when any stored cell disagrees.
  fs.unlinkSync(runner.recordPath(runs, planned.cells[1]));
  const before = snapshot(runs);
  f.input.model = 'claude-example-2';
  const changed = f.bundle();
  assert.throws(() => runner.plan(runs, { ...opts, cohort: changed.manifest.cohort, effective: changed }), /different/);
  assert.deepEqual(snapshot(runs), before);
  assert.throws(() => runner.plan(runs, opts), /changed/);
  assert.deepEqual(snapshot(runs), before);
  const cell = planned.cells[0];
  const result = await runner.driveRun(runs, cell, { cohort: bundle.manifest.cohort, spendingCap: true });
  assert.equal(result.refused, true);
  assert.match(result.detail, /effective manifest/);
  assert.deepEqual(snapshot(runs), before, 'historical direct API cannot prepare or launch');
  const session = runner.driveSession({ spendingCap: true, cohort: bundle.manifest.cohort, logDir: path.join(runs, 'never-created') });
  assert.equal(session.refused, true);
  assert.deepEqual(snapshot(runs), before);
}
{
  // Legacy manifests/readers remain available under their actual original inputs.
  const f = fixture(); const historical = freeze.compute(f.root, f.spec);
  assert.equal(historical.schema, 1);
  assert.equal(freeze.belongs({ cohort: historical.cohort }, historical).ok, true);
  assert.throws(() => effective.assertCurrent({ manifest: historical }), /historical/);
}
{
  const f = fixture(), runs = tempDir(), sentinel = path.join(f.inputRoot, 'LOADED');
  write(f.inputRoot, 'browser/index.cjs', `require('node:fs').writeFileSync(${JSON.stringify(sentinel)}, 'side effect'); module.exports = {};`);
  const inputFile = path.join(f.inputRoot, 'inputs.json'); fs.writeFileSync(inputFile, JSON.stringify(f.input));
  const result = spawnSync(process.execPath, [path.join(repo, 'scripts/delivery-benchmark-v7/orchestrator.cjs'), '--runs', runs, '--execution-inputs', inputFile, '--input-root', f.inputRoot, '--plan-only'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(sentinel), false, 'planning hashes browser source without executing it');
  const before = snapshot(runs);
  const drift = spawnSync(process.execPath, [path.join(repo, 'scripts/delivery-benchmark-v7/orchestrator.cjs'), '--runs', runs, '--execution-inputs', inputFile, '--input-root', f.inputRoot, '--model', 'claude-example-2', '--max-turns', '20', '--plan-only'], { encoding: 'utf8' });
  assert.notEqual(drift.status, 0);
  assert.deepEqual(snapshot(runs), before);
  assert.equal(fs.existsSync(sentinel), false);
}
console.log('benchmark effective input tests passed');
