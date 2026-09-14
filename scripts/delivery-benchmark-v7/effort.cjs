'use strict';
// PRD v7 T-88 (R-02) — the v7 effort record and its offline projection.
//
// A run record is harness-owned metadata about one observed run. The v6 record
// (../record.cjs, schema 1) carried a flat `effort` object with one number per field;
// v7 replaces that with an **event log** and computes every total from it, because the
// v6 study could not say where its time went and recorded automated setup as zero.
//
// Three rules the shape enforces rather than documents:
//
//   1. `null` is not zero. Every metric is either measured or `null` WITH a reason.
//      A record that says `cost_usd: null, unavailable: { cost_usd: "..." }` is
//      complete; one that says `cost_usd: 0` because nothing was recorded is a lie,
//      and `problems()` refuses it.
//   2. Overlapping intervals are merged, never summed. Two sessions running in the
//      same wall-clock minute contribute one minute of `active`, not two.
//   3. An acceptance verdict comes from the evaluator's own checks, never from the
//      record's author and never from an agent's narration. Missing provenance, a
//      missing evaluator or an unverified strict adoption make a run `invalid` or
//      `outstanding` — never `accepted`, and never silently zero-cost.
//
// Nothing here runs a model, opens a socket or executes a candidate. Report
// regeneration is a pure function of the stored events.
const crypto = require('node:crypto');

const SCHEMA = 7;
const ARMS = ['plain', 'pincer', 'strict'];
const STATUSES = ['pending', 'valid', 'invalid', 'unavailable', 'outstanding'];
const OUTCOMES = ['accepted', 'rejected', 'unverified', 'error'];
const RESULTS = ['passed', 'failed', 'unverified', 'error'];
// The stages effort is attributed to. `review` is human time and is collected
// separately from the session; it is the one the v6 study did not measure at all.
const STAGES = ['setup', 'authoring', 'verification', 'recovery', 'review'];
const EVENT_KINDS = ['session', 'stage', 'command', 'intervention', 'evaluation', 'note'];
const INTERVENTIONS = ['clarification', 'reapproval', 'repair', 'operator'];
const LIMITS = { prompt: 8000, note: 2000, detail: 4000, reason: 500, events: 5000, checks: 64 };

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const isIso = s => typeof s === 'string' && ISO.test(s);
const isStr = (s, max) => typeof s === 'string' && s.length > 0 && s.length <= max;
const isHex64 = s => typeof s === 'string' && /^[0-9a-f]{64}$/.test(s);
const isSha = s => typeof s === 'string' && /^[0-9a-f]{40}$/.test(s);
const isNum = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const ms = iso => Date.parse(iso);

