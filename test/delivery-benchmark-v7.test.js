// PRD v7 T-94 (R-08, S-22..S-24): the v7 three-arm benchmark. Every brief's working
// control passes its held-out checks and every injected fault fails the one check it was
// built to fail, so a check that stops failing has stopped testing something. The
// schedule covers 72 unique cells in balanced arm order with matched inputs, and a strict
// run that did not adopt is a protocol failure rather than evidence about strict Pincer.
// Changing any frozen input starts a new cohort and leaves earlier records readable under
// their own. The v6 edition is untouched and still loads. Nothing here calls a model: the
// drivers are controlled fixtures and the browser adapter is injected.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo, tempDir } from './helpers.js';

const require = createRequire(import.meta.url);
const V7 = path.join(repo, 'scripts/delivery-benchmark-v7');
const briefs = require(path.join(V7, 'briefs.cjs'));
const schedule = require(path.join(V7, 'schedule.cjs'));
const harness = require(path.join(V7, 'harness.cjs'));
const effort = require(path.join(V7, 'effort.cjs'));
const freeze = require(path.join(V7, 'freeze.cjs'));
const { REPO, SPEC } = require(path.join(V7, 'freeze-spec.cjs'));
const frozen = JSON.parse(fs.readFileSync(briefs.FROZEN, 'utf8'));

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'v7-benchmark-'));
const IDS = ['brownfield-maintenance', 'bugfix-brownfield', 'cli-greenfield', 'handoff-two-changes', 'integration-untested', 'revision-recovery', 'scope-revision', 'ui-states'];

// A deterministic stand-in for a browser, injected so the seam is testable offline. It
// encodes the one fact the ui-states brief turns on: a browser refuses to activate a
// button carrying the `disabled` attribute, and `aria-disabled` alone does not stop a
// click. A real adapter drives a real browser; this one is honest about being neither.
const fakeBrowser = {
  name: 'fake-headless', version: '1.0.0',
  observe({ page, expectations }) {
    if (!expectations.clickMustNotFire) return { ok: false, detail: 'unknown expectation' };
    const m = /<button[^>]*>/.exec(page);
    if (!m) return { ok: false, detail: 'no button in the rendered page' };
    return /\sdisabled(\s|>|=)/.test(m[0])
      ? { ok: true, detail: 'the browser refused to activate the button' }
      : { ok: false, detail: `the browser activated the button: ${m[0]} carries no disabled attribute` };
  },
};

// Build one candidate of one brief and judge it with the held-out evaluator.
async function judge(id, variant, { browser = fakeBrowser } = {}) {
  const dir = path.join(ROOT, id, variant);
  const ws = path.join(dir, 'workspace');
  const scratch = path.join(dir, 'scratch');
  fs.mkdirSync(scratch, { recursive: true });
  const brief = briefs.loadBrief(id);
  // The two briefs that carry a preservation check get an operator edit to preserve.
  const unrelated = brief.controls.faults && Object.values(brief.controls.faults).includes('unrelated-edits')
    ? { 'scratch.local.md': { kind: 'untracked', content: '# my scratch notes\n' } }
    : null;
  const prepared = harness.prepare(ws, id, { unrelatedEdits: unrelated });
  const candidate = brief.controls.apply(ws, variant, harness.LIB, { date: '2026-09-14T00:00:00Z' });
  const result = await harness.evaluateCandidate({
    id, workspace: ws, candidate, browser, scratch,
    record: { workspace: { unrelated_edits: prepared.unrelated_edits } },
  });
  return { ...result, brief, workspace: ws, candidateDir: path.join(scratch, 'candidate') };
}
const failedIds = result => result.checks.filter(c => c.result !== 'passed').map(c => c.id);

