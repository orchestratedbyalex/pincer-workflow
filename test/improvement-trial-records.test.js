// PRD v7 T-95 (R-09, S-25..S-27): the improvement comparison record — the paired
// baseline-versus-improved pilots, the timed independent reviews, and the assessment of
// each predeclared target.
//
// Three pressures this shape resists, because they are the ones a comparison that came
// out badly invites. A rate reported without its denominator hides the runs that did
// not finish, so every count must account for the 72-run schedule. Review time that was
// never measured becomes zero if nothing stops it, so `null` keeps its reason and zero
// is refused. And a missed target invites relabelling, so `suppressed` is a validation
// failure rather than a field anyone can set.
//
// The comparison itself is outstanding. This suite asserts the repository says so, and
// that the report cannot claim a result it does not have.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repo } from './helpers.js';

const require = createRequire(import.meta.url);
const obs = require(path.join(repo, 'scripts/delivery-benchmark-v7/observations.cjs'));
const read = rel => fs.readFileSync(path.join(repo, rel), 'utf8');

const BASE_KIT = 'a'.repeat(64);
const IMPROVED_KIT = 'c'.repeat(64);
const SHA = 'b'.repeat(40);
const codes = r => obs.problems(r).map(p => p.code);
const ok = (r, label) => assert.deepEqual(obs.problems(r), [], `${label}: ${JSON.stringify(obs.problems(r))}`);

function review(over = {}) {
  return {
    reviewer: 'reviewer-A', implemented_candidate: false, task: 'cli-greenfield',
    decision: 'accept', minutes: 14.5, confidence: 4, missed_faults: [],
    arm_known: 'blinded', order: 1, prior_exposure: false, ...over,
  };
}
function comparison(over = {}) {
  return {
    schema: 1, kind: 'comparison', id: 'comparison-v7', recorded: '2026-10-01T10:00:00Z',
    status: 'complete', observed: true, fixture: false,
    provenance: { kit: IMPROVED_KIT, kit_source: 'the v7 candidate, packed', base: SHA, tool_version: 'claude-code 2.1.267', model: 'sonnet' },
    pairs: [
      { task: 'greenfield pilot task', order: 'baseline-first', baseline: { kit: BASE_KIT, observed: true, operations: 35 }, improved: { kit: IMPROVED_KIT, observed: true, operations: 19 } },
      { task: 'brownfield pilot task', order: 'improved-first', baseline: { kit: BASE_KIT, observed: true, operations: 41 }, improved: { kit: IMPROVED_KIT, observed: true, operations: 26 } },
      { task: 'brownfield maintenance task', order: 'baseline-first', baseline: { kit: BASE_KIT, observed: true, operations: 38 }, improved: { kit: IMPROVED_KIT, observed: true, operations: 22 } },
    ],
    reviews: [review(), review({ reviewer: 'reviewer-B', order: 1, decision: 'reject', minutes: 21, confidence: 3, missed_faults: ['missed the unescaped error-state string'] })],
    targets: [
      { target: 'halve the avoidable workflow operations on the paired pilots', result: 'met', basis: '114 baseline operations against 67 improved across three pairs; the reduction is 41%, short of half on two of three pairs and reported per pair' },
      { target: 'reduce median short-task cost and active time without lower observed acceptance', result: 'missed', basis: 'median cost fell 18% but acceptance fell from 17/18 to 15/18; the quality change is reported separately and is not netted against the cost change' },
    ],
    runs: { scheduled: 72, completed: 68, invalid: 4, outstanding: 0 },
    ...over,
  };
}

