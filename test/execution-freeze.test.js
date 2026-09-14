// PRD v7 T-88 (R-02, S-06) / T-94 (R-08, S-24): the execution freeze. Mutating any
// input that determines what a session sees or how its result is judged changes the
// cohort identity, and a record from another cohort is reported under its own rather
// than re-evaluated — the specific v6 deviation this edition removes. Configuration
// capture is an allowlist: a secret-looking key or value is refused rather than
// redacted and carried, and environment variables contribute names only, never values.
// Frozen inputs are read from the tree and never followed out of it through a symlink.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir, write } from './helpers.js';

const require = createRequire(import.meta.url);
const freeze = require(path.join(repo, 'scripts/delivery-benchmark-v7/freeze.cjs'));
const effort = require(path.join(repo, 'scripts/delivery-benchmark-v7/effort.cjs'));

// A miniature study tree with every frozen input, so each one can be mutated alone.
function studyRoot() {
  const dir = tempDir();
  write(dir, 'protocol.md', '# protocol\n\nThe frozen design.\n');
  write(dir, 'harness/run.cjs', "'use strict';\nmodule.exports = { run: () => 0 };\n");
  write(dir, 'collector/effort.cjs', "'use strict';\nmodule.exports = { collect: () => [] };\n");
  write(dir, 'driver/live.sh', '#!/usr/bin/env bash\necho live\n');
  for (const id of ['cli-greenfield', 'ui-states']) {
    write(dir, `briefs/${id}/brief.md`, `## Task\n\nDo ${id}.\n\n## Prompt 1\n\nImplement ${id}.\n`);
    write(dir, `briefs/${id}/base.cjs`, `module.exports = { build: () => '${id}' };\n`);
    write(dir, `briefs/${id}/evaluator/evaluate.cjs`, `module.exports = { judge: () => 'passed' }; // ${id}\n`);
  }
  return dir;
}
const CAPS = { turns_per_session: 150, wall_clock_minutes: 30 };
const CONFIG = {
  values: { model: 'sonnet', tool: 'claude-code', tool_version: '2.1.267', node_version: 'v22.23.1', os: 'darwin', platform_release: '25.6.0', cwd_kind: 'scratch', permission_mode: 'bypassPermissions', max_turns: 150, wall_clock_minutes: 30 },
  env: ['PATH', 'HOME', 'CLAUDE_PROJECT_DIR'],
};
const spec = dir => ({ protocol: 'protocol.md', harness: 'harness', briefs: 'briefs', collector: 'collector', driver: 'driver', caps: CAPS, configuration: CONFIG });

// --- Every frozen input changes the cohort when it changes --------------------------
{
  const dir = studyRoot();
  const base = freeze.compute(dir, spec(dir));
  assert.match(base.cohort, /^[0-9a-f]{64}$/);
  assert.deepEqual(freeze.compute(dir, spec(dir)).cohort, base.cohort, 'the same tree freezes to the same identity');
  assert.deepEqual(base.order, ['protocol', 'harness', 'briefs', 'evaluators', 'collector', 'driver', 'caps', 'configuration']);

  // One mutation per frozen input, each on its own copy of the tree.
  const mutations = [
    ['protocol', d => write(d, 'protocol.md', '# protocol\n\nThe frozen design, amended.\n')],
    ['harness', d => write(d, 'harness/run.cjs', "'use strict';\nmodule.exports = { run: () => 1 };\n")],
    ['collector', d => write(d, 'collector/effort.cjs', "'use strict';\nmodule.exports = { collect: () => [1] };\n")],
    ['driver', d => write(d, 'driver/live.sh', '#!/usr/bin/env bash\necho live --retry\n')],
    ['briefs', d => write(d, 'briefs/cli-greenfield/brief.md', '## Task\n\nDo something else.\n\n## Prompt 1\n\nImplement it differently.\n')],
    ['evaluators', d => write(d, 'briefs/ui-states/evaluator/evaluate.cjs', "module.exports = { judge: () => 'failed' };\n")],
  ];
  for (const [name, mutate] of mutations) {
    const copy = studyRoot();
    mutate(copy);
    const after = freeze.compute(copy, spec(copy));
    assert.notEqual(after.cohort, base.cohort, `mutating the ${name} changes the cohort`);
    const diff = freeze.difference(base, after);
    assert.equal(diff.same, false);
    assert.ok(diff.changed.includes(name), `the difference names ${name} (saw ${diff.changed.join(', ')})`);
  }
  // A changed cap is a different experiment, even with identical files.
  const capped = freeze.compute(dir, { ...spec(dir), caps: { turns_per_session: 50, wall_clock_minutes: 30 } });
  assert.notEqual(capped.cohort, base.cohort, 'a changed cap changes the cohort');
  assert.deepEqual(freeze.difference(base, capped).changed, ['caps']);
  // ...and so is a changed configuration fingerprint.
  const remodelled = freeze.compute(dir, { ...spec(dir), configuration: { ...CONFIG, values: { ...CONFIG.values, model: 'opus' } } });
  assert.notEqual(remodelled.cohort, base.cohort, 'a changed model changes the cohort');
  assert.deepEqual(freeze.difference(base, remodelled).changed, ['configuration']);
  // Adding an environment variable name changes it too: the driver's environment is
  // part of what the session saw.
  const extraEnv = freeze.compute(dir, { ...spec(dir), configuration: { ...CONFIG, env: [...CONFIG.env, 'NO_COLOR'] } });
  assert.notEqual(extraEnv.cohort, base.cohort);

  // A changed task and a changed judgment are reported as different things.
  const taskChanged = studyRoot();
  write(taskChanged, 'briefs/cli-greenfield/brief.md', '## Task\n\nDifferent.\n\n## Prompt 1\n\nDo it.\n');
  assert.deepEqual(freeze.difference(base, freeze.compute(taskChanged, spec(taskChanged))).briefs, [{ id: 'cli-greenfield', change: 'task changed' }]);
  const judgeChanged = studyRoot();
  write(judgeChanged, 'briefs/cli-greenfield/evaluator/evaluate.cjs', "module.exports = { judge: () => 'rejected' };\n");
  assert.deepEqual(freeze.difference(base, freeze.compute(judgeChanged, spec(judgeChanged))).briefs, [{ id: 'cli-greenfield', change: 'evaluator changed' }]);
  const added = studyRoot();
  write(added, 'briefs/new-brief/brief.md', '## Task\n\nNew.\n\n## Prompt 1\n\nDo it.\n');
  assert.deepEqual(freeze.difference(base, freeze.compute(added, spec(added))).briefs, [{ id: 'new-brief', change: 'added' }]);

  // A rename changes the digest as surely as an edit: the path is part of the identity.
  const renamed = studyRoot();
  fs.renameSync(path.join(renamed, 'harness/run.cjs'), path.join(renamed, 'harness/drive.cjs'));
  assert.notEqual(freeze.compute(renamed, spec(renamed)).cohort, base.cohort, 'renaming a frozen file changes the cohort');
}