// --- The edition: eight briefs, two of them long-form, held-out assets held out --------
{
  assert.deepEqual(briefs.briefIds(), IDS, 'the eight briefs of the v7 edition');
  assert.deepEqual(Object.keys(frozen.briefs).sort(), IDS, 'the frozen manifest names the same eight');

  for (const id of IDS) {
    const b = briefs.loadBrief(id);
    for (const f of ['brief.md', 'base.cjs', 'controls.cjs', 'evaluator/evaluate.cjs']) {
      assert.ok(fs.existsSync(path.join(briefs.BRIEFS_DIR, id, f)), `${id}/${f} exists`);
    }
    assert.ok(b.task.length > 200, `${id}: a substantive task`);
    assert.ok(b.prompts.length >= 1 && b.prompts.every(p => p.prompt.length > 40), `${id}: substantive prompts`);
    // An implementation workspace may receive brief.md and nothing else.
    assert.deepEqual(briefs.workspaceFiles(id), ['brief.md'], `${id}: only brief.md is not held out`);
    assert.deepEqual(briefs.heldOutOf(id), ['base.cjs', 'controls.cjs', 'evaluator'], `${id}: the held-out assets`);
  }
  // The six v6 task types are carried over by intent, and the two long-form briefs are new.
  for (const id of ['cli-greenfield', 'bugfix-brownfield', 'integration-untested', 'ui-states', 'scope-revision', 'handoff-two-changes']) {
    assert.ok(IDS.includes(id), `the v6 task type ${id} is carried over`);
  }
  for (const id of briefs.LONG_FORM) {
    const b = briefs.loadBrief(id);
    assert.ok(b.sessions >= 3, `${id}: at least three sessions (has ${b.sessions})`);
    assert.ok(b.changes >= 2, `${id}: at least two changes (declares ${b.changes})`);
  }
  // Held-out assets never reach a workspace, checked on a real prepared tree rather than
  // asserted about the loader.
  const ws = path.join(ROOT, 'containment', 'workspace');
  harness.prepare(ws, 'cli-greenfield', {});
  for (const held of ['evaluator', 'controls.cjs', 'base.cjs']) {
    assert.ok(!fs.existsSync(path.join(ws, held)), `a prepared workspace has no ${held}`);
  }
  assert.ok(fs.existsSync(path.join(ws, 'BRIEF.md')), 'but it does have the brief');
}

