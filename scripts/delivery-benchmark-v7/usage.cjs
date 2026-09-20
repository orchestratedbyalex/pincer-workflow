'use strict';
// Retained final results are the sole accounting source. Intermediate usage and
// wall-clock durations have different scopes and must never repair missing fields.
//
// Two readers, one per measurement profile. `claude-code-result-modelusage-v1` reads every
// retained API-key record (its `cost_usd` is a legacy list-price estimate). The native profile
// `claude-code-result-native-usage-v1` (T-121) keeps the token and provider-time rules and
// replaces the cost metric with `estimate_usd` plus a billing block: under a subscription no
// charge is attributable, which is expected and valid; a missing mandatory capture is not.
// Records of the two profiles are never pooled.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { contained } = require('./run-claims.cjs');
const { secretIn } = require('./freeze.cjs');
const PROFILE = 'claude-code-result-modelusage-v1';
const NATIVE_PROFILE = 'claude-code-result-native-usage-v1';
const KEYS = ['tokens', 'cost_usd', 'provider_minutes'];
const NATIVE_KEYS = ['tokens', 'estimate_usd', 'provider_minutes'];
const BILLING_MODES = ['subscription', 'api'];
const CHARGE_REASONS = {
  SUBSCRIPTION_NOT_ATTRIBUTABLE: 'accounting: no attributable charge under subscription billing (SUBSCRIPTION_NOT_ATTRIBUTABLE); the list-price estimate is reported as estimate_usd and is not a cost',
  CHARGE_EVIDENCE_MISSING: 'accounting: api billing without retained charge evidence (CHARGE_EVIDENCE_MISSING); the list-price estimate is reported as estimate_usd and is not a cost',
  AMBIGUOUS_BILLING: 'accounting: the billing mode is not declared (AMBIGUOUS_BILLING); no charge or estimate may be attributed',
};
const TOKEN_FIELDS = ['inputTokens', 'outputTokens', 'cacheReadInputTokens', 'cacheCreationInputTokens'];
const SUBTYPES = ['success', 'error_during_execution', 'error_max_turns', 'error_max_budget_usd', 'error_max_structured_output_retries'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const observation = (value, reason = null) => ({ value, reason });
const profileOf = record => (record?.environment?.measurement_profile === NATIVE_PROFILE ? NATIVE_PROFILE : PROFILE);
const keysFor = profile => (profile === NATIVE_PROFILE ? NATIVE_KEYS : KEYS);
const costKeyFor = profile => (profile === NATIVE_PROFILE ? 'estimate_usd' : 'cost_usd');
const absent = (reason, profile = PROFILE) => Object.fromEntries(keysFor(profile).map(key => [key, observation(null, reason)]));
function parse(payload, profile = PROFILE) {
  const costKey = costKeyFor(profile);
  if (!object(payload) || payload.type !== 'result' || !SUBTYPES.includes(payload.subtype) ||
      (payload.is_error !== undefined && payload.is_error !== (payload.subtype !== 'success'))) {
    return absent('Unsupported or incomplete final result envelope.', profile);
  }
  const metrics = absent('Provider field missing or invalid.', profile);
  if (number(payload.total_cost_usd)) metrics[costKey] = observation(payload.total_cost_usd);
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
      if (!modelCosts.every(number) || !Number.isFinite(sum) || (metrics[costKey].value !== null && Math.abs(sum - payload.total_cost_usd) > 1e-8 * Math.max(1, sum))) {
        metrics[costKey] = observation(null, 'Per-model and final cost fields are invalid or inconsistent.');
      }
    }
  }
  // Execution crashes can emit placeholder zero counters despite incurred usage.
  if (payload.subtype === 'error_during_execution') {
    for (const key of keysFor(profile)) {
      if (metrics[key].value === 0) metrics[key] = observation(null, 'Execution-error zero may be a placeholder for unreported usage.');
    }
  }
  return metrics;
}
// The billing block of a native record: declared mode, never a computed charge. The charge
// itself is imported as evidence by a later ticket; this reader only labels its absence.
function billingFor(record) {
  const declared = record?.environment?.billing;
  const mode = BILLING_MODES.includes(declared?.mode) ? declared.mode : null;
  const charge_reason = mode === null ? 'AMBIGUOUS_BILLING' : mode === 'subscription' ? 'SUBSCRIPTION_NOT_ATTRIBUTABLE' : 'CHARGE_EVIDENCE_MISSING';
  return { mode, attributable_charge_usd: null, charge_reason, charge_evidence: null };
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
function summarize(sessions, coverage = 'attempt-ledger', profile = PROFILE) {
  const metrics = {};
  for (const key of keysFor(profile)) {
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
  const profile = profileOf(record);
  const inodes = new Set();
  const sessions = references(record, names).map(ref => {
    const file = contained(root, ref.payload);
    let bytes;
    let text;
    let digest = null;
    let metrics;
    try {
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.size > 32 * 1024 * 1024) throw new Error('unsupported artifact');
      const inode = `${stat.dev}:${stat.ino}`;
      if (inodes.has(inode)) throw new Error('duplicate artifact');
      inodes.add(inode);
      bytes = fs.readFileSync(file);
    } catch (error) {
      if (error.message === 'duplicate artifact') throw new Error('Usage sessions alias the same payload artifact.');
      metrics = absent('Saved payload is missing, unreadable or unsupported.', profile);
    }
    if (bytes !== undefined) {
      try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
      catch { metrics = absent('Saved payload contains invalid UTF-8.', profile); }
    }
    if (text !== undefined) {
      if (secretIn(text)) metrics = absent('Saved payload contains secret material; accounting metadata withheld.', profile);
      else {
        digest = crypto.createHash('sha256').update(bytes).digest('hex');
        try { metrics = parse(JSON.parse(text), profile); }
        catch { metrics = absent('Saved payload is malformed JSON.', profile); }
      }
    }
    return { ...ref, sha256: digest, metrics };
  });
  const coverage = coverageFor(record);
  const measurement = {
    schema: 1, profile,
    coverage,
    sessions, metrics: summarize(sessions, coverage, profile),
    ...(profile === NATIVE_PROFILE ? { billing: billingFor(record) } : {}),
  };
  const reported = {};
  const unavailable = {};
  for (const key of keysFor(profile)) {
    reported[key] = measurement.metrics[key].total;
    if (reported[key] === null) unavailable[key] = measurement.metrics[key].missing.map(item => `${item.session || 'accounting'}: ${item.reason}`).join('; ').slice(0, 500);
  }
  if (profile === NATIVE_PROFILE) {
    // The legacy cost column is never filled from an estimate: null, with the billing reason.
    reported.cost_usd = null;
    unavailable.cost_usd = CHARGE_REASONS[measurement.billing.charge_reason];
  }
  return { measurement, reported, unavailable };
}
function apply(record, result) {
  record.measurement = result.measurement;
  record.reported = result.reported;
  for (const key of [...KEYS, ...NATIVE_KEYS]) delete record.unavailable[key];
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
    const profile = profileOf(record);
    const keys = keysFor(profile);
    if (!object(m) || m.schema !== 1 || ![PROFILE, NATIVE_PROFILE].includes(m.profile) || !Array.isArray(m.sessions)) throw new Error('Unsupported measurement version/profile.');
    if (m.profile !== profile) throw new Error('Measurement profile does not match the record environment profile; legacy and native records are never pooled.');
    if (Object.keys(m).sort().join(',') !== (profile === NATIVE_PROFILE ? 'billing,coverage,metrics,profile,schema,sessions' : 'coverage,metrics,profile,schema,sessions')) throw new Error('Unexpected measurement fields.');
    if (m.coverage !== coverageFor(record)) throw new Error('Accounting coverage does not match record schema.');
    const refs = references(record, m.sessions.map(session => session.id.replace(/^legacy:/, '')));
    if (canonical(refs) !== canonical(m.sessions.map(({ id, payload }) => ({ id, payload })))) throw new Error('Accounting sessions do not match the complete attempt ledger.');
    for (const row of m.sessions) {
      if (Object.keys(row).sort().join(',') !== 'id,metrics,payload,sha256' || !(row.sha256 === null || /^[a-f0-9]{64}$/.test(row.sha256))) throw new Error('Invalid payload metadata.');
      if (!object(row.metrics) || Object.keys(row.metrics).sort().join(',') !== [...keys].sort().join(',')) throw new Error('Invalid metric fields.');
      for (const key of keys) {
        const item = row.metrics[key];
        if (!object(item) || Object.keys(item).sort().join(',') !== 'reason,value') throw new Error('Invalid metric observation.');
        if (item.value === null) {
          if (typeof item.reason !== 'string' || !item.reason || item.reason.length > 500 || secretIn(item.reason)) throw new Error('Unavailable metric needs a bounded non-secret reason.');
        } else if (!number(item.value) || (key === 'tokens' && !Number.isSafeInteger(item.value)) || item.reason !== null || row.sha256 === null) throw new Error('Invalid measured metric.');
      }
    }
    if (canonical(m.metrics) !== canonical(summarize(m.sessions, m.coverage, profile))) throw new Error('Accounting totals, subtotals or completeness are inconsistent.');
    for (const key of keys) {
      if (record.reported[key] !== m.metrics[key].total) throw new Error('Reported metric differs from accounting total.');
      const reason = m.metrics[key].missing.map(item => `${item.session || 'accounting'}: ${item.reason}`).join('; ').slice(0, 500);
      if (m.metrics[key].total === null && record.unavailable[key] !== reason) throw new Error('Accounting unavailable reason differs from observations.');
    }
    if (profile === NATIVE_PROFILE) {
      if (canonical(m.billing) !== canonical(billingFor(record))) throw new Error('Billing block differs from the declared billing mode; a charge is never computed here.');
      if (m.billing.mode === null) throw new Error('AMBIGUOUS_BILLING: the record declares no billing mode.');
      if (record.reported.cost_usd !== null || record.unavailable.cost_usd !== CHARGE_REASONS[m.billing.charge_reason]) throw new Error('A native record must report cost_usd as unavailable with its billing reason; the estimate is not a cost.');
    }
    return [];
  } catch (error) {
    return [{ code: 'USAGE_INVALID', detail: error.message }];
  }
}
module.exports = { PROFILE, NATIVE_PROFILE, KEYS, NATIVE_KEYS, BILLING_MODES, CHARGE_REASONS, profileOf, keysFor, parse, billingFor, references, summarize, collect, apply, problems };
