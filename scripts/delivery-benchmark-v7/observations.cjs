'use strict';
// PRD v7 T-89 / T-93 / T-95 — the observation records and their validators.
//
// Three kinds of record describe things that happened outside this repository: a
// baseline strict pilot on a real project (R-03), a platform journey and cross-agent
// handoff (R-07), and an improved-versus-baseline comparison with timed human review
// (R-09). They share one validator because they share one danger.
//
// The danger is that a passing validator gets read as evidence that the observation
// happened. It is not, and the shape is built so that it cannot be: every record
// carries `observed`, which is `false` until a real session produced it, and a record
// with `observed: false` is `outstanding` — it can never be `complete`, whatever else
// it contains. A fixture is marked `fixture: true` and is refused outright as a live
// observation, so a synthetic record cannot be relabelled into evidence by editing a
// field. Required stages that did not happen stay `outstanding` with their reason and
// keep their criterion unchecked.
//
// What this module checks is record *properties*: that references resolve, that a
// candidate is named by a real commit id, that failures were retained rather than
// deleted, that a claimed capability names the artifact that shows it. Whether the
// agent actually complied, and whether a reviewer judged correctly, is read from the
// linked session, evaluator and reviewer artifacts by a person. The validator says so
// in its own vocabulary: it reports `RECORD_VALID`, never `OBSERVED`.
const crypto = require('node:crypto');

const SCHEMA = 1;
const KINDS = ['pilot', 'platform', 'comparison'];
// A stage of the journey every pilot and platform record must account for. Each is
// either observed with its artifacts, or outstanding with a reason — never absent.
const STAGES = ['install', 'adopt', 'authorize', 'implement', 'revise', 'pause', 'recover', 'evaluate'];
const STAGE_STATES = ['observed', 'failed', 'repaired', 'outstanding', 'unavailable'];
const STATUSES = ['complete', 'partial', 'outstanding'];
const SURFACES = ['claude-code', 'codex', 'copilot', 'plugin-only'];
// How strongly a capability row is supported. `installed` means the package was
// installed and its checks ran; it is NOT a live journey and may never be reported as
// one. This distinction is the whole point of the support matrix.
const SUPPORT = ['observed', 'installed', 'unobserved'];

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const isIso = s => typeof s === 'string' && ISO.test(s);
const isStr = (s, max = 4000) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;
const isSha = s => typeof s === 'string' && /^[0-9a-f]{40}$/.test(s);
const isHex64 = s => typeof s === 'string' && /^[0-9a-f]{64}$/.test(s);
const isNum = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');

// An artifact reference: a repository-relative path to a sanitized record, or a named
// private capture that is deliberately NOT in the tree. A private capture must say
// where it is and why it is not committed, so "the artifact exists" stays checkable by
// a person even when the bytes cannot be published.
function referenceProblems(ref, where) {
  const out = [];
  const bad = detail => out.push({ code: 'REFERENCE_INVALID', detail: `${where}: ${detail}` });
  if (!ref || typeof ref !== 'object' || Array.isArray(ref)) { bad('must be an object'); return out; }
  if (!['tracked', 'private'].includes(ref.kind)) bad('kind must be tracked or private');
  if (!isStr(ref.path, 500)) bad('needs a path');
  else if (ref.kind === 'tracked') {
    if (ref.path.startsWith('/') || ref.path.includes('\\')) bad('a tracked path is repository-relative');
    else if (ref.path.split('/').some(s => s === '' || s === '.' || s === '..')) bad('a tracked path is normalized (no "..", "." or empty segments)');
  }
  if (ref.kind === 'private' && !isStr(ref.reason, 500)) bad('a private capture says why it is not committed');
  if (ref.digest !== undefined && ref.digest !== null && !isHex64(ref.digest)) bad('digest must be a 64-hex sha256');
  return out;
}