// --- S-22: working controls pass, and each fault fails its own check --------------------
{
  for (const id of IDS) {
    const brief = briefs.loadBrief(id);
    for (const variant of brief.controls.accepted) {
      const result = await judge(id, variant);
      assert.equal(result.outcome, 'accepted', `${id}/${variant}: expected accepted, got ${result.outcome} (failed: ${failedIds(result).join(', ')})`);
      assert.ok(result.checks.some(c => c.independent && c.kind === 'acceptance'), `${id}/${variant}: acceptance rests on a held-out check`);
    }
    for (const [variant, expected] of Object.entries(brief.controls.faults)) {
      const result = await judge(id, variant);
      assert.notEqual(result.outcome, 'accepted', `${id}/${variant}: a faulty candidate was accepted`);
      const failed = failedIds(result);
      assert.ok(failed.includes(expected), `${id}/${variant}: expected ${expected} to fail, saw ${failed.join(', ') || 'nothing'}`);
    }
  }

  // Evidence binding, in detail. The v6 helper accepted a whole `.prd/evidence/` directory
  // after an ancestor candidate; this edition rejects an artifact the manifest does not
  // list, which is the loophole the v6 assessment asked to close before the binding check
  // is used to support stronger claims.
  const stale = await judge('cli-greenfield', 'stale-evidence');
  const staleCheck = stale.checks.find(c => c.id === 'evidence-binding');
  assert.equal(staleCheck.result, 'failed');
  assert.match(staleCheck.detail, /names candidate/, 'the stale case names the mismatch');
  const unlisted = await judge('cli-greenfield', 'unlisted-artifact');
  const unlistedCheck = unlisted.checks.find(c => c.id === 'evidence-binding');
  assert.equal(unlistedCheck.result, 'failed');
  assert.match(unlistedCheck.detail, /is not listed in .*manifest\.json/, 'an unlisted artifact is named');
  assert.match(unlistedCheck.detail, /never a whole directory/);
  // ...and the accepted post-candidate convention still passes: an evaluation commit on
  // top of the candidate, touching only NOTES.md and the candidate's own listed evidence.
  const evaluated = await judge('cli-greenfield', 'evaluated');
  assert.equal(evaluated.checks.find(c => c.id === 'evidence-binding').result, 'passed');

  // A candidate can pass its own tests and still fail acceptance. That is the whole reason
  // the candidate's own suite is a regression signal and never the measure.
  const falseSuccess = await judge('cli-greenfield', 'false-success');
  assert.equal(falseSuccess.checks.find(c => c.id === 'own-tests').result, 'passed', "the candidate's own tests pass");
  assert.equal(falseSuccess.checks.find(c => c.id === 'slug-rules').result, 'failed', 'and the held-out check rejects it anyway');
  assert.equal(falseSuccess.outcome, 'rejected');

  // The UI requirement is decided by observation, not markup. `aria-only` satisfies every
  // structural assertion and a browser still activates the button.
  const aria = await judge('ui-states', 'aria-only');
  for (const id of ['empty-state', 'error-state', 'escaping']) {
    assert.equal(aria.checks.find(c => c.id === id).result, 'passed', `${id}: markup inspection is satisfied`);
  }
  const observedCheck = aria.checks.find(c => c.id === 'submitting-observed');
  assert.equal(observedCheck.result, 'failed', 'but the browser observed otherwise');
  assert.equal(observedCheck.observed, true);
  assert.match(observedCheck.detail, /activated the button/);

  // With no adapter configured that check cannot decide: `unverified`, and the run is
  // `unavailable`. Missing tooling is a gap in the study, never an acceptance.
  const noBrowser = await judge('ui-states', 'control', { browser: null });
  const unverified = noBrowser.checks.find(c => c.id === 'submitting-observed');
  assert.equal(unverified.result, 'unverified', 'without an adapter the UI check cannot decide');
  assert.equal(unverified.observed, false);
  assert.match(unverified.detail, /not the same as satisfied/);
  assert.equal(noBrowser.outcome, 'unverified', 'and the run is not accepted');
  assert.equal(harness.statusFor(noBrowser.outcome), 'unavailable');
  assert.equal(harness.statusFor('accepted'), 'valid');
  assert.equal(harness.statusFor('rejected'), 'valid');
  assert.equal(harness.statusFor('error'), 'invalid');
  // A broken adapter is an error, not a pass either.
  const brokenAdapter = await judge('ui-states', 'control', { browser: { name: 'broken', version: '0', observe() { throw new Error('no display'); } } });
  assert.equal(brokenAdapter.checks.find(c => c.id === 'submitting-observed').result, 'error');
  assert.equal(brokenAdapter.outcome, 'error');

  // Preservation is independent of acceptance: `clobbers-local` delivers both changes
  // correctly and still fails, because it committed the operator's uncommitted work.
  const clobbers = await judge('brownfield-maintenance', 'clobbers-local');
  for (const id of ['deep-merge', 'describe', 'existing-behaviour']) {
    assert.equal(clobbers.checks.find(c => c.id === id).result, 'passed', `${id}: the feature work is correct`);
  }
  const preserved = clobbers.checks.find(c => c.id === 'unrelated-edits');
  assert.equal(preserved.result, 'failed');
  assert.equal(preserved.independent, true, 'preservation is an independent check');
  assert.match(preserved.detail, /the untracked file was committed/);
}

