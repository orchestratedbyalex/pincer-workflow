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
const freeze = require('./freeze.cjs');

const DRIVER = path.join(__dirname, 'live-driver.sh');

// The one thing that separates the three arms at execution time. Everything else about a
// cell is identical by design, so if this is empty the arm is not an arm: `plain`,
// `pincer` and `strict` would receive byte-identical prompts in byte-identical trees and
// a third of the schedule would buy a duplicate of another arm.
//
// It varies the WORKFLOW clause and never the task. The task is BRIEF.md, which every
// arm reads unchanged; an arm that was also told what to build would be measuring the
// preamble instead of the workflow.
const ARM_PREAMBLE = {
  plain: '',
  pincer: 'This repository has the PINCER workflow kit installed. Use it for this work.\n\n',
  strict: 'This repository has the PINCER workflow kit installed. Use it for this work, and adopt strict coverage for each change you make (`coverage adopt --preview`, then `coverage adopt --apply`) before you implement it.\n\n',
};

// Where the kit records a change, and what adoption looks like in one: schema 3 with a
// `coverage` object and an `adopt` event. Read from the workspace rather than from the
// arm we asked for — a run that did not adopt is a protocol failure, and a record that
// infers adoption from the request would be recording the question as its own answer.
const CHANGES_DIR = '.prd/evidence/changes';
const STRICT_SCHEMA = 3;

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
  // The replaced run is named in an `operator` event and nowhere else. It used to be set
  // on `record.reason` as well, which made the replacement invalid the moment it was
  // created: the validator allows a reason only on a run that admits something went
  // wrong, and a fresh rerun is `pending`. The event carries the same sentence and
  // survives to whatever terminal status the rerun reaches.
  const detail = `rerun outside the schedule, replacing the invalid run ${original.run}`;
  record.events.push({
    kind: 'intervention', id: `${record.run}:rerun`, started: iso(), ended: iso(),
    intervention: 'operator', detail,
  });
  writeRecord(runsRoot, replacement, record);
  return { cell: replacement, record };
}

// Did this run actually adopt strict coverage? Read from the workspace's own change
// records: schema 3, a `coverage` object naming its map and agreement, and an `adopt`
// event. Returns `false` when we looked and found none — which is not the same as `null`,
// and the difference is the whole point: null means unobserved, false means absent.
function observeAdoption(ws) {
  const dir = path.join(ws, CHANGES_DIR);
  if (!fs.existsSync(dir)) return { observed: false, evidence: null };
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith('.json')) continue;
    let record;
    try { record = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')); } catch { continue; }
    if (!record || record.schema !== STRICT_SCHEMA) continue;
    const coverage = record.coverage;
    if (!coverage || typeof coverage !== 'object' || !coverage.map) continue;
    if (!Array.isArray(record.events) || !record.events.some(e => e && e.kind === 'adopt')) continue;
    return {
      observed: true,
      evidence: `${CHANGES_DIR}/${name}: schema ${STRICT_SCHEMA}, coverage map ${coverage.map}, agreement ${coverage.agreement || 'unrecorded'}, adopt event present`,
    };
  }
  return { observed: false, evidence: null };
}