// --- Interval arithmetic ------------------------------------------------------------
// Merge [start, end) intervals and return their union in minutes. This is the whole
// reason effort is stored as events: summing per-stage durations double-counts any
// work that overlaps, and the v6 record shape made that impossible to detect.
function mergeIntervals(intervals) {
  const sorted = intervals.filter(i => i.end > i.start).sort((a, b) => a.start - b.start);
  const merged = [];
  for (const i of sorted) {
    const last = merged[merged.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else merged.push({ ...i });
  }
  return merged;
}
const minutesOf = intervals => mergeIntervals(intervals).reduce((total, i) => total + (i.end - i.start), 0) / 60000;

// --- The record ---------------------------------------------------------------------
function empty({ run, cohort, brief, arm, repetition, order = null, environment = {}, provenance = {} }) {
  return {
    schema: SCHEMA,
    run, cohort, brief, arm, repetition, order,
    status: 'pending',
    reason: null,
    // Everything that determines what happened or how it was judged. A change to any
    // of these is a new cohort; `freeze.cjs` computes and compares them.
    provenance: {
      base: null, kit: null, kit_source: null,
      prompts: null, driver: null, collector: null, evaluator: null,
      protocol: null, caps: null, configuration: null,
      ...provenance,
    },
    environment: {
      model: null, tool: null, tool_version: null,
      node: process.version, os: null, platform_release: null,
      permission_mode: null, caps: { turns_per_session: null, wall_clock_minutes: null },
      ...environment,
    },
    // Did this run actually do what its arm claims? For `strict` this is read from the
    // workspace's own change record, not from the agent's narration.
    adoption: { required: arm === 'strict', observed: null, evidence: null },
    events: [],
    // Metrics that cannot be derived from events: provider-reported figures.
    reported: { tokens: null, cost_usd: null, provider_minutes: null },
    unavailable: {},
    evaluation: null,
  };
}

// The outcome a check list implies. The evaluator's own word is not trusted over its
// checks — a report claiming `accepted` with a failed check is an error, not an
// acceptance.
function outcomeOf(checks) {
  if (!Array.isArray(checks) || checks.length === 0) return 'error';
  if (checks.some(c => c.result === 'error')) return 'error';
  if (checks.some(c => c.result === 'failed')) return 'rejected';
  if (checks.some(c => c.result === 'unverified')) return 'unverified';
  return checks.every(c => c.result === 'passed') ? 'accepted' : 'error';
}

// --- Validation ----------------------------------------------------------------------
// Returns [] for a record that may be reported, or the problems that stop it. Shape,
// bounds and internal consistency only: it cannot establish that a session happened.
function problems(r, { frozen = null } = {}) {
  const out = [];
  const bad = (code, detail) => out.push({ code, detail });
  if (!r || typeof r !== 'object' || Array.isArray(r)) return [{ code: 'RECORD_INVALID', detail: 'record must be an object' }];
  if (r.schema !== SCHEMA) bad('SCHEMA_UNKNOWN', `schema must be ${SCHEMA}`);
  const known = ['schema', 'run', 'cohort', 'brief', 'arm', 'repetition', 'order', 'status', 'reason', 'provenance', 'environment', 'adoption', 'events', 'reported', 'unavailable', 'evaluation'];
  for (const k of Object.keys(r)) if (!known.includes(k)) bad('RECORD_INVALID', `unknown key "${k}"`);
  if (!ARMS.includes(r.arm)) bad('RECORD_INVALID', `arm must be one of ${ARMS.join(', ')}`);
  if (!STATUSES.includes(r.status)) bad('RECORD_INVALID', `status must be one of ${STATUSES.join(', ')}`);
  if (!isStr(r.brief, 120) || !/^[a-z0-9-]+$/.test(r.brief)) bad('RECORD_INVALID', 'brief must be a slug');
  if (!Number.isInteger(r.repetition) || r.repetition < 1) bad('RECORD_INVALID', 'repetition must be a positive integer');
  if (!isHex64(r.cohort)) bad('COHORT_INVALID', 'cohort must be the 64-hex cohort identity');
  if (r.run !== runId(r.brief, r.repetition, r.arm)) bad('RECORD_INVALID', `run must be ${runId(r.brief, r.repetition, r.arm)}`);
  // A status that admits something went wrong must say what.
  if (['invalid', 'unavailable', 'outstanding'].includes(r.status) && !isStr(r.reason, LIMITS.reason)) bad('REASON_REQUIRED', `status ${r.status} needs a reason`);
  if (['pending', 'valid'].includes(r.status) && r.reason !== null) bad('RECORD_INVALID', 'reason is only for invalid, unavailable or outstanding runs');

  // Provenance: a run that is going to be reported must say what produced it.
  const p = r.provenance;
  if (!p || typeof p !== 'object') bad('RECORD_INVALID', 'provenance must be an object');
  else if (r.status === 'valid') {
    for (const key of ['base', 'prompts', 'driver', 'collector', 'evaluator', 'protocol', 'caps', 'configuration']) {
      if (!(key === 'base' ? isSha(p[key]) : isHex64(p[key]))) bad('PROVENANCE_MISSING', `provenance.${key} is required for a valid run`);
    }
    // The plain arm installs no kit, so its kit digest is legitimately null — and must
    // be null, or the arm is not what it claims.
    if (r.arm === 'plain' && p.kit !== null) bad('PROVENANCE_INVALID', 'the plain arm installs no kit; provenance.kit must be null');
    if (r.arm !== 'plain' && !isHex64(p.kit)) bad('PROVENANCE_MISSING', 'provenance.kit is required for a kit arm');
  }
  // A record is reported under the freeze it was run under. Comparing the cohort
  // identity — not one of its inputs — is what makes that checkable: any frozen input
  // that moved changes the identity, so a run from before the change is refused here
  // and reported under its own cohort instead of being re-evaluated under this one.
  if (frozen && frozen.cohort && r.cohort !== frozen.cohort) {
    bad('COHORT_CHANGED', `record cohort ${String(r.cohort).slice(0, 12)} is not this cohort ${frozen.cohort.slice(0, 12)}; this run belongs to another cohort and is not re-evaluated here`);
  }
  if (frozen && frozen.inputs && r.status === 'valid' && p && p.protocol && p.protocol !== frozen.inputs.protocol) {
    bad('COHORT_CHANGED', `provenance.protocol ${p.protocol.slice(0, 12)} is not the frozen protocol ${String(frozen.inputs.protocol).slice(0, 12)}`);
  }

  // Adoption: a strict run that cannot show adoption is a protocol failure, not
  // evidence about strict Pincer.
  const a = r.adoption;
  if (!a || typeof a !== 'object') bad('RECORD_INVALID', 'adoption must be an object');
  else {
    if (a.required !== (r.arm === 'strict')) bad('RECORD_INVALID', 'adoption.required must be true exactly for the strict arm');
    if (a.required && r.status === 'valid' && a.observed !== true) bad('ADOPTION_UNVERIFIED', 'a strict run must record observed adoption; a run that did not adopt is a protocol failure, not a strict result');
    if (a.observed === true && !isStr(a.evidence, LIMITS.detail)) bad('ADOPTION_UNVERIFIED', 'observed adoption needs its evidence reference');
    if (!a.required && a.observed === true) bad('RECORD_INVALID', `the ${r.arm} arm must not adopt strict coverage`);
  }

  // Events.
  if (!Array.isArray(r.events)) bad('RECORD_INVALID', 'events must be an array');
  else {
    if (r.events.length > LIMITS.events) bad('RECORD_INVALID', `at most ${LIMITS.events} events`);
    const ids = new Set();
    for (const [i, e] of r.events.entries()) out.push(...eventProblems(e, i, ids));
  }

  // Reported metrics: null needs a reason, and a number needs not to be a fake zero.
  // A `pending` run has not run yet, so nothing is expected of it; from the moment a
  // record is reportable, every null must say why it is null rather than zero.
  for (const key of ['tokens', 'cost_usd', 'provider_minutes']) {
    const v = r.reported[key];
    if (v === null) {
      if (r.status !== 'pending' && !isStr(r.unavailable[key], LIMITS.reason)) bad('REASON_REQUIRED', `reported.${key} is null and needs unavailable.${key} to say why`);
    } else if (!isNum(v)) bad('RECORD_INVALID', `reported.${key} must be a nonnegative number or null`);
    else if (key in r.unavailable) bad('RECORD_INVALID', `reported.${key} is measured; unavailable.${key} must not be set`);
  }
  for (const key of Object.keys(r.unavailable)) {
    if (!['tokens', 'cost_usd', 'provider_minutes', ...STAGES].includes(key)) bad('RECORD_INVALID', `unavailable.${key} names no metric`);
  }

  // Evaluation: the verdict must follow from the checks.
  if (r.evaluation !== null) {
    const e = r.evaluation;
    if (!e || typeof e !== 'object') bad('RECORD_INVALID', 'evaluation must be an object or null');
    else {
      if (!isSha(e.candidate)) bad('EVALUATION_INVALID', 'evaluation.candidate must be the 40-hex commit it judged');
      if (!Array.isArray(e.checks) || !e.checks.length) bad('EVALUATION_INVALID', 'evaluation.checks must be a nonempty array');
      else {
        if (e.checks.length > LIMITS.checks) bad('EVALUATION_INVALID', `at most ${LIMITS.checks} checks`);
        for (const c of e.checks) {
          if (!isStr(c.id, 120)) bad('EVALUATION_INVALID', 'each check needs an id');
          if (!RESULTS.includes(c.result)) bad('EVALUATION_INVALID', `check ${c.id}: result must be one of ${RESULTS.join(', ')}`);
          if (c.independent !== true && c.independent !== false) bad('EVALUATION_INVALID', `check ${c.id}: independent must say whether this is a held-out check or the candidate's own`);
        }
        const implied = outcomeOf(e.checks);
        if (!OUTCOMES.includes(e.outcome)) bad('EVALUATION_INVALID', `outcome must be one of ${OUTCOMES.join(', ')}`);
        else if (e.outcome !== implied) bad('OUTCOME_DISPUTED', `evaluation.outcome is "${e.outcome}" but its checks imply "${implied}"; the checks decide`);
        // An acceptance that rests only on the candidate's own tests is not independent.
        if (implied === 'accepted' && !e.checks.some(c => c.independent)) bad('EVALUATION_INVALID', 'an accepted run needs at least one independent held-out check; the candidate\'s own tests are supplementary');
      }
      if (!isHex64(e.evaluator)) bad('EVALUATION_INVALID', 'evaluation.evaluator must be the digest of the evaluator that ran');
    }
  } else if (r.status === 'valid') {
    bad('EVALUATION_MISSING', 'a valid run has an evaluation; without one it is outstanding, not accepted');
  }
  return out;
}

function eventProblems(e, i, ids) {
  const out = [];
  const bad = (code, detail) => out.push({ code, detail: `events[${i}]: ${detail}` });
  if (!e || typeof e !== 'object' || Array.isArray(e)) return [{ code: 'EVENT_INVALID', detail: `events[${i}]: must be an object` }];
  if (!EVENT_KINDS.includes(e.kind)) bad('EVENT_INVALID', `kind must be one of ${EVENT_KINDS.join(', ')}`);
  if (!isStr(e.id, 120)) bad('EVENT_INVALID', 'needs an id');
  else if (ids.has(e.id)) bad('EVENT_DUPLICATE', `duplicate event id "${e.id}"`);
  else ids.add(e.id);
  if (!isIso(e.started)) bad('EVENT_INVALID', 'started must be an ISO UTC timestamp');
  if (e.ended !== null && !isIso(e.ended)) bad('EVENT_INVALID', 'ended must be an ISO UTC timestamp or null');
  if (isIso(e.started) && isIso(e.ended) && ms(e.ended) < ms(e.started)) bad('EVENT_INVALID', 'ended precedes started');
  if (e.kind === 'stage' && !STAGES.includes(e.stage)) bad('EVENT_INVALID', `stage must be one of ${STAGES.join(', ')}`);
  if (e.kind === 'intervention' && !INTERVENTIONS.includes(e.intervention)) bad('EVENT_INVALID', `intervention must be one of ${INTERVENTIONS.join(', ')}`);
  if (e.kind === 'intervention' && !isStr(e.detail, LIMITS.detail)) bad('EVENT_INVALID', 'an intervention records what happened');
  if (e.kind === 'session' && e.prompt !== undefined && !isStr(e.prompt, LIMITS.prompt)) bad('EVENT_INVALID', `a session prompt is at most ${LIMITS.prompt} characters`);
  return out;
}

const runId = (brief, repetition, arm) => `${brief}/rep-${repetition}/${arm}`;

// --- The offline projection ------------------------------------------------------------
// Pure: same events in, same report out, no model call and no network.
function report(r) {
  const closed = kind => r.events.filter(e => e.kind === kind && e.ended);
  const intervalsOf = events => events.map(e => ({ start: ms(e.started), end: ms(e.ended) }));
  const stages = {};
  for (const stage of STAGES) {
    const events = closed('stage').filter(e => e.stage === stage);
    // A stage with no closed event is unmeasured, which is different from zero.
    stages[stage] = events.length ? round(minutesOf(intervalsOf(events))) : null;
  }
  const sessions = closed('session');
  const active = sessions.length ? round(minutesOf(intervalsOf(sessions))) : null;
  const all = r.events.filter(e => isIso(e.started));
  const ends = r.events.filter(e => isIso(e.ended)).map(e => ms(e.ended));
  const elapsed = all.length && ends.length ? round((Math.max(...ends) - Math.min(...all.map(e => ms(e.started)))) / 60000) : null;
  const interventions = {};
  for (const kind of INTERVENTIONS) interventions[kind] = r.events.filter(e => e.kind === 'intervention' && e.intervention === kind).length;
  const checks = r.evaluation ? r.evaluation.checks : [];
  return {
    run: r.run, cohort: r.cohort, brief: r.brief, arm: r.arm, repetition: r.repetition,
    status: r.status, reason: r.reason,
    adoption: { required: r.adoption.required, observed: r.adoption.observed },
    stages,
    // `active` merges overlapping sessions; the naive sum is reported beside it so a
    // reader can see how much concurrency there was rather than having to trust that
    // the merge happened.
    active_minutes: active,
    session_minutes_summed: sessions.length ? round(intervalsOf(sessions).reduce((t, i) => t + (i.end - i.start), 0) / 60000) : null,
    elapsed_minutes: elapsed,
    provider_minutes: r.reported.provider_minutes,
    tokens: r.reported.tokens,
    cost_usd: r.reported.cost_usd,
    unavailable: { ...r.unavailable },
    sessions: sessions.length,
    commands: r.events.filter(e => e.kind === 'command').length,
    interventions,
    outcome: r.evaluation ? r.evaluation.outcome : null,
    independent_checks: checks.filter(c => c.independent).length,
    own_checks: checks.filter(c => !c.independent).length,
  };
}
const round = n => Math.round(n * 100) / 100;

// Aggregate a set of reports per arm. Denominators are explicit: a rate is always
// reported with the number of runs it was computed over and the number excluded.
function aggregate(reports) {
  const arms = {};
  for (const arm of ARMS) {
    const all = reports.filter(r => r.arm === arm);
    const valid = all.filter(r => r.status === 'valid');
    const measured = key => valid.map(r => r[key]).filter(v => v !== null);
    const sum = list => (list.length ? round(list.reduce((t, v) => t + v, 0)) : null);
    arms[arm] = {
      scheduled: all.length,
      valid: valid.length,
      invalid: all.filter(r => r.status === 'invalid').length,
      unavailable: all.filter(r => r.status === 'unavailable').length,
      outstanding: all.filter(r => r.status === 'outstanding' || r.status === 'pending').length,
      accepted: valid.filter(r => r.outcome === 'accepted').length,
      // Every rate carries the denominator it was computed over.
      acceptance: valid.length ? { accepted: valid.filter(r => r.outcome === 'accepted').length, of: valid.length } : null,
      cost_usd: { total: sum(measured('cost_usd')), of: measured('cost_usd').length, unmeasured: valid.length - measured('cost_usd').length },
      active_minutes: { total: sum(measured('active_minutes')), of: measured('active_minutes').length, unmeasured: valid.length - measured('active_minutes').length },
      review_minutes: { total: sum(valid.map(r => r.stages.review).filter(v => v !== null)), of: valid.filter(r => r.stages.review !== null).length, unmeasured: valid.filter(r => r.stages.review === null).length },
      interventions: INTERVENTIONS.reduce((acc, k) => ({ ...acc, [k]: valid.reduce((t, r) => t + r.interventions[k], 0) }), {}),
    };
  }
  return { arms, total: reports.length, complete: reports.every(r => ['valid', 'invalid', 'unavailable'].includes(r.status)) };
}

module.exports = {
  SCHEMA, ARMS, STATUSES, OUTCOMES, RESULTS, STAGES, EVENT_KINDS, INTERVENTIONS, LIMITS,
  sha256, mergeIntervals, minutesOf, empty, outcomeOf, problems, eventProblems, runId, report, aggregate, round,
};