// --- S-23: 72 cells, balanced order, matched inputs, adoption actually verified ---------
{
  const runs = schedule.schedule(IDS);
  assert.equal(runs.length, 72, 'eight briefs, three arms, three repetitions');
  assert.equal(new Set(runs.map(r => r.run)).size, 72, 'every cell is unique');
  assert.deepEqual(runs.map(r => r.order), runs.map((_, i) => i + 1), 'order is dense and sequential');
  // Deterministic: the same brief list gives byte-identical runs, with no clock or RNG.
  assert.deepEqual(schedule.schedule(IDS), runs, 'the schedule is deterministic');
  // Call syntax, not the word: the module's own comment explains why it uses neither.
  const source = fs.readFileSync(path.join(V7, 'schedule.cjs'), 'utf8');
  assert.ok(!/Date\.now\(|Math\.random\(|new Date\(/.test(source), 'the schedule uses no clock or RNG');

  for (const id of IDS) {
    for (const arm of effort.ARMS) {
      assert.equal(runs.filter(r => r.brief === id && r.arm === arm).length, 3, `${id}/${arm}: three repetitions`);
    }
    for (let rep = 1; rep <= 3; rep++) {
      const cell = schedule.cell(runs, id, rep);
      assert.deepEqual(cell.map(r => r.arm).sort(), [...effort.ARMS].sort(), `${id} rep ${rep}: all three arms`);
      // Matched inputs: the three arms of a cell differ only in the arm.
      const [a, b, c] = cell;
      assert.ok(a.brief === b.brief && b.brief === c.brief, 'same brief');
      assert.ok(a.repetition === b.repetition && b.repetition === c.repetition, 'same repetition');
    }
  }
  const balance = schedule.balance(runs);
  assert.equal(balance.cells, 24);
  assert.deepEqual(balance.first_positions, { plain: 8, pincer: 8, strict: 8 }, 'first positions are equal per arm');
  assert.equal(balance.equal_first_positions, true);
  assert.equal(balance.every_brief_starts_with_every_arm, true, 'each brief opens with each arm exactly once');

  // A strict run that did not adopt is a protocol failure, not a strict result. The
  // adoption fact is read from the workspace, never from the agent's narration.
  const cohort = frozen.cohort;
  const base = 'b'.repeat(40), hex = 'a'.repeat(64);
  const strictRun = over => {
    const r = effort.empty({ run: effort.runId('cli-greenfield', 1, 'strict'), cohort, brief: 'cli-greenfield', arm: 'strict', repetition: 1,
      provenance: { base, kit: hex, kit_source: 'v0.6.0', prompts: hex, driver: hex, collector: hex, evaluator: hex, protocol: frozen.inputs.protocol, caps: hex, configuration: hex } });
    r.status = 'valid';
    r.adoption = { required: true, observed: true, evidence: 'workspace .prd/changes/prd-v1.json is schema 3 with an adopt event' };
    r.events = [{ kind: 'session', id: 's1', started: '2026-09-14T10:00:00Z', ended: '2026-09-14T10:20:00Z' }];
    r.reported = { tokens: 1000, cost_usd: 0.5, provider_minutes: 19 };
    r.evaluation = { candidate: base, evaluator: hex, outcome: 'accepted', checks: [{ id: 'slug-rules', result: 'passed', independent: true }] };
    return { ...r, ...over };
  };
  assert.deepEqual(effort.problems(strictRun(), { frozen }), [], 'a strict run with observed adoption validates');
  const unadopted = strictRun({ adoption: { required: true, observed: false, evidence: null } });
  const codes = effort.problems(unadopted, { frozen }).map(p => p.code);
  assert.ok(codes.includes('ADOPTION_UNVERIFIED'), 'a strict run that did not adopt cannot be valid');
  // It is retained as a protocol failure with its reason, not deleted and not counted.
  const retained = strictRun({ status: 'invalid', reason: 'the strict arm never ran coverage adopt; recorded as a protocol failure', adoption: { required: true, observed: false, evidence: null }, evaluation: null });
  assert.deepEqual(effort.problems(retained, { frozen }), [], 'and is complete as an invalid run');
  const agg = effort.aggregate([effort.report(retained)]);
  assert.equal(agg.arms.strict.invalid, 1);
  assert.equal(agg.arms.strict.valid, 0, 'a protocol failure is not evidence for strict Pincer');
  assert.equal(agg.arms.strict.acceptance, null, 'and supports no acceptance rate at all');
}

// --- S-24: a changed input is a new cohort; old records stay under their own ------------
{
  const recomputed = freeze.compute(REPO, SPEC);
  assert.equal(recomputed.cohort, frozen.cohort, 'the committed manifest is the freeze of this tree');
  assert.deepEqual(recomputed.inputs, frozen.inputs);
  assert.equal(freeze.difference(frozen, recomputed).same, true);

  // A copy of the study tree, so each frozen input can be moved on its own without
  // touching the repository the committed manifest describes.
  const FROZEN_PATHS = [SPEC.protocol, ...SPEC.harness, SPEC.briefs, SPEC.collector, SPEC.driver];
  const copyStudy = () => {
    const to = tempDir();
    for (const rel of FROZEN_PATHS) {
      const dest = path.join(to, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.cpSync(path.join(REPO, rel), dest, { recursive: true });
    }
    return to;
  };
  assert.equal(freeze.compute(copyStudy(), SPEC).cohort, frozen.cohort, 'a copy of the study tree freezes identically');

  // One mutation per frozen input, each on its own copy: the cohort must move, and the
  // difference must say WHICH input moved, because "the task changed" and "the judgment
  // changed" are different findings about a study.
  const mutations = [
    ['protocol', dir => fs.appendFileSync(path.join(dir, SPEC.protocol), '\nAn amendment.\n')],
    ['harness', dir => fs.appendFileSync(path.join(dir, SPEC.harness[2]), '\n// a change to how a run is driven\n')],
    ['collector', dir => fs.appendFileSync(path.join(dir, SPEC.collector), '\n// a change to how effort is counted\n')],
    ['driver', dir => fs.appendFileSync(path.join(dir, SPEC.driver), '\n# a change to how a session is invoked\n')],
    ['briefs', dir => fs.appendFileSync(path.join(dir, SPEC.briefs, 'cli-greenfield/brief.md'), '\nAn extra requirement.\n')],
    ['evaluators', dir => fs.appendFileSync(path.join(dir, SPEC.briefs, 'ui-states/evaluator/escaping.test.cjs'), '\n// judged differently\n')],
  ];
  for (const [name, mutate] of mutations) {
    const dir = copyStudy();
    mutate(dir);
    const after = freeze.compute(dir, SPEC);
    assert.notEqual(after.cohort, frozen.cohort, `moving the ${name} starts a new cohort`);
    const diff = freeze.difference(frozen, after);
    assert.equal(diff.same, false);
    assert.ok(diff.changed.includes(name), `the difference names ${name} (saw ${diff.changed.join(', ')})`);
  }
  // A brief whose task moved and one whose judgment moved are reported differently.
  const taskMoved = copyStudy();
  fs.appendFileSync(path.join(taskMoved, SPEC.briefs, 'cli-greenfield/brief.md'), '\nAn extra requirement.\n');
  assert.deepEqual(freeze.difference(frozen, freeze.compute(taskMoved, SPEC)).briefs, [{ id: 'cli-greenfield', change: 'task changed' }]);
  const judgeMoved = copyStudy();
  fs.appendFileSync(path.join(judgeMoved, SPEC.briefs, 'ui-states/evaluator/escaping.test.cjs'), '\n// judged differently\n');
  assert.deepEqual(freeze.difference(frozen, freeze.compute(judgeMoved, SPEC)).briefs, [{ id: 'ui-states', change: 'evaluator changed' }]);

  // A changed cap is a different experiment even with identical files.
  const capped = freeze.compute(REPO, { ...SPEC, caps: { turns_per_session: 50, wall_clock_minutes: 30 } });
  assert.notEqual(capped.cohort, frozen.cohort);
  assert.deepEqual(freeze.difference(frozen, capped).changed, ['caps']);

  // A record of the old cohort is reported under its own, never re-evaluated under the new
  // one. This is the v6 deviation — re-freezing mid-study and re-judging earlier runs —
  // that this edition has no path to repeat.
  const old = { cohort: frozen.cohort };
  assert.deepEqual(freeze.belongs(old, frozen), { ok: true, reason: null });
  const verdict = freeze.belongs(old, capped);
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /belongs to the study it was run under and is not re-evaluated here/);

  // Invalid, unavailable and partial runs keep their reasons, and reports distinguish
  // independent held-out checks from the candidate's own tests.
  const hex = 'a'.repeat(64), sha = 'b'.repeat(40);
  const make = (over) => {
    const r = effort.empty({ run: effort.runId('ui-states', 1, 'plain'), cohort: frozen.cohort, brief: 'ui-states', arm: 'plain', repetition: 1,
      provenance: { base: sha, kit: null, kit_source: null, prompts: hex, driver: hex, collector: hex, evaluator: hex, protocol: frozen.inputs.protocol, caps: hex, configuration: hex } });
    r.events = [{ kind: 'session', id: 's1', started: '2026-09-14T10:00:00Z', ended: '2026-09-14T10:20:00Z' }];
    r.reported = { tokens: 1000, cost_usd: 0.5, provider_minutes: 19 };
    return { ...r, ...over };
  };
  const unavailable = make({ status: 'unavailable', reason: 'no browser tooling on this host, so the UI requirement was not observed' });
  assert.deepEqual(effort.problems(unavailable, { frozen }), []);
  assert.equal(effort.report(unavailable).reason, unavailable.reason, 'the reason survives into the report');
  const noReason = make({ status: 'unavailable', reason: null });
  assert.ok(effort.problems(noReason, { frozen }).some(p => p.code === 'REASON_REQUIRED'), 'an unavailable run must say why');

  const mixed = make({ status: 'valid', evaluation: { candidate: sha, evaluator: hex, outcome: 'accepted', checks: [
    { id: 'empty-state', result: 'passed', independent: true },
    { id: 'submitting-observed', result: 'passed', independent: true },
    { id: 'own-tests', result: 'passed', independent: false },
  ] } });
  assert.deepEqual(effort.problems(mixed, { frozen }), []);
  const report = effort.report(mixed);
  assert.equal(report.independent_checks, 2, 'held-out checks are counted as such');
  assert.equal(report.own_checks, 1, "and the candidate's own suite separately");
  // An acceptance resting only on the candidate's own tests is refused outright.
  const ownOnly = make({ status: 'valid', evaluation: { candidate: sha, evaluator: hex, outcome: 'accepted', checks: [{ id: 'own-tests', result: 'passed', independent: false }] } });
  assert.ok(effort.problems(ownOnly, { frozen }).some(p => p.code === 'EVALUATION_INVALID'));
}

// --- The default path is offline, and the v6 edition is untouched -----------------------
{
  // Nothing in the harness the suite drives can reach a model or a network.
  for (const file of ['harness.cjs', 'briefs.cjs', 'schedule.cjs', 'effort.cjs', 'freeze.cjs', 'evaluator-kit.cjs']) {
    const source = fs.readFileSync(path.join(V7, file), 'utf8');
    for (const forbidden of ['node:http', 'node:https', 'node:net', 'fetch(', 'claude ']) {
      assert.ok(!source.includes(forbidden), `${file} does not use ${forbidden}`);
    }
  }
  // Spending lives in exactly one file, and it refuses to run without an explicit cap.
  const driver = fs.readFileSync(path.join(V7, 'live-driver.sh'), 'utf8');
  assert.match(driver, /claude -p/, 'the live driver is the one file that spends money');
  assert.match(driver, /--i-have-a-spending-cap/, 'and it requires an explicit opt-in');
  const refused = harness.sh('bash', [path.join(V7, 'live-driver.sh'), '--run', 'cli-greenfield/rep-1/plain', '--workspace', ROOT, '--prompt-file', path.join(V7, 'live-driver.sh'), '--model', 'sonnet', '--max-turns', '150', '--wall-clock-minutes', '30', '--cohort', frozen.cohort]);
  assert.equal(refused.status, 3, 'without the opt-in it refuses rather than spending');
  assert.match(refused.stderr, /no spending cap has been asserted/);
  assert.match(refused.stderr, /must be costed before/);

  // The v6 edition still loads and is not this one.
  const v6 = require(path.join(repo, 'scripts/delivery-benchmark/lib.cjs'));
  assert.deepEqual(v6.briefIds(), ['bugfix-brownfield', 'cli-greenfield', 'handoff-two-changes', 'integration-untested', 'scope-revision', 'ui-states'], 'the six v6 briefs are unchanged');
  assert.deepEqual(v6.ARMS, ['pincer', 'plain'], 'the v6 edition still has two arms');
  assert.equal(v6.schedule().length, 36, 'and its own 36-run schedule');
  assert.notEqual(briefs.BRIEFS_DIR, v6.BRIEFS_DIR, 'the two editions have separate fixture roots');
  const v6Frozen = JSON.parse(fs.readFileSync(v6.FROZEN, 'utf8'));
  assert.ok(!v6Frozen.cohort, 'the v6 manifest has no v7 cohort identity');
  assert.notEqual(v6.PROTOCOL, briefs.PROTOCOL, 'and its own protocol document');
}

console.log(`v7 delivery benchmark tests passed (${IDS.length} briefs, 72 cells, controls accepted, injected faults rejected)`);