// --- S-25: every cell accounted for, with its denominator ---------------------------
{
  ok(comparison(), 'the complete fixture validates');

  // The schedule is 72 runs and the counts must add up to it. A comparison that
  // quietly dropped runs is worse than no comparison.
  const short = comparison({ runs: { scheduled: 48, completed: 48, invalid: 0, outstanding: 0 } });
  assert.ok(codes(short).includes('SCHEDULE_INCOMPLETE'), 'a smaller study needs an explicit recorded scope revision');
  assert.match(obs.problems(short).find(p => p.code === 'SCHEDULE_INCOMPLETE').detail, /explicit recorded scope revision/);
  const unaccounted = comparison({ runs: { scheduled: 72, completed: 60, invalid: 4, outstanding: 0 } });
  assert.ok(codes(unaccounted).includes('DENOMINATOR_MISSING'), 'runs that do not add up to the schedule are refused');
  assert.match(obs.problems(unaccounted).find(p => p.code === 'DENOMINATOR_MISSING').detail, /≠ 72/);
  for (const key of ['scheduled', 'completed', 'invalid', 'outstanding']) {
    const missing = comparison();
    delete missing.runs[key];
    assert.ok(codes(missing).includes('DENOMINATOR_MISSING'), `runs.${key} is required`);
  }
  // Outstanding runs make the comparison partial, whatever it calls itself.
  const stillRunning = comparison({ runs: { scheduled: 72, completed: 60, invalid: 4, outstanding: 8 } });
  assert.ok(codes(stillRunning).includes('SCHEDULE_INCOMPLETE'), 'outstanding runs keep the comparison from being complete');
  ok(comparison({ status: 'partial', runs: { scheduled: 72, completed: 60, invalid: 4, outstanding: 8 } }), 'the same record is valid as partial');

  // The pairs really compare two kits, and the order is recorded so learning effects
  // are visible rather than invisible.
  const sameKit = comparison();
  sameKit.pairs[0].improved = { ...sameKit.pairs[0].improved, kit: BASE_KIT };
  assert.ok(codes(sameKit).includes('PAIR_INVALID'), 'a pair whose sides name the same kit compares nothing');
  const noOrder = comparison();
  delete noOrder.pairs[1].order;
  assert.ok(codes(noOrder).includes('PAIR_INVALID'), 'a pair without a recorded order hides learning effects');
  assert.match(obs.problems(noOrder).find(p => p.code === 'PAIR_INVALID').detail, /learning effects are visible/);
  const unmeasured = comparison();
  unmeasured.pairs[0].improved = { kit: IMPROVED_KIT, observed: true };
  assert.ok(codes(unmeasured).includes('PAIR_INVALID'), 'an observed side records the operations it counted');
  // An unobserved side says why.
  const pendingSide = comparison({ status: 'partial' });
  pendingSide.pairs[2].improved = { kit: IMPROVED_KIT, observed: false, reason: 'the third pilot project is not selected' };
  ok(pendingSide, 'an unobserved side with its reason is a valid partial record');
  const silentSide = comparison({ status: 'partial' });
  silentSide.pairs[2].improved = { kit: IMPROVED_KIT, observed: false };
  assert.ok(codes(silentSide).includes('REASON_REQUIRED'), 'and without a reason is refused');
}

// --- S-26: timed independent reviews, and null is never zero ------------------------
{
  // Two non-implementing reviewers, minimum.
  const one = comparison({ reviews: [review()] });
  assert.ok(codes(one).includes('REVIEW_NOT_INDEPENDENT'), 'one reviewer is not two');
  const sameTwice = comparison({ reviews: [review(), review({ order: 2, task: 'ui-states' })] });
  assert.ok(codes(sameTwice).includes('REVIEW_NOT_INDEPENDENT'), 'the same reviewer twice is still one reviewer');
  const implementer = comparison();
  implementer.reviews[1] = review({ reviewer: 'reviewer-B', implemented_candidate: true });
  assert.ok(codes(implementer).includes('REVIEW_NOT_INDEPENDENT'), 'a reviewer who implemented the candidate is not independent');

  // Minutes: measured, or null with a reason. Zero is refused, because the failure this
  // prevents is exactly a stopwatch nobody started being reported as no time spent.
  const zero = comparison();
  zero.reviews[0] = review({ minutes: 0 });
  assert.ok(codes(zero).includes('REVIEW_INVALID'), 'zero minutes is refused');
  const nulled = comparison();
  nulled.reviews[0] = review({ minutes: null });
  assert.ok(codes(nulled).includes('REASON_REQUIRED'), 'null minutes needs a reason');
  assert.match(obs.problems(nulled).find(p => p.code === 'REASON_REQUIRED').detail, /missing review time is not zero/);
  const explained = comparison();
  explained.reviews[0] = review({ minutes: null, minutes_unavailable: 'the reviewer was interrupted and did not record elapsed time' });
  ok(explained, 'null with a reason is complete');

  // The rubric fields that make a review inspectable rather than a verdict.
  for (const [field, value] of [['confidence', 6], ['confidence', 0], ['decision', 'maybe'], ['arm_known', 'unknown'], ['order', 0]]) {
    const bad = comparison();
    bad.reviews[0] = review({ [field]: value });
    assert.ok(codes(bad).includes('REVIEW_INVALID'), `${field}=${value} is refused`);
  }
  const noMissed = comparison();
  delete noMissed.reviews[0].missed_faults;
  assert.ok(codes(noMissed).includes('REVIEW_INVALID'), 'missed_faults is recorded, empty if none were missed');
  const noExposure = comparison();
  delete noExposure.reviews[0].prior_exposure;
  assert.ok(codes(noExposure).includes('REVIEW_INVALID'), 'prior exposure is recorded');
}

