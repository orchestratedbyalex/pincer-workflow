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
const finalization = require('./finalization.cjs');
const os = require('node:os');
const path = require('node:path');
const briefs = require('./briefs.cjs');
const schedule = require('./schedule.cjs');
const harness = require('./harness.cjs');
const effort = require('./effort.cjs');
const freeze = require('./freeze.cjs');
const effectiveInputs = require('./effective.cjs');
const claims = require('./run-claims.cjs');
const attempts = require('./attempts.cjs');
const isolation = require('./isolated-launch.cjs');
const { prepareBrowser } = require('./browser-preflight.cjs');
const studyReadiness = require('./readiness.cjs');
const allocationBudget = require('./allocation.cjs');

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
// it, up to MAX_REPETITION. Pair-level exclusive claims serialize allocation; cell
// claims protect complete atomic record publication. Existing records are never replaced.
const RERUN_FIRST = schedule.REPETITIONS + 1;

const iso = () => new Date().toISOString();

// The schedule stamps `run` on every cell it emits; a rerun cell is built here and has
// none, so derive it the same way `effort` does rather than keeping a second spelling.
const idOf = cell => cell.run || effort.runId(cell.brief, cell.repetition, cell.arm);

function validateCell(cell) {
  if (!cell || !briefs.briefIds().includes(cell.brief) || !schedule.ARMS.includes(cell.arm) || !Number.isInteger(cell.repetition) || cell.repetition < 1 || cell.repetition > schedule.MAX_REPETITION || (cell.run !== undefined && cell.run !== effort.runId(cell.brief, cell.repetition, cell.arm))) {
    throw Object.assign(new Error('invalid or escaping study cell identity'), { code: 'RUN_ID_INVALID' });
  }
  return cell;
}
function cellKey(cell) { validateCell(cell); return `cell.${cell.brief}.${cell.repetition}.${cell.arm}`; }
function runDir(runsRoot, cell) {
  validateCell(cell);
  return claims.contained(runsRoot, `${cell.brief}/rep-${cell.repetition}/${cell.arm}`);
}

function recordPath(runsRoot, cell) {
  runDir(runsRoot, cell);
  return claims.contained(runsRoot, `${cell.brief}/rep-${cell.repetition}/${cell.arm}/record.json`);
}

function readRecord(runsRoot, cell) {
  const p = recordPath(runsRoot, cell);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}

