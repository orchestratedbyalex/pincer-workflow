'use strict';
// PRD v7 T-98 (R-08) — the run orchestrator.
//
// The v7 edition shipped libraries and a one-session driver and nothing that walks the
// schedule. That gap is not neutral: whoever executes has to write the loop, and the
// loop is where the working directory, the caps, the retries and the kit install live —
// which is exactly what `provenance.configuration` and `provenance.driver` claim to
// describe. A record could then name a frozen driver truthfully while an unfrozen script
// decided everything that mattered, and nothing in the repository could notice. So the
// loop lives here, in the tree, and `freeze-spec.cjs` names this file: editing it starts
// a new cohort, the same as editing the driver or a brief.
//
// Everything v6 learned the hard way is implemented here rather than described:
//
//   * the schedule STOPS on the first usage limit. v6's driver kept walking and turned
//     six remaining cells into one-turn failures; it was not the limit that destroyed
//     them, it was the walking.
//   * a session that outruns the wall clock is ENDED, and judged on what it committed.
//     v6's worst event was an uncapped hung process: 5 h 22 m, 59.6% of that study's
//     whole calendar span. v6 also mis-marked one capped run as having produced no
//     usable work when it had committed code and been evaluated.
//   * progress is CHECKPOINTED per cell, because a schedule this size spans several
//     account reset windows and must never restart at cell 1.
//   * an invalidated cell is RERUN above the schedule, naming the run it replaces, with
//     the original left on disk and its reason kept.
//   * the kit is INSTALLED per arm. `harness.prepare()` does not do it.
//
// This file spends no money by itself and cannot: it reaches a model only by executing
// `live-driver.sh`, which refuses without an explicit spending-cap assertion. The
// orchestrator refuses the same way, one level up, so that a caller cannot slip past the
// decision by driving the loop instead of the session.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const briefs = require('./briefs.cjs');
const schedule = require('./schedule.cjs');
const harness = require('./harness.cjs');
const effort = require('./effort.cjs');

const DRIVER = path.join(__dirname, 'live-driver.sh');

// The wall-clock cap surfaces as exit 124, the status `timeout` uses. A model process
// that exits 124 on its own is indistinguishable by status alone, so the driver also
// prints a marker and both must agree before a run is called capped. When they disagree
// the run is an error with the disagreement recorded — never silently one or the other.
const CAP_EXIT = 124;
const CAP_MARKER = /wall-clock cap/;

// The limit strings v6 actually observed, plus the two neighbours that mean the same
// thing to a schedule. Matched against the session's own output as well as its stderr,
// because the CLI reports a limit as a successful process carrying a failed result.
const LIMIT_RE = /usage limit|session limit|rate limit|quota/i;

// The schedule owns repetitions 1..REPETITIONS; a rerun takes the next free number above
// it, up to MAX_REPETITION. The presence of record.json is the allocation lock, and it is
// crash-safe because `plan` and `claimRerun` never overwrite one.
const RERUN_FIRST = schedule.REPETITIONS + 1;

const iso = () => new Date().toISOString();

// The schedule stamps `run` on every cell it emits; a rerun cell is built here and has
// none, so derive it the same way `effort` does rather than keeping a second spelling.
const idOf = cell => cell.run || effort.runId(cell.brief, cell.repetition, cell.arm);

function runDir(runsRoot, cell) {
  return path.join(runsRoot, cell.brief, `rep-${cell.repetition}`, cell.arm);
}

function recordPath(runsRoot, cell) {
  return path.join(runDir(runsRoot, cell), 'record.json');
}

function readRecord(runsRoot, cell) {
  const p = recordPath(runsRoot, cell);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}