// The provider's own figures, from the JSON the driver already saved. Summed across the
// cell's sessions, which are sequential — the merge rule that governs event intervals is
// about overlap, and there is none here.
//
// A metric that no payload carried comes back null WITH its reason, never as zero: the
// study's whole cost column is this function's output, and a fabricated zero there is a
// claim that a paid session was free.
function readUsage(logDir, names) {
  const totals = { tokens: 0, cost_usd: 0, provider_minutes: 0 };
  const seen = { tokens: false, cost_usd: false, provider_minutes: false };
  const unreadable = [];
  for (const name of names) {
    const file = path.join(logDir, `${name}.json`);
    if (!fs.existsSync(file)) { unreadable.push(`${name}: no payload was saved`); continue; }
    let payload;
    try { payload = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { unreadable.push(`${name}: the saved payload is not JSON`); continue; }
    if (!payload || typeof payload !== 'object') { unreadable.push(`${name}: the saved payload is not an object`); continue; }
    if (typeof payload.total_cost_usd === 'number') { totals.cost_usd += payload.total_cost_usd; seen.cost_usd = true; }
    if (typeof payload.duration_ms === 'number') { totals.provider_minutes += payload.duration_ms / 60000; seen.provider_minutes = true; }
    const u = payload.usage;
    if (u && typeof u === 'object') {
      const tokens = ['input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens']
        .reduce((sum, k) => sum + (typeof u[k] === 'number' ? u[k] : 0), 0);
      if (tokens > 0) { totals.tokens += tokens; seen.tokens = true; }
    }
  }
  const why = unreadable.length ? unreadable.join('; ') : 'no session payload reported this metric';
  const reported = {};
  const unavailable = {};
  for (const key of ['tokens', 'cost_usd', 'provider_minutes']) {
    if (seen[key]) reported[key] = totals[key];
    else { reported[key] = null; unavailable[key] = why.slice(0, 500); }
  }
  return { reported, unavailable };
}

// Everything a record needs before it may be reported, in one place, applied once: the
// provider's figures, the adoption this run actually showed, and the validator's own
// verdict on the result. Before this existed `driveRun` assigned a status from the
// evaluator and wrote it, so every record the orchestrator produced failed
// `effort.problems()` — the two halves of the edition never met.
//
// A record that cannot pass its own validator is `invalid` with the problems as its
// reason. That keeps candidate acceptance and experiment validity separate: the
// evaluation stays on the record either way, and a rejected candidate remains a perfectly
// valid measurement.
function complete(record, { logDir, workspace, sessions }) {
  const usage = readUsage(logDir, sessions);
  record.reported = usage.reported;
  for (const [key, why] of Object.entries(usage.unavailable)) record.unavailable[key] = why;

  const adoption = observeAdoption(workspace);
  if (record.adoption.required) {
    record.adoption.observed = adoption.observed;
    record.adoption.evidence = adoption.evidence;
    if (!adoption.observed && record.status === 'valid') {
      record.status = 'invalid';
      record.reason = 'the strict arm did not adopt strict coverage: no schema 3 change record with a coverage object and an adopt event is in the workspace. A run that did not adopt is a protocol failure, not a strict result';
    }
  } else {
    // A default arm that adopted is a finding too, and the validator refuses to record it
    // as adoption, so it is recorded as what it is: a run that did not do its arm.
    record.adoption.observed = false;
    record.adoption.evidence = null;
    if (adoption.observed && record.status === 'valid') {
      record.status = 'invalid';
      record.reason = `the ${record.arm} arm adopted strict coverage, which is not its protocol: ${adoption.evidence}`.slice(0, 500);
    }
  }

  const problems = effort.problems(record);
  if (problems.length && record.status === 'valid') {
    record.status = 'invalid';
    record.reason = `the record does not validate: ${problems.map(x => `${x.code} ${x.detail}`).join('; ')}`.slice(0, 500);
  }
  return problems;
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
    spendingCap = false, unrelatedEdits = null, frozen = null,
  } = opts;
  const record = readRecord(runsRoot, cell);
  if (!record) throw new Error(`no planned record at ${idOf(cell)}`);
  // Resume: a cell that already reached a terminal status is never redriven. This is the
  // whole reason the study can span reset windows without repeating paid work.
  if (record.status !== 'pending') return { record, stop: false, skipped: true };

  // --- preflight ----------------------------------------------------------------------
  // Everything that can refuse happens BEFORE the workspace is touched or a session is
  // launched, and none of it writes a terminal status. A refusal that marks the cell
  // `outstanding` strands it: `driveRun` then skips any non-pending cell forever and
  // `claimRerun` replaces only invalid runs, so one dry run would cost a cell of the
  // study permanently. A refusal that launched nothing leaves the cell as it found it.
  const refuse = detail => ({ record, stop: true, refused: true, detail });
  if (spendingCap !== true) return refuse(`${record.run}: no spending cap has been asserted; nothing was prepared and no session was launched`);
  if (cohort !== record.cohort) {
    return refuse(`${record.run}: the cohort given to the driver (${String(cohort).slice(0, 12)}) is not the cohort this cell was planned under (${String(record.cohort).slice(0, 12)})`);
  }
  // The freeze, recomputed. A cohort identity is only a claim until something compares it
  // with the files it is supposed to be a digest of; the driver validated its SHAPE and
  // nothing else, so a run could name a frozen execution path while an edited one drove it.
  if (frozen && frozen.cohort && frozen.cohort !== record.cohort) {
    return refuse(`${record.run}: the execution path has changed since this cell was planned (${String(record.cohort).slice(0, 12)} → ${frozen.cohort.slice(0, 12)}); plan a new cohort rather than driving this one`);
  }
  const plannedModel = record.environment.model;
  if (plannedModel !== null && plannedModel !== model) return refuse(`${record.run}: planned for model ${plannedModel}, driven with ${model}`);
  const plannedCaps = record.environment.caps || {};
  if (plannedCaps.turns_per_session !== null && plannedCaps.turns_per_session !== undefined && plannedCaps.turns_per_session !== maxTurns) {
    return refuse(`${record.run}: planned for ${plannedCaps.turns_per_session} turns per session, driven with ${maxTurns}`);
  }
  if (plannedCaps.wall_clock_minutes !== null && plannedCaps.wall_clock_minutes !== undefined && plannedCaps.wall_clock_minutes !== wallClockMinutes) {
    return refuse(`${record.run}: planned for a ${plannedCaps.wall_clock_minutes}-minute wall clock, driven with ${wallClockMinutes}`);
  }

  const home = runDir(runsRoot, cell);
  const ws = path.join(home, 'workspace');
  const scratch = path.join(home, 'scratch');
  const logs = path.join(home, 'logs');
  const brief = briefs.loadBrief(cell.brief, dir);

  // A pending cell with a workspace already on disk is an interrupted attempt: the cell
  // never reached a terminal status, so something killed it mid-run. Re-drive it from
  // nothing. `harness.prepare` does not wipe, and its `git add -A` would otherwise commit
  // the dead attempt's files into this run's recorded base — a record that looks clean,
  // with a base nobody can tell is polluted. The discarded logs are kept under their own
  // name and the attempt is named in an event, so the repetition is visible rather than
  // silently paid for twice.
  const setupStart = iso();
  if (fs.existsSync(ws)) {
    const attempt = fs.readdirSync(home).filter(n => n.startsWith('logs-attempt-')).length + 1;
    if (fs.existsSync(logs)) fs.renameSync(logs, path.join(home, `logs-attempt-${attempt}`));
    fs.rmSync(ws, { recursive: true, force: true });
    fs.rmSync(scratch, { recursive: true, force: true });
    record.events.push({
      kind: 'intervention', id: `${record.run}:attempt-${attempt}`, started: setupStart, ended: setupStart,
      intervention: 'operator',
      detail: `an interrupted attempt was discarded and the cell re-driven from a clean workspace; its logs are retained at logs-attempt-${attempt}`,
    });
  }

  // Order matters, and it is the opposite of what the edition shipped with. The kit is
  // installed and committed FIRST, because the install ends in `git add -A`; injecting
  // the brief's unrelated edits before it committed the very work the run is asked to
  // leave alone, and the preservation check would then have been scored against a tree
  // the harness had already contaminated.
  harness.prepare(ws, cell.brief, { arm: cell.arm, dir });
  const installed = installKit(ws, cell.arm, kit);
  record.provenance.kit = installed ? installed.digest : null;
  record.provenance.kit_source = installed ? installed.source : null;
  record.provenance.base = harness.git(ws, 'rev-parse', 'HEAD');
  // Injected after the base is taken, and recorded, because an unrecorded injection is
  // an unmeasurable one: the evaluator reads what to preserve from the record, and an
  // absent map makes the whole check pass vacuously.
  const edits = unrelatedEdits || (typeof brief.base.unrelated === 'function' ? brief.base.unrelated(ws, harness.LIB) : null);
  record.workspace = { unrelated_edits: harness.applyUnrelated(ws, edits) };
  record.environment.model = model;
  record.environment.caps = { turns_per_session: maxTurns, wall_clock_minutes: wallClockMinutes };
  record.events.push({ kind: 'stage', id: `${record.run}:setup`, stage: 'setup', started: setupStart, ended: iso() });
  // The first checkpoint that says this cell was actually started. Everything above is
  // recoverable from the workspace; from here on a crash costs money.
  writeRecord(runsRoot, cell, record);

  const sessionNames = brief.prompts.map(x => x.name);
  for (const p of brief.prompts) {
    const promptFile = path.join(scratch, `${p.name}.prompt`);
    fs.mkdirSync(scratch, { recursive: true });
    const prompt = `${ARM_PREAMBLE[cell.arm] || ''}${p.prompt}`;
    fs.writeFileSync(promptFile, prompt);
    const s = driveSession({
      run: record.run, workspace: ws, promptFile, model, maxTurns,
      wallClockMinutes, cohort, logDir: logs, name: p.name, spendingCap,
    });
    if (s.refused) return refuse(`${record.run}: the driver refused the session; no spending cap has been asserted`);
    record.events.push({
      kind: 'session', id: `${record.run}:${p.name}`, started: s.started, ended: s.ended,
      prompt: prompt.slice(0, effort.LIMITS.prompt),
    });
    // Checkpointed per SESSION, not per cell. A cell is up to three paid sessions; a
    // crash after the second used to leave a record reading `pending` with no events,
    // so nothing on disk said those sessions had been bought.
    writeRecord(runsRoot, cell, record);

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
  const problems = complete(record, { logDir: logs, workspace: ws, sessions: sessionNames });
  writeRecord(runsRoot, cell, record);
  return { record, stop: false, problems };
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
    if (result.stop) {
      // A refusal reports its own detail: the cell is untouched and still pending, so its
      // record carries no reason to read.
      return { driven, stopped: result.record.run, reason: result.detail || result.record.reason, refused: Boolean(result.refused) };
    }
  }
  return { driven, stopped: null, reason: null, refused: false };
}