// Written through a temp file and renamed, so a process killed mid-write leaves the
// previous record intact rather than a truncated one. A half-written checkpoint is worse
// than none: resume would skip the cell.
function writeRecord(runsRoot, cell, record, claim = null) {
  const key = cellKey(cell);
  if (record.run !== idOf(cell) || record.brief !== cell.brief || record.arm !== cell.arm || record.repetition !== cell.repetition) throw new Error('record identity does not match cell');
  const owned = claim || claims.acquire(runsRoot, key, 'record publication');
  try {
    claims.assertOwner(owned, runsRoot, key);
    const dir = runDir(runsRoot, cell);
    if (finalization.blocked(dir)) throw new Error('FINALIZATION_FAILED: record mutation requires explicit operator disposition');
    fs.mkdirSync(dir, { recursive: true });
    const file = claims.contained(runsRoot, `${cell.brief}/rep-${cell.repetition}/${cell.arm}/record.json`);
    claims.atomicWrite(file, `${JSON.stringify(record, null, 2)}\n`);
    return file;
  } finally { if (!claim) claims.release(owned); }
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
function plan(runsRoot, options) {
  const ids = options.ids || briefs.briefIds();
  for (const cell of scheduledCells(ids, options.repetitions)) validateCell(cell);
  planOwned(runsRoot, options, true);
  const claim = claims.acquire(runsRoot, 'plan', 'schedule planning');
  try { return planOwned(runsRoot, options); } finally { claims.release(claim); }
}
// The scheduled cells, optionally limited to the first `repetitions` repetitions. An
// operational smoke approves one session per arm; without this prefix, planning a brief
// would materialise cells the smoke allocation never approved, and the allocation's
// unlisted-run guard would then refuse every launch. Cell identities are unchanged, so a
// later full plan of the same runs root simply adds the remaining repetitions.
function scheduledCells(ids, repetitions = schedule.REPETITIONS) {
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > schedule.REPETITIONS) throw new Error(`repetitions must select a prefix of the ${schedule.REPETITIONS} scheduled repetitions`);
  return schedule.schedule(ids).filter(cell => cell.repetition <= repetitions);
}
function planOwned(runsRoot, { cohort, provenance = {}, environment = {}, ids = briefs.briefIds(), effective = null, repetitions }, dryRun = false) {
  const cells = scheduledCells(ids, repetitions);
  if (effective) {
    const manifest = effectiveInputs.assertCurrent(effective);
    ({ provenance, environment } = effectiveInputs.recordInputs(manifest));
    if (manifest.cohort !== cohort) throw new Error('effective cohort does not match plan');
    const manifestPath = path.join(runsRoot, 'effective-manifest.json');
    if (fs.existsSync(manifestPath) && effectiveInputs.canonical(JSON.parse(fs.readFileSync(manifestPath, 'utf8'))) !== effectiveInputs.canonical(manifest)) throw new Error('existing plan has different effective inputs');
    // Inspect all stored cells, including reruns and briefs outside this invocation.
    // Never fill a partially populated plan until the entire existing plan agrees.
    function inspect(dir) {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) throw new Error('plan contains a symbolic link');
        const file = path.join(dir, entry.name);
        if (entry.isDirectory() && !['workspace', 'scratch', 'logs'].includes(entry.name) && !entry.name.startsWith('logs-attempt-')) inspect(file);
        else if (entry.isFile() && entry.name === 'record.json') {
          const record = JSON.parse(fs.readFileSync(file, 'utf8'));
          if (record.cohort !== cohort) throw new Error('existing record has different effective inputs');
          for (const [key, value] of Object.entries(provenance)) {
            if (record.provenance?.[key] !== value) throw new Error('existing record has unknown effective provenance');
          }
          for (const [key, value] of Object.entries(environment)) {
            if (effectiveInputs.canonical(record.environment?.[key]) !== effectiveInputs.canonical(value)) throw new Error('existing record has different effective environment');
          }
        }
      }
    }
    inspect(runsRoot);
    if (dryRun) return;
    fs.mkdirSync(runsRoot, { recursive: true });
    if (!fs.existsSync(manifestPath)) claims.atomicWrite(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  if (dryRun) return;
  const created = [];
  for (const cell of cells) {
    if (readRecord(runsRoot, cell)) continue;
    const claim = claims.acquire(runsRoot, cellKey(cell), 'new planned cell');
    try {
    if (readRecord(runsRoot, cell)) continue;
    const record = effort.empty({
      run: idOf(cell), cohort,
      brief: cell.brief, arm: cell.arm, repetition: cell.repetition, order: cell.order,
      provenance, environment,
    });
    writeRecord(runsRoot, cell, record, claim);
    created.push(record.run);
    } finally { claims.release(claim); }
  }
  return { cells, created };
}