// One stage of an observed journey.
function stageProblems(s, where) {
  const out = [];
  const bad = (code, detail) => out.push({ code, detail: `${where}: ${detail}` });
  if (!s || typeof s !== 'object') { bad('STAGE_INVALID', 'must be an object'); return out; }
  if (!STAGE_STATES.includes(s.state)) bad('STAGE_INVALID', `state must be one of ${STAGE_STATES.join(', ')}`);
  // A stage that happened must point at something a reviewer can open. A stage that
  // did not must say why — silence is the failure mode this exists to prevent.
  if (['observed', 'failed', 'repaired'].includes(s.state)) {
    if (!Array.isArray(s.artifacts) || !s.artifacts.length) bad('ARTIFACT_MISSING', `state "${s.state}" needs at least one artifact reference`);
    else s.artifacts.forEach((ref, i) => out.push(...referenceProblems(ref, `${where}.artifacts[${i}]`)));
  } else if (!isStr(s.reason, 1000)) bad('REASON_REQUIRED', `state "${s.state}" needs a reason`);
  // A repaired stage keeps the original failure: deleting it would turn a journey that
  // went wrong into one that never did.
  if (s.state === 'repaired' && !isStr(s.original_failure, 2000)) bad('FAILURE_DISCARDED', 'a repaired stage retains the original failure it repaired');
  if (s.state === 'failed' && !isStr(s.detail, 2000)) bad('STAGE_INVALID', 'a failed stage records what failed');
  return out;
}

// --- The shared record validator -----------------------------------------------------
// Returns [] when the record's properties hold. That is not the same as the observation
// having happened; see the module comment.
function problems(r) {
  const out = [];
  const bad = (code, detail) => out.push({ code, detail });
  if (!r || typeof r !== 'object' || Array.isArray(r)) return [{ code: 'RECORD_INVALID', detail: 'record must be an object' }];
  if (r.schema !== SCHEMA) bad('SCHEMA_UNKNOWN', `schema must be ${SCHEMA}`);
  if (!KINDS.includes(r.kind)) bad('RECORD_INVALID', `kind must be one of ${KINDS.join(', ')}`);
  if (!isStr(r.id, 200)) bad('RECORD_INVALID', 'needs an id');
  if (!isIso(r.recorded)) bad('RECORD_INVALID', 'recorded must be an ISO UTC timestamp');
  if (!STATUSES.includes(r.status)) bad('RECORD_INVALID', `status must be one of ${STATUSES.join(', ')}`);
  if (r.observed !== true && r.observed !== false) bad('RECORD_INVALID', 'observed must say whether a real session produced this record');
  if (r.fixture !== true && r.fixture !== false) bad('RECORD_INVALID', 'fixture must say whether this is a test fixture');

  // The two rules that keep a validator from becoming evidence.
  if (r.fixture === true && r.observed === true) {
    bad('FIXTURE_MISLABELLED', 'a fixture cannot also be an observation; a synthetic record is never live evidence, however it is labelled');
  }
  if (r.observed === false && r.status !== 'outstanding') {
    bad('NOT_OBSERVED', `a record no session produced is outstanding, never "${r.status}"; record validation is not observation`);
  }
  if (r.observed === false && !isStr(r.outstanding_reason, 1000)) {
    bad('REASON_REQUIRED', 'an unobserved record says what is missing before it can be observed');
  }

  // Provenance of the kit and base the observation ran against.
  const p = r.provenance || {};
  if (r.observed === true) {
    if (!isHex64(p.kit)) bad('PROVENANCE_MISSING', 'provenance.kit is the digest of the installed kit that was observed');
    if (!isStr(p.kit_source, 200)) bad('PROVENANCE_MISSING', 'provenance.kit_source names where that kit came from');
    if (!isSha(p.base)) bad('PROVENANCE_MISSING', 'provenance.base is the 40-hex commit the work started from');
    if (!isStr(p.tool_version, 200)) bad('PROVENANCE_MISSING', 'provenance.tool_version records the exact tool that ran');
    if (!isStr(p.model, 200)) bad('PROVENANCE_MISSING', 'provenance.model records the exact model that ran');
  }

  if (r.kind === 'pilot') out.push(...pilotProblems(r));
  if (r.kind === 'platform') out.push(...platformProblems(r));
  if (r.kind === 'comparison') out.push(...comparisonProblems(r));
  return out;
}

