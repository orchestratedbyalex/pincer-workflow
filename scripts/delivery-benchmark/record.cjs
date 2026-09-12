'use strict';
// Run record schema 1 and its validator. A record is harness-owned metadata about one
// benchmark run; the only field that can carry an acceptance judgment is `evaluation`,
// written by `evaluate` from a real evaluator execution. The validator checks shape,
// bounds and internal consistency; it cannot establish that an agent complied — that is
// read from transcripts and the evaluator log by a reviewer.
const lib = require('./lib.cjs');

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const isIso = s => typeof s === 'string' && ISO.test(s);
const isInt = n => Number.isInteger(n);
const isNum = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const isStr = (s, max) => typeof s === 'string' && s.length <= max;

function empty({ brief, pair, arm, order, prompts, environment, workspace }) {
  return {
    schema: lib.RECORD_SCHEMA,
    run: lib.runId(brief, pair, arm),
    brief, arm, pair, order,
    created: lib.nowIso(),
    status: 'pending',
    reason: null,
    environment: { model: null, tool: null, tool_version: null, node: process.version, os: `${process.platform} ${require('node:os').release()}`, kit: null, caps: { turns_per_session: null, wall_clock_minutes: null }, ...environment },
    workspace: { base: null, project_base: null, candidate: null, unrelated_edits: {}, ...workspace },
    sessions: prompts.map(p => ({ name: p.name, prompt: p.prompt, started: null, ended: null, exit: null, transcript: null })),
    interventions: [],
    effort: { setup_minutes: null, review_minutes: null, active_minutes: null, elapsed_minutes: null, tokens: null, cost_usd: null, unavailable: { tokens: 'not recorded', cost_usd: 'not recorded' } },
    evaluation: null
  };
}

// Outcome implied by a check list; the evaluator's word is not trusted over its checks.
function outcomeOf(checks) {
  if (!Array.isArray(checks) || checks.length === 0) return 'error';
  if (checks.some(c => c.result === 'error')) return 'error';
  if (checks.some(c => c.result === 'failed')) return 'rejected';
  if (checks.some(c => c.result === 'unverified')) return 'unverified';
  return checks.every(c => c.result === 'passed') ? 'accepted' : 'error';
}