// --- S-27: each predeclared target assessed, and a missed one is a finding ----------
{
  // A missed target is a product finding. Marking it suppressed is the move this refuses.
  const suppressed = comparison();
  suppressed.targets[1] = { ...suppressed.targets[1], suppressed: true };
  assert.ok(codes(suppressed).includes('RESULT_SUPPRESSED'), 'a missed target cannot be suppressed');
  assert.match(obs.problems(suppressed).find(p => p.code === 'RESULT_SUPPRESSED').detail, /a product finding, not permission to suppress it/);
  const undecided = comparison();
  undecided.targets[0] = { target: 'halve the operations', result: 'met' };
  assert.ok(codes(undecided).includes('TARGET_INVALID'), 'a decided target says what it was decided on');
  const openTarget = comparison({ status: 'partial' });
  openTarget.targets[0] = { target: 'halve the operations', result: 'outstanding', reason: 'the paired pilots have not run' };
  ok(openTarget, 'an outstanding target with its reason validates');
  const openSilent = comparison({ status: 'partial' });
  openSilent.targets[0] = { target: 'halve the operations', result: 'outstanding' };
  assert.ok(codes(openSilent).includes('REASON_REQUIRED'), 'and without a reason is refused');
  const badResult = comparison();
  badResult.targets[0] = { target: 'x', result: 'partially met', basis: 'y' };
  assert.ok(codes(badResult).includes('TARGET_INVALID'), 'a target is met, missed or outstanding — nothing in between');

  // A fixture cannot be relabelled, and an unobserved record cannot be complete.
  assert.ok(codes(comparison({ fixture: true })).includes('FIXTURE_MISLABELLED'));
  assert.ok(codes(comparison({ observed: false, status: 'complete' })).includes('NOT_OBSERVED'));
}

// --- The repository records the comparison as outstanding ---------------------------
{
  const file = 'docs/prd-v7-artifacts/comparison/comparison-v7.json';
  assert.ok(fs.existsSync(path.join(repo, file)), 'the comparison record exists');
  const record = JSON.parse(read(file));
  assert.deepEqual(obs.problems(record), [], `it validates: ${JSON.stringify(obs.problems(record))}`);
  assert.equal(record.fixture, false, 'it is not a fixture');
  assert.equal(record.observed, false, 'nothing has been observed');
  assert.equal(record.status, 'outstanding');
  assert.ok(record.outstanding_reason.length > 20, 'and it says what is missing');
  // Every predeclared target is listed as outstanding with its reason — none is quietly
  // reported as met before the runs exist.
  assert.ok(record.targets.length >= 2, 'both predeclared targets are listed');
  for (const t of record.targets) {
    assert.equal(t.result, 'outstanding', `${t.target} is outstanding, not decided`);
    assert.ok(t.reason, 'with its reason');
  }
  assert.ok(record.reviews.length === 0, 'no reviews have been collected');
  assert.equal(record.pairs.length, 3, 'the three paired pilots are planned');
  for (const pair of record.pairs) for (const side of ['baseline', 'improved']) assert.equal(pair[side].observed, false, `${pair.task} ${side} has not run`);

  // The comparison report says what it is and what it is not.
  const report = read('docs/prd-v7-comparison.md');
  assert.match(report, /^# PRD v7 comparison/m);
  assert.match(report.replace(/\s+/g, ' '), /No comparison has been run/i, 'the report states that nothing has been run');
  assert.match(report, /72/, 'it names the schedule size');
  assert.match(report.replace(/\s+/g, ' '), /a missed target is a product finding/i, 'and that a missed target is a finding');
  assert.match(report.replace(/\s+/g, ' '), /unfavourable|unfavorable/i, 'and that unfavourable results are published');
  // It never reports a result it does not have.
  assert.doesNotMatch(report, /\bis \d+% (faster|cheaper|better)\b/i, 'no performance claim is made');
  assert.match(report, /T-95/, 'it names the ticket that would fill it in');

  const v = obs.verdict([record]);
  assert.equal(v.code, 'RECORD_VALID');
  assert.equal(v.observed, 0);
  assert.match(v.note, /does not establish that a session happened/);
}

console.log('improvement trial record tests passed');