// --- Pilot (R-03) ---------------------------------------------------------------------
function pilotProblems(r) {
  const out = [];
  const bad = (code, detail) => out.push({ code, detail });
  if (!['greenfield', 'brownfield'].includes(r.project_kind)) bad('RECORD_INVALID', 'project_kind must be greenfield or brownfield');
  if (!isStr(r.project, 200)) bad('RECORD_INVALID', 'needs a project name or pseudonym');
  // Every stage of the journey is accounted for, none omitted.
  const stages = r.stages || {};
  for (const stage of STAGES) {
    if (!(stage in stages)) { bad('STAGE_MISSING', `the ${stage} stage is not accounted for; a stage that did not happen is outstanding with a reason, not absent`); continue; }
    out.push(...stageProblems(stages[stage], `stages.${stage}`));
  }
  for (const key of Object.keys(stages)) if (!STAGES.includes(key)) bad('RECORD_INVALID', `stages.${key} is not a stage of the journey`);
  // A complete pilot observed every stage.
  const unobservedStages = STAGES.filter(s => stages[s] && !['observed', 'repaired'].includes(stages[s].state));
  if (r.status === 'complete' && unobservedStages.length) {
    bad('STAGE_OUTSTANDING', `status is complete but ${unobservedStages.join(', ')} ${unobservedStages.length === 1 ? 'is' : 'are'} not observed`);
  }
  // A brownfield pilot with pre-existing user edits must record their preservation:
  // "unrelated work survived" is a claim that needs a check behind it.
  if (r.project_kind === 'brownfield' && r.preexisting_edits === true) {
    const pres = r.preservation;
    if (!pres || typeof pres !== 'object') bad('PRESERVATION_MISSING', 'a brownfield pilot with pre-existing edits records their preservation');
    else {
      // The paths can only be named once the project is chosen, so an outstanding
      // pilot may leave them empty. The moment it claims to have been observed, the
      // paths and their check are what makes "unrelated work survived" a fact rather
      // than an assurance.
      if (!Array.isArray(pres.paths)) bad('PRESERVATION_MISSING', 'preservation.paths must be an array');
      else if (r.observed === true && !pres.paths.length) bad('PRESERVATION_MISSING', 'preservation names the paths that had to survive');
      if (pres.verified !== true && r.observed === true) bad('PRESERVATION_MISSING', 'preservation.verified must record that the paths were checked after the work');
      if (pres.verified === true && !Array.isArray(pres.evidence)) bad('PRESERVATION_MISSING', 'preservation.verified needs its evidence references');
      else if (Array.isArray(pres.evidence)) pres.evidence.forEach((ref, i) => out.push(...referenceProblems(ref, `preservation.evidence[${i}]`)));
    }
  }
  // The revised scope needs its own authorization; a generic continue is not one.
  if (stages.revise && ['observed', 'repaired'].includes(stages.revise.state)) {
    const a = r.revision_authorization;
    if (!a || typeof a !== 'object') bad('AUTHORIZATION_MISSING', 'an observed revision records the authorization that covered it');
    else {
      if (!isStr(a.excerpt, 2000)) bad('AUTHORIZATION_MISSING', 'the authorization records the user\'s own words');
      if (!isStr(a.reference, 500)) bad('AUTHORIZATION_MISSING', 'the authorization records where those words came from');
      if (a.generic_continue === true) bad('AUTHORIZATION_GENERIC', 'a generic continue authorizes no revised scope; this revision has no authorization');
      if (!isHex64(a.agreement)) bad('AUTHORIZATION_MISSING', 'the authorization names the agreement digest it covered');
    }
  }
  // The candidate and its schema 3 evidence.
  if (stages.evaluate && ['observed', 'repaired'].includes(stages.evaluate.state)) {
    const c = r.candidate;
    if (!c || typeof c !== 'object') bad('CANDIDATE_MISSING', 'an observed evaluation names its candidate');
    else {
      if (!isSha(c.commit)) bad('CANDIDATE_INVALID', 'candidate.commit must be a 40-hex commit id');
      if (c.evidence_schema !== 3) bad('CANDIDATE_INVALID', 'a strict pilot produces schema 3 evidence');
      if (!Array.isArray(c.artifacts) || !c.artifacts.length) bad('CANDIDATE_MISSING', 'the candidate names its evidence artifacts');
      else c.artifacts.forEach((ref, i) => out.push(...referenceProblems(ref, `candidate.artifacts[${i}]`)));
    }
  }
  // Interventions are retained, including the ones that make the journey look worse.
  if (r.observed === true && !Array.isArray(r.interventions)) bad('RECORD_INVALID', 'interventions must be an array, empty if there genuinely were none');
  return out;
}