function problems(r, { frozen } = {}) {
  const out = [];
  const bad = (code, detail) => out.push({ code, detail });
  if (!r || typeof r !== 'object' || Array.isArray(r)) return [{ code: 'RECORD_INVALID', detail: 'record must be an object' }];
  if (r.schema !== lib.RECORD_SCHEMA) bad('SCHEMA_UNKNOWN', `schema must be ${lib.RECORD_SCHEMA}`);
  const known = ['schema', 'run', 'brief', 'arm', 'pair', 'order', 'created', 'status', 'reason', 'environment', 'workspace', 'sessions', 'interventions', 'effort', 'evaluation'];
  for (const k of Object.keys(r)) if (!known.includes(k)) bad('RECORD_INVALID', `unknown key "${k}"`);
  if (!lib.ARMS.includes(r.arm)) bad('RECORD_INVALID', `arm must be one of ${lib.ARMS.join(', ')}`);
  if (!isInt(r.pair) || r.pair < 1 || r.pair > lib.MAX_PAIR) bad('RECORD_INVALID', `pair must be 1..${lib.MAX_PAIR}`);
  if (r.order !== null && (!isInt(r.order) || r.order < 1)) bad('RECORD_INVALID', 'order must be a positive integer, or null for a rerun outside the schedule');
  if (r.pair > lib.PAIRS && r.order !== null) bad('RECORD_INVALID', `pair ${r.pair} is a rerun outside the schedule and has no order`);
  if (typeof r.brief !== 'string' || !/^[a-z0-9-]+$/.test(r.brief)) bad('RECORD_INVALID', 'brief must be a slug');
  else if (frozen && !frozen.briefs[r.brief]) bad('BRIEF_UNKNOWN', `brief "${r.brief}" is not in the frozen manifest`);
  if (r.run !== lib.runId(r.brief, r.pair, r.arm)) bad('RECORD_INVALID', `run must be ${lib.runId(r.brief, r.pair, r.arm)}`);
  if (!isIso(r.created)) bad('RECORD_INVALID', 'created must be an ISO timestamp');
  if (!lib.STATUSES.includes(r.status)) bad('RECORD_INVALID', `status must be one of ${lib.STATUSES.join(', ')}`);
  if ((r.status === 'invalid' || r.status === 'unavailable') && !(isStr(r.reason, lib.LIMITS.note) && r.reason.trim())) bad('REASON_REQUIRED', `status ${r.status} needs a reason`);
  if (r.status !== 'invalid' && r.status !== 'unavailable' && r.reason !== null) bad('RECORD_INVALID', 'reason is only for invalid or unavailable runs');
  const env = r.environment;
  if (!env || typeof env !== 'object') bad('RECORD_INVALID', 'environment must be an object');
  else {
    for (const k of ['model', 'tool', 'tool_version', 'node', 'os']) if (env[k] !== null && !isStr(env[k], 200)) bad('RECORD_INVALID', `environment.${k} must be a string or null`);
    if (env.kit !== null && !(env.kit && typeof env.kit === 'object' && isStr(env.kit.source, 1000) && lib.isHex64(env.kit.digest))) bad('RECORD_INVALID', 'environment.kit must be null or { source, digest(64 hex) }');
    if (r.arm === 'pincer' && env.kit === null) bad('KIT_MISSING', 'a pincer run records the kit it installed');
    if (r.arm === 'plain' && env.kit !== null) bad('RECORD_INVALID', 'a plain run installs no kit');
    if (!env.caps || typeof env.caps !== 'object') bad('RECORD_INVALID', 'environment.caps must be an object');
    else for (const k of ['turns_per_session', 'wall_clock_minutes']) if (env.caps[k] !== null && !isNum(env.caps[k])) bad('RECORD_INVALID', `caps.${k} must be a number or null`);
  }
  const ws = r.workspace;
  if (!ws || typeof ws !== 'object') bad('RECORD_INVALID', 'workspace must be an object');
  else {
    if (!lib.isSha(ws.base)) bad('RECORD_INVALID', 'workspace.base must be a full commit id');
    if (ws.project_base !== null && !lib.isSha(ws.project_base)) bad('RECORD_INVALID', 'workspace.project_base must be a full commit id or null');
    if (ws.candidate !== null && !lib.isSha(ws.candidate)) bad('RECORD_INVALID', 'workspace.candidate must be a full commit id or null');
    if (!ws.unrelated_edits || typeof ws.unrelated_edits !== 'object') bad('RECORD_INVALID', 'workspace.unrelated_edits must be an object');
    else for (const [k, v] of Object.entries(ws.unrelated_edits)) {
      if (!isStr(k, 500) || !v || typeof v !== 'object') { bad('RECORD_INVALID', `unrelated_edits.${k} must be an object`); continue; }
      if (v.kind === 'append') { if (!isStr(v.text, lib.LIMITS.note) || !v.text) bad('RECORD_INVALID', `unrelated_edits.${k}: append needs the appended text`); }
      else if (v.kind === 'untracked') { if (!lib.isHex64(v.digest)) bad('RECORD_INVALID', `unrelated_edits.${k}: untracked needs a 64-hex digest`); }
      else bad('RECORD_INVALID', `unrelated_edits.${k}: kind must be append or untracked`);
    }
  }
  const names = new Set();
  if (!Array.isArray(r.sessions) || r.sessions.length < 1 || r.sessions.length > lib.LIMITS.sessions) bad('RECORD_INVALID', `sessions must list 1..${lib.LIMITS.sessions} sessions`);
  else r.sessions.forEach((s, i) => {
    if (!s || typeof s !== 'object') return bad('RECORD_INVALID', `session ${i} must be an object`);
    if (!isStr(s.name, 20) || !/^S\d+$/.test(s.name)) bad('RECORD_INVALID', `session ${i}: name must be S<n>`);
    else if (names.has(s.name)) bad('RECORD_INVALID', `session ${s.name} listed twice`); else names.add(s.name);
    if (!isStr(s.prompt, lib.LIMITS.prompt) || !s.prompt.trim()) bad('RECORD_INVALID', `session ${s.name}: prompt must be recorded (≤ ${lib.LIMITS.prompt} chars)`);
    for (const k of ['started', 'ended']) if (s[k] !== null && !isIso(s[k])) bad('RECORD_INVALID', `session ${s.name}: ${k} must be an ISO timestamp or null`);
    if (s.started && s.ended && s.ended < s.started) bad('RECORD_INVALID', `session ${s.name}: ended before started`);
    if (s.exit !== null && !isInt(s.exit)) bad('RECORD_INVALID', `session ${s.name}: exit must be an integer or null`);
    if (s.transcript !== null && !isStr(s.transcript, 1000)) bad('RECORD_INVALID', `session ${s.name}: transcript must be a path or null`);
  });
  if (!Array.isArray(r.interventions) || r.interventions.length > lib.LIMITS.interventions) bad('RECORD_INVALID', `interventions must be a list of at most ${lib.LIMITS.interventions}`);
  else r.interventions.forEach((x, i) => {
    if (!x || typeof x !== 'object') return bad('RECORD_INVALID', `intervention ${i} must be an object`);
    if (!lib.INTERVENTIONS.includes(x.type)) bad('RECORD_INVALID', `intervention ${i}: type must be one of ${lib.INTERVENTIONS.join(', ')}`);
    if (!names.has(x.session)) bad('RECORD_INVALID', `intervention ${i}: session ${x.session} is not listed`);
    if (!isIso(x.at)) bad('RECORD_INVALID', `intervention ${i}: at must be an ISO timestamp`);
    if (!isStr(x.note, lib.LIMITS.note) || !x.note.trim()) bad('RECORD_INVALID', `intervention ${i}: note required (≤ ${lib.LIMITS.note} chars)`);
  });
  const ef = r.effort;
  if (!ef || typeof ef !== 'object') bad('RECORD_INVALID', 'effort must be an object');
  else {
    for (const k of ['setup_minutes', 'review_minutes', 'active_minutes', 'elapsed_minutes']) if (ef[k] !== null && !isNum(ef[k])) bad('RECORD_INVALID', `effort.${k} must be a non-negative number or null`);
    if (ef.tokens !== null && !(ef.tokens && typeof ef.tokens === 'object' && isNum(ef.tokens.input) && isNum(ef.tokens.output))) bad('RECORD_INVALID', 'effort.tokens must be null or { input, output }');
    if (ef.cost_usd !== null && !isNum(ef.cost_usd)) bad('RECORD_INVALID', 'effort.cost_usd must be a non-negative number or null');
    if (!ef.unavailable || typeof ef.unavailable !== 'object') bad('RECORD_INVALID', 'effort.unavailable must be an object of reasons');
    else for (const k of ['tokens', 'cost_usd']) {
      if (ef[k] === null && !(isStr(ef.unavailable[k], lib.LIMITS.note) && ef.unavailable[k].trim())) bad('UNAVAILABLE_REASON_REQUIRED', `effort.${k} is null without a reason in effort.unavailable.${k}`);
      if (ef[k] !== null && ef.unavailable[k] !== undefined && ef.unavailable[k] !== null) bad('RECORD_INVALID', `effort.${k} is recorded and also marked unavailable`);
    }
  }
  const ev = r.evaluation;
  if (ev !== null) {
    if (!ev || typeof ev !== 'object') bad('RECORD_INVALID', 'evaluation must be an object or null');
    else {
      if (!ev.evaluator || typeof ev.evaluator !== 'object' || ev.evaluator.brief !== r.brief || !lib.isHex64(ev.evaluator.digest)) bad('RECORD_INVALID', 'evaluation.evaluator must name this brief and its 64-hex digest');
      else if (frozen && frozen.briefs[r.brief] && ev.evaluator.digest !== frozen.briefs[r.brief].evaluator) bad('EVALUATOR_UNFROZEN', `the evaluator that judged this run (${ev.evaluator.digest.slice(0, 12)}) is not the frozen one (${frozen.briefs[r.brief].evaluator.slice(0, 12)})`);
      if (!isIso(ev.at)) bad('RECORD_INVALID', 'evaluation.at must be an ISO timestamp');
      if (!lib.isSha(ev.candidate)) bad('RECORD_INVALID', 'evaluation.candidate must be a full commit id');
      else if (ws && ev.candidate !== ws.candidate) bad('CANDIDATE_MISMATCH', 'evaluation.candidate differs from workspace.candidate');
      if (!lib.OUTCOMES.includes(ev.outcome)) bad('RECORD_INVALID', `evaluation.outcome must be one of ${lib.OUTCOMES.join(', ')}`);
      if (!Array.isArray(ev.checks) || ev.checks.length < 1 || ev.checks.length > lib.LIMITS.checks) bad('CHECKS_MISSING', `evaluation.checks must list 1..${lib.LIMITS.checks} checks`);
      else {
        const ids = new Set();
        ev.checks.forEach((c, i) => {
          if (!c || typeof c !== 'object') return bad('RECORD_INVALID', `check ${i} must be an object`);
          if (!isStr(c.id, 40) || !/^[a-z0-9-]+$/.test(c.id)) bad('RECORD_INVALID', `check ${i}: id must be a slug`);
          else if (ids.has(c.id)) bad('RECORD_INVALID', `check ${c.id} listed twice`); else ids.add(c.id);
          if (!['acceptance', 'regression', 'preservation', 'evidence', 'protocol'].includes(c.kind)) bad('RECORD_INVALID', `check ${c.id}: unknown kind ${c.kind}`);
          if (!lib.RESULTS.includes(c.result)) bad('RECORD_INVALID', `check ${c.id}: result must be one of ${lib.RESULTS.join(', ')}`);
          if ((c.result === 'passed' || c.result === 'failed') && !isInt(c.exit)) bad('EXIT_REQUIRED', `check ${c.id}: a ${c.result} check records the integer exit status of the process that decided it`);
          if (c.result === 'passed' && c.exit !== 0) bad('OUTCOME_INCONSISTENT', `check ${c.id}: passed with exit ${c.exit}`);
          if (c.result === 'failed' && c.exit === 0) bad('OUTCOME_INCONSISTENT', `check ${c.id}: failed with exit 0`);
          if (c.exit !== null && !isInt(c.exit)) bad('RECORD_INVALID', `check ${c.id}: exit must be an integer or null`);
          if (!isStr(c.detail, lib.LIMITS.detail)) bad('RECORD_INVALID', `check ${c.id}: detail must be a bounded string`);
        });
        const implied = outcomeOf(ev.checks);
        if (implied !== ev.outcome) bad('OUTCOME_INCONSISTENT', `outcome ${ev.outcome} does not follow from the checks (${implied})`);
        const regressions = ev.checks.filter(c => c.kind === 'regression' && c.result === 'failed').length;
        if (ev.regressions !== regressions) bad('OUTCOME_INCONSISTENT', `regressions must be ${regressions}`);
      }
      if (!isStr(ev.log, 1000)) bad('RECORD_INVALID', 'evaluation.log must name the evaluator log');
    }
  }
  if (r.status === 'valid') {
    if (ev === null) bad('EVALUATION_MISSING', 'a valid run has been evaluated');
    if (Array.isArray(r.sessions) && r.sessions.some(s => !s.started || !s.ended)) bad('SESSION_INCOMPLETE', 'a valid run has every session started and ended');
  }
  return out;
}

// Whether this record counts as an independently accepted run, and why not otherwise.
function acceptance(r, { frozen } = {}) {
  const p = problems(r, { frozen });
  if (p.length) return { accepted: false, counted: false, reason: `${p[0].code}: ${p[0].detail}` };
  if (r.status !== 'valid') return { accepted: false, counted: false, reason: `status ${r.status}${r.reason ? ` (${r.reason})` : ''}` };
  if (!r.evaluation) return { accepted: false, counted: false, reason: 'not evaluated' };
  return { accepted: r.evaluation.outcome === 'accepted', counted: true, reason: r.evaluation.outcome };
}

module.exports = { empty, problems, acceptance, outcomeOf, isIso };