// --- the operator entry point ---------------------------------------------------------
// Without this the schedule has no runnable form: an operator would hand-write the caller
// that supplies the cohort, the kit, the caps and the adapter — which is precisely the
// unfrozen script this file exists to make unnecessary. A frozen loop reachable only by
// writing an unfrozen loop is not frozen.
//
// It computes the freeze itself and hands it to `driveRun`, so the cohort a record names
// is checked against the files on disk rather than against the operator's memory.
async function main(argv) {
  const flag = (name, fallback = null) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? fallback : argv[i + 1];
  };
  const runsRoot = flag('runs');
  if (!runsRoot || argv.includes('--help')) {
    process.stdout.write([
      'usage: node orchestrator.cjs --runs <dir> [options]',
      '',
      '  --runs <dir>              where run directories and records live (required)',
      '  --kit <tarball>           the released kit installed for the pincer and strict arms',
      '  --model <name>            default sonnet',
      '  --max-turns <n>           default 150',
      '  --wall-clock-minutes <n>  default 30',
      '  --browser <module>        a CommonJS module exporting the browser adapter. Without',
      '                            one, every UI check is `unverified`, which makes those runs',
      '                            `unavailable` — never accepted.',
      '  --plan-only               write the pending records and stop',
      '  --i-have-a-spending-cap   assert that a human has agreed a cap. Without it nothing',
      '                            is prepared and no session is launched.',
      '',
    ].join('\n'));
    return runsRoot ? 0 : 2;
  }
  const { REPO, SPEC } = require('./freeze-spec.cjs');
  const frozen = freeze.compute(REPO, SPEC);
  const model = flag('model', SPEC.configuration.values.model);
  const maxTurns = Number(flag('max-turns', SPEC.caps.turns_per_session));
  const wallClockMinutes = Number(flag('wall-clock-minutes', SPEC.caps.wall_clock_minutes));
  const browserModule = flag('browser');
  const browser = browserModule ? require(path.resolve(browserModule)) : null;
  if (!browser) process.stderr.write('orchestrator: no --browser adapter; any UI check will be unverified and those runs unavailable, never accepted\n');

  const opts = {
    cohort: frozen.cohort, frozen,
    kit: flag('kit'), model, maxTurns, wallClockMinutes, browser,
    spendingCap: argv.includes('--i-have-a-spending-cap'),
    provenance: {
      protocol: frozen.inputs.protocol, prompts: frozen.inputs.briefs, driver: frozen.inputs.driver,
      collector: frozen.inputs.collector, evaluator: frozen.inputs.evaluators,
      caps: frozen.inputs.caps, configuration: frozen.inputs.configuration,
    },
    environment: { model, caps: { turns_per_session: maxTurns, wall_clock_minutes: wallClockMinutes } },
  };
  const planned = plan(runsRoot, opts);
  process.stdout.write(`cohort ${frozen.cohort}\n${planned.cells.length} cells, ${planned.created.length} newly planned\n`);
  if (argv.includes('--plan-only')) return 0;

  const result = await driveSchedule(runsRoot, opts);
  for (const d of result.driven) process.stdout.write(`${d.skipped ? 'skip' : 'run '} ${d.run} ${d.status}\n`);
  if (result.stopped) {
    process.stderr.write(`stopped at ${result.stopped}: ${result.reason}\n`);
    return result.refused ? 3 : 1;
  }
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then(code => { process.exit(code); }, e => { process.stderr.write(`orchestrator: ${e.message}\n`); process.exit(1); });
}

module.exports = {
  main,
  DRIVER, CAP_EXIT, CAP_MARKER, LIMIT_RE, RERUN_FIRST,
  ARM_PREAMBLE, CHANGES_DIR,
  runDir, recordPath, readRecord, writeRecord,
  observeAdoption, readUsage, complete,
  limitHit, endOf, nextRepetition, plan, claimRerun, installKit,
  driveSession, driveRun, driveSchedule,
};