// --- Platform (R-07) --------------------------------------------------------------------
function platformProblems(r) {
  const out = [];
  const bad = (code, detail) => out.push({ code, detail });
  if (!SURFACES.includes(r.surface)) bad('RECORD_INVALID', `surface must be one of ${SURFACES.join(', ')}`);
  const stages = r.stages || {};
  for (const stage of STAGES) {
    if (!(stage in stages)) { bad('STAGE_MISSING', `the ${stage} stage is not accounted for`); continue; }
    out.push(...stageProblems(stages[stage], `stages.${stage}`));
  }
  // A handoff record describes work started on one surface and resumed on another.
  if (r.handoff) {
    const h = r.handoff;
    if (!SURFACES.includes(h.from) || !SURFACES.includes(h.to)) bad('HANDOFF_INVALID', 'a handoff names the surface it came from and the one it went to');
    else if (h.from === h.to) bad('HANDOFF_INVALID', 'a handoff between one surface and itself is not a handoff');
    if (h.conversational_recap !== false) bad('HANDOFF_INVALID', 'the handoff must recover context from files; a conversational recap is not the thing being tested');
    if (h.observed === true) {
      if (!Array.isArray(h.artifacts) || !h.artifacts.length) bad('ARTIFACT_MISSING', 'an observed handoff names its artifacts');
      else h.artifacts.forEach((ref, i) => out.push(...referenceProblems(ref, `handoff.artifacts[${i}]`)));
      if (!isStr(h.authorization_preserved, 1000)) bad('AUTHORIZATION_MISSING', 'the handoff records how the existing authorization survived it');
    } else if (!isStr(h.reason, 1000)) bad('REASON_REQUIRED', 'an unobserved handoff says what is missing');
  }
  // The support matrix: every row says how strongly it is supported, and an `observed`
  // row names the artifact that shows it. Packaged parity is `installed`, never
  // `observed` — that substitution is the claim this record exists to prevent.
  if (Array.isArray(r.support)) {
    for (const [i, row] of r.support.entries()) {
      const where = `support[${i}]`;
      if (!SURFACES.includes(row.surface)) bad('SUPPORT_INVALID', `${where}: surface must be one of ${SURFACES.join(', ')}`);
      if (!isStr(row.capability, 500)) bad('SUPPORT_INVALID', `${where}: needs a capability`);
      if (!SUPPORT.includes(row.support)) bad('SUPPORT_INVALID', `${where}: support must be one of ${SUPPORT.join(', ')}`);
      if (row.support === 'observed') {
        if (!Array.isArray(row.evidence) || !row.evidence.length) bad('SUPPORT_UNEVIDENCED', `${where}: an observed capability names the artifact that shows it`);
        else row.evidence.forEach((ref, j) => out.push(...referenceProblems(ref, `${where}.evidence[${j}]`)));
        if (!isStr(row.version, 200)) bad('SUPPORT_UNEVIDENCED', `${where}: an observed capability names the version it was observed on`);
        if (row.basis === 'packaged-parity') bad('SUPPORT_SUBSTITUTED', `${where}: packaged parity is an installation check, not a live observation; this row is "installed", not "observed"`);
      }
      if (row.support === 'installed' && !isStr(row.basis, 500)) bad('SUPPORT_INVALID', `${where}: an installed row says what was installed and checked`);
      if (row.support === 'unobserved' && !isStr(row.reason, 500)) bad('SUPPORT_INVALID', `${where}: an unobserved row says why`);
    }
    // A record claiming a surface is supported must have a row for it.
    if (r.observed === true && !r.support.some(row => row.surface === r.surface)) bad('SUPPORT_INVALID', `the support matrix has no row for ${r.surface}`);
  } else if (r.kind === 'platform') bad('RECORD_INVALID', 'support must be an array');
  return out;
}

