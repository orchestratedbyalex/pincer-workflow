'use strict';
// Retained final results are the sole accounting source. Intermediate usage and
// wall-clock durations have different scopes and must never repair missing fields.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { contained } = require('./run-claims.cjs');
const { secretIn } = require('./freeze.cjs');
const PROFILE = 'claude-code-result-modelusage-v1';
const KEYS = ['tokens', 'cost_usd', 'provider_minutes'];
const TOKEN_FIELDS = ['inputTokens', 'outputTokens', 'cacheReadInputTokens', 'cacheCreationInputTokens'];
const SUBTYPES = ['success', 'error_during_execution', 'error_max_turns', 'error_max_budget_usd', 'error_max_structured_output_retries'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const observation = (value, reason = null) => ({ value, reason });
const absent = reason => Object.fromEntries(KEYS.map(key => [key, observation(null, reason)]));
function parse(payload) {
  if (!object(payload) || payload.type !== 'result' || !SUBTYPES.includes(payload.subtype) ||
      (payload.is_error !== undefined && payload.is_error !== (payload.subtype !== 'success'))) {
    return absent('Unsupported or incomplete final result envelope.');
  }
  const metrics = absent('Provider field missing or invalid.');
  if (number(payload.total_cost_usd)) metrics.cost_usd = observation(payload.total_cost_usd);
  if (number(payload.duration_api_ms)) metrics.provider_minutes = observation(payload.duration_api_ms / 60000);
  if (object(payload.modelUsage) && Object.keys(payload.modelUsage).length) {
    let tokens = 0;
    let valid = true;
    for (const model of Object.values(payload.modelUsage)) {
      for (const field of TOKEN_FIELDS) {
        if (!object(model) || !Number.isSafeInteger(model[field]) || model[field] < 0) valid = false;
        else tokens += model[field];
      }
    }
    if (valid && Number.isSafeInteger(tokens)) metrics.tokens = observation(tokens);
    const modelCosts = Object.values(payload.modelUsage).map(model => model?.costUSD);
    if (modelCosts.some(value => value !== undefined)) {
      const sum = modelCosts.reduce((a, b) => a + b, 0);
      if (!modelCosts.every(number) || !Number.isFinite(sum) || (metrics.cost_usd.value !== null && Math.abs(sum - payload.total_cost_usd) > 1e-8 * Math.max(1, sum))) {
        metrics.cost_usd = observation(null, 'Per-model and final cost fields are invalid or inconsistent.');
      }
    }
  }
  // Execution crashes can emit placeholder zero counters despite incurred usage.
  if (payload.subtype === 'error_during_execution') {
    for (const key of KEYS) {
      if (metrics[key].value === 0) metrics[key] = observation(null, 'Execution-error zero may be a placeholder for unreported usage.');
    }
  }
  return metrics;
}
function references(record, names = []) {
  const refs = record.schema === 8
    ? record.attempts.flatMap(attempt => attempt.sessions.map(session => ({ id: session.id, payload: session.payload })))
    : names.map(name => ({ id: `legacy:${name}`, payload: `${name}.json` }));
  const ids = new Set();
  const paths = new Set();
  for (const ref of refs) {
    if (!/^(?:attempt-[0-9]{6}|legacy-000001|legacy):S[1-9][0-9]*$/.test(ref.id) || typeof ref.payload !== 'string' || secretIn(ref.payload) || ids.has(ref.id) || paths.has(ref.payload)) {
      throw new Error('Usage session identities and payload paths must be unique and non-secret.');
    }
    if (ref.payload.startsWith('/') || ref.payload.includes('\\') || ref.payload.split('/').some(part => !part || part === '.' || part === '..')) {
      throw new Error('Usage requires a contained relative payload path.');
    }
    if (/(?:^|\/)(?:\.env(?:\.[^/]*)?|\.credentials\.json|auth\.json|credentials(?:\.json)?|\.npmrc|\.netrc|id_rsa|id_ed25519|\.ssh|\.aws)(?:\/|$)/i.test(ref.payload)) {
      throw new Error('Usage payload names a protected configuration path.');
    }
    ids.add(ref.id);
    paths.add(ref.payload);
  }
  return refs;
}
function coverageFor(record) {
  if (record.schema !== 8) return 'explicit-legacy-session-list';
  return record.attempts.some(attempt => attempt.origin === 'legacy') ? 'legacy-attempt-coverage-unknown' : 'attempt-ledger';
}
function summarize(sessions, coverage = 'attempt-ledger') {
  const metrics = {};
  for (const key of KEYS) {
    const measured = sessions.filter(session => session.metrics[key].value !== null);
    const subtotal = measured.reduce((sum, session) => sum + session.metrics[key].value, 0);
    const safe = number(subtotal) && (key !== 'tokens' || Number.isSafeInteger(subtotal));
    const missing = sessions.filter(session => session.metrics[key].value === null).map(session => ({ session: session.id, reason: session.metrics[key].reason }));
    if (coverage !== 'attempt-ledger') missing.push({ session: null, reason: 'Historical attempt coverage is unknown; values cover only the explicitly retained sessions.' });
    if (!sessions.length) missing.push({ session: null, reason: 'No session accounting observations are available.' });
    if (!safe) missing.push({ session: null, reason: 'Measured subtotal exceeds the supported numeric range.' });
    metrics[key] = {
      total: missing.length ? null : subtotal,
      measured_subtotal: measured.length && safe ? subtotal : null,
      measured_sessions: measured.length,
      expected_sessions: sessions.length,
      complete: missing.length === 0,
      missing,
    };
  }
  return metrics;
}
function collect(root, record, names = []) {
  const inodes = new Set();
  const sessions = references(record, names).map(ref => {
    const file = contained(root, ref.payload);
    let text;
    let digest = null;
    let metrics;
    try {
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.size > 32 * 1024 * 1024) throw new Error('unsupported artifact');
      const inode = `${stat.dev}:${stat.ino}`;
      if (inodes.has(inode)) throw new Error('duplicate artifact');
      inodes.add(inode);
      text = fs.readFileSync(file, 'utf8');
    } catch (error) {
      if (error.message === 'duplicate artifact') throw new Error('Usage sessions alias the same payload artifact.');
      metrics = absent('Saved payload is missing, unreadable or unsupported.');
    }
    if (text !== undefined) {
      if (secretIn(text)) metrics = absent('Saved payload contains secret material; accounting metadata withheld.');
      else {
        digest = crypto.createHash('sha256').update(text).digest('hex');
        try { metrics = parse(JSON.parse(text)); }
        catch { metrics = absent('Saved payload is malformed JSON.'); }
      }
    }
    return { ...ref, sha256: digest, metrics };
  });
  const measurement = {
    schema: 1, profile: PROFILE,
    coverage: coverageFor(record),
    sessions, metrics: summarize(sessions, coverageFor(record)),
  };
  const reported = {};
  const unavailable = {};
  for (const key of KEYS) {
    reported[key] = measurement.metrics[key].total;
    if (reported[key] === null) unavailable[key] = measurement.metrics[key].missing.map(item => `${item.session || 'accounting'}: ${item.reason}`).join('; ').slice(0, 500);
  }
  return { measurement, reported, unavailable };
}
function apply(record, result) {
  record.measurement = result.measurement;
  record.reported = result.reported;
  for (const key of KEYS) delete record.unavailable[key];
  Object.assign(record.unavailable, result.unavailable);
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function problems(record) {
  if (record.measurement === undefined) return [];
  try {
    const m = record.measurement;
    if (!object(m) || m.schema !== 1 || m.profile !== PROFILE || !Array.isArray(m.sessions)) throw new Error('Unsupported measurement version/profile.');
    if (Object.keys(m).sort().join(',') !== 'coverage,metrics,profile,schema,sessions') throw new Error('Unexpected measurement fields.');
    if (m.coverage !== coverageFor(record)) throw new Error('Accounting coverage does not match record schema.');
    const refs = references(record, m.sessions.map(session => session.id.replace(/^legacy:/, '')));
    if (canonical(refs) !== canonical(m.sessions.map(({ id, payload }) => ({ id, payload })))) throw new Error('Accounting sessions do not match the complete attempt ledger.');
    for (const row of m.sessions) {
      if (Object.keys(row).sort().join(',') !== 'id,metrics,payload,sha256' || !(row.sha256 === null || /^[a-f0-9]{64}$/.test(row.sha256))) throw new Error('Invalid payload metadata.');
      if (!object(row.metrics) || Object.keys(row.metrics).sort().join(',') !== [...KEYS].sort().join(',')) throw new Error('Invalid metric fields.');
      for (const key of KEYS) {
        const item = row.metrics[key];
        if (!object(item) || Object.keys(item).sort().join(',') !== 'reason,value') throw new Error('Invalid metric observation.');
        if (item.value === null) {
          if (typeof item.reason !== 'string' || !item.reason || item.reason.length > 500 || secretIn(item.reason)) throw new Error('Unavailable metric needs a bounded non-secret reason.');
        } else if (!number(item.value) || (key === 'tokens' && !Number.isSafeInteger(item.value)) || item.reason !== null || row.sha256 === null) throw new Error('Invalid measured metric.');
      }
    }
    if (canonical(m.metrics) !== canonical(summarize(m.sessions, m.coverage))) throw new Error('Accounting totals, subtotals or completeness are inconsistent.');
    for (const key of KEYS) {
      if (record.reported[key] !== m.metrics[key].total) throw new Error('Reported metric differs from accounting total.');
      const reason = m.metrics[key].missing.map(item => `${item.session || 'accounting'}: ${item.reason}`).join('; ').slice(0, 500);
      if (m.metrics[key].total === null && record.unavailable[key] !== reason) throw new Error('Accounting unavailable reason differs from observations.');
    }
    return [];
  } catch (error) {
    return [{ code: 'USAGE_INVALID', detail: error.message }];
  }
}
module.exports = { PROFILE, KEYS, parse, references, summarize, collect, apply, problems };
