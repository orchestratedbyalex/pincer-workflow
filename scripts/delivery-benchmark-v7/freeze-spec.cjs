'use strict';
// PRD v7 T-94 — the frozen inputs of the v7 edition, in one place.
//
// The committed manifest (test/fixtures/delivery-benchmark-v7/frozen.json) is
// `freeze.compute(REPO, SPEC)`. Keeping the spec here rather than in the suite means the
// manifest a reader recomputes is the one the study ran under, not one the test invented.
//
// `harness` is the benchmark EXECUTION PATH, named file by file: the brief loader, the
// schedule, the run harness and the shared evaluator checks. It is deliberately not
// "every file in this directory" — the directory also holds v7 tooling that never drives
// a benchmark run (the T-89 baseline probe, the scale measurement, the observation
// records), and freezing those would make an unrelated edit look like a cohort change
// while telling a reader nothing true about how a run executed.
//
// Editing any file named here DOES change the cohort — which is the point — and the
// committed manifest has to be regenerated with the edit:
//
//   node -e "const fs=require('node:fs'),f=require('./scripts/delivery-benchmark-v7/freeze.cjs'),{REPO,SPEC}=require('./scripts/delivery-benchmark-v7/freeze-spec.cjs');fs.writeFileSync('test/fixtures/delivery-benchmark-v7/frozen.json',JSON.stringify(f.compute(REPO,SPEC),null,2)+'\n')"
//
// test/delivery-benchmark-v7.test.js fails when the two disagree, the same way the v6
// edition's `check-freeze` does. A cohort that drifts silently is the failure this whole
// mechanism exists to prevent.
const path = require('node:path');
const REPO = path.resolve(__dirname, '..', '..');

// Caps are part of the execution path: the same task under a different turn limit is a
// different experiment, so they are frozen with the files.
const CAPS = { turns_per_session: 150, wall_clock_minutes: 30 };

// The allowlisted configuration of the cohort. Values that are decided at execution time
// (the exact tool version, the host OS) are recorded per run in the record's environment;
// what is frozen here is the configuration the cohort is DEFINED by.
const CONFIGURATION = {
  values: { model: 'sonnet', tool: 'claude-code', permission_mode: 'bypassPermissions', max_turns: 150, wall_clock_minutes: 30, cwd_kind: 'scratch' },
  env: ['PATH', 'HOME'],
};

const SPEC = {
  protocol: 'docs/prd-v8-protocol.md',
  // The execution path, in load order. Adding a module that drives or judges a run
  // means adding it here, or the cohort stops describing what actually ran.
  harness: ['scripts/delivery-benchmark-v7/briefs.cjs', 'scripts/delivery-benchmark-v7/schedule.cjs', 'scripts/delivery-benchmark-v7/harness.cjs', 'scripts/delivery-benchmark-v7/evaluator-kit.cjs', 'scripts/delivery-benchmark-v7/orchestrator.cjs', 'scripts/delivery-benchmark-v7/effective.cjs', 'scripts/delivery-benchmark-v7/freeze.cjs', 'scripts/delivery-benchmark-v7/freeze-spec.cjs', 'scripts/delivery-benchmark-v7/run-claims.cjs', 'scripts/delivery-benchmark-v7/isolated-launch.cjs', 'scripts/delivery-benchmark-v7/browser-preflight.cjs', 'scripts/delivery-benchmark-v7/browser.cjs', 'scripts/delivery-benchmark-v7/attempts.cjs', 'scripts/delivery-benchmark-v7/usage.cjs', 'scripts/delivery-benchmark-v7/finalization.cjs', 'scripts/delivery-benchmark-v7/readiness.cjs', 'scripts/delivery-benchmark-v7/allocation.cjs', 'docs/prd-v7-protocol.md', 'docs/prd-v8-usage-semantics.md', 'docs/prd-v8-agent-isolation.md'],
  briefs: 'test/fixtures/delivery-benchmark-v7/briefs',
  collector: 'scripts/delivery-benchmark-v7/effort.cjs',
  driver: 'scripts/delivery-benchmark-v7/live-driver.sh',
  caps: CAPS,
  configuration: CONFIGURATION,
};

module.exports = { REPO, CAPS, CONFIGURATION, SPEC };