// --- Comparison (R-09) -------------------------------------------------------------------
function comparisonProblems(r) {
  const out = [];
  const bad = (code, detail) => out.push({ code, detail });
  // Paired baseline-versus-improved pilots.
  if (!Array.isArray(r.pairs)) bad('RECORD_INVALID', 'pairs must be an array');
  else for (const [i, pair] of r.pairs.entries()) {
    const where = `pairs[${i}]`;
    if (!isStr(pair.task, 500)) bad('PAIR_INVALID', `${where}: needs a task`);
    for (const side of ['baseline', 'improved']) {
      const s = pair[side];
      if (!s || typeof s !== 'object') { bad('PAIR_INVALID', `${where}.${side}: missing`); continue; }
      // A kit digest is only knowable once the side has run — the improved kit is not
      // pinned until the v7 candidate is identified. The moment a side claims to have
      // been observed, the digest is what makes the comparison a comparison.
      if (s.observed === true) {
        if (!isHex64(s.kit)) bad('PAIR_INVALID', `${where}.${side}: names the kit digest it ran`);
        if (!isNum(s.operations)) bad('PAIR_INVALID', `${where}.${side}: records the workflow operations counted`);
      } else {
        if (s.kit !== null && s.kit !== undefined && !isHex64(s.kit)) bad('PAIR_INVALID', `${where}.${side}: kit must be a 64-hex digest or null until it runs`);
        if (!isStr(s.reason, 1000)) bad('REASON_REQUIRED', `${where}.${side}: an unobserved side says why`);
      }
    }
    // Two sides pinned to the same kit compare nothing. Both null is not that: it is a
    // pair that has not run, which the reasons above already account for.
    if (pair.baseline && pair.improved && isHex64(pair.baseline.kit) && pair.baseline.kit === pair.improved.kit) {
      bad('PAIR_INVALID', `${where}: both sides name the same kit, so the pair compares nothing`);
    }
    // Learning effects are a threat to a repeated task; the record must state the order.
    if (!['baseline-first', 'improved-first'].includes(pair.order)) bad('PAIR_INVALID', `${where}: order must record which side ran first, so learning effects are visible`);
  }
  // Timed independent reviews.
  if (!Array.isArray(r.reviews)) bad('RECORD_INVALID', 'reviews must be an array');
  else {
    for (const [i, review] of r.reviews.entries()) {
      const where = `reviews[${i}]`;
      if (!isStr(review.reviewer, 200)) bad('REVIEW_INVALID', `${where}: needs a reviewer pseudonym`);
      if (review.implemented_candidate !== false) bad('REVIEW_NOT_INDEPENDENT', `${where}: a reviewer who implemented the candidate is not an independent reviewer`);
      if (!isStr(review.task, 500)) bad('REVIEW_INVALID', `${where}: names the task reviewed`);
      if (!['accept', 'reject'].includes(review.decision)) bad('REVIEW_INVALID', `${where}: decision must be accept or reject`);
      // Minutes are the measure the v6 study never took. Null keeps its reason and is
      // never rewritten to zero.
      if (review.minutes === null) {
        if (!isStr(review.minutes_unavailable, 500)) bad('REASON_REQUIRED', `${where}: null minutes needs a reason; missing review time is not zero`);
      } else if (!isNum(review.minutes) || review.minutes === 0) bad('REVIEW_INVALID', `${where}: minutes must be a positive number, or null with a reason`);
      if (!Number.isInteger(review.confidence) || review.confidence < 1 || review.confidence > 5) bad('REVIEW_INVALID', `${where}: confidence is 1..5 on the frozen rubric`);
      if (!Array.isArray(review.missed_faults)) bad('REVIEW_INVALID', `${where}: missed_faults must be an array, empty if none were missed`);
      if (!['baseline', 'improved', 'blinded'].includes(review.arm_known)) bad('REVIEW_INVALID', `${where}: arm_known records whether the reviewer could tell which arm this was`);
      if (!Number.isInteger(review.order) || review.order < 1) bad('REVIEW_INVALID', `${where}: order records this review's position for the reviewer`);
      if (review.prior_exposure !== true && review.prior_exposure !== false) bad('REVIEW_INVALID', `${where}: prior_exposure records whether the reviewer had seen this task`);
    }
    const reviewers = new Set(r.reviews.map(x => x.reviewer));
    if (r.observed === true && reviewers.size < 2) bad('REVIEW_NOT_INDEPENDENT', `at least two non-implementing reviewers are required (saw ${reviewers.size})`);
  }
  // The predeclared targets are each assessed, and a missed target is a finding.
  if (!Array.isArray(r.targets)) bad('RECORD_INVALID', 'targets must be an array');
  else for (const [i, t] of r.targets.entries()) {
    const where = `targets[${i}]`;
    if (!isStr(t.target, 500)) bad('TARGET_INVALID', `${where}: names the predeclared target`);
    if (!['met', 'missed', 'outstanding'].includes(t.result)) bad('TARGET_INVALID', `${where}: result must be met, missed or outstanding`);
    if (t.result !== 'outstanding' && !isStr(t.basis, 2000)) bad('TARGET_INVALID', `${where}: a decided target says what it was decided on`);
    if (t.result === 'outstanding' && !isStr(t.reason, 1000)) bad('REASON_REQUIRED', `${where}: an outstanding target says what is missing`);
    if (t.result === 'missed' && t.suppressed === true) bad('RESULT_SUPPRESSED', `${where}: a missed target is a product finding, not permission to suppress it`);
  }
  // Denominators: a comparison that quietly drops runs is worse than no comparison.
  const runs = r.runs || {};
  if (r.observed === true) {
    for (const key of ['scheduled', 'completed', 'invalid', 'outstanding']) {
      if (!Number.isInteger(runs[key]) || runs[key] < 0) bad('DENOMINATOR_MISSING', `runs.${key} must be an integer; a rate without its denominator hides what is missing`);
    }
    if (Number.isInteger(runs.scheduled) && runs.scheduled !== 72) bad('SCHEDULE_INCOMPLETE', `the frozen schedule is 72 runs; a smaller study needs an explicit recorded scope revision (saw ${runs.scheduled})`);
    if ([runs.completed, runs.invalid, runs.outstanding].every(Number.isInteger) && runs.completed + runs.invalid + runs.outstanding !== runs.scheduled) {
      bad('DENOMINATOR_MISSING', `runs do not account for the schedule: ${runs.completed} + ${runs.invalid} + ${runs.outstanding} ≠ ${runs.scheduled}`);
    }
    if (Number.isInteger(runs.outstanding) && runs.outstanding > 0 && r.status === 'complete') {
      bad('SCHEDULE_INCOMPLETE', `${runs.outstanding} run(s) are outstanding, so the comparison is partial, not complete`);
    }
  }
  return out;
}

// A one-line verdict for a set of records. Deliberately says RECORD_VALID rather than
// anything resembling "observed": the strongest thing this module can conclude is that
// the records are well formed.
function verdict(records) {
  const all = records.map(r => ({ id: r.id, kind: r.kind, observed: r.observed === true, status: r.status, problems: problems(r) }));
  const invalid = all.filter(r => r.problems.length);
  return {
    code: invalid.length ? 'RECORD_INVALID' : 'RECORD_VALID',
    records: all.length,
    observed: all.filter(r => r.observed).length,
    outstanding: all.filter(r => !r.observed).length,
    invalid: invalid.map(r => ({ id: r.id, problems: r.problems })),
    note: 'record validity is a property of the records. It does not establish that a session happened, that an agent complied, or that a reviewer judged correctly; those are read from the linked session, evaluator and reviewer artifacts.',
  };
}

module.exports = {
  SCHEMA, KINDS, STAGES, STAGE_STATES, STATUSES, SURFACES, SUPPORT,
  sha256, referenceProblems, stageProblems, problems, pilotProblems, platformProblems, comparisonProblems, verdict,
};