// Claim a rerun slot for an invalidated cell. The replaced run is named in the new
// record's reason and in an `operator` event, so a reader never has to infer which run a
// rerun replaces — and the original stays on disk with its own reason.
function claimRerun(runsRoot, cell, options) {
  validateCell(cell);
  const allocation = claims.acquire(runsRoot, `reruns.${cell.brief}.${cell.arm}`, 'rerun slot allocation');
  let original;
  try {
    original = claims.acquire(runsRoot, cellKey(cell), 'inspect original for rerun');
    return claimRerunOwned(runsRoot, cell, options);
  } finally { if (original) claims.release(original); claims.release(allocation); }
}
function claimRerunOwned(runsRoot, cell, { cohort, provenance = {}, environment = {} }) {
  if (finalization.blocked(runDir(runsRoot, cell))) throw new Error('FINALIZATION_FAILED: original requires explicit operator disposition');
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
const usageAccounting = require('./usage.cjs');
function readUsage(logDir, names) {
  return usageAccounting.collect(logDir, { schema: 7 }, names);
}

// Everything a record needs before it may be reported, in one place, applied once: the
// provider's figures, the adoption this run actually showed, and the validator's own
// verdict on the result. Before this existed `driveRun` assigned a status from the
// evaluator and wrote it, so every record the orchestrator produced failed
// `effort.problems()` — the two halves of the edition never met.
//
// Compute complete accounting and protocol observations without repairing invalid
// data into a plausible result. The caller validates before publishing, or retains a
// separate diagnostic envelope and the exact attempted record on failure.
function complete(record, { home, logDir, workspace, sessions }) {
  const usage = usageAccounting.collect(record.schema === 8 ? home : logDir, record, sessions);
  usageAccounting.apply(record, usage);

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

  return effort.problems(record);
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
  return { digest, source: `tarball ${path.basename(kit)}`, version,
    base: harness.commitAll(ws, `Install PINCER kit v${version}`, harness.PREPARATION_DATE) };
}

// One session, through the frozen driver. Nothing else in this file may reach a model,
// and this function adds nothing to the prompt: a driver — or an orchestrator — that
// coaches is measuring itself rather than the workflow.
function driveSession({ run, workspace, promptFile, model, maxTurns, wallClockMinutes, cohort, logDir, name, spendingCap, effective = null,
  arm, stateRoot, apiKey, expectedAssets, onGroup, readiness, observationFile, allocation, signal }) {
  if (spendingCap !== true) {
    return { refused: true, status: 3, stdout: '', stderr: 'orchestrator: refused: no spending cap has been asserted' };
  }
  try {
    const current = effectiveInputs.assertCurrent(effective);
    if (current.cohort !== cohort || current.effective.model !== model || current.caps.turns_per_session !== maxTurns || current.caps.wall_clock_minutes !== wallClockMinutes) throw new Error('session inputs differ from effective manifest');
  } catch (error) { return { refused: true, status: 3, stdout: '', stderr: error.message }; }
  return isolation.launchNative({ effective, arm, workspace, stateRoot, logDir, name,
    prompt: fs.readFileSync(promptFile, 'utf8'), apiKey, expectedAssets, onGroup, readiness, observationFile, allocation, signal });
}

// Resolve actual recorded decisions before any workspace preparation. The old cap
// flag remains an extra opt-in; it cannot manufacture a study grant or a budget.
function studyFor(runsRoot, opts, run = null, name = null, prompt = null) {
  if (!opts.effective?.manifest) throw new Error('An effective manifest is required before study execution');
  // The purpose is the approved manifest's label. A measured launch needs the reviewed
  // native isolation observation; an operational smoke is the launch that collects it,
  // and its sessions are never reportable study results.
  const purpose = opts.allocation?.purpose;
  if (!opts.allocation?.manifestPath || !['measured', 'operational-smoke'].includes(purpose)) {
    throw new Error('A concrete measured-study or operational-smoke manifest and allocation are required');
  }
  const context = { manifestPath: opts.allocation.manifestPath,
    inputRoot: opts.allocation.inputRoot, purpose };
  const inspected = studyReadiness.inspectStudy(context);
  if (!inspected.ready || !inspected.launchGrant) {
    const codes = (inspected.pending || []).map(item => item.code).join(', ');
    throw new Error(`Study readiness is pending: ${codes || 'no validated grant'}`);
  }
  const grant = inspected.launchGrant;
  if (fs.realpathSync(grant.allocation.root) !== fs.realpathSync(runsRoot) ||
      grant.execution.effective_digest !== opts.effective?.manifest?.cohort) {
    throw new Error('Study allocation root or effective execution identity differs from this run');
  }
  let selected = null;
  if (run !== null) {
    const matches = grant.sessions.filter(session => session.run === run && session.name === name);
    if (matches.length !== 1) throw new Error('The study schedule must name this session exactly once');
    selected = matches[0];
    if (selected.effective_digest !== grant.execution.effective_digest ||
        (prompt !== null && selected.prompt_digest !== effort.sha256(prompt))) {
      throw new Error('Scheduled prompt or execution identity differs from the delivered session');
    }
    context.nextSessionId = selected.id;
  }
  const executionRoot = fs.realpathSync(opts.effective.inputRoot || opts.effective.root);
  if (fs.realpathSync(grant.inputRoot) !== fs.realpathSync(executionRoot)) {
    throw new Error('Study and execution artifacts must use the same declared root');
  }
  // Only a measured launch carries the reviewed observation; the smoke that produces
  // it has none yet, and the launcher refuses a measured launch without it.
  let observationFile = null;
  if (purpose === 'measured') {
    const observationPath = effectiveInputs.contained(grant.inputRoot, grant.observationFile);
    observationFile = path.relative(executionRoot, observationPath).split(path.sep).join('/');
    effectiveInputs.contained(executionRoot, observationFile);
  }
  const project = selected && grant.projects.find(item => item.id === selected.project);
  if (selected && !project) throw new Error('The selected study project has no approved immutable base');
  return {
    projectBase: project?.base || null,
    allocation: context,
    readiness: { purpose, spendingAuthorized: true, projectAccessAuthorized: true,
      hostPolicyPreserved: true, decisionRef: grant.decision.ref,
      ...(purpose === 'measured' ? { observationReviewed: true } : {}) },
    observationFile,
  };
}

// One run, end to end. Returns { record, stop } — `stop` is true only for an account
// limit, which is the single condition that must halt the whole schedule rather than
// this cell.
async function driveRun(runsRoot, cell, opts) {
  const key = cellKey(cell);
  // Validate containment before creating claim metadata, even for a losing claimant.
  runDir(runsRoot, cell);
  let claim;
  try { claim = claims.acquire(runsRoot, key, 'execute study cell'); }
  catch (error) {
    if (!['RUN_BUSY', 'RUN_RECOVERY_REQUIRED'].includes(error.code)) throw error;
    return { record: readRecord(runsRoot, cell), stop: true, refused: true, code: error.code, detail: error.message };
  }
  let result;
  try { result = await driveRunOwned(runsRoot, cell, opts, claim); return result; }
  finally {
    // If even diagnostic storage failed, retain ownership: automatic retry cannot
    // safely distinguish the last checkpoint from an unrecorded terminal decision.
    if (!result?.diagnosticFailure) claims.release(claim);
  }
}
async function driveRunOwned(runsRoot, cell, opts, claim) {
  const {
    cohort, kit = null, model = 'sonnet', maxTurns = 150, wallClockMinutes = 30,
    dir = briefs.BRIEFS_DIR, tools = harness.DEFAULT_TOOLS(), browser = null,
    spendingCap = false, unrelatedEdits = null, frozen = null,
  } = opts;
  const record = readRecord(runsRoot, cell);
  if (!record) throw new Error(`no planned record at ${idOf(cell)}`);
  if (finalization.blocked(runDir(runsRoot, cell))) return { record, stop: true, refused: true, code: 'FINALIZATION_FAILED', detail: 'Retained finalization failure requires explicit operator disposition' };
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
  const home = runDir(runsRoot, cell);
  const brief = briefs.loadBrief(cell.brief, dir);
  let nativeStudy = null;
  try {
    const invalid = effort.problems(record);
    if (invalid.length) throw new Error(`planned checkpoint is invalid: ${invalid.map(p => p.code).join(', ')}`);
    attempts.requireResume(home, record, opts.resumeInterrupted);
    if (typeof opts.fixtureSession !== 'function' && record.schema === 7 && attempts.resumeTarget(home, record) && !/^[a-f0-9]{40}$/.test(record.provenance.base || '')) {
      throw Object.assign(new Error('Interrupted historical native execution has no recorded original base; retain it for explicit disposition, not regeneration'), { code: 'ORIGINAL_BASE_UNAVAILABLE' });
    }
  } catch (error) { return { ...refuse(error.message), code: error.code || 'RECORD_INVALID' }; }
  let effectiveBrowser = browser;
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
  if (typeof opts.fixtureSession !== 'function') {
    try {
      const first = brief.prompts[0];
      nativeStudy = studyFor(runsRoot, opts, record.run, first.name,
        `${ARM_PREAMBLE[cell.arm] || ''}${first.prompt}`);
      const current = effectiveInputs.assertCurrent(opts.effective);
      if (current.cohort !== cohort || current.effective.model !== model || current.caps.turns_per_session !== maxTurns || current.caps.wall_clock_minutes !== wallClockMinutes) throw new Error('runtime inputs differ from effective manifest');
      const inputRoot = opts.effective.inputRoot || opts.effective.root;
      if (kit !== effectiveInputs.contained(inputRoot, opts.effective.input.kit.path)) throw new Error('runtime kit differs from effective manifest');
      if (dir !== briefs.BRIEFS_DIR || opts.tools || browser || opts.unrelatedEdits) throw new Error('unbound brief, tool or browser override');
      const gate = isolation.preflightExecution({ effective: opts.effective, apiKey: opts.apiKey,
        ...nativeStudy, onGroup: group => claims.registerGroup(claim, group) });
      if (!gate.ok) throw new Error(gate.detail);
      if (cell.brief === 'ui-states') effectiveBrowser = await prepareBrowser(opts.effective, { signal: opts.signal });
    } catch (error) { return refuse(error.message); }
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

  const sessionNames = brief.prompts.map(x => x.name);
  let attempt;
  try { attempt = attempts.begin(home, record, { resumeInterrupted: opts.resumeInterrupted, sessionNames }); }
  catch (error) { return { ...refuse(error.message), code: error.code || 'ATTEMPT_INVALID' }; }
  const ws = attempts.location(home, attempt, 'workspace');
  const scratch = attempts.location(home, attempt, 'scratch');
  const logs = attempts.location(home, attempt, 'logs');
  const checkpoint = () => {
    if (record.status !== 'pending' && attempt.status === 'running') attempts.finish(attempt);
    usageAccounting.apply(record, usageAccounting.collect(home, record));
    writeRecord(runsRoot, cell, record, claim);
  };
  const finalize = (status, reason = null, stop = false) => {
    record.status = status;
    record.reason = reason;
    for (const session of attempt.sessions) if (session.status === 'intent') {
      session.status = 'unavailable';
      session.unavailable = 'Session completion was not observed; retained output may be partial.';
    }
    attempts.finish(attempt);
    try {
      const problems = complete(record, { home, logDir: logs, workspace: ws, sessions: sessionNames });
      if (problems.length) return finalization.failed(home, record);
      writeRecord(runsRoot, cell, record, claim);
      return { record, stop, problems };
    } catch { return finalization.failed(home, record); }
  };
  try {
  const boundary = async name => {
    if (typeof opts.fixtureSession === 'function' && typeof opts.fixtureCheckpoint === 'function') await opts.fixtureCheckpoint(name, { record, attempt, workspace: ws, scratch, logs });
  };
  // Persist identity before creating any directory or launching any setup/session work.
  checkpoint();
  await boundary('attempt-start');
  if (typeof opts.fixtureSession === 'function') record.environment = { ...record.environment, fixture: true, tool: 'synthetic-session' };
  const setupStart = iso();

  // Order matters, and it is the opposite of what the edition shipped with. The kit is
  // installed and committed FIRST, because the install ends in `git add -A`; injecting
  // the brief's unrelated edits before it committed the very work the run is asked to
  // leave alone, and the preservation check would then have been scored against a tree
  // the harness had already contaminated.
  const originalAttempt = record.attempts.slice(0, -1).find(previous => previous.base);
  let edits;
  if (originalAttempt) {
    attempts.restoreBase(home, originalAttempt, ws);
    edits = originalAttempt.origin === 'legacy' && Object.keys(record.workspace.unrelated_edits || {}).length === 0 ? {} : attempts.loadUnrelated(home, originalAttempt);
  } else {
    harness.prepare(ws, cell.brief, { arm: cell.arm, dir });
    const installed = installKit(ws, cell.arm, kit);
    record.provenance.kit = installed ? installed.digest : null;
    record.provenance.kit_source = installed ? installed.source : null;
    edits = unrelatedEdits || (typeof brief.base.unrelated === 'function' ? brief.base.unrelated(ws, harness.LIB) : null);
  }
  const expectedAssets = typeof opts.fixtureSession === 'function' ? null : isolation.assetsFor(cell.arm, ws).files;
  attempt.configuration_digest = expectedAssets === null ? null : effort.sha256(effectiveInputs.canonical(expectedAssets));
  if (originalAttempt && originalAttempt.configuration_digest !== attempt.configuration_digest) throw new Error('Original attempt configuration changed; refusing launch');
  record.provenance.base = harness.git(ws, 'rev-parse', 'HEAD');
  attempt.base = record.provenance.base;
  let preparedProjectBase = null;
  if (nativeStudy) {
    // Project identity precedes the arm's single kit-install commit. Read the raw
    // parent ID so an exact-base shallow restart needs no copied ancestor objects.
    const projectBase = cell.arm === 'plain' ? attempt.base :
      harness.git(ws, 'cat-file', '-p', attempt.base).match(/^parent ([a-f0-9]{40})$/m)?.[1];
    preparedProjectBase = projectBase;
    if (projectBase !== nativeStudy.projectBase) {
      throw new Error('Prepared workspace differs from the approved immutable study base; no model was launched');
    }
  }
  if (originalAttempt && attempt.base !== originalAttempt.base) throw new Error('Original attempt base changed; refusing launch');
  attempts.validateUnrelated(ws, edits);
  attempts.saveUnrelated(home, attempt, edits);
  record.workspace = { unrelated_edits: harness.applyUnrelated(ws, edits) };
  record.environment.model = model;
  record.environment.caps = { ...record.environment.caps, turns_per_session: maxTurns, wall_clock_minutes: wallClockMinutes };
  record.events.push({ kind: 'stage', id: attempts.eventId(record, attempt, 'setup'), stage: 'setup', started: setupStart, ended: iso() });
  // The first checkpoint that says this cell was actually started. Everything above is
  // recoverable from the workspace; from here on a crash costs money.
  checkpoint();
  await boundary('setup');
  let executionFailure = null;
  let stopAfterEvaluation = false;
  for (const p of brief.prompts) {
    const promptFile = path.join(scratch, `${p.name}.prompt`);
    fs.mkdirSync(scratch, { recursive: true });
    const prompt = `${ARM_PREAMBLE[cell.arm] || ''}${p.prompt}`;
    fs.writeFileSync(promptFile, prompt);
    const session = typeof opts.fixtureSession === 'function' ? opts.fixtureSession : driveSession;
    let reservation = null;
    if (typeof opts.fixtureSession !== 'function') {
      try {
        nativeStudy = studyFor(runsRoot, opts, record.run, p.name, prompt);
        if (nativeStudy.projectBase !== preparedProjectBase) throw new Error('Scheduled session project base differs from the prepared workspace');
        reservation = allocationBudget.reserve({ ...nativeStudy.allocation, cellClaim: claim,
          session: { id: `${attempt.id}:${p.name}`, run: record.run, attempt: attempt.id,
            name: p.name, payload: `${record.run}/${attempt.directory}/logs/${p.name}.json` } });
        nativeStudy.allocation = { ...nativeStudy.allocation, handle: reservation };
      } catch {
        return refuse('Study allocation no longer permits this session; retained pending work requires explicit resume.');
      }
    }
    const intent = attempts.intent(record, attempt, p.name, prompt.slice(0, effort.LIMITS.prompt));
    checkpoint();
    await boundary('session-start');
    let s;
    try { s = await session({
      run: record.run, workspace: ws, promptFile, model, maxTurns,
      wallClockMinutes, cohort, logDir: logs, name: p.name, spendingCap, effective: opts.effective,
      onGroup: group => claims.registerGroup(claim, group),
      arm: cell.arm, stateRoot: scratch, apiKey: opts.apiKey, expectedAssets,
      ...(nativeStudy || {}), signal: opts.signal,
    }); } catch { return finalize('invalid', 'Session execution threw before completion; retained output may be partial.'); }
    attempts.sessionEnd(record, attempt, intent, s);
    if (s.environment) record.environment = { ...record.environment, ...s.environment };
    // Checkpointed per SESSION, not per cell. A cell is up to three paid sessions; a
    // crash after the second used to leave a record reading `pending` with no events,
    // so nothing on disk said those sessions had been bought.
    checkpoint();
    await boundary('session-end');
    let allocationStopped = false;
    if (reservation) {
      const reconciled = allocationBudget.reconcile({ ...nativeStudy.allocation,
        handle: reservation, result: s, cellClaim: claim });
      allocationStopped = reconciled.stopped || reconciled.ready === false;
    }
    if (s.refused) return refuse('The driver refused before invocation; retained pending attempt requires explicit resume.');
    let result;
    try { result = JSON.parse(fs.readFileSync(path.join(logs, `${p.name}.json`), 'utf8')); } catch {}
    const providerCap = s.status === 0 && result?.type === 'result' && result.is_error === true &&
      ['error_max_turns', 'error_max_budget_usd'].includes(result.subtype);
    const nativeUnreportable = typeof opts.fixtureSession !== 'function' && s.reportable !== true;
    // An operational smoke session is unreportable by purpose, not by defect: it runs
    // the whole path, including independent evaluation, is finalized as an invalid
    // operational record, launches no further prompt, and stops the schedule so the
    // operator inspects it before the next paid session.
    const operational = typeof opts.fixtureSession !== 'function' && s.observation === 'operational-smoke';
    if (allocationStopped || nativeUnreportable) {
      const reason = allocationStopped
        ? 'Study allocation stopped after this session; retained accounting or custody requires review.'
        : operational ? 'Operational smoke session: retained as operational evidence, never a study result.'
          : 'Native session did not attest the required model, isolation or process cleanup; artifacts retained.';
      // Once custody is gone, an independent evaluator may inspect a capped
      // candidate even though accounting/model attestation is incomplete. No
      // subsequent paid prompt is permitted, and experiment validity stays invalid.
      if ((s.end === 'capped' || providerCap || operational) && s.cleanup_complete === true && !s.limit) {
        executionFailure = reason;
        stopAfterEvaluation = true;
      } else return finalize('invalid', reason, true);
    }

    // An account limit ends the study, not the cell. Marking it invalid keeps the
    // partial work and its reason; walking on would convert every later cell into a
    // one-turn failure, which is precisely how v6 lost six runs.
    if (s.limit) {
      record.status = 'invalid';
      record.reason = `account limit during ${p.name}; the schedule stopped rather than continuing into it`;
      record.events.push({
        kind: 'intervention', id: attempts.eventId(record, attempt, `${p.name}:limit`), started: s.ended, ended: s.ended,
        intervention: 'operator', detail: record.reason,
      });
      return finalize(record.status, record.reason, true);
    }

    if (s.end === 'capped' || providerCap) {
      if (result && (result.is_error === true || String(result.subtype).startsWith('error_')) &&
          !['error_max_turns', 'error_max_budget_usd'].includes(result.subtype)) {
        executionFailure = 'A capped session also reported a provider execution error; independent candidate evaluation is retained but the experiment is invalid.';
      }
      // The cap is a fact about the run, recorded as an operator intervention — and the
      // run still goes to the evaluator. v6 marked one capped session as having produced
      // no usable work when it had committed code and been rejected on the merits; a cap
      // decides when a session stopped, never whether what it wrote was any good.
      record.events.push({
        kind: 'intervention', id: attempts.eventId(record, attempt, `${p.name}:cap`), started: s.ended, ended: s.ended,
        intervention: 'operator', detail: providerCap ? `session ${p.name} reached its predeclared provider cap (${result.subtype})` : `session ${p.name} ended by the ${wallClockMinutes}-minute wall-clock cap (exit ${CAP_EXIT})`,
      });
    } else if (s.end === 'ambiguous') {
      record.status = 'invalid';
      record.reason = `session ${p.name} exited ${s.status} without a matching cap marker; the cap and the exit status disagree`;
      return finalize(record.status, record.reason);
    }
    if (s.end !== 'capped' && !providerCap) {
      if (s.status !== 0 || s.end === 'failed' || !result || result.type !== 'result' || result.subtype !== 'success' || result.is_error === true) {
        return finalize('invalid', `Session ${p.name} has no successful provider completion; retained payload determines accounting.`, stopAfterEvaluation);
      }
    }
    if (executionFailure) break;
  }

  const candidate = harness.git(ws, 'rev-parse', 'HEAD');
  const evalStart = iso();
  attempt.evaluation = 'started';
  checkpoint();
  await boundary('pre-evaluation');
  let evaluation;
  try {
    evaluation = await harness.evaluateCandidate({ id: cell.brief, workspace: ws, candidate, dir, tools, browser: effectiveBrowser, record, scratch });
  } catch {
    return finalize('invalid', 'Independent evaluation failed; retained candidate and artifacts require review.', stopAfterEvaluation);
  }
  record.evaluation = {
    candidate, evaluator: effort.sha256(fs.readFileSync(path.join(dir, cell.brief, 'evaluator', 'evaluate.cjs'))),
    outcome: evaluation.outcome, checks: evaluation.checks,
  };
  record.events.push({ kind: 'evaluation', id: attempts.eventId(record, attempt, 'evaluation'), started: evalStart, ended: iso() });
  attempt.evaluation = 'completed';
  const status = executionFailure ? 'invalid' : harness.statusFor(evaluation.outcome);
  return finalize(status, executionFailure || (status === 'valid' ? null : 'Independent evaluation is unavailable or inconclusive; no acceptance is established.'), stopAfterEvaluation);
  } catch {
    // A thrown setup, collector or checkpoint operation retains the actual
    // in-memory record and last atomic checkpoint. Never infer a successful run.
    return finalization.failed(home, record);
  }

}

// Walk the schedule in execution order, stopping at the first account limit. Everything
// already terminal is skipped, so this is also the resume entry point: call it again
// after a reset window and it continues where the limit stopped it.
async function driveSchedule(runsRoot, opts) {
  const { ids = briefs.briefIds(), kit = null } = opts;
  const cells = scheduledCells(ids, opts.repetitions);
  if (typeof opts.fixtureSession !== 'function') {
    const refuse = reason => ({ driven: [], stopped: cells[0]?.run || null, reason, refused: true });
    if (opts.spendingCap !== true) return refuse('No spending cap asserted; no browser or session launched');
    if (cells.some(cell => !readRecord(runsRoot, cell))) return refuse('Every scheduled cell must be planned before execution');
    const next = cells.find(cell => readRecord(runsRoot, cell)?.status === 'pending');
    if (!next) return { driven: cells.map(cell => ({ run: idOf(cell),
      status: readRecord(runsRoot, cell)?.status || 'unplanned', skipped: true })), stopped: null, reason: null, refused: false };
    try {
      const first = briefs.loadBrief(next.brief).prompts[0];
      const nativeStudy = studyFor(runsRoot, opts, idOf(next), first.name,
        `${ARM_PREAMBLE[next.arm] || ''}${first.prompt}`);
      const gate = isolation.preflightExecution({ effective: opts.effective, apiKey: opts.apiKey,
        ...nativeStudy, onGroup: () => {} });
      if (!gate.ok) return refuse(gate.detail);
    }
    catch (error) { return refuse(error.message); }
  }
  // Check UI capability for the whole schedule before the first paid cell, even
  // when the first brief itself does not need a browser.
  if (typeof opts.fixtureSession !== 'function' && ids.includes('ui-states')) {
    await prepareBrowser(opts.effective, { signal: opts.signal });
  }
  // Checked before the first session rather than at the cell that needs it: discovering a
  // missing kit halfway through is discovering it after the paid runs behind it.
  if (!kit && cells.some(c => c.arm !== 'plain')) {
    throw new Error(`the schedule contains ${cells.filter(c => c.arm !== 'plain').length} kit-arm cells and no kit was given`);
  }
  const driven = [];
  for (const cell of cells) {
    const result = await driveRun(runsRoot, cell, opts);
    driven.push({ run: result.record?.run || idOf(cell), status: result.record?.status || 'pending', skipped: Boolean(result.skipped) });
    if (result.stop) {
      // A refusal reports its own detail: the cell is untouched and still pending, so its
      // record carries no reason to read.
      return { driven, stopped: result.record?.run || idOf(cell), reason: result.detail || result.record?.reason, refused: Boolean(result.refused) };
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
  let args;
  try { args = effectiveInputs.parseArgs(argv); }
  catch (error) { process.stderr.write(`orchestrator: ${error.message}\n`); return 2; }
  if (args.help || !args.runs) {
    process.stdout.write([
      'usage: node orchestrator.cjs --runs <dir> --execution-inputs <json> [options]',
      '--input-root <dir>  root containing kit and browser artifacts (default repository)',
      '--study-manifest <json> --study-input-root <dir>  actual decisions and retained readiness evidence',
      '--study-purpose measured|operational-smoke  the approved manifest purpose (default measured)',
      '--repetitions <n>  plan and drive only the first n scheduled repetitions (an operational smoke uses 1)',
      '--briefs <id,...>  plan and drive only these briefs, in schedule order (required for an operational smoke)',
      '--model <provider-id> --max-turns <n> --wall-clock-minutes <n> --max-budget-usd <n>',
      '--kit <relative-tarball> --browser <module>  override entries from execution inputs',
      'Missing browser leaves UI checks unavailable; browser dependency roots must be declared.',
      '--plan-only --i-have-a-spending-cap',
      'Execution inputs must pin tool executable/version, model, caps, kit commit, and configuration.',
      '',
    ].join('\n'));
    return args.help ? 0 : 2;
  }
  if (!args['execution-inputs']) throw new Error('--execution-inputs is required; historical plans are read-only');
  const unknownBriefs = (args.briefs || []).filter(id => !briefs.briefIds().includes(id));
  if (unknownBriefs.length) { process.stderr.write(`orchestrator: --briefs: unknown brief ${unknownBriefs.join(', ')}\n`); return 2; }
  const { REPO, SPEC } = require('./freeze-spec.cjs');
  const input = JSON.parse(fs.readFileSync(args['execution-inputs'], 'utf8'));
  if (args.model) input.model = args.model;
  if (args.kit) input.kit = { ...input.kit, path: args.kit };
  if (args.browser) input.browser = { ...input.browser, entry: args.browser };
  for (const [flag, key] of [['max-turns', 'turns_per_session'], ['wall-clock-minutes', 'wall_clock_minutes'], ['max-budget-usd', 'spend_usd']]) {
    if (Object.hasOwn(args, flag)) input.caps = { ...input.caps, [key]: args[flag] };
  }
  const inputRoot = args['input-root'] ? fs.realpathSync(args['input-root']) : REPO;
  const manifest = effectiveInputs.resolve(REPO, SPEC, input, { inputRoot });
  const effective = { root: REPO, spec: SPEC, inputRoot, input, manifest };
  const opts = {
    cohort: manifest.cohort, frozen: manifest, effective,
    kit: effectiveInputs.contained(inputRoot, input.kit.path), model: input.model,
    maxTurns: manifest.caps.turns_per_session, wallClockMinutes: manifest.caps.wall_clock_minutes,
    spendingCap: args['i-have-a-spending-cap'] === true,
    allocation: args['study-manifest'] ? { manifestPath: path.resolve(args['study-manifest']),
      inputRoot: args['study-input-root'] ? path.resolve(args['study-input-root']) : inputRoot,
      purpose: args['study-purpose'] || 'measured' } : null,
    repetitions: args.repetitions,
    ...(args.briefs ? { ids: args.briefs } : {}),
    apiKey: process.env.ANTHROPIC_API_KEY,
    provenance: {
      protocol: manifest.inputs.protocol, prompts: manifest.inputs.briefs, driver: manifest.inputs.driver,
      collector: manifest.inputs.collector, evaluator: manifest.inputs.evaluators,
      caps: manifest.inputs.caps, configuration: manifest.inputs.configuration,
    },
    environment: {
      model: input.model, tool: 'claude-code', tool_version: manifest.effective.tool.version,
      os: manifest.effective.platform.os, node: manifest.effective.platform.node,
      platform_release: manifest.effective.platform.release,
      permission_mode: input.configuration.permission_mode, caps: manifest.caps,
    },
  };
  const planned = plan(args.runs, opts);
  process.stdout.write(`cohort ${manifest.cohort}\n${planned.cells.length} cells, ${planned.created.length} newly planned\n`);
  if (args['plan-only']) return 0;
  const result = await driveSchedule(args.runs, opts);
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
  runDir, recordPath, readRecord, writeRecord, cellKey, validateCell,
  inspectClaim: (root, cell) => claims.inspect(root, cellKey(cell)),
  recoverRun: (root, cell, decision) => claims.recover(root, cellKey(cell), decision),
  observeAdoption, readUsage, complete,
  limitHit, endOf, nextRepetition, plan, claimRerun, installKit,
  driveSession, driveRun, driveSchedule,
};