// Written through a temp file and renamed, so a process killed mid-write leaves the
// previous record intact rather than a truncated one. A half-written checkpoint is worse
// than none: resume would skip the cell.
function writeRecord(runsRoot, cell, record) {
  const dir = runDir(runsRoot, cell);
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, 'record.json');
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(record, null, 2)}\n`);
  fs.renameSync(tmp, p);
  return p;
}

const limitHit = text => LIMIT_RE.test(String(text || ''));

// A session's outcome, from the two signals the driver can give. `ambiguous` is a real
// answer: exit 124 without the marker is not proof of a cap.
function endOf({ status, stderr }) {
  const marked = CAP_MARKER.test(String(stderr || ''));
  if (status === CAP_EXIT && marked) return 'capped';
  if (status === CAP_EXIT || marked) return 'ambiguous';
  return status === 0 ? 'completed' : 'failed';
}

// The first free repetition above the schedule, or null when 4..9 are all taken.
function nextRepetition(runsRoot, brief, arm) {
  for (let r = RERUN_FIRST; r <= schedule.MAX_REPETITION; r += 1) {
    if (!fs.existsSync(recordPath(runsRoot, { brief, repetition: r, arm }))) return r;
  }
  return null;
}

// Materialise the schedule as pending records. Idempotent by construction: a cell that
// already has a record is left exactly as it is, which is what makes `plan` safe to call
// again after an interrupted study and what makes it the resume checkpoint.
function plan(runsRoot, { cohort, provenance = {}, environment = {}, ids = briefs.briefIds() }) {
  const cells = schedule.schedule(ids);
  const created = [];
  for (const cell of cells) {
    if (readRecord(runsRoot, cell)) continue;
    const record = effort.empty({
      run: idOf(cell), cohort,
      brief: cell.brief, arm: cell.arm, repetition: cell.repetition, order: cell.order,
      provenance, environment,
    });
    writeRecord(runsRoot, cell, record);
    created.push(record.run);
  }
  return { cells, created };
}

// Claim a rerun slot for an invalidated cell. The replaced run is named in the new
// record's reason and in an `operator` event, so a reader never has to infer which run a
// rerun replaces — and the original stays on disk with its own reason.
function claimRerun(runsRoot, cell, { cohort, provenance = {}, environment = {} }) {
  const original = readRecord(runsRoot, cell);
  if (!original) throw new Error(`no record to rerun at ${idOf(cell)}`);
  if (original.status !== 'invalid') throw new Error(`${original.run} is ${original.status}, not invalid; only an invalid run is rerun`);
  const repetition = nextRepetition(runsRoot, cell.brief, cell.arm);
  if (repetition === null) return null;
  const replacement = { brief: cell.brief, arm: cell.arm, repetition, order: null };
  const record = effort.empty({
    run: idOf(replacement), cohort,
    brief: cell.brief, arm: cell.arm, repetition, order: null,
    provenance, environment,
  });
  record.reason = `rerun outside the schedule, replacing the invalid run ${original.run}`;
  record.events.push({
    kind: 'intervention', id: `${record.run}:rerun`, started: iso(), ended: iso(),
    intervention: 'operator', detail: record.reason,
  });
  writeRecord(runsRoot, replacement, record);
  return { cell: replacement, record };
}

// Install a released kit into the workspace, as its own commit, so the candidate's base
// is the post-install tree and the kit never reads as the agent's own work. `plain` gets
// nothing, which is the arm's whole definition.
function installKit(ws, arm, kit) {
  if (arm === 'plain') return null;
  if (!kit) throw new Error(`the ${arm} arm needs a kit; none was given`);
  if (!fs.existsSync(kit)) throw new Error(`no kit at ${kit}`);
  const digest = effort.sha256(fs.readFileSync(kit));
  // Unpacked outside the workspace, so a failed install cannot leave a half-extracted kit
  // inside the tree the agent is about to be measured on.
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'pincer-kit-'));
  let version;
  try {
    const untar = harness.sh('tar', ['-xzf', kit, '-C', staging]);
    if (untar.status !== 0) throw new Error(`kit extraction failed: ${untar.stderr.trim()}`);
    const pkg = path.join(staging, 'package');
    version = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'), 'utf8')).version;
    const init = harness.sh(process.execPath, [path.join(pkg, 'bin', 'pincer.js'), 'init', '--platform', 'claude'], { cwd: ws, env: { CI: '1' } });
    if (init.status !== 0) throw new Error(`kit install failed: ${init.stderr.trim() || init.stdout.trim()}`);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
  fs.rmSync(path.join(ws, 'AGENTS.md.new'), { force: true });
  // Its own commit, so the candidate's base is the post-install tree and the kit is never
  // read as the agent's work.
  return { digest, source: `tarball ${path.basename(kit)}`, version, base: harness.commitAll(ws, `Install PINCER kit v${version}`) };
}

// One session, through the frozen driver. Nothing else in this file may reach a model,
// and this function adds nothing to the prompt: a driver — or an orchestrator — that
// coaches is measuring itself rather than the workflow.
function driveSession({ run, workspace, promptFile, model, maxTurns, wallClockMinutes, cohort, logDir, name, spendingCap }) {
  if (spendingCap !== true) {
    return { refused: true, status: 3, stdout: '', stderr: 'orchestrator: refused: no spending cap has been asserted' };
  }
  fs.mkdirSync(logDir, { recursive: true });
  const started = iso();
  const r = harness.sh('bash', [
    DRIVER,
    '--run', run,
    '--workspace', workspace,
    '--prompt-file', promptFile,
    '--model', model,
    '--max-turns', String(maxTurns),
    '--wall-clock-minutes', String(wallClockMinutes),
    '--cohort', cohort,
    '--i-have-a-spending-cap',
  ]);
  const ended = iso();
  fs.writeFileSync(path.join(logDir, `${name}.json`), r.stdout || '');
  fs.writeFileSync(path.join(logDir, `${name}.err`), r.stderr || '');
  return {
    refused: false, status: r.status, stdout: r.stdout, stderr: r.stderr,
    started, ended, end: endOf(r), limit: limitHit(r.stdout) || limitHit(r.stderr),
  };
}

// One run, end to end. Returns { record, stop } — `stop` is true only for an account
// limit, which is the single condition that must halt the whole schedule rather than
// this cell.
async function driveRun(runsRoot, cell, opts) {
  const {
    cohort, kit = null, model = 'sonnet', maxTurns = 150, wallClockMinutes = 30,
    dir = briefs.BRIEFS_DIR, tools = harness.DEFAULT_TOOLS(), browser = null,
    spendingCap = false, unrelatedEdits = null,
  } = opts;
  const record = readRecord(runsRoot, cell);
  if (!record) throw new Error(`no planned record at ${idOf(cell)}`);
  // Resume: a cell that already reached a terminal status is never redriven. This is the
  // whole reason the study can span reset windows without repeating paid work.
  if (record.status !== 'pending') return { record, stop: false, skipped: true };

  const home = runDir(runsRoot, cell);
  const ws = path.join(home, 'workspace');
  const scratch = path.join(home, 'scratch');
  const logs = path.join(home, 'logs');
  const brief = briefs.loadBrief(cell.brief, dir);

  const setupStart = iso();
  harness.prepare(ws, cell.brief, { arm: cell.arm, dir, unrelatedEdits });
  const installed = installKit(ws, cell.arm, kit);
  record.provenance.kit = installed ? installed.digest : null;
  record.provenance.kit_source = installed ? installed.source : null;
  record.provenance.base = harness.git(ws, 'rev-parse', 'HEAD');
  record.environment.model = model;
  record.environment.caps = { turns_per_session: maxTurns, wall_clock_minutes: wallClockMinutes };
  record.events.push({ kind: 'stage', id: `${record.run}:setup`, stage: 'setup', started: setupStart, ended: iso() });

  for (const p of brief.prompts) {
    const promptFile = path.join(scratch, `${p.name}.prompt`);
    fs.mkdirSync(scratch, { recursive: true });
    fs.writeFileSync(promptFile, p.prompt);
    const s = driveSession({
      run: record.run, workspace: ws, promptFile, model, maxTurns,
      wallClockMinutes, cohort, logDir: logs, name: p.name, spendingCap,
    });
    if (s.refused) {
      record.status = 'outstanding';
      record.reason = 'no spending cap has been asserted; no session was launched';
      writeRecord(runsRoot, cell, record);
      return { record, stop: true, refused: true };
    }
    record.events.push({
      kind: 'session', id: `${record.run}:${p.name}`, started: s.started, ended: s.ended,
      prompt: p.prompt.slice(0, effort.LIMITS.prompt),
    });

    // An account limit ends the study, not the cell. Marking it invalid keeps the
    // partial work and its reason; walking on would convert every later cell into a
    // one-turn failure, which is precisely how v6 lost six runs.
    if (s.limit) {
      record.status = 'invalid';
      record.reason = `account limit during ${p.name}; the schedule stopped rather than continuing into it`;
      record.events.push({
        kind: 'intervention', id: `${record.run}:${p.name}:limit`, started: s.ended, ended: s.ended,
        intervention: 'operator', detail: record.reason,
      });
      writeRecord(runsRoot, cell, record);
      return { record, stop: true };
    }

    if (s.end === 'capped') {
      // The cap is a fact about the run, recorded as an operator intervention — and the
      // run still goes to the evaluator. v6 marked one capped session as having produced
      // no usable work when it had committed code and been rejected on the merits; a cap
      // decides when a session stopped, never whether what it wrote was any good.
      record.events.push({
        kind: 'intervention', id: `${record.run}:${p.name}:cap`, started: s.ended, ended: s.ended,
        intervention: 'operator', detail: `session ${p.name} ended by the ${wallClockMinutes}-minute wall-clock cap (exit ${CAP_EXIT})`,
      });
    } else if (s.end === 'ambiguous') {
      record.status = 'invalid';
      record.reason = `session ${p.name} exited ${s.status} without a matching cap marker; the cap and the exit status disagree`;
      writeRecord(runsRoot, cell, record);
      return { record, stop: false };
    }
  }

  const candidate = harness.git(ws, 'rev-parse', 'HEAD');
  const evalStart = iso();
  let evaluation;
  try {
    evaluation = await harness.evaluateCandidate({ id: cell.brief, workspace: ws, candidate, dir, tools, browser, record, scratch });
  } catch (e) {
    record.status = 'invalid';
    record.reason = `evaluation failed: ${String(e.message).slice(0, effort.LIMITS.reason)}`;
    writeRecord(runsRoot, cell, record);
    return { record, stop: false };
  }
  record.evaluation = {
    candidate, evaluator: effort.sha256(fs.readFileSync(path.join(dir, cell.brief, 'evaluator', 'evaluate.cjs'))),
    outcome: evaluation.outcome, checks: evaluation.checks,
  };
  record.events.push({ kind: 'evaluation', id: `${record.run}:evaluation`, started: evalStart, ended: iso() });
  record.status = harness.statusFor(evaluation.outcome);
  writeRecord(runsRoot, cell, record);
  return { record, stop: false };
}

// Walk the schedule in execution order, stopping at the first account limit. Everything
// already terminal is skipped, so this is also the resume entry point: call it again
// after a reset window and it continues where the limit stopped it.
async function driveSchedule(runsRoot, opts) {
  const { ids = briefs.briefIds(), kit = null } = opts;
  const cells = schedule.schedule(ids);
  // Checked before the first session rather than at the cell that needs it: discovering a
  // missing kit halfway through is discovering it after the paid runs behind it.
  if (!kit && cells.some(c => c.arm !== 'plain')) {
    throw new Error(`the schedule contains ${cells.filter(c => c.arm !== 'plain').length} kit-arm cells and no kit was given`);
  }
  const driven = [];
  for (const cell of cells) {
    const result = await driveRun(runsRoot, cell, opts);
    driven.push({ run: result.record.run, status: result.record.status, skipped: Boolean(result.skipped) });
    if (result.stop) return { driven, stopped: result.record.run, reason: result.record.reason };
  }
  return { driven, stopped: null, reason: null };
}

module.exports = {
  DRIVER, CAP_EXIT, CAP_MARKER, LIMIT_RE, RERUN_FIRST,
  runDir, recordPath, readRecord, writeRecord,
  limitHit, endOf, nextRepetition, plan, claimRerun, installKit,
  driveSession, driveRun, driveSchedule,
};