// --- A record belongs to the cohort it was run under, and is not re-evaluated --------
{
  const dir = studyRoot();
  const first = freeze.compute(dir, spec(dir));
  const record = { cohort: first.cohort };
  assert.deepEqual(freeze.belongs(record, first), { ok: true, reason: null });

  // The v6 mistake: the harness changes mid-study and earlier runs are re-judged.
  write(dir, 'harness/run.cjs', "'use strict';\nmodule.exports = { run: () => 2 };\n");
  const second = freeze.compute(dir, spec(dir));
  const verdict = freeze.belongs(record, second);
  assert.equal(verdict.ok, false, 'an earlier record does not belong to the new cohort');
  assert.match(verdict.reason, /belongs to the study it was run under and is not re-evaluated here/);

  // The effort validator refuses to report it under the new freeze, by code.
  const r = effortRecord(first.cohort, first);
  assert.deepEqual(effort.problems(r, { frozen: first }), [], `the record validates under its own freeze: ${JSON.stringify(effort.problems(r, { frozen: first }))}`);
  const wrong = effort.problems(r, { frozen: second });
  assert.ok(wrong.some(p => p.code === 'COHORT_CHANGED'), 'and is refused under another');
  assert.match(wrong.find(p => p.code === 'COHORT_CHANGED').detail, /belongs to another cohort and is not re-evaluated here/);
  // A pending record from another cohort is refused too: the identity is checked
  // before anything is measured, not only when a verdict is claimed.
  assert.ok(effort.problems({ ...r, status: 'pending', reason: null, evaluation: null }, { frozen: second }).some(p => p.code === 'COHORT_CHANGED'));
}
function effortRecord(cohort, frozen = null) {
  const HEX = 'a'.repeat(64), SHA = 'b'.repeat(40);
  if (!frozen) { const dir = studyRoot(); frozen = freeze.compute(dir, spec(dir)); }
  const r = effort.empty({
    run: effort.runId('cli-greenfield', 1, 'plain'), cohort, brief: 'cli-greenfield', arm: 'plain', repetition: 1,
    provenance: { base: SHA, kit: null, kit_source: null, prompts: HEX, driver: HEX, collector: HEX, evaluator: HEX, protocol: frozen.inputs.protocol, caps: HEX, configuration: HEX },
  });
  r.status = 'valid';
  r.events = [{ kind: 'session', id: 's1', started: '2026-09-14T10:00:00Z', ended: '2026-09-14T10:20:00Z' }];
  r.reported = { tokens: 1000, cost_usd: 0.5, provider_minutes: 19 };
  r.evaluation = { candidate: SHA, evaluator: HEX, outcome: 'accepted', checks: [{ id: 'held-out', result: 'passed', independent: true }] };
  return r;
}

// --- Secrets never reach a record, redacted or hashed -------------------------------
{
  // Keys outside the allowlist are dropped and named, not captured.
  const f = freeze.fingerprint({ model: 'sonnet', ANTHROPIC_API_KEY: 'sk-ant-abcdefghijklmnopqrstuvwx', session_token: 'abc', unrelated: 1 }, { env: ['PATH'] });
  assert.deepEqual(Object.keys(f.configuration), ['model'], 'only allowlisted keys are captured');
  const reasons = Object.fromEntries(f.rejected.map(r => [r.key, r.reason]));
  assert.equal(reasons.ANTHROPIC_API_KEY, 'name suggests a credential');
  assert.equal(reasons.session_token, 'name suggests a credential');
  assert.equal(reasons.unrelated, 'not in the configuration allowlist');
  const serialized = JSON.stringify(f);
  assert.ok(!serialized.includes('sk-ant-abcdefghijklmnopqrstuvwx'), 'the secret value never reaches the fingerprint');

  // A canary in an ALLOWLISTED field is refused rather than hashed: a digest of a
  // secret is still an oracle for it.
  for (const canary of [
    'sk-ant-api03-CANARYCANARYCANARYCANARY',
    'sk-CANARYCANARYCANARYCANARY',
    'ghp_CANARYCANARYCANARYCANARYCANARY0',
    'AKIACANARYCANARYCANA',
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJDQU5BUlkifQ.x',
    '-----BEGIN RSA PRIVATE KEY-----',
  ]) {
    assert.ok(freeze.secretIn(canary), `${canary.slice(0, 12)}… is recognised as a credential`);
    const poisoned = freeze.fingerprint({ model: canary, tool: 'claude-code' }, {});
    assert.ok(!('model' in poisoned.configuration), 'a secret-looking value is not captured');
    assert.ok(poisoned.rejected.some(r => r.key === 'model'), 'and is reported as rejected');
    assert.ok(!JSON.stringify(poisoned).includes(canary), 'and never appears in the fingerprint');
  }
  // Ordinary values are unaffected.
  assert.ok(!freeze.secretIn('sonnet'));
  assert.ok(!freeze.secretIn('bypassPermissions'));

  // Environment variables contribute names only, and the order they arrive in does not
  // change the identity.
  const a = freeze.fingerprint({ model: 'sonnet' }, { env: ['HOME', 'PATH'] });
  const b = freeze.fingerprint({ model: 'sonnet' }, { env: ['PATH', 'HOME', 'PATH'] });
  assert.equal(a.digest, b.digest, 'environment names are a set, sorted');
  assert.deepEqual(a.env_names, ['HOME', 'PATH']);
  const c = freeze.fingerprint({ tool: 'claude-code', model: 'sonnet' }, {});
  const d = freeze.fingerprint({ model: 'sonnet', tool: 'claude-code' }, {});
  assert.equal(c.digest, d.digest, 'key order does not change the fingerprint');
  // A value that is not a variable name is rejected rather than recorded.
  const bogus = freeze.fingerprint({ model: 'sonnet' }, { env: ['PATH', 'ANTHROPIC_API_KEY=sk-ant-secretsecretsecret'] });
  assert.ok(bogus.rejected.some(r => /not an environment variable name/.test(r.reason)));
  assert.ok(!JSON.stringify(bogus).includes('sk-ant-secretsecretsecret'));
}

// --- Frozen inputs are read from the tree, never followed out of it -----------------
{
  const dir = studyRoot();
  const outside = tempDir();
  write(outside, 'elsewhere.cjs', "module.exports = { run: () => 'outside' };\n");
  fs.symlinkSync(path.join(outside, 'elsewhere.cjs'), path.join(dir, 'harness/linked.cjs'));
  assert.throws(() => freeze.compute(dir, spec(dir)), /is a symbolic link/, 'a symlinked frozen input is refused, not followed');

  const clean = studyRoot();
  for (const escape of ['../outside', '/etc/passwd', 'a/../../b', 'a\\b', '']) {
    assert.ok(freeze.unsafe(escape), `${JSON.stringify(escape)} is rejected as a path`);
    assert.throws(() => freeze.digestOf(clean, escape), /must be|backslashes|normalized/);
  }
  assert.equal(freeze.unsafe('briefs/cli-greenfield'), null, 'an ordinary relative path is accepted');
}

// --- Report replay is deterministic and makes no call -------------------------------
{
  const r = effortRecord('c'.repeat(64));
  const once = effort.report(r);
  const twice = effort.report(JSON.parse(JSON.stringify(r)));
  assert.deepEqual(once, twice, 'replaying a report from stored events is deterministic');
  assert.equal(once.active_minutes, 20);
  // The projection reads only the record: no network, no model, no filesystem.
  const source = fs.readFileSync(path.join(repo, 'scripts/delivery-benchmark-v7/effort.cjs'), 'utf8');
  for (const forbidden of ['node:http', 'node:https', 'node:net', 'fetch(', 'spawn', 'execFile', "require('node:fs')"]) {
    assert.ok(!source.includes(forbidden), `the effort projection does not use ${forbidden}`);
  }
}

console.log('execution freeze tests passed');
